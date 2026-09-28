"""Ingest US House STOCK Act PTRs (politicians) — best-effort.

Downloads the yearly index ZIP, lists Periodic Transaction Reports, fetches the
most recent PDFs, and extracts transactions via parse/house_ptr.py. Scanned
(image-only) PDFs are skipped until OCR is added, so coverage starts partial.
Capped to the newest PTRs so a daily run stays bounded. Pelosi is flagged as
highlight.

Each filer is matched to the official member list (providers/legislators) for
the official name, party, seat and Bioguide ID; the web app derives the public
domain portrait from the Bioguide ID. Filers who have left Congress keep the
name from the index.

Run:
  PYTHONPATH=. DATABASE_URL=... python3 -m outsider_ingest.pipelines.ingest_house --year 2026
  ... --year 2025 --year 2024 --dry-run   # parse and print, write nothing
"""

from __future__ import annotations

import argparse
import re
from datetime import date, datetime

from outsider_ingest import config
from outsider_ingest.parse.house_ptr import extract_transactions
from outsider_ingest.providers.legislators import Directory


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def _d(iso):
    if not iso:
        return None
    try:
        return datetime.strptime(iso, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def ingest_house(year: int | None = None, max_ptrs: int = 500, dry_run: bool = False,
                 directory: Directory | None = None) -> int:
    provider = config.get_filings_provider("house")
    refs = provider.list_filings("", ["P"], year=year)
    refs.sort(key=lambda r: (r.filed_at or date.min), reverse=True)  # newest first
    try:
        directory = directory or Directory.load()
    except Exception as e:  # noqa: BLE001 — names from the index still work
        print(f"  member list unavailable ({type(e).__name__}); using index names")
        directory = Directory([])

    repo = conn = None
    if not dry_run:
        from outsider_ingest.db import Repository, connect

        conn = connect(config.DATABASE_URL)
        repo = Repository(conn)

    n, skipped, matched = 0, 0, set()
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
        last, _, first = (p.strip() for p in name.partition(","))
        member = directory.match(last, first, ref.state_dst)
        display = member.name if member else (f"{first} {last}".strip() if first else last)
        if member:
            matched.add(member.bioguide)
        if dry_run:
            tickers = [r["ticker"] for r in rows if r.get("ticker")]
            who = f"{display} ({member.party}-{member.seat}, {member.bioguide})" if member else f"{display} (unmatched {ref.state_dst})"
            print(f"  {ref.filed_at} {who}: {len(tickers)} trades {' '.join(tickers[:6])}")
            n += len(tickers)
            continue
        ids = {"doc_id": ref.accession}
        if member:
            ids.update(bioguide=member.bioguide, portrait=member.portrait)
        entity_id = repo.upsert_entity(
            "politician", display, slugify(display), ids,
            role=f"Abgeordnete·r {member.seat}" if member else None,
            party=member.party if member else None,
            chamber="House", highlight="pelosi" in display.lower(),
        )
        filing_id = repo.insert_filing(
            "house_fd", "P", entity_id, ref.filed_at, None, ref.source_url
        )
        if not any(r.get("ticker") for r in rows):
            skipped += 1
            continue
        repo.supersede_legacy_transactions(filing_id)
        repo.claim_filing(filing_id, entity_id)
        for ordinal, r in enumerate(rows):
            if not r.get("ticker"):
                continue
            sid = repo.upsert_security_by_ticker(r["ticker"], r.get("asset"))
            repo.insert_transaction(
                filing_id, entity_id, sid, r["txn_type"],
                txn_date=_d(r.get("txn_date")), disclosed_at=ref.filed_at,
                amount_min=r.get("amount_min"), amount_max=r.get("amount_max"),
                owner=r.get("owner"), is_derivative=r.get("asset_code") == "OP",
                source_line=f"house:{ordinal}",
            )
            n += 1
        repo.commit()
    if conn is not None:
        conn.close()
    print(f"House {year or 'current'}: {n} transactions from {len(refs[:max_ptrs])} recent PTRs "
          f"({skipped} skipped/scanned, {len(matched)} members matched)"
          f"{' — dry run, nothing written' if dry_run else ''}")
    if not n:
        raise RuntimeError("House import produced no parsed transactions; check source availability and OCR coverage")
    return n


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, action="append", help="repeat for several years, e.g. a one-off backfill")
    ap.add_argument("--max-ptrs", type=int, default=500)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    directory = None
    for year in dict.fromkeys(args.year or [None]):
        try:
            directory = directory or Directory.load()
        except Exception:  # noqa: BLE001 — ingest_house falls back to index names
            directory = None
        ingest_house(year=year, max_ptrs=args.max_ptrs, dry_run=args.dry_run, directory=directory)


if __name__ == "__main__":
    main()
