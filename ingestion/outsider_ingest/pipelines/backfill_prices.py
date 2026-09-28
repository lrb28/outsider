"""Refresh missing/stale prices first, bounded by attempted symbols per run.

Order: securities the app shows (recent trades, current holdings) before the
long tail. Tickers that cannot be US listings (e.g. "QC10", "PAHUSD") are
skipped, and a symbol that failed is retried after a week rather than daily,
so dead symbols no longer eat the time budget. Fetches run on a few threads;
database writes stay on the main thread.

Attempt timestamps keep unavailable symbols from starving the remaining queue.
A source returning only old prices is not counted as a successful refresh.
"""
from __future__ import annotations
import math
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from outsider_ingest import config
from outsider_ingest.db import Repository, connect
HISTORY_DAYS = int(os.environ.get("PRICE_HISTORY_DAYS", "370"))
FRESH_DAYS = int(os.environ.get("PRICE_FRESH_DAYS", "3"))
MAX_TICKERS = int(os.environ.get("PRICE_MAX_TICKERS", "600"))
# Finish cleanly before the CI job limit instead of being cancelled mid-run.
TIME_BUDGET_S = int(os.environ.get("PRICE_TIME_BUDGET_S", str(45 * 60)))
WORKERS = int(os.environ.get("PRICE_WORKERS", "3"))
RETRY_FAILED_DAYS = int(os.environ.get("PRICE_RETRY_FAILED_DAYS", "7"))
# US listings: 1-5 letters, optionally a share class (BRK.B, BF-B).
US_TICKER = re.compile(r"^[A-Z]{1,5}([.-][A-Z]{1,2})?$")


def plausible(ticker: str) -> bool:
    return bool(US_TICKER.match((ticker or "").strip().upper()))


def valid_prices(points, today: date):
    return [p for p in points if p.the_date <= today and math.isfinite(p.close) and p.close > 0]


def main() -> None:
    price = config.get_price_provider()
    today = date.today()
    start = today - timedelta(days=HISTORY_DAYS)
    with connect(config.DATABASE_URL) as conn:
        repo = Repository(conn)
        rows = conn.execute("""
            WITH shown AS (
                SELECT DISTINCT t.security_id AS id FROM transactions t
                WHERE t.disclosed_at >= current_date - 180
                UNION
                SELECT DISTINCT h.security_id FROM holdings h
                JOIN (SELECT entity_id, max(as_of_date) AS as_of FROM holdings GROUP BY entity_id) l
                  ON l.entity_id = h.entity_id AND l.as_of = h.as_of_date
            )
            SELECT s.id, s.ticker FROM securities s
            LEFT JOIN LATERAL (SELECT max(date) AS latest FROM prices p WHERE p.security_id=s.id) p ON true
            LEFT JOIN ingestion_price_attempts a ON a.security_id=s.id
            WHERE s.ticker IS NOT NULL AND (p.latest IS NULL OR p.latest < %s)
              AND NOT (a.outcome = 'failed' AND a.last_attempt > now() - make_interval(days => %s))
            ORDER BY (s.id IN (SELECT id FROM shown)) DESC, a.last_attempt NULLS FIRST, p.latest NULLS FIRST, s.id
            LIMIT %s
        """, (today - timedelta(days=FRESH_DAYS), RETRY_FAILED_DAYS, MAX_TICKERS)).fetchall()
        skipped = [(sid, t) for sid, t in rows if not plausible(t)]
        rows = [(sid, t) for sid, t in rows if plausible(t)]
        for sid, _ in skipped:
            conn.execute("""
                INSERT INTO ingestion_price_attempts (security_id,last_attempt,outcome)
                VALUES (%s,now(),'failed') ON CONFLICT (security_id) DO UPDATE
                SET last_attempt=EXCLUDED.last_attempt, outcome=EXCLUDED.outcome
            """, (sid,))
        repo.commit()
        if skipped:
            print(f"Skipped {len(skipped)} tickers that are not US listings (retried in {RETRY_FAILED_DAYS} days).")
        updated = stale = empty = failed = 0
        started = time.monotonic()
        attempted = 0

        def fetch(ticker):
            try:
                return valid_prices(price.get_daily_prices(ticker, start=start), today), None
            except Exception as error:  # noqa: BLE001 — recorded per symbol
                return None, error

        pool = ThreadPoolExecutor(max_workers=max(1, WORKERS))
        queue = list(rows)
        # Submit in small waves so the time budget is respected.
        while queue:
            if time.monotonic() - started > TIME_BUDGET_S:
                print(f"Time budget reached after {attempted} symbols; the rest follows next run.")
                break
            wave, queue = queue[: WORKERS * 4], queue[WORKERS * 4:]
            futures = [(sid, ticker, pool.submit(fetch, ticker)) for sid, ticker in wave]
            results = [(sid, ticker, *f.result()) for sid, ticker, f in futures]
            for sid, ticker, points, error in results:
                attempted += 1
                if attempted % 50 == 0:
                    print(f"  {attempted}/{len(rows)} symbols, {updated} fresh, {failed} failed")
                outcome = "failed"
                try:
                    if error is not None:
                        raise error
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
                except Exception as exc:  # noqa: BLE001 — one symbol must not stop the run
                    conn.rollback()
                    failed += 1
                    print(f"price {ticker}: {type(exc).__name__}")
                conn.execute("""
                    INSERT INTO ingestion_price_attempts (security_id,last_attempt,outcome)
                    VALUES (%s,now(),%s) ON CONFLICT (security_id) DO UPDATE
                    SET last_attempt=EXCLUDED.last_attempt, outcome=EXCLUDED.outcome
                """, (sid,outcome))
                repo.commit()
        pool.shutdown(wait=False, cancel_futures=True)
        summary = f"Prices: {attempted} of {len(rows)} attempted; {updated} fresh; {stale} stale; {empty} empty; {failed} failed."
        print(summary)
        if os.environ.get("GITHUB_STEP_SUMMARY"):
            with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as output:
                output.write(summary + "\n")
        # A handful of delisted or stale symbols is normal once the queue is
        # short; fail only when a real batch refreshes nothing or mostly errors.
        if attempted and ((attempted >= 20 and updated == 0) or failed > attempted * 0.6):
            raise RuntimeError("Price refresh incomplete; see counters above")


if __name__ == "__main__":
    main()
