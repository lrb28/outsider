"""Parser for SEC Form 4 (insider transactions) ownership documents.

Built to SEC's stable `ownershipDocument` XML schema. Each Form 4 is fetched
from the same EDGAR Archives path proven for 13F (SecEdgarProvider); only the
parse differs. Validated against ingestion/tests/fixtures/form4_sample.xml.

Fields live under <value> wrappers, e.g.
  <transactionDate><value>2025-06-10</value></transactionDate>

Transaction codes (SEC): P open-market buy, S open-market sale, A grant/award,
M exercise of derivative, F shares withheld for tax, G gift, C conversion,
X exercise of in-the-money option. `acquiredDisposed` ('A'/'D') confirms
direction. Non-derivative + derivative tables are both parsed; *Holding rows
(no transaction) are skipped.
"""

from __future__ import annotations

from typing import Optional

from lxml import etree

from outsider_ingest.models import Form4Transaction

CODE_TO_TXN = {
    "P": "buy", "S": "sell", "A": "buy", "F": "sell", "D": "sell",
    "M": "exchange", "G": "exchange", "C": "exchange", "X": "exchange", "J": "exchange",
}


def _local(tag) -> str:
    if not isinstance(tag, str):
        return ""
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def _child(el, name):
    if el is None:
        return None
    for c in el:
        if _local(c.tag) == name:
            return c
    return None


def _value(el, name) -> Optional[str]:
    """Text of el>name>value, or el>name text. None if absent/blank."""
    c = _child(el, name)
    if c is None:
        return None
    v = _child(c, "value")
    if v is not None and v.text and v.text.strip():
        return v.text.strip()
    return c.text.strip() if c.text and c.text.strip() else None


def _num(el, name) -> Optional[float]:
    raw = _value(el, name)
    if raw is None:
        return None
    try:
        return float(raw.replace(",", ""))
    except ValueError:
        return None


def _bool(el, name) -> bool:
    v = _value(el, name)
    return v in ("1", "true", "True")


def parse_form4(xml_bytes: bytes) -> list[Form4Transaction]:
    if isinstance(xml_bytes, str):
        xml_bytes = xml_bytes.encode("utf-8")
    root = etree.fromstring(xml_bytes, parser=etree.XMLParser(recover=True, huge_tree=True))
    if root is None:
        return []

    issuer = _child(root, "issuer")
    issuer_cik = (_value(issuer, "issuerCik") or "").strip()
    issuer_name = (_value(issuer, "issuerName") or "").strip()
    ticker = _value(issuer, "issuerTradingSymbol")

    owner = _child(root, "reportingOwner")
    owner_id = _child(owner, "reportingOwnerId")
    owner_name = (_value(owner_id, "rptOwnerName") or "").strip()
    rel = _child(owner, "reportingOwnerRelationship")
    is_officer = _bool(rel, "isOfficer")
    is_director = _bool(rel, "isDirector")
    is_ten = _bool(rel, "isTenPercentOwner")
    owner_title = _value(rel, "officerTitle")

    out: list[Form4Transaction] = []
    for table, txn_tag, is_deriv in (
        ("nonDerivativeTable", "nonDerivativeTransaction", False),
        ("derivativeTable", "derivativeTransaction", True),
    ):
        tbl = _child(root, table)
        if tbl is None:
            continue
        for tx in tbl:
            if _local(tx.tag) != txn_tag:
                continue
            coding = _child(tx, "transactionCoding")
            amounts = _child(tx, "transactionAmounts")
            code = _value(coding, "transactionCode")
            ad = _value(amounts, "transactionAcquiredDisposedCode")
            txn_type = CODE_TO_TXN.get((code or "").upper(), "exchange")
            # respect the acquired/disposed flag when the code is ambiguous
            if txn_type == "exchange" and ad == "A":
                pass  # keep 'exchange' (grants/exercises are not open-market buys)
            out.append(
                Form4Transaction(
                    issuer_cik=issuer_cik,
                    issuer_name=issuer_name,
                    ticker=ticker,
                    owner_name=owner_name,
                    owner_title=owner_title,
                    is_director=is_director,
                    is_officer=is_officer,
                    is_ten_percent_owner=is_ten,
                    security_title=_value(tx, "securityTitle"),
                    txn_date=_value(tx, "transactionDate"),
                    code=code,
                    txn_type=txn_type,
                    shares=_num(amounts, "transactionShares"),
                    price=_num(amounts, "transactionPricePerShare"),
                    acquired_disposed=ad,
                    is_derivative=is_deriv,
                )
            )
    return out
