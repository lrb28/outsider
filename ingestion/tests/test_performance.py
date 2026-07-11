"""Deterministic tests for the performance calculator.

Uses a fixed price series (no network) so the nearest-trading-day logic and the
percent-change math are pinned exactly.

Run:  PYTHONPATH=. python3 tests/test_performance.py
"""

from datetime import date

from outsider_ingest.models import PricePoint
from outsider_ingest.performance import (
    compute_performance,
    format_amount_range,
    midpoint,
)

PRICES = [
    PricePoint(date(2025, 9, 29), close=100.0),  # Monday
    PricePoint(date(2025, 9, 30), close=110.0),
    PricePoint(date(2025, 10, 1), close=120.0),
    PricePoint(date(2025, 10, 2), close=130.0),
    PricePoint(date(2025, 10, 3), close=150.0),  # latest
]


def test_entry_uses_next_trading_day_on_weekend():
    # trade dated Sunday 2025-09-28 -> entry should be Mon 2025-09-29 close = 100
    perf = compute_performance(PRICES, txn_date=date(2025, 9, 28))
    assert perf.entry_trade == 100.0
    assert perf.current == 150.0
    assert abs(perf.pct_since_trade - 0.5) < 1e-9   # +50%


def test_since_disclosure_is_separate_from_trade():
    perf = compute_performance(
        PRICES, txn_date=date(2025, 9, 28), disclosed_at=date(2025, 10, 1)
    )
    assert perf.entry_disclosure == 120.0
    assert abs(perf.pct_since_disclosure - 0.25) < 1e-9  # +25%
    # the lag cost the public 25 points of upside vs the actor
    assert perf.pct_since_trade > perf.pct_since_disclosure


def test_missing_prices_is_safe():
    perf = compute_performance([], txn_date=date(2025, 9, 28))
    assert perf.pct_since_trade is None
    assert perf.current is None


def test_politician_range_helpers():
    assert format_amount_range(1001, 15000) == "$1,001–$15,000"
    assert format_amount_range(1000000, None).startswith("≥ $1,000,000")
    assert midpoint(1001, 15000) == 8000.5


if __name__ == "__main__":
    test_entry_uses_next_trading_day_on_weekend()
    test_since_disclosure_is_separate_from_trade()
    test_missing_prices_is_safe()
    test_politician_range_helpers()
    p = compute_performance(
        PRICES, txn_date=date(2025, 9, 28), disclosed_at=date(2025, 10, 1)
    )
    print("OK  performance calc")
    print(f"  entry@trade      = {p.entry_trade}")
    print(f"  entry@disclosure = {p.entry_disclosure}")
    print(f"  current          = {p.current}")
    print(f"  since trade      = {p.pct_since_trade:+.2%}")
    print(f"  since disclosure = {p.pct_since_disclosure:+.2%}")
