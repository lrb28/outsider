"""Senate normalizer test. Run: PYTHONPATH=. python3 tests/test_senate_parse.py"""

import json
from pathlib import Path

from outsider_ingest.parse.senate import normalize_all, parse_amount_range

FIXTURE = Path(__file__).parent / "fixtures" / "senate_sample.json"


def test_amount_range_parsing():
    assert parse_amount_range("$1,001 - $15,000") == (1001.0, 15000.0)
    assert parse_amount_range("$1,000,001 +") == (1000001.0, None)
    assert parse_amount_range(None) == (None, None)


def test_normalizes_records():
    txns = normalize_all(json.loads(FIXTURE.read_text()))
    assert len(txns) == 3

    buy = txns[0]
    assert buy.txn_type == "buy"
    assert buy.ticker == "AAPL"
    assert buy.amount_min == 1001 and buy.amount_max == 15000
    assert buy.txn_date == "2024-01-02"
    assert buy.disclosed_at == "2024-01-15"
    assert buy.owner == "Spouse"
    assert buy.chamber == "Senate"

    sell = txns[1]
    assert sell.txn_type == "sell"          # "Sale (Full)"
    assert sell.ticker == "NVDA"

    partial = txns[2]
    assert partial.txn_type == "sell"       # "Sale (Partial)"
    assert partial.ticker is None           # "--" -> None
    assert partial.amount_min == 1000001 and partial.amount_max is None


if __name__ == "__main__":
    test_amount_range_parsing()
    test_normalizes_records()
    txns = normalize_all(json.loads(FIXTURE.read_text()))
    print(f"OK  normalized {len(txns)} Senate transactions")
    for t in txns:
        rng = f"${t.amount_min:,.0f}" + (f"-${t.amount_max:,.0f}" if t.amount_max else "+")
        print(f"  {t.txn_type:4} {str(t.ticker):5} {rng:22} {t.politician_name}")
