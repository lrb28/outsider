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


# Layout of the current electronic PTRs (pdfplumber text): the ticker and the
# asset code follow on the next line, long amounts wrap, field lines end a row.
REAL_LAYOUT = """
ID Owner Asset Transaction Date Notification Amount Cap.
Type Date Gains >
SP Broadcom Inc. - Common Stock P 08/12/2026 09/15/2026 $1,001 - $15,000
(AVGO) [ST]
F      S     : New
S          O : R.W. Allen & Associates, Inc. > RWA&A - Securities
SP Rollins, Inc. Common Stock (ROL) S 08/12/2026 09/15/2026 $15,001 -
[ST] $50,000
F      S     : New
Microsoft Corporation (MSFT) [OP] P 08/14/2026 09/10/2026 $250,001 -
$500,000
D          : Purchased 50 call options
JT Howmet Aerospace Inc. (HWM) S (partial) 08/11/2026 09/02/2026 $1,001 - $15,000
[ST]
United States Treasury Bill P 08/20/2026 09/01/2026 $15,001 - $50,000
[GS]
* For the complete list of asset type abbreviations, please visit https://fd.house.gov/reference/asset-type-codes.aspx.
"""


def test_current_ptr_layout():
    rows = parse_ptr_text(REAL_LAYOUT)
    assert [r["ticker"] for r in rows] == ["AVGO", "ROL", "MSFT", "HWM", None]
    avgo, rol, msft, hwm, bill = rows
    assert (avgo["owner"], avgo["txn_type"], avgo["asset_code"]) == ("SP", "buy", "ST")
    assert avgo["asset"] == "Broadcom Inc. - Common Stock"
    assert (rol["amount_min"], rol["amount_max"]) == (15001, 50000), "wrapped range is completed"
    assert rol["txn_date"] == "2026-08-12" and rol["notification_date"] == "2026-09-15"
    assert msft["asset_code"] == "OP" and (msft["amount_min"], msft["amount_max"]) == (250001, 500000)
    assert (hwm["owner"], hwm["txn_type"], hwm["raw_type"]) == ("JT", "sell", "S (partial)")
    assert bill["asset_code"] == "GS", "rows without ticker are returned but skipped by the pipeline"


if __name__ == "__main__":
    rows = parse_ptr_text(SAMPLE)
    test_extracts_ticker_rows_only()
    print(f"OK  House PTR text parser: {len(rows)} ticker rows extracted")
    for r in rows:
        print(f"  {r['txn_type']:4} {r['ticker']:5} ${r['amount_min']:,.0f}-${r['amount_max']:,.0f}  {r['txn_date']}")


def test_nul_glyph_field_labels_end_the_asset():
    # Some PDFs draw the spaced labels with NUL glyphs; the asset name must stop
    # before "Filing status" and carry no NUL (PostgreSQL rejects it).
    text = (
        "SP 2000140446 American Funds AMCAP Fund Class A P 06/03/2025 06/04/2025 $500,001 -\n"
        "(SMCWX) [MF] $1,000,000\n"
        "F\x00\x00\x00\x00\x00 S\x00\x00\x00\x00\x00: New\n"
        "S\x00\x00\x00\x00\x00\x00\x00\x00\x00 O\x00: Raymond James Brokerage\n"
    )
    rows = parse_ptr_text(text)
    assert len(rows) == 1
    row = rows[0]
    assert row["ticker"] == "SMCWX"
    assert row["asset"] == "American Funds AMCAP Fund Class A"
    assert "\x00" not in row["asset"]
    assert (row["amount_min"], row["amount_max"]) == (500001, 1000000)
