"""Draft a letter file (ingestion/letters/<slug>.json) from the original.

A maintainer tool, not part of the daily job: it reads a letter, memo or
public letter to a company (PDF or web page), has Claude write the summary in
the house format, checks the result, and writes the JSON file for review.
Nothing reaches the app until the file is reviewed, committed and loaded by
`ingest_letters`, so every summary has passed a person.

  pip install anthropic            # only this tool needs it
  export ANTHROPIC_API_KEY=...     # or an `ant auth login` profile
  PYTHONPATH=. python -m outsider_ingest.pipelines.draft_letter \\
      --url https://www.oaktreecapital.com/docs/default-source/memos/....pdf \\
      --investor oaktree-capital-management-lp --author "Howard Marks" \\
      --org "Oaktree Capital" --kind memo --slug oaktree-some-memo

The draft is checked like every letter file (ingest_letters.validate), and
each quote is looked up in the document's own text: a quote that cannot be
found verbatim is reported, so it can be fixed or dropped before committing.
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import re
import sys
from datetime import date
from pathlib import Path

import requests

from outsider_ingest.pipelines.ingest_letters import KINDS, LABELS, LETTERS_DIR, SCOPES, STANCES, validate

MODEL = "claude-opus-5-5"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"

INSTRUCTIONS = """You summarise investor letters for Outsider, an app that shows what investors, insiders and politicians disclose. Readers are private investors on a phone. Write in plain, short English sentences, in your own words, and stay strictly with what the document says: no outside facts, no figures that are not in it, no advice.

Fill the fields like this:
- title: the document's own title, cleaned up (e.g. "Berkshire Hathaway 2025 Shareholder Letter").
- published_on: the date printed in the document (YYYY-MM-DD). If it only gives a month, use the first day of that month and set published_precision to "month"; otherwise "day".
- stance: the overall tone toward markets or the author's holdings. "bullish" when the author is clearly constructive, "bearish" when the letter mainly warns, otherwise "neutral".
- headline: one sentence of at most 150 characters with the letter's main point, naming the author.
- summary: one paragraph of 80 to 120 words: what happened, what the author thinks, what they did.
- takeaways: three to five. label "Move" for something the author did (bought, sold, decided), "View" for an opinion, "Watch" for something the author says to watch. tickers: US tickers the item is about, only when you are sure of them.
- risks: two or three risks the author names. scope is "Company", "Industry", "Market" or "Macro".
- quotes: two or three short passages copied word for word from the document (at most 40 words each), with a few words of context such as "On the cash pile".
- stocks: every company the letter discusses in a meaningful way (not passing mentions), up to fourteen. ticker is the US ticker when you are sure, otherwise null. stance is the author's view of that company. note is one short sentence with the reason or the figure the letter gives."""

SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "published_on": {"type": "string"},
        "published_precision": {"type": "string", "enum": ["day", "month"]},
        "stance": {"type": "string", "enum": sorted(STANCES)},
        "headline": {"type": "string"},
        "summary": {"type": "string"},
        "takeaways": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "label": {"type": "string", "enum": sorted(LABELS)},
                    "text": {"type": "string"},
                    "tickers": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["label", "text", "tickers"],
                "additionalProperties": False,
            },
        },
        "risks": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "scope": {"type": "string", "enum": sorted(SCOPES)},
                    "text": {"type": "string"},
                },
                "required": ["scope", "text"],
                "additionalProperties": False,
            },
        },
        "quotes": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"text": {"type": "string"}, "context": {"type": "string"}},
                "required": ["text", "context"],
                "additionalProperties": False,
            },
        },
        "stocks": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "ticker": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                    "company": {"type": "string"},
                    "stance": {"type": "string", "enum": sorted(STANCES)},
                    "note": {"type": "string"},
                },
                "required": ["ticker", "company", "stance", "note"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["title", "published_on", "published_precision", "stance", "headline", "summary", "takeaways", "risks", "quotes", "stocks"],
    "additionalProperties": False,
}


def fetch(url: str) -> tuple[bytes, str]:
    resp = requests.get(url, headers={"User-Agent": UA}, timeout=60)
    resp.raise_for_status()
    kind = "pdf" if resp.content[:5] == b"%PDF-" or "pdf" in resp.headers.get("content-type", "") else "html"
    return resp.content, kind


