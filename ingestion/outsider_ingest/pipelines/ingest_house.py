"""Ingest US House STOCK Act PTRs (politicians) — best-effort.

Downloads the yearly index ZIP, lists Periodic Transaction Reports, fetches the
most recent PDFs, and extracts transactions via parse/house_ptr.py. Scanned
(image-only) PDFs are skipped until OCR is added, so coverage starts partial.
Capped to the newest PTRs so a daily run stays bounded. Pelosi is flagged as
highlight.

Run:
  PYTHONPATH=. DATABASE_URL=... python3 -m outsider_ingest.pipelines.ingest_house --year 2026
"""

from __future__ import annotations

import argparse
import re
from datetime import date, datetime

from outsider_ingest import config
from outsider_ingest.db import Repository, connect
from outsider_ingest.parse.house_ptr import extract_transactions


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def _d(iso):
    if not iso:
        return None
    try:
        return datetime.strptime(iso, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def ingest_house(year: int | None = None, max_ptrs: int = 120) -> int:
    provider = config.get_filings_provider("house")
    refs = provider.list_filings("", ["P"], year=year)
    refs.sort(key=lambda r: (r.filed_at or date.min), reverse=True)  # newest first

    conn = connect(config.DATABASE_URL)
    repo = Repository(conn)

    n, skipped = 0, 0
    for ref in refs[:max_ptrs]:
        try:
            pdf = provider.fetch_document(ref)
            rows = extract_transactions(pdf)
        except Exception:  # noqa: BLE001 — one bad PDF must not stop the run
            skipped += 1
            continue
        if not rows:
            skipped += 1  # scanned or unparseable
            continue

        name = ref.external_entity_id  # "Last,First" from the index XML
        display = " ".join(reversed([p.strip() for p in name.split(",")])) if "," in name else name
        entity_id = repo.upsert_entity(
            "politician", display, slugify(display), {"doc_id": ref.accession},
            chamber="House", highlight="pelosi" in display.lower(),
        )
        filing_id = repo.insert_filing(
            "house_fd", "P", entity_id, ref.filed_at, None, ref.source_url
        )
        for r in rows:
            if not r.get("ticker"):
                continue
            sid = repo.upsert_security_by_ticker(r["ticker"], r.get("asset"))
            repo.insert_transaction(
                filing_id, entity_id, sid, r["txn_type"],
                txn_date=_d(r.get("txn_date")), disclosed_at=ref.filed_at,
                amount_min=r.get("amount_min"), amount_max=r.get("amount_max"),
            )
            n += 1
        repo.commit()
    print(f"House: {n} transactions from {len(refs[:max_ptrs])} recent PTRs "
          f"({skipped} skipped/scanned)")
    return n


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int)
    ap.add_argument("--max-ptrs", type=int, default=120)
    args = ap.parse_args()
    ingest_house(year=args.year, max_ptrs=args.max_ptrs)


if __name__ == "__main__":
    main()
