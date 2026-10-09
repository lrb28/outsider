"""Load investor letters from ingestion/letters/*.json into the letters table.

Each file is one letter, memo or public letter to a company: where it came
from, and a summary written from the original text (headline, summary,
takeaways, risks, verbatim quotes, the stocks it discusses). The files are
the source of truth and are reviewed like code; this job only checks them
and upserts by slug, so editing a file and re-running updates the row.

  PYTHONPATH=. python -m outsider_ingest.pipelines.ingest_letters
  PYTHONPATH=. python -m outsider_ingest.pipelines.ingest_letters --check   # validate only
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import date
from pathlib import Path

from outsider_ingest import config

LETTERS_DIR = Path(__file__).resolve().parents[2] / "letters"
KINDS = {"annual_letter", "quarterly_letter", "memo", "activist_letter", "commentary"}
STANCES = {"bullish", "neutral", "bearish"}
LABELS = {"Move", "View", "Watch"}
SCOPES = {"Company", "Industry", "Market", "Macro"}
SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
TICKER_RE = re.compile(r"^[A-Z][A-Z0-9.\-]{0,9}$")
REQUIRED = ("slug", "author", "kind", "title", "published_on", "source_url", "stance", "headline", "summary")


def validate(letter: dict, name: str = "") -> list[str]:
    """Problems with one letter file; empty when it can be loaded."""
    where = name or letter.get("slug", "?")
    errors = [f"{where}: missing {k}" for k in REQUIRED if not letter.get(k)]
    if errors:
        return errors
    if not SLUG_RE.match(letter["slug"]):
        errors.append(f"{where}: slug must be lower-case words joined by hyphens")
    if name and Path(name).stem != letter["slug"]:
        errors.append(f"{where}: file name and slug differ")
    if letter["kind"] not in KINDS:
        errors.append(f"{where}: kind {letter['kind']!r} not in {sorted(KINDS)}")
    if letter["stance"] not in STANCES:
        errors.append(f"{where}: stance {letter['stance']!r} not in {sorted(STANCES)}")
    if letter.get("published_precision", "day") not in {"day", "month"}:
        errors.append(f"{where}: published_precision must be day or month")
    try:
        if date.fromisoformat(letter["published_on"]) > date.today():
            errors.append(f"{where}: published_on is in the future")
    except ValueError:
        errors.append(f"{where}: published_on must be YYYY-MM-DD")
    if not str(letter["source_url"]).startswith("https://"):
        errors.append(f"{where}: source_url must be https")
    if len(letter["headline"]) > 160:
        errors.append(f"{where}: headline longer than 160 characters")
    for t in letter.get("takeaways", []):
        if t.get("label") not in LABELS or not t.get("text"):
            errors.append(f"{where}: takeaway needs a label in {sorted(LABELS)} and text")
        for ticker in t.get("tickers", []):
            if not TICKER_RE.match(ticker):
                errors.append(f"{where}: bad ticker {ticker!r} in takeaways")
    for r in letter.get("risks", []):
        if r.get("scope") not in SCOPES or not r.get("text"):
            errors.append(f"{where}: risk needs a scope in {sorted(SCOPES)} and text")
    for q in letter.get("quotes", []):
        if not q.get("text") or len(q["text"]) > 400:
            errors.append(f"{where}: quotes must be short excerpts (under 400 characters)")
    for s in letter.get("stocks", []):
        if not s.get("company") or s.get("stance") not in STANCES:
            errors.append(f"{where}: stock needs a company and a stance")
        if s.get("ticker") is not None and not TICKER_RE.match(s["ticker"]):
            errors.append(f"{where}: bad ticker {s['ticker']!r} in stocks")
    return errors


def load_files(directory: Path = LETTERS_DIR) -> tuple[list[dict], list[str]]:
    letters, errors = [], []
    for path in sorted(directory.glob("*.json")):
        try:
            letter = json.loads(path.read_text())
        except json.JSONDecodeError as e:
            errors.append(f"{path.name}: invalid JSON ({e})")
            continue
        problems = validate(letter, path.name)
        errors.extend(problems)
        if not problems:
            letters.append(letter)
    return letters, errors


UPSERT = """
insert into letters (slug, entity_id, author, org, kind, title, published_on, published_precision,
                     source_url, source_name, stance, headline, summary, takeaways, risks, quotes,
                     stocks, summarized_by, updated_at)
values (%(slug)s, (select id from entities where slug = %(investor)s), %(author)s, %(org)s, %(kind)s,
        %(title)s, %(published_on)s, %(published_precision)s, %(source_url)s, %(source_name)s,
        %(stance)s, %(headline)s, %(summary)s, %(takeaways)s::jsonb, %(risks)s::jsonb,
        %(quotes)s::jsonb, %(stocks)s::jsonb, %(summarized_by)s, now())
on conflict (slug) do update set
  entity_id = excluded.entity_id, author = excluded.author, org = excluded.org, kind = excluded.kind,
  title = excluded.title, published_on = excluded.published_on,
  published_precision = excluded.published_precision, source_url = excluded.source_url,
  source_name = excluded.source_name, stance = excluded.stance, headline = excluded.headline,
  summary = excluded.summary, takeaways = excluded.takeaways, risks = excluded.risks,
  quotes = excluded.quotes, stocks = excluded.stocks, summarized_by = excluded.summarized_by,
  updated_at = now()
"""


def row(letter: dict) -> dict:
    return {
        "slug": letter["slug"],
        "investor": letter.get("investor"),
        "author": letter["author"],
        "org": letter.get("org"),
        "kind": letter["kind"],
        "title": letter["title"],
        "published_on": letter["published_on"],
        "published_precision": letter.get("published_precision", "day"),
        "source_url": letter["source_url"],
        "source_name": letter.get("source_name"),
        "stance": letter["stance"],
        "headline": letter["headline"],
        "summary": letter["summary"],
        "takeaways": json.dumps(letter.get("takeaways", [])),
        "risks": json.dumps(letter.get("risks", [])),
        "quotes": json.dumps(letter.get("quotes", [])),
        "stocks": json.dumps(letter.get("stocks", [])),
        "summarized_by": letter.get("summarized_by", "Outsider editors"),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="only validate the files")
    args = ap.parse_args()
    letters, errors = load_files()
    for e in errors:
        print(f"  INVALID {e}")
    print(f"[letters] {len(letters)} valid files")
    if errors:
        raise SystemExit(1)
    if args.check:
        return
    from outsider_ingest.db import connect

    with connect(config.DATABASE_URL) as conn:
        with conn.cursor() as cur:
            for letter in letters:
                cur.execute(UPSERT, row(letter))
        missing = conn.execute(
            "select slug from letters where entity_id is null and slug = any(%s)",
            ([l["slug"] for l in letters if l.get("investor")],),
        ).fetchall()
        conn.commit()
    for (slug,) in missing:
        print(f"  note: {slug} names an investor that is not in the database")
    print(f"[letters] upserted {len(letters)}")


if __name__ == "__main__":
    main()