def document_text(content: bytes, kind: str) -> str:
    """Plain text of the original, for the quote check (and as the input for web pages)."""
    if kind == "pdf":
        import pdfplumber

        with pdfplumber.open(io.BytesIO(content)) as pdf:
            return "\n".join((p.extract_text() or "") for p in pdf.pages)
    from lxml import html as lxml_html

    tree = lxml_html.fromstring(content)
    for bad in tree.xpath("//script|//style|//nav|//footer|//header"):
        bad.getparent().remove(bad)
    return re.sub(r"\n\s*\n+", "\n\n", tree.text_content()).strip()


def _norm(s: str) -> str:
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"').replace("–", "-").replace("—", "-")
    s = re.sub(r"-\s*\n\s*", "", s)  # words hyphenated across lines
    return re.sub(r"\s+", " ", s).strip().lower()


def missing_quotes(quotes: list[dict], text: str) -> list[str]:
    """Quotes that do not appear word for word in the document's text."""
    hay = _norm(text)
    return [q["text"] for q in quotes if _norm(q["text"]).strip(" .\"'") not in hay]


def summarize(content: bytes, kind: str, text: str) -> dict:
    try:
        import anthropic
    except ImportError:
        sys.exit("This tool needs the Anthropic SDK: pip install anthropic")

    if kind == "pdf":
        source = {
            "type": "document",
            "source": {"type": "base64", "media_type": "application/pdf", "data": base64.standard_b64encode(content).decode()},
        }
    else:
        source = {"type": "text", "text": f"<document>\n{text}\n</document>"}

    client = anthropic.Anthropic()
    # Streaming: a long PDF and a long answer can outlast a plain request's timeout.
    with client.beta.messages.stream(
        model=MODEL,
        max_tokens=16000,
        betas=["server-side-fallback-2026-07-01"],
        # On a safety decline the API retries on Anthropic's recommended model.
        extra_body={"fallbacks": "default"},
        system=INSTRUCTIONS,
        output_config={"effort": "high", "format": {"type": "json_schema", "schema": SCHEMA}},
        messages=[{"role": "user", "content": [source, {"type": "text", "text": "Summarise this document in the format described."}]}],
    ) as stream:
        message = stream.get_final_message()
    if message.stop_reason == "refusal":
        sys.exit("The model declined to summarise this document.")
    if message.stop_reason == "max_tokens":
        sys.exit("The summary was cut off (max_tokens); try again.")
    body = next(b.text for b in message.content if b.type == "text")
    return json.loads(body)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", required=True, help="the original document (PDF or web page)")
    ap.add_argument("--investor", required=True, help="entity slug, e.g. berkshire-hathaway-inc")
    ap.add_argument("--author", required=True)
    ap.add_argument("--org")
    ap.add_argument("--kind", required=True, choices=sorted(KINDS))
    ap.add_argument("--slug", required=True, help="file name, e.g. oaktree-some-memo")
    ap.add_argument("--source-name", help="shown as the source, e.g. oaktreecapital.com")
    ap.add_argument("--force", action="store_true", help="overwrite an existing file")
    args = ap.parse_args()

    out = LETTERS_DIR / f"{args.slug}.json"
    if out.exists() and not args.force:
        sys.exit(f"{out} exists; pass --force to replace it")

    content, kind = fetch(args.url)
    text = document_text(content, kind)
    draft = summarize(content, kind, text)
    letter = {
        "slug": args.slug,
        "investor": args.investor,
        "author": args.author,
        "org": args.org,
        "kind": args.kind,
        "title": draft["title"],
        "published_on": draft["published_on"],
        "published_precision": draft["published_precision"],
        "source_url": args.url,
        "source_name": args.source_name or re.sub(r"^www\.", "", requests.utils.urlparse(args.url).netloc),
        "stance": draft["stance"],
        "headline": draft["headline"],
        "summary": draft["summary"],
        "takeaways": draft["takeaways"],
        "risks": draft["risks"],
        "quotes": draft["quotes"],
        "stocks": draft["stocks"],
        "summarized_by": f"Outsider editors with {MODEL}",
    }
    out.write_text(json.dumps(letter, ensure_ascii=False, indent=2) + "\n")
    print(f"Draft written to {out}")
    problems = validate(letter, out.name)
    for p in problems:
        print(f"  CHECK  {p}")
    for q in missing_quotes(letter["quotes"], text):
        print(f"  QUOTE not found word for word, fix or drop it: “{q[:90]}”")
    if date.fromisoformat(letter["published_on"]) > date.today():
        print("  CHECK  the date lies in the future")
    print("Read it against the original before committing it.")


if __name__ == "__main__":
    main()
