"""Performance calculation — the core "how much has it moved since the trade"
feature. Pure functions over price series so they are trivially unit-tested.

Rules (from the spec):
  entry price   = close of the nearest trading day ON OR AFTER the reference date
  current price = latest available close
  pct_change    = (current - entry) / entry

We compute TWO figures per transaction:
  * since the TRADE date        (what the actor got)
  * since the DISCLOSURE date   (what the public could actually have acted on —
    the disclosure lag is the whole point of a transparency app)

Politician amounts are ranges; use midpoints only for aggregates and always
surface the range in the UI.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Optional, Sequence

from outsider_ingest.models import PricePoint


@dataclass(frozen=True)
class Performance:
    entry_trade: Optional[float]
    entry_disclosure: Optional[float]
    current: Optional[float]
    pct_since_trade: Optional[float]
    pct_since_disclosure: Optional[float]


def _nearest_on_or_after(prices: Sequence[PricePoint], d: date) -> Optional[PricePoint]:
    """First price whose date is >= d. Assumes `prices` sorted ascending."""
    for p in prices:
        if p.the_date >= d:
            return p
    return None


def compute_performance(
    prices: Sequence[PricePoint],
    txn_date: Optional[date],
    disclosed_at: Optional[date] = None,
    current: Optional[float] = None,
) -> Performance:
    if not prices:
        return Performance(None, None, None, None, None)

    ps = sorted(prices, key=lambda p: p.the_date)
    latest = current if current is not None else ps[-1].close

    entry_trade = None
    if txn_date is not None:
        p = _nearest_on_or_after(ps, txn_date)
        entry_trade = p.close if p is not None else None

    entry_disc = None
    if disclosed_at is not None:
        p = _nearest_on_or_after(ps, disclosed_at)
        entry_disc = p.close if p is not None else None

    def pct(entry: Optional[float]) -> Optional[float]:
        if entry is None or entry == 0 or latest is None:
            return None
        return (latest - entry) / entry

    return Performance(
        entry_trade=entry_trade,
        entry_disclosure=entry_disc,
        current=latest,
        pct_since_trade=pct(entry_trade),
        pct_since_disclosure=pct(entry_disc),
    )


# --- politician amount ranges -------------------------------------------------

def midpoint(amount_min: Optional[float], amount_max: Optional[float]) -> Optional[float]:
    vals = [v for v in (amount_min, amount_max) if v is not None]
    if not vals:
        return None
    return sum(vals) / len(vals)


def format_amount_range(
    amount_min: Optional[float], amount_max: Optional[float]
) -> str:
    def money(v: float) -> str:
        return f"${v:,.0f}"

    if amount_min is not None and amount_max is not None:
        if amount_min == amount_max:
            return money(amount_min)
        return f"{money(amount_min)}–{money(amount_max)}"
    if amount_min is not None:
        return f"≥ {money(amount_min)}"
    if amount_max is not None:
        return f"≤ {money(amount_max)}"
    return "undisclosed"
