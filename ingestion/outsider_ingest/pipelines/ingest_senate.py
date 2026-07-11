"""Ingest US Senate STOCK Act transactions from the free eFD JSON mirror.

Transaction-level already (no PDF parsing). Rows without a ticker (bonds, funds)
are skipped for the MVP since they can't be price-tracked.

Run:
  PYTHONPATH=. DATABASE_URL=... python3 -m outsider_ingest.pipelines.ingest_senate
"""

from __future__ import annotations

import re
from datetime import datetime

from outsider_ingest import config
from outsider_ingest.db import Repository, connect
from outsider_ingest.parse.senate import normalize_all
from outsider_ingest.providers.senate_disclosure import SenateDisclosureProvider


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
    provider = SenateDisclosureProvider()
    records = provider.load_transactions()
    if max_records:
        records = records[:max_records]
    txns = normalize_all(records)

    conn = connect(config.DATABASE_URL)
    repo = Repository(conn)

    n = 0
    for t in txns:
        if not t.ticker:
            continue
        entity_id = repo.upsert_entity(
            "politician", t.politician_name, slugify(t.politician_name), {}, chamber="Senate"
        )
        src = t.source_url or f"senate:{slugify(t.politician_name)}:{t.txn_date}"
        filing_id = repo.insert_filing(
            "senate_efd", "PTR", entity_id, _d(t.disclosed_at), _d(t.txn_date), src
        )
        sid = repo.upsert_security_by_ticker(t.ticker, t.asset_description)
        repo.insert_transaction(
            filing_id, entity_id, sid, t.txn_type,
            txn_date=_d(t.txn_date), disclosed_at=_d(t.disclosed_at),
            amount_min=t.amount_min, amount_max=t.amount_max, owner=t.owner,
        )
        n += 1
    repo.commit()
    print(f"Senate: {n} transactions ingested (of {len(txns)} records)")
    return n


if __name__ == "__main__":
    ingest_senate()
