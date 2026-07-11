"""Stooq price adapter (PriceProvider) — free EOD OHLCV, no key.

    https://stooq.com/q/d/l/?s={ticker}.us&i=d   -> CSV Date,Open,High,Low,Close,Volume

Reliability note: Stooq rate-limits by IP and, when throttled, returns an EMPTY
body or a one-line "N/D". During verification (July 2026) the fetch returned an
empty body from a datacenter IP. We therefore raise `PriceUnavailable` on an
empty/`N/D` response so a CompositePriceProvider can fall back to Yahoo. This is
exactly why PriceProvider is an interface — see docs/ARCHITECTURE.md.
"""

from __future__ import annotations

import csv
import io
import time
from datetime import date, datetime
from typing import Optional

import requests

from outsider_ingest.models import PricePoint
from outsider_ingest.providers.base import PriceProvider


class PriceUnavailable(RuntimeError):
    """Raised when a price source returns nothing usable (throttle/unknown symbol)."""


class StooqPriceProvider(PriceProvider):
    name = "stooq"

    def __init__(self, us_suffix: str = ".us", min_interval_s: float = 0.4):
        self.us_suffix = us_suffix
        self.min_interval_s = min_interval_s
        self._last = 0.0
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": "Outsider/0.1 (+price-backfill)"})

    def _symbol(self, ticker: str) -> str:
        t = ticker.lower()
        return t if "." in t else t + self.us_suffix

    def get_daily_prices(
        self, ticker: str, start: Optional[date] = None, end: Optional[date] = None
    ) -> list[PricePoint]:
        gap = time.monotonic() - self._last
        if gap < self.min_interval_s:
            time.sleep(self.min_interval_s - gap)
        url = f"https://stooq.com/q/d/l/?s={self._symbol(ticker)}&i=d"
        resp = self.session.get(url, timeout=30)
        self._last = time.monotonic()
        resp.raise_for_status()
        text = resp.text.strip()

        if not text or text.upper().startswith("N/D") or "<html" in text.lower():
            raise PriceUnavailable(f"stooq returned no data for {ticker!r} (throttled?)")

        rows: list[PricePoint] = []
        reader = csv.DictReader(io.StringIO(text))
        for r in reader:
            try:
                d = datetime.strptime(r["Date"], "%Y-%m-%d").date()
            except (KeyError, ValueError):
                continue
            if start and d < start:
                continue
            if end and d > end:
                continue

            def num(key: str) -> Optional[float]:
                v = r.get(key)
                try:
                    return float(v) if v not in (None, "", "N/D") else None
                except ValueError:
                    return None

            close = num("Close")
            if close is None:
                continue
            rows.append(
                PricePoint(
                    the_date=d,
                    close=close,
                    open=num("Open"),
                    high=num("High"),
                    low=num("Low"),
                    volume=int(num("Volume")) if num("Volume") is not None else None,
                )
            )
        if not rows:
            raise PriceUnavailable(f"stooq parsed 0 rows for {ticker!r}")
        rows.sort(key=lambda p: p.the_date)
        return rows
