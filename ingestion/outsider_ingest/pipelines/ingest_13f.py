"""Ingest institutional 13F-HR filings into Postgres.

Flow (per institution): submissions.json -> list 13F-HR filings -> for the most
recent couple: fetch info table, parse, upsert holdings, and derive QoQ
position-change transactions vs the prior quarter. Securities are resolved
CUSIP->identity via OpenFIGI, BATCH-resolved up front (fast with an API key) so
large funds don't make one API call per position.

Run:
  PYTHONPATH=. SEC_USER_AGENT='Outsider/0.1 you@example.com' \
    DATABASE_URL=postgres://... OPENFIGI_API_KEY=... \
    python3 -m outsider_ingest.pipelines.ingest_13f --cik 0001649339 --name "Scion ..."
"""

from __future__ import annotations

import argparse
import re
from datetime import date
from pathlib import Path

import yaml

from outsider_ingest import config
from outsider_ingest.db import Repository, connect
from outsider_ingest.holdings_diff import compute_position_changes
from outsider_ingest.models import Holding13F


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def _prewarm_securities(repo: Repository, symbols, holdings: list[Holding13F]) -> None:
    """Batch-resolve every uncached CUSIP once, then upsert + cache, so the
    per-holding loop hits the DB cache instead of the OpenFIGI API. This is what
    makes a 1000-position fund ingest in seconds rather than many minutes."""
    if symbols is None:
        return
    todo = [h.cusip for h in holdings if h.cusip and repo.cache_get_symbol(h.cusip) is None]
    if not todo:
        return
    try:
        identities = symbols.resolve_batch(todo)
    except Exception:  # noqa: BLE001 — never let symbol lookup break ingestion
        return
    for cusip, identity in identities.items():
        if identity and identity.figi:
            sid = repo.upsert_security(identity)
            repo.cache_put_symbol(cusip, sid)


def _resolve_security_id(repo: Repository, symbols, h: Holding13F) -> int:
    cached = repo.cache_get_symbol(h.cusip)
    if cached is not None:
        return repo.upsert_security(cached)
    identity = None
    try:
        identity = symbols.resolve(h.cusip, "ID_CUSIP")
    except Exception:  # noqa: BLE001
        identity = None
    if identity and identity.figi:
        sid = repo.upsert_security(identity)
        repo.cache_put_symbol(h.cusip, sid)
        return sid
    return repo.upsert_security_by_cusip(h.cusip, h.name_of_issuer)


def ingest_institution(
    cik: str, name: str, since: date | None = None, max_filings: int = 8
) -> None:
    sec = config.get_filings_provider("sec")
    symbols = config.get_symbol_provider()
    conn = connect(config.DATABASE_URL)
    repo = Repository(conn)

    entity_id = repo.upsert_entity(
        "institution", name, slugify(name), {"cik": cik}, org_name=name, highlight=True
    )
    filings = sec.list_filings(cik, ["13F-HR"], since)
    filings.sort(key=lambda f: (f.period_of_report or date.min))

    prev: list[Holding13F] | None = None
    for ref in filings[-max_filings:]:
        holdings = sec.get_13f_holdings(ref)
        _prewarm_securities(repo, symbols, holdings)
        as_of = ref.period_of_report or ref.filed_at
        filing_id = repo.insert_filing(
            ref.source, ref.form_type, entity_id, ref.filed_at,
            ref.period_of_report, ref.source_url,
        )
        for h in holdings:
            sid = _resolve_security_id(repo, symbols, h)
            repo.upsert_holding(filing_id, entity_id, sid, as_of,
                                h.shares_or_prn, h.value_usd, h.put_call)

        if prev is not None:
            for ch in compute_position_changes(prev, holdings):
                if ch.change_type == "unchanged":
                    continue
                sid = repo.upsert_security_by_cusip(ch.cusip, ch.name)
                repo.insert_transaction(
                    filing_id, entity_id, sid, ch.txn_type,
                    txn_date=as_of, disclosed_at=ref.filed_at,
                    shares=abs(ch.delta_shares), put_call=ch.put_call,
                )
        prev = holdings
        repo.commit()
        print(f"  {ref.period_of_report}: {len(holdings)} positions")


def ingest_from_config() -> None:
    cfg = yaml.safe_load((Path(__file__).resolve().parents[2] / "tracked_entities.yaml").read_text())
    for inst in cfg.get("institutions", []):
        print(f"[13F] {inst['full_name']} (CIK {inst['cik']})")
        try:
            # latest 2 quarters = current holdings + one QoQ diff; keeps volume sane
            ingest_institution(inst["cik"], inst["full_name"], max_filings=2)
        except Exception as e:  # noqa: BLE001 — one bad fund must not stop the rest
            print(f"  SKIP {inst['full_name']}: {e}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cik")
    ap.add_argument("--name")
    ap.add_argument("--max-filings", type=int, default=8)
    ap.add_argument("--all", action="store_true", help="ingest everything in tracked_entities.yaml")
    args = ap.parse_args()

    if args.all:
        ingest_from_config()
    elif args.cik and args.name:
        ingest_institution(args.cik, args.name, max_filings=args.max_filings)
    else:
        ap.error("pass --all or both --cik and --name")


if __name__ == "__main__":
    main()
