"""Canonical in-memory domain types.

These mirror the Postgres schema (db/migrations/0001_init.sql) but stay
storage-agnostic so parsers and the performance calculator can be unit-tested
without a database.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Optional


EntityType = str  # 'politician' | 'corporate_insider' | 'institution'
TxnType = str     # 'buy' | 'sell' | 'exchange' | 'option'


@dataclass(frozen=True)
class Holding13F:
    """One <infoTable> row from a 13F-HR information table.

    `put_call` is None for ordinary long positions. When it is 'Put' or 'Call'
    the position is a derivative and `value_usd` is the market value of the
    UNDERLYING (notional), not the option premium. Never render a Put as a long
    holding.
    """

    name_of_issuer: str
    cusip: str
    value_usd: int
    shares_or_prn: int
    sh_prn_type: str                       # 'SH' | 'PRN'
    title_of_class: Optional[str] = None
    put_call: Optional[str] = None         # 'Put' | 'Call' | None
    investment_discretion: Optional[str] = None
    voting_sole: int = 0
    voting_shared: int = 0
    voting_none: int = 0
    raw_value: int = 0                      # value exactly as reported (pre-scaling)

    @property
    def is_derivative(self) -> bool:
        return self.put_call is not None

    @property
    def direction(self) -> str:
        """Coarse directional read for display/aggregation."""
        if self.put_call == "Put":
            return "bearish"
        if self.put_call == "Call":
            return "bullish"
        return "long"


@dataclass(frozen=True)
class Form4Transaction:
    """One transaction row from an SEC Form 4 (insider) ownership document.

    Covers both non-derivative (common stock) and derivative (options) tables.
    `code` is the SEC transaction code (P=buy, S=sell, A=grant, M=exercise,
    F=tax withholding, G=gift, ...); `txn_type` is our unified mapping.
    """

    issuer_cik: str
    issuer_name: str
    ticker: Optional[str]
    owner_name: str
    owner_title: Optional[str]
    is_director: bool
    is_officer: bool
    is_ten_percent_owner: bool
    security_title: Optional[str]
    txn_date: Optional[str]              # 'YYYY-MM-DD' as filed; pipeline parses
    code: Optional[str]
    txn_type: TxnType
    shares: Optional[float]
    price: Optional[float]
    acquired_disposed: Optional[str]     # 'A' | 'D'
    is_derivative: bool

    @property
    def role(self) -> str:
        if self.is_officer and self.owner_title:
            return self.owner_title
        if self.is_officer:
            return "Officer"
        if self.is_director:
            return "Director"
        if self.is_ten_percent_owner:
            return "10% owner"
        return "Insider"


@dataclass(frozen=True)
class PoliticianTxn:
    """A normalized STOCK Act transaction (House or Senate).

    Amounts are disclosed as ranges (e.g. $1,001–$15,000); we keep both bounds
    and let the UI show the range and aggregates use the midpoint.
    """

    politician_name: str
    chamber: str                          # 'Senate' | 'House'
    ticker: Optional[str]
    asset_description: str
    txn_type: TxnType
    amount_min: Optional[float]
    amount_max: Optional[float]
    txn_date: Optional[str]               # ISO 'YYYY-MM-DD'
    disclosed_at: Optional[str]           # ISO 'YYYY-MM-DD'
    owner: Optional[str]                  # self | spouse | joint | child
    source_url: Optional[str]
    raw_type: Optional[str] = None


@dataclass(frozen=True)
class PricePoint:
    the_date: date
    close: float
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    volume: Optional[int] = None


@dataclass
class TrackedEntity:
    """A data-driven entry in tracked_entities.yaml."""

    slug: str
    entity_type: EntityType
    full_name: str
    external_ids: dict = field(default_factory=dict)   # {'cik': '...', 'bioguide_id': '...'}
    org_name: Optional[str] = None
    highlight: bool = False                             # e.g. surface Pelosi/Burry prominently


@dataclass
class FeedRow:
    """A single unified row of the Recent Trades feed (any actor type)."""

    entity_name: str
    entity_type: EntityType
    ticker: Optional[str]
    security_name: str
    txn_type: TxnType
    put_call: Optional[str]
    txn_date: Optional[date]
    disclosed_at: Optional[date]
    amount_display: str                # exact size or politician range, human-readable
    pct_since_trade: Optional[float]   # fraction, e.g. 0.1234 == +12.34%
    pct_since_disclosure: Optional[float]
    source_url: str
