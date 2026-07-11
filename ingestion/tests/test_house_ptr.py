"""House PTR text-parser test (no PDF needed).
Run: PYTHONPATH=. python3 tests/test_house_ptr.py
"""

from outsider_ingest.parse.house_ptr import parse_ptr_text

SAMPLE = """
Transactions
Apple Inc. (AAPL) P 01/02/2024 01/20/2024 $1,001 - $15,000
NVIDIA Corp (NVDA) S 03/05/2024 03/25/2024 $15,001 - $50,000
Some Municipal Bond 4.5% Self 04/01/2024 $1,001 - $15,000
"""


def test_extracts_ticker_rows_only():
    rows = parse_ptr_text(SAMPLE)
    # the bond line has no (TICKER) -> skipped
    assert len(rows) == 2

    aapl = rows[0]
    assert aapl["ticker"] == "AAPL"
    assert aapl["txn_type"] == "buy"
    assert aapl["amount_min"] == 1001 and aapl["amount_max"] == 15000
    assert aapl["txn_date"] == "2024-01-02"

    nvda = rows[1]
    assert nvda["ticker"] == "NVDA"
    assert nvda["txn_type"] == "sell"
    assert nvda["amount_min"] == 15001 and nvda["amount_max"] == 50000


if __name__ == "__main__":
    rows = parse_ptr_text(SAMPLE)
    test_extracts_ticker_rows_only()
    print(f"OK  House PTR text parser: {len(rows)} ticker rows extracted")
    for r in rows:
        print(f"  {r['txn_type']:4} {r['ticker']:5} ${r['amount_min']:,.0f}-${r['amount_max']:,.0f}  {r['txn_date']}")
