"""OpenFIGI must never retry forever on HTTP 429.

A persistent rate limit used to recurse into resolve() without a limit. These
tests pin the bounded retries and the fail-fast pause that follows.
"""

import pytest
import requests

from outsider_ingest.providers import openfigi
from outsider_ingest.providers.openfigi import OpenFigiProvider, SymbolProviderUnavailable


class FakeResponse:
    def __init__(self, status_code, payload=None):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"HTTP {self.status_code}")


class FakeSession:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = 0
        self.headers = {}

    def post(self, url, json, timeout):
        self.calls += 1
        return self.responses.pop(0) if len(self.responses) > 1 else self.responses[0]


@pytest.fixture
def no_sleep(monkeypatch):
    sleeps = []
    monkeypatch.setattr(openfigi.time, "sleep", sleeps.append)
    return sleeps


def provider(responses):
    p = OpenFigiProvider(api_key="test")
    p.min_interval_s = 0  # only count the 429 backoff sleeps
    p.session = FakeSession(responses)
    return p


def test_persistent_429_stops_after_bounded_retries(no_sleep):
    p = provider([FakeResponse(429)])
    with pytest.raises(SymbolProviderUnavailable):
        p.resolve("67066G104")
    assert p.session.calls == p.max_retries + 1
    assert len(no_sleep) == p.max_retries
    assert max(no_sleep) <= p.retry_cap_s


def test_paused_provider_fails_fast_for_rest_of_run(no_sleep):
    p = provider([FakeResponse(429)])
    with pytest.raises(SymbolProviderUnavailable):
        p.resolve("67066G104")
    calls = p.session.calls
    with pytest.raises(SymbolProviderUnavailable):
        p.resolve("037833100")
    with pytest.raises(SymbolProviderUnavailable):
        p.resolve_batch(["037833100", "594918104"])
    assert p.session.calls == calls


def test_transient_429_recovers(no_sleep):
    row = {"data": [{"ticker": "NVDA", "figi": "BBG000BBJQV0", "name": "NVIDIA", "exchCode": "US"}]}
    p = provider([FakeResponse(429), FakeResponse(200, [row])])
    identity = p.resolve("67066G104")
    assert identity.ticker == "NVDA"
    assert p.session.calls == 2


def test_other_http_errors_are_not_retried(no_sleep):
    p = provider([FakeResponse(500)])
    with pytest.raises(requests.HTTPError):
        p.resolve_batch(["67066G104"])
    assert p.session.calls == 1
    assert no_sleep == []
