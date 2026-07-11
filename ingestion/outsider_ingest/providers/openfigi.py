"""OpenFIGI symbol adapter (SymbolProvider).

Maps a CUSIP (from 13F) or ticker to a stable security identity (ticker, FIGI,
name, exchange). Free; an API key raises the rate limit. Cache every result in
the DB (symbols_cache) — CUSIP->identity never changes, so we should ask once.

    POST https://api.openfigi.com/v3/mapping
    header X-OPENFIGI-APIKEY: <key>   (optional)
    body [{"idType": "ID_CUSIP", "idValue": "67066G104"}]
"""

from __future__ import annotations

import time
from typing import Callable, Optional

import requests

from outsider_ingest.providers.base import SecurityIdentity, SymbolProvider

MAPPING_URL = "https://api.openfigi.com/v3/mapping"


class OpenFigiProvider(SymbolProvider):
    name = "openfigi"

    def __init__(
        self,
        api_key: Optional[str] = None,
        cache_get: Optional[Callable[[str], Optional[SecurityIdentity]]] = None,
        cache_put: Optional[Callable[[str, SecurityIdentity], None]] = None,
    ):
        self.api_key = api_key
        self.cache_get = cache_get
        self.cache_put = cache_put
        # 25 req/min unauthenticated, 25 req/6s with a key (be conservative)
        self.min_interval_s = 0.3 if api_key else 2.5
        self._last = 0.0
        self.session = requests.Session()
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["X-OPENFIGI-APIKEY"] = api_key
        self.session.headers.update(headers)

    def resolve(self, identifier: str, id_type: str = "ID_CUSIP") -> Optional[SecurityIdentity]:
        if self.cache_get:
            cached = self.cache_get(identifier)
            if cached is not None:
                return cached

        gap = time.monotonic() - self._last
        if gap < self.min_interval_s:
            time.sleep(self.min_interval_s - gap)
        resp = self.session.post(
            MAPPING_URL, json=[{"idType": id_type, "idValue": identifier}], timeout=30
        )
        self._last = time.monotonic()
        if resp.status_code == 429:
            time.sleep(5)
            return self.resolve(identifier, id_type)
        resp.raise_for_status()

        payload = resp.json()
        if not payload or "data" not in payload[0] or not payload[0]["data"]:
            return None
        d = payload[0]["data"][0]
        identity = SecurityIdentity(
            ticker=d.get("ticker"),
            figi=d.get("figi"),
            name=d.get("name"),
            cusip=identifier if id_type == "ID_CUSIP" else None,
            exchange=d.get("exchCode"),
            asset_type=d.get("securityType"),
        )
        if self.cache_put:
            self.cache_put(identifier, identity)
        return identity
