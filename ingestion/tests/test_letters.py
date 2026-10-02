"""The letter files in ingestion/letters are complete and well-formed."""

import copy

from outsider_ingest.pipelines.ingest_letters import load_files, validate

GOOD = {
    "slug": "x-2025-letter", "author": "A", "kind": "memo", "title": "T", "published_on": "2026-01-01",
    "source_url": "https://example.com/x.pdf", "stance": "neutral", "headline": "H", "summary": "S",
    "takeaways": [{"label": "View", "text": "t", "tickers": ["BRK.B"]}],
    "risks": [{"scope": "Macro", "text": "r"}],
    "quotes": [{"text": "q"}],
    "stocks": [{"ticker": None, "company": "Eurobank", "stance": "bullish"}],
}


def test_repository_letters_are_valid():
    letters, errors = load_files()
    assert errors == []
    assert len(letters) >= 8
    assert len({l["slug"] for l in letters}) == len(letters)


def test_validation_catches_mistakes():
    assert validate(GOOD) == []
    for change, needle in [
        (lambda l: l.update(stance="optimistic"), "stance"),
        (lambda l: l.update(kind="tweet"), "kind"),
        (lambda l: l.update(source_url="http://example.com"), "https"),
        (lambda l: l.update(published_on="2026-13-01"), "YYYY-MM-DD"),
        (lambda l: l["takeaways"].append({"label": "Consider", "text": "x"}), "label"),
        (lambda l: l["stocks"].append({"ticker": "brk b", "company": "x", "stance": "neutral"}), "ticker"),
        (lambda l: l.pop("headline"), "missing headline"),
    ]:
        bad = copy.deepcopy(GOOD)
        change(bad)
        assert any(needle in e for e in validate(bad)), needle
