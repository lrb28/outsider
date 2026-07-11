"""US House financial-disclosure adapter (FilingsProvider) — free, no key.

Politician trades under the STOCK Act. Two-step, and the transactions live in
PDFs (the hard part):

  1. Yearly index ZIP (refreshed daily):
     https://disclosures-clerk.house.gov/public_disc/financial-pdfs/{YEAR}FD.zip
     -> contains {YEAR}FD.xml, an index of ALL filings. FilingType 'P' =
        Periodic Transaction Report (the trades). Fields incl. DocID, Name,
        StateDst, Year, FilingDate.
  2. Each PTR PDF:
     https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/{DocID}.pdf
     -> parse with pdfplumber; OCR fallback for scanned ones.

This is the most labor-intensive source, so it is sequenced AFTER 13F + Form 4
(task 8). `list_filings` (index) is sketched; PDF row parsing lives in
parse/house_ptr.py.
"""

from __future__ import annotations

import io
import zipfile
from datetime import date, datetime
from typing import Optional, Sequence

import requests
from lxml import etree

from outsider_ingest.providers.base import FilingRef, FilingsProvider

YEAR_ZIP = "https://disclosures-clerk.house.gov/public_disc/financial-pdfs/{year}FD.zip"
PTR_PDF = "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/{doc_id}.pdf"


class HouseDisclosureProvider(FilingsProvider):
    source = "house_fd"

    def __init__(self, user_agent: str = "Outsider/0.1 (+house-fd)"):
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": user_agent})

    def list_filings(
        self,
        external_entity_id: str,      # "" == all filers for the year
        form_types: Sequence[str],    # e.g. ["P"] for periodic transaction reports
        since: Optional[date] = None,
        year: Optional[int] = None,
    ) -> list[FilingRef]:
        year = year or (since.year if since else date.today().year)
        resp = self.session.get(YEAR_ZIP.format(year=year), timeout=60)
        resp.raise_for_status()
        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        xml_bytes = zf.read(f"{year}FD.xml")
        root = etree.fromstring(xml_bytes, parser=etree.XMLParser(recover=True))

        wanted = {f.upper() for f in form_types} if form_types else None
        out: list[FilingRef] = []
        for m in root.iter("Member"):
            def t(tag: str) -> Optional[str]:
                el = m.find(tag)
                return el.text.strip() if el is not None and el.text else None

            filing_type = t("FilingType")
            if wanted and (filing_type or "").upper() not in wanted:
                continue
            doc_id = t("DocID")
            if not doc_id:
                continue
            filed_at = _parse_house_date(t("FilingDate"))
            if since and filed_at and filed_at < since:
                continue
            out.append(
                FilingRef(
                    source=self.source,
                    form_type=filing_type or "P",
                    external_entity_id=external_entity_id or f"{t('Last')},{t('First')}",
                    accession=doc_id,
                    filed_at=filed_at,
                    period_of_report=None,
                    source_url=PTR_PDF.format(doc_id=doc_id),
                    primary_document=f"{doc_id}.pdf",
                )
            )
        return out

    def fetch_document(self, ref: FilingRef, filename: Optional[str] = None) -> bytes:
        resp = self.session.get(ref.source_url, timeout=60)
        resp.raise_for_status()
        return resp.content

    # NOTE: transaction extraction from the PDF is parse/house_ptr.py (task 8):
    #   text via pdfplumber; if a page yields no text it's scanned -> OCR.


def _parse_house_date(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    for fmt in ("%m/%d/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None
