"""Polygon.io price adapter — PAID, TODO stub.

Implements the SAME PriceProvider interface as Stooq/Yahoo. When you are ready
to pay for intraday/adjusted data, fill this in and set PRICE_PROVIDER=polygon;
no business-logic changes required. That is the entire point of the port.

Docs: https://polygon.io/docs/stocks/get_v2_aggs_ticker__stocksticker__range
"""

from __future__ import annotations

from datetime import date
from typing import Optional

from outsider_ingest.models import PricePoint
from outsider_ingest.providers.base import PriceProvider


class PolygonPriceProvider(PriceProvider):
    name = "polygon"

    def __init__(self, api_key: str):
        self.api_key = api_key

    def get_daily_prices(
        self, ticker: str, start: Optional[date] = None, end: Optional[date] = None
    ) -> list[PricePoint]:
        raise NotImplementedError(
            "PolygonPriceProvider is a paid-tier stub. Implement using "
            "GET /v2/aggs/ticker/{ticker}/range/1/day/{start}/{end} and map "
            "results to PricePoint. See docs/ARCHITECTURE.md."
        )
