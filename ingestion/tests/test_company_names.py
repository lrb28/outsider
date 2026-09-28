"""Official SEC names replace 13F abbreviations, one name per ticker."""

from outsider_ingest.pipelines.refresh_company_names import official_names


def test_official_names_map_tickers_to_registrant_names():
    payload = {
        "0": {"cik_str": 4904, "ticker": "AEP", "title": "AMERICAN ELECTRIC POWER CO INC"},
        "1": {"cik_str": 932787, "ticker": "stm", "title": "STMicroelectronics  N.V."},
        "2": {"cik_str": 1652044, "ticker": "GOOGL", "title": "Alphabet Inc."},
        "3": {"cik_str": 1652044, "ticker": "GOOGL", "title": "Alphabet Inc. Class A duplicate"},
        "4": {"cik_str": 1, "ticker": "", "title": "No ticker"},
    }
    names = official_names(payload)
    assert names == {
        "AEP": "AMERICAN ELECTRIC POWER CO INC",
        "STM": "STMicroelectronics N.V.",
        "GOOGL": "Alphabet Inc.",
    }
