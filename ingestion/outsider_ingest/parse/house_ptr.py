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


# A transaction starts on the line that carries its type and both dates:
#   "SP Broadcom Inc. - Common Stock P 08/12/2026 09/15/2026 $1,001 - $15,000"
# The ticker "(AVGO)", the asset code "[ST]" and the rest of a wrapped amount
# follow on the next lines, until the next transaction or a field line such as
# "F      S     : New" (filing status) or "S          O : ..." (subholding).
ROW_RE = re.compile(
    r"^(?:(?P<owner>SP|JT|DC)\s+)?(?P<asset>.*?)\s+"
    r"(?P<type>P|S(?:\s*\((?:partial|Partial|full|Full)\))?|E)\s+"
    r"(?P<date>\d{2}/\d{2}/\d{4})\s+(?P<notif>\d{2}/\d{2}/\d{4})\s*"
    r"(?P<amount>.*)$"
)
FIELD_RE = re.compile(r"^[A-Z](?:\s{2,}[A-Z]?)+\s*:")
BLOCK_END = ("* For the complete list", "I CERTIFY", "Digitally Signed", "I          V", "Filing ID #")
PAREN_TICKER_RE = re.compile(r"\(([A-Z][A-Z0-9.\-]{0,6})\)")
ASSET_CODE_RE = re.compile(r"\[([A-Z]{2})\]")
MONEY_RE = re.compile(r"\$[\d,]+")


def _amount(text: str) -> tuple[str, Optional[int], Optional[int]]:
    """Normalise "$1,001 - $15,000", "$15,001 -" + "$50,000", "Over $50,000,000"."""
    values = [int(v[1:].replace(",", "")) for v in MONEY_RE.findall(text)]
    if not values:
        return text.strip(), None, None
    if text.strip().lower().startswith("over") or (len(values) == 1 and "-" not in text):
        return text.strip(), values[0], None
    lo, hi = values[0], values[1] if len(values) > 1 else None
    return f"${lo:,} - ${hi:,}" if hi else f"${lo:,} -", lo, hi


def parse_ptr_text(text: str) -> list[dict]:
    """Pure text -> rows (unit-testable without a PDF)."""
    blocks: list[tuple[re.Match, list[str]]] = []
    current: Optional[tuple[re.Match, list[str]]] = None
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        match = ROW_RE.match(line)
        if match:
            current = (match, [])
            blocks.append(current)
            continue
        if current is None:
            continue
        if FIELD_RE.match(line) or line.startswith(BLOCK_END):
            current = None  # details of this transaction are complete
            continue
        current[1].append(line)

    rows: list[dict] = []
    for match, extra in blocks:
        tail = " ".join(extra)
        amount_text = match.group("amount")
        # A wrapped range ends on a following line: "$15,001 -" ... "[ST] $50,000".
        if amount_text.rstrip().endswith("-"):
            more = MONEY_RE.search(tail)
            if more:
                amount_text = f"{amount_text} {more.group(0)}"
        amount, amin, amax = _amount(amount_text)
        asset_text = f"{match.group('asset')} {tail}"
        ticker = PAREN_TICKER_RE.search(asset_text)
        code = ASSET_CODE_RE.search(asset_text)
        raw_type = match.group("type")
        asset = PAREN_TICKER_RE.split(match.group("asset") + " " + tail)[0]
        asset = ASSET_CODE_RE.sub("", asset).strip(" -")
        rows.append(
            {
                "ticker": ticker.group(1) if ticker else None,
                "asset": asset[:120],
                "asset_code": code.group(1) if code else None,
                "raw_type": raw_type,
                "txn_type": TYPE_MAP.get(raw_type.split("(")[0].strip().lower(), "exchange"),
                "txn_date": _iso(match.group("date")),
                "notification_date": _iso(match.group("notif")),
                "amount": amount,
                "amount_min": amin,
                "amount_max": amax,
                "owner": match.group("owner"),
            }
        )
    return rows
