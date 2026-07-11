"""Configuration + provider factories.

Provider choice is data/env-driven. To move to a paid price feed later:
    PRICE_PROVIDER=polygon POLYGON_API_KEY=...   # no code changes
"""

from __future__ import annotations

import os
from datetime import date
from typing import Optional, Sequence

from outsider_ingest.models import PricePoint
from outsider_ingest.providers.base import PriceProvider
from outsider_ingest.providers.stooq_price import PriceUnavailable, StooqPriceProvider
from outsider_ingest.providers.yahoo_price import YahooPriceProvider

# --- environment --------------------------------------------------------------

SEC_USER_AGENT = os.environ.get("SEC_USER_AGENT", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "")
OPENFIGI_API_KEY = os.environ.get("OPENFIGI_API_KEY") or None

PRICE_PROVIDER = os.environ.get("PRICE_PROVIDER", "stooq").lower()
# comma-separated fallbacks tried in order if the primary yields nothing
PRICE_FALLBACKS = [
    p.strip().lower() for p in os.environ.get("PRICE_FALLBACKS", "yahoo").split(",") if p.strip()
]


# --- composite price provider -------------------------------------------------

class CompositePriceProvider(PriceProvider):
    """Tries each provider in order until one returns data.

    This is the concrete answer to price-source flakiness (Stooq/Yahoo throttle
    datacenter IPs). Order is config-driven; every member honours the same
    PriceProvider contract.
    """

    name = "composite"

    def __init__(self, providers: Sequence[PriceProvider]):
        if not providers:
            raise ValueError("CompositePriceProvider needs at least one provider")
        self.providers = list(providers)

    def get_daily_prices(
        self, ticker: str, start: Optional[date] = None, end: Optional[date] = None
    ) -> list[PricePoint]:
        errors = []
        for p in self.providers:
            try:
                rows = p.get_daily_prices(ticker, start, end)
                if rows:
                    return rows
            except (PriceUnavailable, Exception) as e:  # noqa: BLE001 - log & try next
                errors.append(f"{p.name}: {e}")
        raise PriceUnavailable(f"all price providers failed for {ticker!r}: {'; '.join(errors)}")


def _build_price(name: str) -> PriceProvider:
    if name == "stooq":
        return StooqPriceProvider()
    if name == "yahoo":
        return YahooPriceProvider()
    if name == "polygon":
        from outsider_ingest.providers.polygon_price import PolygonPriceProvider

        return PolygonPriceProvider(os.environ["POLYGON_API_KEY"])
    if name == "intrinio":
        from outsider_ingest.providers.intrinio_price import IntrinioPriceProvider

        return IntrinioPriceProvider(os.environ["INTRINIO_API_KEY"])
    raise ValueError(f"unknown price provider {name!r}")


def get_price_provider() -> PriceProvider:
    chain = [PRICE_PROVIDER] + [f for f in PRICE_FALLBACKS if f != PRICE_PROVIDER]
    return CompositePriceProvider([_build_price(n) for n in chain])


def get_filings_provider(source: str = "sec"):
    if source == "sec":
        from outsider_ingest.providers.sec_edgar import SecEdgarProvider

        return SecEdgarProvider(SEC_USER_AGENT)
    if source == "house":
        from outsider_ingest.providers.house_disclosure import HouseDisclosureProvider

        return HouseDisclosureProvider()
    if source == "senate":
        from outsider_ingest.providers.senate_disclosure import SenateDisclosureProvider

        return SenateDisclosureProvider()
    raise ValueError(f"unknown filings source {source!r}")


def get_symbol_provider(cache_get=None, cache_put=None):
    from outsider_ingest.providers.openfigi import OpenFigiProvider

    return OpenFigiProvider(api_key=OPENFIGI_API_KEY, cache_get=cache_get, cache_put=cache_put)
