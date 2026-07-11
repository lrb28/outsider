"""Backfill EOD prices for every security that has a ticker, via the configured
PriceProvider (Stooq -> Yahoo fallback by default). Idempotent.

Run:
  PYTHONPATH=. DATABASE_URL=postgres://... \
    python3 -m outsider_ingest.pipelines.backfill_prices
"""

from __future__ import annotations

from outsider_ingest import config
from outsider_ingest.db import Repository, connect


def main() -> None:
    price = config.get_price_provider()
    conn = connect(config.DATABASE_URL)
    repo = Repository(conn)

    rows = conn.execute(
        "SELECT id, ticker FROM securities WHERE ticker IS NOT NULL ORDER BY ticker"
    ).fetchall()
    print(f"backfilling {len(rows)} tickers via {price.name}")

    for sid, ticker in rows:
        try:
            prices = price.get_daily_prices(ticker)
        except Exception as e:  # noqa: BLE001 — keep going; log the symbol
            print(f"  {ticker}: SKIP ({e})")
            continue
        n = repo.upsert_prices(sid, prices)
        repo.commit()
        print(f"  {ticker}: {n} rows")


if __name__ == "__main__":
    main()
