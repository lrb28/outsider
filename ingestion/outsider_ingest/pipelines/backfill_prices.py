"""Backfill EOD prices for every security that has a ticker, via the configured
PriceProvider (Stooq -> Yahoo fallback by default).

Kept fast + idempotent for a daily cron:
  * only a recent history window (PRICE_HISTORY_DAYS, default 370),
  * SKIP tickers that already have a fresh close (within PRICE_FRESH_DAYS),
  * bulk upsert (one executemany per ticker instead of hundreds of round-trips).

So the first populated run does the work once; later daily runs mostly skip and
finish in seconds.

Run:
  PYTHONPATH=. DATABASE_URL=postgres://... \
    python3 -m outsider_ingest.pipelines.backfill_prices
"""

from __future__ import annotations

import os
from datetime import date, timedelta

from outsider_ingest import config
from outsider_ingest.db import Repository, connect

HISTORY_DAYS = int(os.environ.get("PRICE_HISTORY_DAYS", "370"))
FRESH_DAYS = int(os.environ.get("PRICE_FRESH_DAYS", "3"))
MAX_TICKERS = int(os.environ.get("PRICE_MAX_TICKERS", "250"))


def main() -> None:
    price = config.get_price_provider()
    conn = connect(config.DATABASE_URL)
    repo = Repository(conn)
    start = date.today() - timedelta(days=HISTORY_DAYS)

    rows = conn.execute(
        "SELECT id, ticker FROM securities WHERE ticker IS NOT NULL ORDER BY ticker"
    ).fetchall()
    print(f"pricing up to {min(len(rows), MAX_TICKERS)} tickers via {price.name}")

    priced = skipped = failed = 0
    for sid, ticker in rows:
        if priced >= MAX_TICKERS:
            break
        latest = repo.latest_price_date(sid)
        if latest and (date.today() - latest).days <= FRESH_DAYS:
            skipped += 1
            continue
        try:
            prices = price.get_daily_prices(ticker, start=start)
        except Exception as e:  # noqa: BLE001 — one bad symbol must not stop the run
            failed += 1
            continue
        repo.upsert_prices_bulk(sid, prices)
        repo.commit()
        priced += 1

    print(f"prices: {priced} updated, {skipped} already fresh, {failed} unavailable")


if __name__ == "__main__":
    main()
