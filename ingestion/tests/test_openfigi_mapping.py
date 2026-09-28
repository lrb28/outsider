"""CUSIPs must map to the US listing, foreign issuers via CINS.

Without an exchange filter OpenFIGI answered Chevron with Frankfurt's CHV and
Philip Morris with 4I1; ASML's CINS number sent as a CUSIP found nothing.
"""

from outsider_ingest.providers.openfigi import OpenFigiProvider
from outsider_ingest.pipelines.backfill_prices import fetch_start, plausible
from datetime import date


class FakeResponse:
    status_code = 200

    def __init__(self, payload):
        self._payload = payload

    def json(self):
        return self._payload

    def raise_for_status(self):
        pass


class RecordingSession:
    """Answers US-filtered jobs for CVX only; everything else is unmapped."""

    def __init__(self):
        self.jobs = []
        self.headers = {}

    def post(self, url, json, timeout):
        self.jobs.append(json)
        out = []
        for job in json:
            if job["idValue"] == "166764100" and job.get("exchCode") == "US":
                out.append({"data": [{"ticker": "CVX", "figi": "BBG000K4ND22", "exchCode": "US"}]})
            elif job["idValue"] == "084670702" and job.get("exchCode") == "US":
                out.append({"data": [{"ticker": "BRK/B", "figi": "BBG000DWG505", "exchCode": "US"}]})
            elif job["idValue"] == "999999999" and "exchCode" not in job:
                out.append({"data": [{"ticker": "FOO", "figi": "BBG0FOREIGN", "exchCode": "GR"}]})
            else:
                out.append({"warning": "No identifier found."})
        return FakeResponse(out)


def provider():
    p = OpenFigiProvider(api_key="test")
    p.min_interval_s = 0
    p.session = RecordingSession()
    return p


def test_batch_asks_for_us_listing_first_and_normalises_share_classes():
    p = provider()
    out = p.resolve_batch(["166764100", "084670702", "999999999"])
    assert out["166764100"].ticker == "CVX"
    assert out["084670702"].ticker == "BRK.B"
    # Only the unmapped identifier is retried without the filter.
    assert out["999999999"].exchange == "GR"
    first, second = p.session.jobs
    assert all(job["exchCode"] == "US" for job in first)
    assert [job["idValue"] for job in second] == ["999999999"]


def test_foreign_issuers_use_cins():
    job = OpenFigiProvider._job("N07059210", "ID_CUSIP", True)
    assert job == {"idType": "ID_CINS", "idValue": "N07059210", "exchCode": "US"}
    assert OpenFigiProvider._job("166764100", "ID_CUSIP", False) == {"idType": "ID_CUSIP", "idValue": "166764100"}


def test_price_runs_only_top_up_known_history():
    today = date(2026, 9, 28)
    assert fetch_start(None, today) == date(2025, 9, 23)
    assert fetch_start(date(2026, 9, 25), today) == date(2026, 9, 20)
    assert fetch_start(date(2024, 1, 2), today) == date(2025, 9, 23)
    assert plausible("BRK.B") and not plausible("CB1A") and not plausible("4I1")
