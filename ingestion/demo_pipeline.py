"""End-to-end smoke test of the REAL modules — no network, no database.

Proves the full display chain the web app will use:
  parse real 13F  ->  split long/put/call  ->  portfolio weights  ->
  Recent-Trades feed rows with % since disclosure.

Prices here are ILLUSTRATIVE placeholders (live price fetch is blocked from this
sandbox IP; the app uses StooqPriceProvider -> Yahoo fallback). The point is to
prove the wiring, not to assert Burry's real returns.

Run:  PYTHONPATH=. python3 demo_pipeline.py
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

from outsider_ingest.models import PricePoint
from outsider_ingest.parse.form13f import parse_information_table
from outsider_ingest.performance import compute_performance

FIXTURE = Path(__file__).parent / "tests" / "fixtures" / "scion_infotable.xml"
DISCLOSED = date(2025, 11, 3)      # real filed date of this 13F
TODAY = date(2026, 7, 9)

CUSIP_TICKER = {
    "116794207": "BRKR", "406216101": "HAL", "550021109": "LULU",
    "60855R100": "MOH", "67066G104": "NVDA", "69608A108": "PLTR",
    "717081103": "PFE", "78442P106": "SLM",
}

# ILLUSTRATIVE ONLY: {ticker: (price@disclosure, price@today)}
ILLUSTRATIVE = {
    "BRKR": (42.0, 55.0), "HAL": (24.6, 30.0), "LULU": (178.0, 150.0),
    "MOH": (191.0, 210.0), "NVDA": (186.0, 205.0), "PLTR": (182.0, 240.0),
    "PFE": (25.5, 28.0), "SLM": (27.7, 33.0),
}


def price_series(ticker: str) -> list[PricePoint]:
    p0, p1 = ILLUSTRATIVE[ticker]
    return [PricePoint(DISCLOSED, close=p0), PricePoint(TODAY, close=p1)]


def main() -> None:
    holdings = parse_information_table(FIXTURE.read_bytes())
    total_value = sum(h.value_usd for h in holdings)

    print("=" * 78)
    print("SCION ASSET MANAGEMENT  ·  13F-HR  ·  Q3 2025  (filed 2025-11-03)")
    print("Source: https://www.sec.gov/Archives/edgar/data/1649339/000164933925000007/")
    print("=" * 78)
    print("\nPORTFOLIO (as reported — weight by reported value; options are notional)\n")
    print(f"  {'TICKER':7}{'TYPE':6}{'SHARES':>12}{'REPORTED $':>16}{'WEIGHT':>9}")
    for h in sorted(holdings, key=lambda x: -x.value_usd):
        t = CUSIP_TICKER.get(h.cusip, h.cusip)
        typ = h.put_call.upper() if h.put_call else "LONG"
        w = h.value_usd / total_value if total_value else 0
        print(f"  {t:7}{typ:6}{h.shares_or_prn:>12,}{h.value_usd:>16,}{w:>8.1%}")

    print("\nRECENT TRADES FEED (institution view = position disclosed)\n")
    print(f"  {'TICKER':7}{'SIGNAL':9}{'SIZE':>12}{'DISCLOSED':>12}{'SINCE DISCL.':>14}")
    for h in sorted(holdings, key=lambda x: -x.value_usd):
        t = CUSIP_TICKER.get(h.cusip, h.cusip)
        if h.put_call == "Put":
            signal = "BEARISH"
        elif h.put_call == "Call":
            signal = "BULLISH"
        else:
            signal = "LONG"
        perf = compute_performance(price_series(t), txn_date=DISCLOSED, disclosed_at=DISCLOSED)
        pct = f"{perf.pct_since_disclosure:+.1%}" if perf.pct_since_disclosure is not None else "n/a"
        print(f"  {t:7}{signal:9}{h.shares_or_prn:>12,}{str(DISCLOSED):>12}{pct:>14}")

    puts = [h for h in holdings if h.put_call == "Put"]
    print("\nNOTE: {} PUT position(s) — e.g. {} — are BEARISH bets, not longs. "
          "A naive parser\n      would show them as large holdings. Prices above are "
          "ILLUSTRATIVE.".format(
              len(puts), ", ".join(CUSIP_TICKER.get(h.cusip, h.cusip) for h in puts)))


if __name__ == "__main__":
    main()
