"""Abstract provider interfaces — the only contracts business logic knows about.

Each concrete adapter (sec_edgar, stooq_price, yahoo_price, openfigi, ...)
implements exactly one of these. Paid adapters implement the SAME interface, so
`config.py` can pick an implementation from an env var with zero logic changes.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date
from typing import Optional, Sequence

from outsider_ingest.models import PricePoint


# --- shared value types -------------------------------------------------------

@dataclass(frozen=True)
class FilingRef:
    """A pointer to one filing, source-agnostic."""

    source: str                 # 'sec_edgar' | 'house_fd' | 'senate_efd'
    form_type: str              # '13F-HR' | '4' | 'SC 13D' | 'PTR' ...
    external_entity_id: str     # CIK, DocID, bioguide id ...
    accession: str
    filed_at: Optional[date]
    period_of_report: Optional[date]
    source_url: str
    primary_document: Optional[str] = None


@dataclass(frozen=True)
class SecurityIdentity:
    ticker: Optional[str]
    figi: Optional[str]
    name: Optional[str]
    cusip: Optional[str] = None
    exchange: Optional[str] = None
    asset_type: Optional[str] = None


# --- ports --------------------------------------------------------------------

class FilingsProvider(ABC):
    """Lists and fetches disclosure filings for a tracked entity."""

    source: str = "abstract"

    @abstractmethod
    def list_filings(
        self,
        external_entity_id: str,
        form_types: Sequence[str],
        since: Optional[date] = None,
    ) -> list[FilingRef]:
        ...

    @abstractmethod
    def fetch_document(self, ref: FilingRef, filename: Optional[str] = None) -> bytes:
        """Return raw bytes of a document within a filing (stored for audit)."""
        ...


class PriceProvider(ABC):
    """End-of-day OHLCV for performance calculation."""

    name: str = "abstract"

    @abstractmethod
    def get_daily_prices(
        self, ticker: str, start: Optional[date] = None, end: Optional[date] = None
    ) -> list[PricePoint]:
        ...

    def get_latest_close(self, ticker: str) -> Optional[PricePoint]:
        prices = self.get_daily_prices(ticker)
        return prices[-1] if prices else None


class SymbolProvider(ABC):
    """Resolve a raw identifier (CUSIP, ticker, FIGI) to a security identity."""

    name: str = "abstract"

    @abstractmethod
    def resolve(self, identifier: str, id_type: str = "ID_CUSIP") -> Optional[SecurityIdentity]:
        ...


class ShortInterestProvider(ABC):
    name: str = "abstract"

    @abstractmethod
    def get_short_interest(self, ticker: str) -> list[dict]:
        ...


class MacroProvider(ABC):        # Phase 2 (FRED)
    name: str = "abstract"

    @abstractmethod
    def get_series(self, series_id: str) -> list[dict]:
        ...


class GovContractsProvider(ABC):  # Phase 2 (USASpending)
    name: str = "abstract"

    @abstractmethod
    def search_awards(self, query: dict) -> list[dict]:
        ...
