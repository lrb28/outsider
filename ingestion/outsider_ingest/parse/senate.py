"""Normalize US Senate STOCK Act records (from the free eFD JSON mirror) into
the canonical PoliticianTxn shape.

Mirror record schema (senate-stock-watcher), one object per transaction:
  transaction_date, owner, ticker, asset_description, asset_type, type,
  amount, comment, senator, ptr_link, disclosure_date

Unlike the House feed, the Senate mirror is already transaction-level, so no PDF
parsing is needed for the MVP. Kept behind SenateDisclosureProvider so it can be
swapped for direct eFD scraping later.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Optional

from outsider_ingest.models import PoliticianTxn

TYPE_MAP = {
    "purchase": "buy",
    "sale (full)": "sell",
    "sale (partial)": "sell",
    "sale": "sell",
    "exchange": "exchange",
}


def parse_amount_range(s: Optional[str]) -> tuple[Optional[float], Optional[float]]:
    """'$1,001 - $15,000' -> (1001.0, 15000.0); '$1,000,001+' -> (1000001.0, None)."""
    if not s:
        return (None, None)
    nums = re.findall(r"[\d,]+", s.replace("$", ""))
    vals = [float(n.replace(",", "")) for n in nums if n.replace(",", "").isdigit()]
    if not vals:
        return (None, None)
    if len(vals) == 1:
        return (vals[0], None)
    return (vals[0], vals[1])


def _iso(s: Optional[str]) -> Optional[str]:
    if not s or s.strip() in ("--", ""):
        return None
    for fmt in ("%m/%d/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s.strip(), fmt).date().isoformat()
        except ValueError:
            continue
    return None


def normalize_senate_record(rec: dict) -> PoliticianTxn:
    raw_type = rec.get("type")
    txn_type = TYPE_MAP.get((raw_type or "").strip().lower(), "exchange")
    amin, amax = parse_amount_range(rec.get("amount"))
    ticker = rec.get("ticker")
    ticker = None if ticker in (None, "--", "") else str(ticker).strip().upper()
    return PoliticianTxn(
        politician_name=(rec.get("senator") or "").strip(),
        chamber="Senate",
        ticker=ticker,
        asset_description=(rec.get("asset_description") or "").strip(),
        txn_type=txn_type,
        amount_min=amin,
        amount_max=amax,
        txn_date=_iso(rec.get("transaction_date")),
        disclosed_at=_iso(rec.get("disclosure_date")),
        owner=rec.get("owner"),
        source_url=rec.get("ptr_link"),
        raw_type=raw_type,
    )


def normalize_all(records: list[dict]) -> list[PoliticianTxn]:
    return [normalize_senate_record(r) for r in records]
