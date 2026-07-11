"""SEC EDGAR adapter (FilingsProvider).

Free, no API key. SEC requires a descriptive User-Agent and asks for <=10
requests/sec. We send a real UA (from config.SEC_USER_AGENT) and self-throttle.

Implemented now: 13F-HR holdings (institutions). Form 4 (insiders) and
SC 13D/G reuse `list_filings` + `fetch_document`; their row-level parsers live
in parse/form4.py etc. (Phase: insiders — see task 8).

Endpoints (verified July 2026):
  submissions : https://data.sec.gov/submissions/CIK{cik10}.json
  filing dir  : https://www.sec.gov/Archives/edgar/data/{cik}/{accession_nodash}/
  dir index   : {filing_dir}index.json
"""

from __future__ import annotations

import time
from datetime import date, datetime
from typing import Optional, Sequence

import requests

from outsider_ingest.models import Holding13F
from outsider_ingest.parse.form13f import (
    infer_values_in_thousands,
    parse_information_table,
)
from outsider_ingest.providers.base import FilingRef, FilingsProvider

SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik10}.json"
ARCHIVE_DIR = "https://www.sec.gov/Archives/edgar/data/{cik}/{acc}/"


def _to_date(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError:
        return None


class SecEdgarProvider(FilingsProvider):
    source = "sec_edgar"

    def __init__(
        self,
        user_agent: str,
        min_interval_s: float = 0.15,   # ~6.6 req/s, comfortably under SEC's 10
        max_retries: int = 4,
        session: Optional[requests.Session] = None,
    ):
        if not user_agent or "@" not in user_agent:
            raise ValueError(
                "SEC requires a descriptive User-Agent like "
                "'Outsider/0.1 you@example.com'. Set SEC_USER_AGENT."
            )
        self.user_agent = user_agent
        self.min_interval_s = min_interval_s
        self.max_retries = max_retries
        self._last_req = 0.0
        self.session = session or requests.Session()
        self.session.headers.update(
            {"User-Agent": user_agent, "Accept-Encoding": "gzip, deflate"}
        )

    # --- low-level polite GET --------------------------------------------------

    def _get(self, url: str) -> requests.Response:
        for attempt in range(self.max_retries):
            gap = time.monotonic() - self._last_req
            if gap < self.min_interval_s:
                time.sleep(self.min_interval_s - gap)
            resp = self.session.get(url, timeout=30)
            self._last_req = time.monotonic()
            if resp.status_code == 429 or resp.status_code >= 500:
                time.sleep(min(2 ** attempt, 8))
                continue
            resp.raise_for_status()
            return resp
        resp.raise_for_status()
        return resp

    # --- FilingsProvider -------------------------------------------------------

    @staticmethod
    def _cik10(cik: str) -> str:
        return str(cik).lstrip("CIK").strip().zfill(10)

    def get_submissions(self, cik: str) -> dict:
        return self._get(SUBMISSIONS_URL.format(cik10=self._cik10(cik))).json()

    def list_filings(
        self,
        external_entity_id: str,
        form_types: Sequence[str],
        since: Optional[date] = None,
    ) -> list[FilingRef]:
        data = self.get_submissions(external_entity_id)
        recent = data.get("filings", {}).get("recent", {})
        forms = recent.get("form", [])
        accs = recent.get("accessionNumber", [])
        filed = recent.get("filingDate", [])
        periods = recent.get("reportDate", [])
        primary = recent.get("primaryDocument", [])
        cik = str(int(self._cik10(external_entity_id)))
        wanted = {f.upper() for f in form_types}

        out: list[FilingRef] = []
        for i, form in enumerate(forms):
            if form.upper() not in wanted:
                continue
            filed_at = _to_date(filed[i]) if i < len(filed) else None
            if since and filed_at and filed_at < since:
                continue
            acc = accs[i]
            acc_nodash = acc.replace("-", "")
            out.append(
                FilingRef(
                    source=self.source,
                    form_type=form,
                    external_entity_id=external_entity_id,
                    accession=acc,
                    filed_at=filed_at,
                    period_of_report=_to_date(periods[i]) if i < len(periods) else None,
                    source_url=ARCHIVE_DIR.format(cik=cik, acc=acc_nodash),
                    primary_document=primary[i] if i < len(primary) else None,
                )
            )
        return out

    def _dir_index(self, ref: FilingRef) -> list[dict]:
        return self._get(ref.source_url + "index.json").json()["directory"]["item"]

    def _find_information_table(self, ref: FilingRef) -> Optional[str]:
        """Return the filename of the 13F information table within a filing.

        Filenames vary by filer: infotable.xml, informationtable.xml,
        form13fInfoTable.xml, ... so we match by pattern, never hard-code.
        """
        candidates = []
        for item in self._dir_index(ref):
            name = item.get("name", "")
            low = name.lower()
            if not low.endswith(".xml") or "primary_doc" in low:
                continue
            if any(k in low for k in ("infotable", "informationtable", "form13finfo")):
                return name
            candidates.append(name)
        # fallback: the only other xml document
        return candidates[0] if len(candidates) == 1 else None

    def fetch_document(self, ref: FilingRef, filename: Optional[str] = None) -> bytes:
        name = filename or ref.primary_document
        if not name:
            raise ValueError("no document filename given and no primaryDocument on ref")
        return self._get(ref.source_url + name).content

    def get_13f_holdings(self, ref: FilingRef) -> list[Holding13F]:
        """Fetch + parse a 13F-HR filing's holdings, auto-scaling value units."""
        table_name = self._find_information_table(ref)
        if not table_name:
            return []
        xml = self._get(ref.source_url + table_name).content
        raw = parse_information_table(xml, values_in_thousands=False)
        if infer_values_in_thousands(raw):
            return parse_information_table(xml, values_in_thousands=True)
        return raw

    def _find_ownership_xml(self, ref: FilingRef) -> Optional[str]:
        """Filename of the Form 3/4/5 ownership XML (not the xsl-rendered copy)."""
        for item in self._dir_index(ref):
            name = item.get("name", "")
            low = name.lower()
            if not low.endswith(".xml") or "xsl" in low or low == "primary_doc.xml":
                continue
            if "form" in low or "ownership" in low or low.startswith(("wf-", "wk-", "edgar")):
                return name
        # fallback: first plain .xml that isn't the rendered/primary one
        for item in self._dir_index(ref):
            name = item.get("name", "")
            low = name.lower()
            if low.endswith(".xml") and "xsl" not in low and low != "primary_doc.xml":
                return name
        return None

    def get_form4(self, ref: FilingRef):
        """Fetch + parse a Form 4 ownership document into Form4Transaction rows."""
        from outsider_ingest.parse.form4 import parse_form4

        name = self._find_ownership_xml(ref)
        if not name:
            return []
        return parse_form4(self._get(ref.source_url + name).content)
