"""Ingest SEC Form 4 (insider) transactions for tracked issuers.

For each issuer CIK we list its Form 4 filings, fetch + parse each ownership
document, upsert the reporting owner as a `corporate_insider` entity, and store
the transactions. Uses the same proven EDGAR fetch path as 13F.

Run:
  PYTHONPATH=. SEC_USER_AGENT='Outsider/0.1 you@example.com' DATABASE_URL=... \
    python3 -m outsider_ingest.pipelines.ingest_form4 --cik 0000320193
  ... --all   # every issuer in tracked_entities.yaml -> form4_issuers
"""

from __future__ import annotations

import argparse
import re
from datetime import date, datetime
from pathlib import Path

import yaml

from outsider_ingest import config
from outsider_ingest.db import Repository, connect


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def _d(s):
    if not s:
        return None
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError:
        return None


def ingest_issuer_form4(issuer_cik: str, since: date | None = None, max_filings: int = 20) -> int:
    sec = config.get_filings_provider("sec")
    conn = connect(config.DATABASE_URL)
    repo = Repository(conn)

    filings = sec.list_filings(issuer_cik, ["4"], since)
    filings.sort(key=lambda f: (f.filed_at or date.min))

    n = 0
    for ref in filings[-max_filings:]:
        txns = sec.get_form4(ref)
        if not txns:
            continue
        first = txns[0]
        slug = slugify(f"{first.owner_name}-{first.issuer_cik}")
        entity_id = repo.upsert_entity(
            "corporate_insider", first.owner_name or "Unknown insider", slug,
            {"issuer_cik": first.issuer_cik}, role=first.role, org_name=first.issuer_name,
        )
        filing_id = repo.insert_filing(
            ref.source, "4", entity_id, ref.filed_at, ref.period_of_report, ref.source_url
        )
        for t in txns:
            key = t.ticker or t.issuer_name
            sid = repo.upsert_security_by_ticker(key, t.issuer_name)
            repo.insert_transaction(
                filing_id, entity_id, sid, t.txn_type,
                txn_date=_d(t.txn_date), disclosed_at=ref.filed_at,
                shares=t.shares, price=t.price,
            )
            n += 1
    repo.commit()
    print(f"  {issuer_cik}: {n} insider transactions")
    return n


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cik")
    ap.add_argument("--all", action="store_true")
    args = ap.parse_args()

    if args.all:
        cfg = yaml.safe_load(
            (Path(__file__).resolve().parents[2] / "tracked_entities.yaml").read_text()
        )
        for cik in cfg.get("form4_issuers", []):
            ingest_issuer_form4(str(cik))
    elif args.cik:
        ingest_issuer_form4(args.cik)
    else:
        ap.error("pass --all or --cik")


if __name__ == "__main__":
    main()
