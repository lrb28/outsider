"""Refresh missing/stale prices first, bounded by attempted symbols per run.

Attempt timestamps keep unavailable symbols from starving the remaining queue.
A source returning only old prices is not counted as a successful refresh.
"""
from __future__ import annotations
import math
import os
from datetime import date, timedelta
from outsider_ingest import config
from outsider_ingest.db import Repository, connect
HISTORY_DAYS = int(os.environ.get("PRICE_HISTORY_DAYS", "370"))
FRESH_DAYS = int(os.environ.get("PRICE_FRESH_DAYS", "3"))
MAX_TICKERS = int(os.environ.get("PRICE_MAX_TICKERS", "250"))


def valid_prices(points, today: date):
    return [p for p in points if p.the_date <= today and math.isfinite(p.close) and p.close > 0]


def main() -> None:
    price = config.get_price_provider()
    today = date.today()
    start = today - timedelta(days=HISTORY_DAYS)
    with connect(config.DATABASE_URL) as conn:
        repo = Repository(conn)
        rows = conn.execute("""
            SELECT s.id, s.ticker FROM securities s
            LEFT JOIN LATERAL (SELECT max(date) AS latest FROM prices p WHERE p.security_id=s.id) p ON true
            LEFT JOIN ingestion_price_attempts a ON a.security_id=s.id
            WHERE s.ticker IS NOT NULL AND (p.latest IS NULL OR p.latest < %s)
            ORDER BY a.last_attempt NULLS FIRST, p.latest NULLS FIRST, s.id
            LIMIT %s
        """, (today - timedelta(days=FRESH_DAYS), MAX_TICKERS)).fetchall()
        updated = stale = empty = failed = 0
        for sid, ticker in rows:
            outcome = "failed"
            try:
                points = valid_prices(price.get_daily_prices(ticker, start=start), today)
                if not points:
                    empty += 1
                    outcome = "empty"
                else:
                    repo.upsert_prices_bulk(sid, points)
                    if max(p.the_date for p in points) >= today - timedelta(days=FRESH_DAYS):
                        updated += 1
                        outcome = "updated"
                    else:
                        stale += 1
                        outcome = "stale"
                repo.commit()
            except Exception as error:
                conn.rollback()
                failed += 1
                print(f"price {ticker}: {type(error).__name__}")
            conn.execute("""
                INSERT INTO ingestion_price_attempts (security_id,last_attempt,outcome)
                VALUES (%s,now(),%s) ON CONFLICT (security_id) DO UPDATE
                SET last_attempt=EXCLUDED.last_attempt, outcome=EXCLUDED.outcome
            """, (sid,outcome))
            repo.commit()
        summary = f"Prices: {len(rows)} attempted; {updated} fresh; {stale} stale; {empty} empty; {failed} failed."
        print(summary)
        if os.environ.get("GITHUB_STEP_SUMMARY"):
            with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as output:
                output.write(summary + "\n")
        if rows and (updated == 0 or failed > len(rows) / 2):
            raise RuntimeError("Price refresh incomplete; see counters above")


if __name__ == "__main__":
    main()
