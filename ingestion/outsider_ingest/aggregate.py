"""Aggregate 13F holdings that a filer split across several <infoTable> rows.

A 13F-HR information table reports ONE economic position as MULTIPLE rows when
the position is managed by several internal sub-managers (the <otherManager>
field). Berkshire's Apple stake, for example, appears as ~12 separate rows that
must be summed to get the real position.

Our storage key is (filing_id, security_id, put_call), so if we upsert each row
individually the later rows overwrite the earlier ones and a giant position
collapses to just its last (often tiny) slice. Summing per (cusip, put_call)
before upserting fixes this. Puts and calls stay separate from the common-stock
line because they carry a distinct put_call and are economically different.
"""

from __future__ import annotations

from collections import OrderedDict
from dataclasses import replace

from outsider_ingest.models import Holding13F


def aggregate_holdings(holdings: list[Holding13F]) -> list[Holding13F]:
    """Sum rows that share a (cusip, put_call) into one Holding13F.

    Order is preserved by first appearance. value_usd, raw_value, shares and the
    voting tallies are summed; all other fields keep the first row's values.
    """
    agg: "OrderedDict[tuple[str, str], Holding13F]" = OrderedDict()
    for h in holdings:
        key = (h.cusip, h.put_call or "")
        cur = agg.get(key)
        if cur is None:
            agg[key] = h
        else:
            agg[key] = replace(
                cur,
                value_usd=cur.value_usd + h.value_usd,
                raw_value=cur.raw_value + h.raw_value,
                shares_or_prn=cur.shares_or_prn + h.shares_or_prn,
                voting_sole=cur.voting_sole + h.voting_sole,
                voting_shared=cur.voting_shared + h.voting_shared,
                voting_none=cur.voting_none + h.voting_none,
            )
    return list(agg.values())
