"""Intrinio price adapter — PAID, TODO stub. Same PriceProvider interface.

Docs: https://docs.intrinio.com/documentation/web_api/get_security_stock_prices_v2
Fill in and set PRICE_PROVIDER=intrinio when ready. No logic changes needed.
"""

from __future__ import annotations

from datetime import date
from typing import Optional

from outsider_ingest.models import PricePoint
from outsider_ingest.providers.base import PriceProvider


class IntrinioPriceProvider(PriceProvider):
    name = "intrinio"

    def __init__(self, api_key: str):
        self.api_key = api_key

    def get_daily_prices(
        self, ticker: str, start: Optional[date] = None, end: Optional[date] = None
    ) -> list[PricePoint]:
        raise NotImplementedError(
            "IntrinioPriceProvider is a paid-tier stub. Implement using "
            "GET /securities/{identifier}/prices and map to PricePoint."
        )
