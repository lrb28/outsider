"""Ingest US Senate STOCK Act transactions from the free eFD JSON mirror.

Performance: the mirror holds YEARS of history (tens of thousands of rows).
Writing each row to a remote database one-by-one is far too slow, so we:
  * keep only rows that have a ticker,
  * cap to the most recent SENATE_MAX_RECORDS (default 400) by disclosure date,
  * de-duplicate senators / securities / filings in memory and upsert each once.

That turns tens of thousands of round-trips into a few hundred.

Run:
  PYTHONPATH=. DATABASE_URL=... python3 -m outsider_ingest.pipelines.ingest_senate
"""

from __future__ import annotations

import os
import re
from datetime import datetime

from outsider_ingest import config
from outsider_ingest.db import Repository, connect
from outsider_ingest.parse.senate import normalize_all
from outsider_ingest.providers.senate_disclosure import SenateDisclosureProvider

MAX_RECORDS = int(os.environ.get("SENATE_MAX_RECORDS", "400"))


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def _d(s):
    if not s:
        return None
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def ingest_senate(max_records: int | None = None) -> int:
    max_records = max_records or MAX_RECORDS

    provider = SenateDisclosureProvider()
    txns = [t for t in normalize_all(provider.load_transactions()) if t.ticker]
    txns.sort(key=lambda t: t.disclosed_at or "", reverse=True)  # newest first
    txns = txns[:max_records]
    if not txns:
        print("Senate: no ticker'd transactions found")
        return 0

    conn = connect(config.DATABASE_URL)
    repo = Repository(conn)

    # upsert each unique senator + ticker ONCE, cache the ids
    entity_ids = {
        name: repo.upsert_entity("politician", name, slugify(name), {}, chamber="Senate")
        for name in sorted({t.politician_name for t in txns})
    }
    sec_ids = {
        tk: repo.upsert_security_by_ticker(tk, None)
        for tk in sorted({t.ticker for t in txns})
    }

    filing_ids: dict[str, int] = {}
    n = 0
    for t in txns:
        url = t.source_url or f"senate:{slugify(t.politician_name)}:{t.txn_date}"
        fid = filing_ids.get(url)
        if fid is None:
            fid = repo.insert_filing(
                "senate_efd", "PTR", entity_ids[t.politician_name],
                _d(t.disclosed_at), _d(t.txn_date), url,
            )
            filing_ids[url] = fid
        repo.insert_transaction(
            fid, entity_ids[t.politician_name], sec_ids[t.ticker], t.txn_type,
            txn_date=_d(t.txn_date), disclosed_at=_d(t.disclosed_at),
            amount_min=t.amount_min, amount_max=t.amount_max, owner=t.owner,
        )
        n += 1
    repo.commit()
    print(f"Senate: {n} transactions ingested (capped at {max_records}, "
          f"{len(entity_ids)} senators, {len(filing_ids)} filings)")
    return n


if __name__ == "__main__":
    ingest_senate()
