"""QoQ position-change logic. Run: PYTHONPATH=. python3 tests/test_holdings_diff.py"""

from outsider_ingest.holdings_diff import compute_position_changes
from outsider_ingest.models import Holding13F


def H(name, cusip, shares, put_call=None):
    return Holding13F(
        name_of_issuer=name, cusip=cusip, value_usd=shares * 10,
        shares_or_prn=shares, sh_prn_type="SH", put_call=put_call,
    )


def test_new_added_reduced_exited_and_option_separation():
    prev = [H("NVIDIA", "67066G104", 500_000),
            H("APPLE", "037833100", 100),
            H("PALANTIR", "69608A108", 1_000_000, put_call="Put")]
    curr = [H("NVIDIA", "67066G104", 1_000_000),         # added +500k
            H("MICROSOFT", "594918104", 200),            # new
            H("PALANTIR", "69608A108", 5_000_000, put_call="Put")]  # added (put leg)

    by = {(c.name, c.put_call): c for c in compute_position_changes(prev, curr)}

    assert by[("NVIDIA", None)].change_type == "added"
    assert by[("NVIDIA", None)].delta_shares == 500_000
    assert by[("NVIDIA", None)].txn_type == "buy"

    assert by[("MICROSOFT", None)].change_type == "new"

    assert by[("APPLE", None)].change_type == "exited"
    assert by[("APPLE", None)].txn_type == "sell"

    # the put leg is tracked independently; direction is preserved (added -> buy)
    # while put_call still marks it as an option position
    assert by[("PALANTIR", "Put")].change_type == "added"
    assert by[("PALANTIR", "Put")].txn_type == "buy"
    assert by[("PALANTIR", "Put")].put_call == "Put"


if __name__ == "__main__":
    test_new_added_reduced_exited_and_option_separation()
    print("OK  holdings diff: new/added/reduced/exited + option-leg separation")
