"""Parser for SEC Form 13F-HR information tables.

Validated against a real filing: Scion Asset Management (Michael Burry),
Q3-2025, accession 0001649339-25-000007, file `infotable.xml`.
See ingestion/tests/test_form13f_parse.py.

Confirmed modeling notes (from real data):
  * Each <infoTable> element is one reported position.
  * <putCall> is OPTIONAL. When present ('Put' | 'Call') the row is a
    DERIVATIVE. <value> is then the market value of the UNDERLYING (notional),
    NOT the option premium, and <sshPrnamt> is the number of underlying shares.
    Treating a Put as a long holding is the classic 13F mistake (Burry's
    Q3-2025 book is mostly PUTS on NVDA and PLTR — they must not look long).
  * <value> units: filings for periods ending 2022-12-31 onward report WHOLE
    DOLLARS; earlier filings report THOUSANDS. The caller passes
    `values_in_thousands` (the pipeline decides from period_of_report). We keep
    `raw_value` too so nothing is lost. See docs/ARCHITECTURE.md ("13F value
    units").
  * Namespaces vary by filer (default ns vs an `n1:` prefix). We therefore match
    on local element name only, never on a fixed namespace.
  * 13F is LONG US-listed positions + listed options only. Short stock is not
    reported. It is filed up to 45 days after quarter end. Model that lag.
"""

from __future__ import annotations

from typing import Optional

from lxml import etree

from outsider_ingest.models import Holding13F


def _local(tag) -> str:
    if not isinstance(tag, str):
        return ""
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def _child(el, name):
    for c in el:
        if _local(c.tag) == name:
            return c
    return None


def _text(el, name) -> Optional[str]:
    if el is None:
        return None
    c = _child(el, name)
    if c is not None and c.text is not None:
        t = c.text.strip()
        return t or None
    return None


def _int(el, name, default: int = 0) -> int:
    raw = _text(el, name)
    if raw is None:
        return default
    # values can contain commas or decimals in malformed filings
    raw = raw.replace(",", "").split(".")[0]
    try:
        return int(raw)
    except ValueError:
        return default


def parse_information_table(
    xml_bytes: bytes, values_in_thousands: bool = False
) -> list[Holding13F]:
    """Parse a 13F information table into a list of Holding13F.

    Args:
        xml_bytes: raw bytes of the information-table XML document.
        values_in_thousands: scale <value> by 1000 when True (older filings).
    """
    if isinstance(xml_bytes, str):
        xml_bytes = xml_bytes.encode("utf-8")

    # recover=True tolerates the occasional malformed 13F
    parser = etree.XMLParser(recover=True, huge_tree=True)
    root = etree.fromstring(xml_bytes, parser=parser)
    if root is None:
        return []

    holdings: list[Holding13F] = []
    for el in root.iter():
        if _local(el.tag) != "infoTable":
            continue

        cusip = _text(el, "cusip") or ""
        raw_value = _int(el, "value")
        value_usd = raw_value * 1000 if values_in_thousands else raw_value

        shrs = _child(el, "shrsOrPrnAmt")
        shares = _int(shrs, "sshPrnamt") if shrs is not None else 0
        sh_type = (_text(shrs, "sshPrnamtType") if shrs is not None else None) or "SH"

        va = _child(el, "votingAuthority")

        holdings.append(
            Holding13F(
                name_of_issuer=(_text(el, "nameOfIssuer") or "").strip(),
                title_of_class=_text(el, "titleOfClass"),
                cusip=cusip.strip().upper(),
                value_usd=value_usd,
                raw_value=raw_value,
                shares_or_prn=shares,
                sh_prn_type=sh_type,
                put_call=_text(el, "putCall"),
                investment_discretion=_text(el, "investmentDiscretion"),
                voting_sole=_int(va, "Sole") if va is not None else 0,
                voting_shared=_int(va, "Shared") if va is not None else 0,
                voting_none=_int(va, "None") if va is not None else 0,
            )
        )
    return holdings


def infer_values_in_thousands(holdings: list[Holding13F]) -> bool:
    """Best-effort detection of the <value> unit for a filing.

    SEC historically reported 13F values in THOUSANDS of dollars, then moved to
    WHOLE DOLLARS for more recent periods. Rather than hard-code a switch date
    (which is easy to get wrong), we infer per filing from the data itself:

        implied_price = value / shares   (for ordinary long SH positions)

    If values were in thousands, implied_price is ~1000x too small, so the
    median implied price collapses to well under $5. Any real equity book has a
    median share price far above that. This is self-correcting per filing.

    Returns True when values look like thousands and should be multiplied by
    1000. Falls back to False (whole dollars) when it cannot tell.
    """
    implied = []
    for h in holdings:
        if h.put_call is not None or h.sh_prn_type != "SH":
            continue
        if h.shares_or_prn > 0 and h.raw_value > 0:
            implied.append(h.raw_value / h.shares_or_prn)
    if not implied:
        return False
    implied.sort()
    median = implied[len(implied) // 2]
    return median < 5.0
