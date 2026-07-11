"""Validates the 13F parser against a REAL Scion Asset Management filing
(Q3-2025, accession 0001649339-25-000007).

Run:  PYTHONPATH=. python3 tests/test_form13f_parse.py
"""

from pathlib import Path

from outsider_ingest.parse.form13f import parse_information_table

FIXTURE = Path(__file__).parent / "fixtures" / "scion_infotable.xml"


def test_parses_all_positions():
    holdings = parse_information_table(FIXTURE.read_bytes())
    assert len(holdings) == 8, f"expected 8 positions, got {len(holdings)}"
    return holdings


def test_puts_are_not_treated_as_long():
    holdings = {h.name_of_issuer: h for h in parse_information_table(FIXTURE.read_bytes())}

    pltr = holdings["PALANTIR TECHNOLOGIES INC"]
    assert pltr.put_call == "Put"
    assert pltr.is_derivative is True
    assert pltr.direction == "bearish"
    assert pltr.shares_or_prn == 5_000_000
    assert pltr.value_usd == 912_100_000        # notional, NOT premium

    nvda = holdings["NVIDIA CORPORATION"]
    assert nvda.put_call == "Put"
    assert nvda.direction == "bearish"

    hal = holdings["HALLIBURTON CO"]
    assert hal.put_call == "Call"
    assert hal.direction == "bullish"

    lulu = holdings["LULULEMON ATHLETICA INC"]
    assert lulu.put_call is None
    assert lulu.direction == "long"
    assert lulu.cusip == "550021109"


def test_value_scaling_for_old_filings():
    thousands = {
        h.name_of_issuer: h
        for h in parse_information_table(FIXTURE.read_bytes(), values_in_thousands=True)
    }
    # same fixture, but scaled x1000 (as a pre-2023 filing would need)
    assert thousands["LULULEMON ATHLETICA INC"].value_usd == 17_793_000 * 1000
    assert thousands["LULULEMON ATHLETICA INC"].raw_value == 17_793_000


if __name__ == "__main__":
    hs = test_parses_all_positions()
    test_puts_are_not_treated_as_long()
    test_value_scaling_for_old_filings()

    longs = [h for h in hs if not h.is_derivative]
    puts = [h for h in hs if h.put_call == "Put"]
    calls = [h for h in hs if h.put_call == "Call"]
    print(f"OK  parsed {len(hs)} positions "
          f"({len(longs)} long, {len(puts)} puts, {len(calls)} calls)")
    for h in hs:
        tag = h.put_call or "LONG"
        print(f"  {tag:4}  {h.name_of_issuer:28} {h.shares_or_prn:>10,} sh  "
              f"${h.value_usd:>14,}")
