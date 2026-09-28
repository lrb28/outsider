"""Market-wide insider purchases: index parsing, XML extraction, purchase filter."""

from datetime import date
from pathlib import Path

from outsider_ingest.parse.form4 import parse_form4
from outsider_ingest.pipelines.ingest_insider_buys import (
    ownership_xml,
    parse_daily_index,
    purchases,
    trading_days,
)

FIXTURE = (Path(__file__).parent / "fixtures" / "form4_sample.xml").read_bytes()

INDEX = """Description:           Daily Index of EDGAR Dissemination Feed by Form Type
Form Type   Company Name                                                  CIK         Date Filed  File Name
---------------------------------------------------------------------------------------------------------------------------------------------
4           ACME CORP                                                     1234567     20260925    edgar/data/1234567/0001234567-26-000123.txt
4           DOE JANE                                                      7654321     20260925    edgar/data/7654321/0001234567-26-000123.txt
4/A         BETA INC                                                      2222222     20260925    edgar/data/2222222/0002222222-26-000009.txt
8-K         GAMMA LTD                                                     3333333     20260925    edgar/data/3333333/0003333333-26-000001.txt
"""


def test_index_lists_each_form4_once():
    entries = parse_daily_index(INDEX)
    assert [(e.form, e.accession) for e in entries] == [
        ("4", "0001234567-26-000123"),
        ("4/A", "0002222222-26-000009"),
    ], "issuer and owner lines of one filing collapse; other forms are ignored"
    assert entries[0].filed == date(2026, 9, 25)
    assert entries[0].path == "edgar/data/1234567/0001234567-26-000123.txt"


def test_ownership_xml_is_found_in_a_complete_submission():
    submission = b"<SEC-DOCUMENT>\n<DOCUMENT>\n<TYPE>4\n<TEXT>\n<XML>\n" + FIXTURE + b"\n</XML>\n</TEXT>\n</DOCUMENT>\n</SEC-DOCUMENT>"
    xml = ownership_xml(submission)
    assert xml is not None and xml.lstrip().startswith(b"<?xml")
    assert parse_form4(xml), "the extracted document parses"
    assert ownership_xml(b"<SEC-DOCUMENT><XML><other/></XML></SEC-DOCUMENT>") is None


def _as_purchase(xml: bytes, shares: str = "100000", price: str = "200.50") -> bytes:
    return (
        xml.replace(b"<transactionCode>S</transactionCode>", b"<transactionCode>P</transactionCode>", 1)
        .replace(b"<value>D</value>", b"<value>A</value>", 1)
        .replace(b"<value>100000</value>", f"<value>{shares}</value>".encode(), 1)
        .replace(b"<value>200.50</value>", f"<value>{price}</value>".encode(), 1)
    )


def test_only_open_market_purchases_above_the_minimum_are_kept():
    assert purchases(parse_form4(FIXTURE), 10_000) == [], "sales, grants and exercises are not purchases"
    buys = purchases(parse_form4(_as_purchase(FIXTURE)), 10_000)
    assert len(buys) == 1
    buy = buys[0]
    assert (buy.code, buy.ticker, buy.acquired_disposed, buy.is_derivative) == ("P", "AAPL", "A", False)
    assert buy.shares * buy.price >= 10_000
    small = purchases(parse_form4(_as_purchase(FIXTURE, shares="10", price="5.00")), 10_000)
    assert small == [], "tiny purchases stay out"


def test_trading_days_skip_weekends():
    days = trading_days(date(2026, 9, 28), 3)  # Monday
    assert days == [date(2026, 9, 28), date(2026, 9, 25), date(2026, 9, 24)]
