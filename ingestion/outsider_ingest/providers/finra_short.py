"""FINRA short-interest adapter (ShortInterestProvider) — free, no key.

    https://api.finra.org/data/group/otcMarket/name/EquityShortInterest

Updated twice monthly; listed equities covered from ~June 2021. Used for the
ticker-page short-interest overlay (Phase 2). Minimal skeleton here.
"""

from __future__ import annotations

import requests

from outsider_ingest.providers.base import ShortInterestProvider

FINRA_URL = "https://api.finra.org/data/group/otcMarket/name/EquityShortInterest"


class FinraShortInterestProvider(ShortInterestProvider):
    name = "finra"

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({"Accept": "application/json"})

    def get_short_interest(self, ticker: str) -> list[dict]:
        # FINRA supports filtered POST queries; a compact filtered request keeps
        # payloads small. See docs/ARCHITECTURE.md for the query DSL.
        body = {
            "limit": 50,
            "compareFilters": [
                {"compareType": "equal", "fieldName": "symbolCode", "fieldValue": ticker.upper()}
            ],
        }
        resp = self.session.post(FINRA_URL, json=body, timeout=30)
        resp.raise_for_status()
        return resp.json() if resp.content else []
