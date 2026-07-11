"""Quarter-over-quarter position changes for 13F institutions.

Powers Phase-1 feature #3 (portfolio view: new / added / reduced / exited) and
supplies the institution rows of the Recent Trades feed (a 13F reveals holdings,
not trades — the *changes* between consecutive filings are the closest thing to
trades an institution discloses).

Positions are keyed by (cusip, put_call) so a long and a put on the same name
are tracked separately — essential given Burry-style options books.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Sequence

from outsider_ingest.models import Holding13F


@dataclass(frozen=True)
class PositionChange:
    cusip: str
    name: str
    put_call: Optional[str]
    change_type: str        # 'new' | 'added' | 'reduced' | 'exited' | 'unchanged'
    prev_shares: int
    curr_shares: int
    delta_shares: int

    @property
    def txn_type(self) -> str:
        """Unified transaction direction for the feed.

        Direction is preserved for options too (a closed call is a SELL, not a
        bullish 'option'); the separate `put_call` field carries the instrument,
        so buy+Call vs sell+Call stay distinguishable downstream.
        """
        if self.change_type in ("new", "added"):
            return "buy"
        if self.change_type in ("reduced", "exited"):
            return "sell"
        return "exchange"


def _key(h: Holding13F):
    return (h.cusip, h.put_call or "")


def compute_position_changes(
    prev: Sequence[Holding13F], curr: Sequence[Holding13F]
) -> list[PositionChange]:
    prev_map = {_key(h): h for h in prev}
    curr_map = {_key(h): h for h in curr}
    changes: list[PositionChange] = []

    for k, c in curr_map.items():
        p = prev_map.get(k)
        if p is None:
            changes.append(
                PositionChange(c.cusip, c.name_of_issuer, c.put_call, "new",
                               0, c.shares_or_prn, c.shares_or_prn)
            )
        else:
            delta = c.shares_or_prn - p.shares_or_prn
            ctype = "unchanged" if delta == 0 else ("added" if delta > 0 else "reduced")
            changes.append(
                PositionChange(c.cusip, c.name_of_issuer, c.put_call, ctype,
                               p.shares_or_prn, c.shares_or_prn, delta)
            )

    for k, p in prev_map.items():
        if k not in curr_map:
            changes.append(
                PositionChange(p.cusip, p.name_of_issuer, p.put_call, "exited",
                               p.shares_or_prn, 0, -p.shares_or_prn)
            )
    return changes
