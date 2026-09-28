"""Yahoo Finance price adapter (PriceProvider) — free EOD, no key.

    https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?range=..&interval=1d

Unofficial endpoint; treat as a FALLBACK behind Stooq. Same PriceProvider
interface, so it is a drop-in. Yahoo also rate-limits datacenter IPs (returned
empty during July-2026 verification) — hence keeping both, plus the paid stubs.
"""

from __future__ import annotations

import time
from datetime import date, datetime, timezone
from typing import Optional

import requests

from outsider_ingest.models import PricePoint
from outsider_ingest.providers.base import PriceProvider
from outsider_ingest.providers.stooq_price import PriceUnavailable


class YahooPriceProvider(PriceProvider):
    name = "yahoo"

    def __init__(self, default_range: str = "1y", timeout_s: float = 8):
        self.timeout_s = timeout_s
        self.default_range = default_range
        self.session = requests.Session()
        # Keep this short UA: a full browser string makes Yahoo demand a
        # cookie consent and answer 429, a bare library UA is blocked too.
        self.session.headers.update(
            {"User-Agent": "Mozilla/5.0 (compatible; Outsider/0.1)"}
        )

    def get_daily_prices(
        self, ticker: str, start: Optional[date] = None, end: Optional[date] = None
    ) -> list[PricePoint]:
        # Yahoo throttles in bursts (429). Back off briefly and alternate
        # between its two API hosts instead of failing the symbol at once.
        resp = None
        # Share classes: SEC writes BRK.B, Yahoo expects BRK-B.
        symbol = ticker.strip().upper().replace(".", "-")
        # An explicit window keeps daily top-ups small: a symbol that already
        # has history only needs its last few sessions, not a whole year.
        if start:
            period1 = int(datetime(start.year, start.month, start.day, tzinfo=timezone.utc).timestamp())
            period2 = int(datetime.now(timezone.utc).timestamp()) + 86400
            window = f"period1={period1}&period2={period2}"
        else:
            window = f"range={self.default_range}"
        for attempt, host in enumerate(("query1", "query2", "query1")):
            url = (
                f"https://{host}.finance.yahoo.com/v8/finance/chart/{symbol}"
                f"?{window}&interval=1d"
            )
            resp = self.session.get(url, timeout=self.timeout_s)
            if resp.status_code != 429:
                break
            time.sleep(1.5 * (attempt + 1))
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
