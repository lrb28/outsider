from datetime import date
from pathlib import Path
import pytest
from lxml import etree
from outsider_ingest.models import PricePoint
from outsider_ingest.parse.form4 import parse_form4
from outsider_ingest.parse.senate import normalize_senate_record
from outsider_ingest.pipelines.backfill_prices import valid_prices

XML = (Path(__file__).parent / "fixtures/form4_sample.xml").read_bytes()

@pytest.mark.parametrize("code, expected", [("P","buy"),("S","sell"),("A","exchange"),("F","exchange"),("D","exchange"),("G","exchange"),("M","exchange")])
def test_form4_codes(code, expected):
    doc = XML.replace(b'<transactionCode>S</transactionCode>', f'<transactionCode>{code}</transactionCode>'.encode())
    row = parse_form4(doc)[0]
    assert row.code == code
    assert row.txn_type == expected


def test_source_rows_remain_distinct():
    rows = parse_form4(XML)
    assert len({row.source_line for row in rows}) == len(rows)
    assert rows[2].is_derivative


def test_invalid_xml_rejected():
    with pytest.raises(etree.XMLSyntaxError):
        parse_form4(b'<ownershipDocument><broken>')

@pytest.mark.parametrize("symbol", ["N/A", "--", "NULL", "none", "", None])
def test_missing_senate_ticker(symbol):
    row = normalize_senate_record({"ticker":symbol,"disclosure_date":"N/A"})
    assert row.ticker is None
    assert row.disclosed_at is None


def test_price_validation():
    points = [PricePoint(date(2026,9,11),20), PricePoint(date(2026,9,14),30), PricePoint(date(2026,9,10),float('nan')), PricePoint(date(2026,9,10),-2)]
    assert valid_prices(points,date(2026,9,13)) == [points[0]]
