"""Form 4 parser test. Run: PYTHONPATH=. python3 tests/test_form4_parse.py"""

from pathlib import Path

from outsider_ingest.parse.form4 import parse_form4

FIXTURE = Path(__file__).parent / "fixtures" / "form4_sample.xml"


def test_parses_issuer_owner_and_transactions():
    txns = parse_form4(FIXTURE.read_bytes())
    assert len(txns) == 3

    sale = txns[0]
    assert sale.ticker == "AAPL"
    assert sale.issuer_name == "Apple Inc."
    assert sale.owner_name == "COOK TIMOTHY D"
    assert sale.is_officer is True
    assert sale.role == "Chief Executive Officer"
    assert sale.code == "S"
    assert sale.txn_type == "sell"
    assert sale.shares == 100000.0
    assert sale.price == 200.50
    assert sale.acquired_disposed == "D"
    assert sale.is_derivative is False

    grant = txns[1]
    assert grant.code == "A"
    assert grant.txn_type == "buy"          # award/acquire
    assert grant.acquired_disposed == "A"

    deriv = txns[2]
    assert deriv.is_derivative is True
    assert deriv.code == "M"
    assert deriv.txn_type == "exchange"      # option exercise, not an open-market buy


if __name__ == "__main__":
    txns = parse_form4(FIXTURE.read_bytes())
    test_parses_issuer_owner_and_transactions()
    print(f"OK  parsed {len(txns)} Form 4 transactions for "
          f"{txns[0].owner_name} @ {txns[0].ticker}")
    for t in txns:
        kind = "DERIV" if t.is_derivative else "STOCK"
        print(f"  {kind}  code {t.code}  -> {t.txn_type:8} "
              f"{t.shares:>10,.0f} sh  @ ${t.price if t.price else 0:.2f}")
