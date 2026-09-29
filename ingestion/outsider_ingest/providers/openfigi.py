"""OpenFIGI symbol adapter (SymbolProvider).

Maps a CUSIP (from 13F) or ticker to a stable security identity (ticker, FIGI,
name, exchange). Free; an API key raises the rate limit AND the batch size
(100 ids/request vs 10), which is what makes large funds (Bridgewater ~1000
positions) resolvable in seconds instead of many minutes.

    POST https://api.openfigi.com/v3/mapping
    header X-OPENFIGI-APIKEY: <key>   (optional but strongly recommended)
    body [{"idType": "ID_CUSIP", "idValue": "67066G104"}, ...]
"""

from __future__ import annotations

import time
from typing import Callable, Iterable, Optional

import requests

from outsider_ingest.providers.base import SecurityIdentity, SymbolProvider

MAPPING_URL = "https://api.openfigi.com/v3/mapping"


class SymbolProviderUnavailable(RuntimeError):
    """OpenFIGI keeps answering 429. Callers fall back to CUSIP-only rows."""


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
        # with a key: 25 req/6s and 100 ids/request; without: slower + 10/request
        self.min_interval_s = 0.3 if api_key else 2.5
        self.batch_size = 100 if api_key else 10
        self._last = 0.0
        # Hard stop instead of an endless retry loop: a few backed-off retries,
        # then the provider pauses for the rest of the run (circuit breaker).
        self.max_retries = 3
        self.retry_base_s = 6.0
        self.retry_cap_s = 30.0
        self.cooldown_s = 15 * 60
        self._paused_until = 0.0
        self.session = requests.Session()
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["X-OPENFIGI-APIKEY"] = api_key
        self.session.headers.update(headers)

    def _throttle(self):
        gap = time.monotonic() - self._last
        if gap < self.min_interval_s:
            time.sleep(self.min_interval_s - gap)

    def _post(self, jobs: list[dict], timeout: int) -> requests.Response:
        """POST with a bounded number of 429 retries. After the last retry the
        provider is paused, so later lookups in the same run fail fast instead
        of sleeping through the whole job timeout."""
        if time.monotonic() < self._paused_until:
            raise SymbolProviderUnavailable("OpenFIGI rate limit: lookups paused")
        for attempt in range(self.max_retries + 1):
            self._throttle()
            resp = self.session.post(MAPPING_URL, json=jobs, timeout=timeout)
            self._last = time.monotonic()
            if resp.status_code != 429:
                resp.raise_for_status()
                return resp
            if attempt < self.max_retries:
                time.sleep(min(self.retry_cap_s, self.retry_base_s * 2**attempt))
        self._paused_until = time.monotonic() + self.cooldown_s
        raise SymbolProviderUnavailable(
            f"OpenFIGI rate limit persisted after {self.max_retries} retries"
        )

    @staticmethod
    def _pick(data: list[dict]) -> dict:
        """OpenFIGI returns one row per listing/exchange for a CUSIP. Prefer the
        US composite listing (exchCode 'US') so we get the familiar US ticker
        (CVX, not a foreign line like CHV). Fall back to the first row."""
        for d in data:
            if d.get("exchCode") == "US":
                return d
        return data[0]

    @staticmethod
    def _job(identifier: str, id_type: str, us_only: bool) -> dict:
        """One mapping job. An unfiltered CUSIP lookup returns up to a hundred
        foreign lines and often not the US one at all (Chevron came back as
        Frankfurt's CHV, Philip Morris as 4I1), so ask for the US composite
        first. Non-US issuers carry a CINS number (a letter first, e.g. ASML
        N07059210), which OpenFIGI only maps as ID_CINS."""
        if id_type == "ID_CUSIP" and identifier[:1].isalpha():
            id_type = "ID_CINS"
        job = {"idType": id_type, "idValue": identifier}
        if us_only:
            job["exchCode"] = "US"
        return job

    @staticmethod
    def _identity(cusip: str, id_type: str, data0: dict) -> SecurityIdentity:
        ticker = data0.get("ticker")
        # OpenFIGI writes share classes with a slash (BRK/B); SEC, logos and the
        # app use a dot (BRK.B), and a slash would break the /stock/ URL.
        if ticker:
            ticker = ticker.strip().upper().replace("/", ".")
        return SecurityIdentity(
            ticker=ticker or None,
            figi=data0.get("figi"),
            name=data0.get("name"),
            cusip=cusip if id_type == "ID_CUSIP" else None,
            exchange=data0.get("exchCode"),
            asset_type=data0.get("securityType"),
        )

    def resolve(self, identifier: str, id_type: str = "ID_CUSIP") -> Optional[SecurityIdentity]:
        if self.cache_get:
            cached = self.cache_get(identifier)
            if cached is not None:
                return cached

        identity = None
        for us_only in (True, False):
            resp = self._post([self._job(identifier, id_type, us_only)], timeout=30)
            payload = resp.json()
            if payload and isinstance(payload[0], dict) and payload[0].get("data"):
                identity = self._identity(identifier, id_type, self._pick(payload[0]["data"]))
                break
        if identity is None:
            return None
        if self.cache_put:
            self.cache_put(identifier, identity)
        return identity

    def resolve_batch(
        self, identifiers: Iterable[str], id_type: str = "ID_CUSIP"
    ) -> dict[str, SecurityIdentity]:
        """Resolve many identifiers at once. Returns {identifier: SecurityIdentity}
        for those that mapped (unmapped ones are simply absent). US listings are
        asked for first; whatever has none (a foreign-only line) is retried
        without the exchange filter."""
        ids = [i for i in dict.fromkeys(identifiers) if i]  # unique, drop blanks
        out: dict[str, SecurityIdentity] = {}
        for us_only in (True, False):
            todo = [i for i in ids if i not in out]
            for start in range(0, len(todo), self.batch_size):
                chunk = todo[start : start + self.batch_size]
                jobs = [self._job(c, id_type, us_only) for c in chunk]
                resp = self._post(jobs, timeout=45)
                for cusip, item in zip(chunk, resp.json()):
                    data = item.get("data") if isinstance(item, dict) else None
                    if data:
                        out[cusip] = self._identity(cusip, id_type, self._pick(data))
        return out
