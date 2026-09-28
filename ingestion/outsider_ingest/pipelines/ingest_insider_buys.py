"""Market-wide open-market insider purchases (Form 4, code P).

The tracked-issuer import (ingest_form4) follows a handful of mega caps whose
insiders almost never buy on the open market, so "Insider greifen zu" stayed
nearly empty. This pipeline reads EDGAR's daily form index for every Form 4
filed on the last N days, fetches each complete submission once (the
ownership XML is embedded in it) and keeps only non-derivative purchases:
transaction code P, acquired (A), with a ticker and at least --min-value USD.

Rows use the same filing URL and source_line as ingest_form4, so a filing
that both imports see is stored once.

Run:
  PYTHONPATH=. SEC_USER_AGENT='Outsider/0.1 you@example.com' DATABASE_URL=... \
    python3 -m outsider_ingest.pipelines.ingest_insider_buys --days 4
  ... --days 30 --dry-run   # count and print, write nothing
"""

from __future__ import annotations

import argparse
import re
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Iterable, Optional

from outsider_ingest import config
from outsider_ingest.models import Form4Transaction
from outsider_ingest.parse.form4 import parse_form4

DAILY_INDEX = "https://www.sec.gov/Archives/edgar/daily-index/{y}/QTR{q}/form.{ymd}.idx"
SUBMISSION = "https://www.sec.gov/Archives/{path}"
ARCHIVE_DIR = "https://www.sec.gov/Archives/edgar/data/{cik}/{acc}/"
# "4   ACME CORP   1234567   20260925   edgar/data/1234567/0001234567-26-000123.txt"
INDEX_ROW = re.compile(r"^(4|4/A)\s+(.+?)\s+(\d+)\s+(\d{8})\s+(edgar/data/\d+/([\d-]+)\.txt)\s*$")
XML_BLOCK = re.compile(rb"<XML>\s*(.*?)\s*</XML>", re.S | re.I)


@dataclass(frozen=True)
class IndexEntry:
    form: str
    filed: date
    path: str
    accession: str


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def parse_daily_index(text: str) -> list[IndexEntry]:
    """Form 4 filings from a daily form.idx, once per accession.

    Each Form 4 is listed under the issuer and again under every reporting
    owner; the submission is the same file, so one entry is enough.
    """
    seen: dict[str, IndexEntry] = {}
    for line in text.splitlines():
        m = INDEX_ROW.match(line.rstrip())
        if not m:
            continue
        acc = m.group(6)
        if acc in seen:
            continue
        filed = datetime.strptime(m.group(4), "%Y%m%d").date()
        seen[acc] = IndexEntry(form=m.group(1), filed=filed, path=m.group(5), accession=acc)
    return list(seen.values())


def ownership_xml(submission: bytes) -> Optional[bytes]:
    """The ownershipDocument embedded in a complete submission text file."""
    for block in XML_BLOCK.findall(submission):
        if b"ownershipDocument" in block:
            start = block.find(b"<?xml")
            return block[start:] if start >= 0 else block
    return None


def purchases(txns: Iterable[Form4Transaction], min_value: float) -> list[Form4Transaction]:
    """Open-market buys only: code P, non-derivative, acquired, priced, with a ticker."""
    out = []
    for t in txns:
        if (t.code or "").upper() != "P" or t.is_derivative or (t.acquired_disposed or "A") != "A":
            continue
        if not t.ticker or not t.shares or not t.price:
            continue
        if t.shares * t.price < min_value:
            continue
        out.append(t)
    return out


def trading_days(end: date, days: int) -> list[date]:
    out, d = [], end
    while len(out) < days:
        if d.weekday() < 5:
            out.append(d)
        d -= timedelta(days=1)
    return out


class _Sec:
    """Polite EDGAR client: declared User-Agent, <= ~6.6 requests per second."""

    def __init__(self, user_agent: str, min_interval_s: float = 0.15):
        import requests

        if not user_agent or "@" not in user_agent:
            raise ValueError("Set SEC_USER_AGENT, e.g. 'Outsider/0.1 you@example.com' (SEC fair-access rule).")
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": user_agent, "Accept-Encoding": "gzip, deflate"})
        self.min_interval_s = min_interval_s
        self._last = 0.0

    def get(self, url: str, missing: tuple[int, ...] = (404,)) -> Optional[bytes]:
        for attempt in range(4):
            gap = time.monotonic() - self._last
            if gap < self.min_interval_s:
                time.sleep(self.min_interval_s - gap)
            resp = self.session.get(url, timeout=30)
            self._last = time.monotonic()
            if resp.status_code in missing:
                return None
            if resp.status_code == 429 or resp.status_code >= 500:
                time.sleep(min(2 ** attempt, 8))
                continue
            resp.raise_for_status()
            return resp.content
        return None


