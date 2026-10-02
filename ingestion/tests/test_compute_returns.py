"""13F clone returns: months, price checks, buy and hold, chaining."""

from datetime import date

import pytest

from outsider_ingest.models import Holding13F
from outsider_ingest.pipelines.compute_returns import (
    PriceSeries,
    Report,
    Position,
    accepted_positions,
    add_months,
    benchmark_series,
    compute_series,
    latest_reports,
    months_after,
    report_from_holdings,
    segment_end,
    select_positions,
)
from outsider_ingest.providers.base import FilingRef


def series(rows, splits=()):
    """rows: {month: price}; close = adjusted close unless a tuple is given."""
    return PriceSeries({m: (v if isinstance(v, tuple) else (v, v)) for m, v in rows.items()}, list(splits))


def test_month_arithmetic():
    assert add_months("2025-11", 2) == "2026-01"
    assert add_months("2026-01", -1) == "2025-12"
    assert months_after("2025-12", "2026-03") == ["2026-01", "2026-02", "2026-03"]
    assert months_after("2026-03", "2026-03") == []


def test_report_keeps_long_stock_only():
    def h(cusip, value, shares, put_call=None, kind="SH"):
        return Holding13F(name_of_issuer=cusip, cusip=cusip, value_usd=value, shares_or_prn=shares,
                          sh_prn_type=kind, put_call=put_call)

    r = report_from_holdings(date(2026, 3, 31), None, [
        h("AAA", 100, 10), h("AAA", 50, 5),           # split across managers: summed
        h("BBB", 999, 9, put_call="Put"),             # options are not a stake
        h("CCC", 70, 70, kind="PRN"),                 # bonds
        h("DDD", 0, 3),
    ])
    assert [(p.cusip, p.value, p.shares) for p in r.positions] == [("AAA", 150, 15)]


def test_select_positions_stops_at_value_cover():
    r = Report(date(2026, 3, 31), None, [Position(str(i), str(i), v, 1) for i, v in enumerate([60, 30, 7, 2, 1])])
    assert [p.cusip for p in select_positions(r, cover=0.97)] == ["0", "1", "2"]
    assert [p.cusip for p in select_positions(r, max_n=2)] == ["0", "1"]


def test_price_check_undoes_later_splits_and_rejects_strangers():
    q = Report(date(2025, 12, 31), None, [
        Position("A", "A", 1000, 10),   # 13F price 100; Yahoo 25 after a later 4:1 split
        Position("B", "B", 500, 5),     # 13F price 100; ticker now belongs to a $3 stock
    ])
    prices = {
        "AT": series({"2025-12": 25.0}, splits=[(date(2026, 2, 2), 4.0)]),
        "BT": series({"2025-12": 3.0}),
    }
    ok = accepted_positions(q, {"A": "AT", "B": "BT"}, prices)
    assert [p.cusip for p, _ in ok] == ["A"]


def test_buy_and_hold_with_drift_and_cash_after_delisting():
    q = Report(date(2025, 12, 31), None, [Position("A", "A", 500, 5), Position("B", "B", 500, 5)])
    prices = {
        "A": series({"2025-12": 100.0, "2026-01": 200.0, "2026-02": 200.0}),
        "B": series({"2025-12": 100.0, "2026-01": 100.0}),  # taken over in February: stays cash
    }
    out = compute_series([q], {"A": "A", "B": "B"}, prices, now="2026-02")
    assert [m.month for m in out] == ["2026-01", "2026-02"]
    assert out[0].ret == pytest.approx(0.5)   # (2 + 1) / 2
    assert out[1].ret == pytest.approx(0.0)
    assert out[0].coverage == pytest.approx(1.0)


def test_unpriced_positions_are_reweighted_and_counted_in_coverage():
    q = Report(date(2025, 12, 31), None, [Position("A", "A", 750, 7.5), Position("Z", "Z", 250, 1)])
    out = compute_series([q], {"A": "A", "Z": None}, {"A": series({"2025-12": 100.0, "2026-01": 110.0})}, "2026-01")
    assert out[0].ret == pytest.approx(0.10)
    assert out[0].coverage == pytest.approx(0.75)


def test_reports_hand_over_and_old_reports_expire():
    a = Report(date(2025, 3, 31), None, [])
    b = Report(date(2025, 6, 30), None, [])
    assert segment_end([a, b], 0, "2026-10") == "2025-06"
    # Without a newer report a portfolio stands for at most six months.
    assert segment_end([a, b], 1, "2026-10") == "2025-12"
    assert segment_end([a, b], 1, "2025-08") == "2025-08"


def test_adjusted_close_counts_dividends():
    s = series({"2025-12": (100.0, 98.0), "2026-01": (100.0, 100.0)})
    assert benchmark_series(s, "2025-12", "2026-01") == [("2026-01", pytest.approx(100 / 98 - 1))]


def test_latest_reports_one_per_quarter():
    def ref(n, form, period, filed):
        return FilingRef("sec_edgar", form, "1", f"a{n}", filed, period, f"u{n}")

    refs = [
        ref(1, "13F-HR", date(2025, 12, 31), date(2026, 2, 14)),
        ref(2, "13F-HR", date(2025, 12, 31), date(2026, 3, 1)),     # refiled original wins
        ref(3, "13F-HR/A", date(2025, 12, 31), date(2026, 5, 1)),   # amendments are ignored
        ref(4, "13F-HR", date(2025, 9, 30), date(2025, 11, 14)),
    ]
    assert [r.accession for r in latest_reports(refs)] == ["a4", "a2"]
