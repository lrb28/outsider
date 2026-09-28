"""13F import skips stored filings and writes new ones in bulk."""

from datetime import date

from outsider_ingest.models import Holding13F
from outsider_ingest.pipelines import ingest_13f
from outsider_ingest.providers.base import FilingRef


def _holding(cusip, name, shares, value=1000):
    return Holding13F(name_of_issuer=name, title_of_class="COM", cusip=cusip, value_usd=value,
                      shares_or_prn=shares, sh_prn_type="SH", put_call=None, investment_discretion="SOLE")


def _ref(n, period):
    return FilingRef(source="sec_edgar", form_type="13F-HR", external_entity_id="1", accession=f"acc{n}",
                     filed_at=date(2026, 8, 14), period_of_report=period, source_url=f"https://sec/acc{n}/",
                     primary_document=None)


OLD, NEW = _ref(1, date(2026, 3, 31)), _ref(2, date(2026, 6, 30))
HOLDINGS = {OLD.source_url: [_holding("AAA", "ALPHA", 10), _holding("BBB", "BETA", 5)],
            NEW.source_url: [_holding("AAA", "ALPHA", 15), _holding("CCC", "GAMMA", 7)]}


class FakeSec:
    def list_filings(self, cik, forms, since):
        return [NEW, OLD]

    def get_13f_holdings(self, ref):
        return HOLDINGS[ref.source_url]


class FakeRepo:
    def __init__(self, stored):
        self.stored, self.bulk, self.txns, self.commits, self.lookups = stored, [], [], 0, 0

    def upsert_entity(self, *a, **k): return 1
    def filing_has_holdings(self, url): return url in self.stored
    def known_securities_by_cusip(self):
        self.lookups += 1
        return {"AAA": 11}, {"AAA": 11, "BBB": 12}
    def cache_get_symbol(self, cusip): return None
    def insert_filing(self, *a): return 99
    def upsert_holdings_bulk(self, rows): self.bulk.extend(rows)
    def upsert_security_by_cusip(self, cusip, name): return {"CCC": 13, "BBB": 12}[cusip]
    def ensure_security_name(self, *a): pass
    def supersede_legacy_transactions(self, filing_id): pass
    def insert_transaction(self, filing_id, entity_id, sid, txn_type, **k): self.txns.append((sid, txn_type))
    def commit(self): self.commits += 1


class FakeConn:
    def close(self): pass


class NoSymbols:
    def resolve_batch(self, cusips): return {}
    def resolve(self, cusip, kind): return None


def _run(monkeypatch, repo):
    monkeypatch.setattr(ingest_13f.config, "get_filings_provider", lambda s: FakeSec())
    monkeypatch.setattr(ingest_13f.config, "get_symbol_provider", lambda: NoSymbols())
    monkeypatch.setattr(ingest_13f, "connect", lambda url: FakeConn())
    monkeypatch.setattr(ingest_13f, "Repository", lambda conn: repo)
    ingest_13f.ingest_institution("1", "Fund", max_filings=2)


def test_stored_filings_are_not_rewritten(monkeypatch):
    repo = FakeRepo({OLD.source_url, NEW.source_url})
    _run(monkeypatch, repo)
    assert (repo.bulk, repo.txns, repo.commits, repo.lookups) == ([], [], 0, 0)


def test_new_filing_is_written_in_bulk_and_diffed_against_the_stored_one(monkeypatch):
    repo = FakeRepo({OLD.source_url})
    _run(monkeypatch, repo)
    assert [(r[2], r[4]) for r in repo.bulk] == [(11, 15), (13, 7)], "cached ids reused, new CUSIP resolved once"
    assert sorted(repo.txns) == [(11, "buy"), (12, "sell"), (13, "buy")], "QoQ changes vs the stored quarter"
    assert repo.commits == 1