def ingest_insider_buys(days: int = 4, end: Optional[date] = None, min_value: float = 10_000,
                        max_filings: int = 12_000, dry_run: bool = False) -> int:
    sec = _Sec(config.SEC_USER_AGENT)
    # The daily index appears in the evening; start with the previous day.
    end = end or date.today() - timedelta(days=1)
    entries: list[IndexEntry] = []
    indexes = 0
    for d in trading_days(end, days):
        # Holidays and not-yet-published days answer 404 or 403.
        raw = sec.get(DAILY_INDEX.format(y=d.year, q=(d.month - 1) // 3 + 1, ymd=d.strftime("%Y%m%d")), missing=(403, 404))
        if raw:
            indexes += 1
            entries += parse_daily_index(raw.decode("latin-1"))
    if not indexes:
        raise RuntimeError("No EDGAR daily index could be read; check SEC_USER_AGENT and EDGAR access")
    entries = entries[:max_filings]

    repo = conn = None
    if not dry_run:
        from outsider_ingest.db import Repository, connect

        conn = connect(config.DATABASE_URL)
        repo = Repository(conn)

    scanned = found = failed = 0
    for entry in entries:
        scanned += 1
        try:
            raw = sec.get(SUBMISSION.format(path=entry.path))
            xml = ownership_xml(raw or b"")
            buys = purchases(parse_form4(xml), min_value) if xml else []
        except Exception:  # noqa: BLE001 — one malformed filing must not stop the scan
            failed += 1
            continue
        if not buys:
            continue
        found += len(buys)
        first = buys[0]
        if dry_run:
            for t in buys:
                print(f"  {entry.filed} {t.ticker:6} {t.owner_name[:32]:32} {t.shares:>12,.0f} @ {t.price:,.2f}  ({t.role})")
            continue
        slug = slugify(f"{first.owner_name}-{first.issuer_cik}")
        entity_id = repo.upsert_entity(
            "corporate_insider", first.owner_name or "Unknown insider", slug,
            {"issuer_cik": first.issuer_cik}, role=first.role, org_name=first.issuer_name,
        )
        source_url = ARCHIVE_DIR.format(cik=int(first.issuer_cik or 0), acc=entry.accession.replace("-", ""))
        filing_id = repo.insert_filing("sec_edgar", entry.form, entity_id, entry.filed, None, source_url)
        for t in buys:
            sid = repo.upsert_security_by_ticker(t.ticker, t.issuer_name)
            repo.insert_transaction(
                filing_id, entity_id, sid, "buy",
                txn_date=_d(t.txn_date), disclosed_at=entry.filed,
                shares=t.shares, price=t.price,
                transaction_code="P", is_derivative=False,
                acquired_disposed="A", source_line=t.source_line,
            )
        repo.commit()
    if conn is not None:
        conn.close()
    print(f"Insider purchases: {found} buys in {scanned} Form 4 filings over {days} trading days "
          f"({failed} unreadable){' — dry run, nothing written' if dry_run else ''}")
    if scanned and failed > scanned * 0.2:
        raise RuntimeError("More than 20% of Form 4 submissions could not be read; check EDGAR access")
    return found


def _d(s: Optional[str]) -> Optional[date]:
    try:
        return datetime.strptime(s, "%Y-%m-%d").date() if s else None
    except ValueError:
        return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=4, help="trading days back from --end")
    ap.add_argument("--end", type=lambda s: datetime.strptime(s, "%Y-%m-%d").date(), help="last day (default today)")
    ap.add_argument("--min-value", type=float, default=10_000)
    ap.add_argument("--max-filings", type=int, default=12_000)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    ingest_insider_buys(args.days, args.end, args.min_value, args.max_filings, args.dry_run)


if __name__ == "__main__":
    main()
