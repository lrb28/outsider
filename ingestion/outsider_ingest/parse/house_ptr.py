"""Best-effort extractor for US House Periodic Transaction Report (PTR) PDFs.

This is the hardest source: transactions live inside PDFs whose layout varies,
and older ones are SCANNED (image-only) and need OCR. This module does a
reasonable text-layer pass with pdfplumber and regexes; it is deliberately
conservative (returns [] rather than guessing wrong) and is expected to need
real-world tuning. For the MVP, the Senate JSON mirror is the reliable politician
path; House PTRs come online as this parser is hardened.

Returns a list of dicts:
  {ticker, asset, raw_type, txn_type, txn_date, notification_date, amount,
   amount_min, amount_max, owner}

pdfplumber is imported lazily so the package imports without it installed.
"""

from __future__ import annotations

import re
from typing import Optional

from outsider_ingest.parse.senate import parse_amount_range

# House PTRs usually render the ticker in parentheses, e.g. "Apple Inc. (AAPL)"
TICKER_RE = re.compile(r"\(([A-Z]{1,5})\)")
AMOUNT_RE = re.compile(r"\$[\d,]+\s*-\s*\$[\d,]+|\$[\d,]+\s*\+")
DATE_RE = re.compile(r"\b(\d{2}/\d{2}/\d{4})\b")
TYPE_RE = re.compile(r"\b(P|S|E|Purchase|Sale(?:\s*\((?:Full|Partial)\))?|Exchange)\b")

TYPE_MAP = {"p": "buy", "purchase": "buy", "s": "sell", "sale": "sell", "e": "exchange", "exchange": "exchange"}


def _iso(mmddyyyy: str) -> Optional[str]:
    from datetime import datetime

    try:
        return datetime.strptime(mmddyyyy, "%m/%d/%Y").date().isoformat()
    except ValueError:
        return None


def looks_scanned(text: str) -> bool:
    return len(text.strip()) < 40


def extract_transactions(pdf_bytes: bytes) -> list[dict]:
    try:
        import pdfplumber  # lazy
    except ImportError as e:  # pragma: no cover
        raise RuntimeError("pdfplumber not installed; `pip install pdfplumber`") from e

    import io

    rows: list[dict] = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        text = "\n".join((page.extract_text() or "") for page in pdf.pages)

    if looks_scanned(text):
        # image-only PDF -> needs OCR (ocrmypdf/pytesseract). Signal caller to skip.
        return []
    return parse_ptr_text(text)


def parse_ptr_text(text: str) -> list[dict]:
    """Pure text -> rows (unit-testable without a PDF)."""
    rows: list[dict] = []
    for line in text.splitlines():
        amt = AMOUNT_RE.search(line)
        tkr = TICKER_RE.search(line)
        if not amt or not tkr:
            continue
        typ = TYPE_RE.search(line)
        dates = DATE_RE.findall(line)
        raw_type = typ.group(1) if typ else None
        amin, amax = parse_amount_range(amt.group(0))
        rows.append(
            {
                "ticker": tkr.group(1),
                "asset": line.split("(")[0].strip()[:120],
                "raw_type": raw_type,
                "txn_type": TYPE_MAP.get((raw_type or "").strip().lower(), "exchange"),
                "txn_date": _iso(dates[0]) if dates else None,
                "notification_date": _iso(dates[1]) if len(dates) > 1 else None,
                "amount": amt.group(0),
                "amount_min": amin,
                "amount_max": amax,
                "owner": None,
            }
        )
    return rows
