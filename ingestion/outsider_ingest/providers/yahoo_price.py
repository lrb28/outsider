"""Yahoo Finance price adapter (PriceProvider) — free EOD, no key.

    https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?range=..&interval=1d

Unofficial endpoint; treat as a FALLBACK behind Stooq. Same PriceProvider
interface, so it is a drop-in. Yahoo also rate-limits datacenter IPs (returned
empty during July-2026 verification) — hence keeping both, plus the paid stubs.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional

import requests

from outsider_ingest.models import PricePoint
from outsider_ingest.providers.base import PriceProvider
from outsider_ingest.providers.stooq_price import PriceUnavailable


class YahooPriceProvider(PriceProvider):
    name = "yahoo"

    def __init__(self, default_range: str = "2y"):
        self.default_range = default_range
        self.session = requests.Session()
        self.session.headers.update(
            {"User-Agent": "Mozilla/5.0 (compatible; Outsider/0.1)"}
        )

    def get_daily_prices(
        self, ticker: str, start: Optional[date] = None, end: Optional[date] = None
    ) -> list[PricePoint]:
        url = (
            f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
            f"?range={self.default_range}&interval=1d"
        )
        resp = self.session.get(url, timeout=30)
        resp.raise_for_status()
        try:
            result = resp.json()["chart"]["result"][0]
        except (KeyError, IndexError, TypeError, ValueError):
            raise PriceUnavailable(f"yahoo returned no chart for {ticker!r}")

        ts = result.get("timestamp") or []
        quote = (result.get("indicators", {}).get("quote") or [{}])[0]
        closes = quote.get("close") or []

        rows: list[PricePoint] = []
        for i, epoch in enumerate(ts):
            close = closes[i] if i < len(closes) else None
            if close is None:
                continue
            d = datetime.fromtimestamp(epoch, tz=timezone.utc).date()
            if start and d < start:
                continue
            if end and d > end:
                continue
            rows.append(
                PricePoint(
                    the_date=d,
                    close=float(close),
                    open=_at(quote.get("open"), i),
                    high=_at(quote.get("high"), i),
                    low=_at(quote.get("low"), i),
                    volume=_int_at(quote.get("volume"), i),
                )
            )
        if not rows:
            raise PriceUnavailable(f"yahoo parsed 0 rows for {ticker!r}")
        rows.sort(key=lambda p: p.the_date)
        return rows


def _at(seq, i) -> Optional[float]:
    if seq and i < len(seq) and seq[i] is not None:
        return float(seq[i])
    return None


def _int_at(seq, i) -> Optional[int]:
    v = _at(seq, i)
    return int(v) if v is not None else None
