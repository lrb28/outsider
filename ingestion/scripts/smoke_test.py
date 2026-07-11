"""Verify the free data sources actually work from THIS machine's IP.

This is the test that matters after the sandbox couldn't reach the price feeds:
run it on your own machine (or in GitHub Actions) to confirm SEC + prices come
through before you wire up the database.

Run:
  cd ingestion
  pip install -r requirements.txt
  PYTHONPATH=. SEC_USER_AGENT='Outsider/0.1 you@example.com' python3 scripts/smoke_test.py
"""

from __future__ import annotations

import os
import sys
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def main() -> int:
    ua = os.environ.get("SEC_USER_AGENT") or "Outsider/0.1 smoke@example.com"

    print("1) SEC EDGAR 13F (Scion Asset Management) ...", flush=True)
    from outsider_ingest.providers.sec_edgar import SecEdgarProvider

    sec = SecEdgarProvider(ua)
    refs = sec.list_filings("0001649339", ["13F-HR"])
    if not refs:
        print("   FAILED: no 13F filings returned")
        return 1
    latest = max(refs, key=lambda r: r.filed_at or date.min)
    holdings = sec.get_13f_holdings(latest)
    puts = sum(1 for h in holdings if h.put_call == "Put")
    print(f"   OK — {latest.period_of_report}: {len(holdings)} positions ({puts} puts)")

    print("2) Prices (Stooq -> Yahoo fallback) ...", flush=True)
    from outsider_ingest.config import get_price_provider

    try:
        prices = get_price_provider().get_daily_prices("AAPL")
        print(f"   OK — AAPL {len(prices)} days, last close {prices[-1].close}")
    except Exception as e:  # noqa: BLE001
        print(f"   FAILED: {e}")
        print("   -> both free price feeds throttled your IP too. Add a paid")
        print("      PriceProvider (Polygon/Intrinio stub) or try another network.")
        return 2

    print("\nAll good — data fetch works from your IP. Proceed with GO_LIVE.md.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
