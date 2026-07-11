"""Generate an idempotent demo seed (real Scion Q3-2025 13F snapshot + sample
insider/senate rows) as portable SQL, then TEST it on SQLite before handing it
to the user for Supabase/Postgres.

Run:  PYTHONPATH=. python3 generate_seed.py
Writes: ../db/seed/0002_demo_seed.sql
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from outsider_ingest.parse.form13f import parse_information_table
from outsider_ingest.parse.form4 import parse_form4
from outsider_ingest.parse.senate import normalize_all

FX = Path("tests/fixtures")
CT = {
    "116794207": "BRKR", "406216101": "HAL", "550021109": "LULU", "60855R100": "MOH",
    "67066G104": "NVDA", "69608A108": "PLTR", "717081103": "PFE", "78442P106": "SLM",
}

SCION = "https://www.sec.gov/Archives/edgar/data/1649339/000164933925000007/"
COOK = "https://www.sec.gov/Archives/edgar/data/320193/000032019325000057/"
TUB = "https://efdsearch.senate.gov/search/view/ptr/abc123/"
WH = "https://efdsearch.senate.gov/search/view/ptr/def456/"

L: list[str] = []


def sq(x):
    if x is None:
        return "null"
    if isinstance(x, (int, float)):
        return str(x)
    return "'" + str(x).replace("'", "''") + "'"


def emit(s=""):
    L.append(s)


def build() -> str:
    emit("-- Outsider demo seed — REAL Scion Q3-2025 13F snapshot + sample insider/senate rows.")
    emit("-- Run AFTER 0001_init.sql. Idempotent (safe to run more than once).")
    emit("begin;")
    emit()

    emit("insert into entities (type,full_name,slug,org_name,highlight) values"
         " ('institution','Scion Asset Management (Michael Burry)','scion-asset-management',"
         "'Scion Asset Management, LLC',true) on conflict (slug) do nothing;")
    emit("insert into entities (type,full_name,slug,org_name,role) values"
         " ('corporate_insider','COOK TIMOTHY D','cook-timothy-d-0000320193','Apple Inc.',"
         "'Chief Executive Officer') on conflict (slug) do nothing;")
    emit("insert into entities (type,full_name,slug,chamber) values"
         " ('politician','Thomas H Tuberville','thomas-h-tuberville','Senate') on conflict (slug) do nothing;")
    emit("insert into entities (type,full_name,slug,chamber) values"
         " ('politician','Sheldon Whitehouse','sheldon-whitehouse','Senate') on conflict (slug) do nothing;")
    emit()

    q3 = parse_information_table((FX / "scion_infotable.xml").read_bytes())
    secs = {CT.get(h.cusip, h.cusip): (h.cusip, h.name_of_issuer) for h in q3}
    secs["AAPL"] = (None, "Apple Inc.")
    for tk, (cusip, name) in secs.items():
        emit(f"insert into securities (cusip,ticker,name) select {sq(cusip)},{sq(tk)},{sq(name)} "
             f"where not exists (select 1 from securities where ticker={sq(tk)});")
    emit()

    def filing(source, form, slug, filed, period, url):
        emit("insert into filings (source,form_type,entity_id,filed_at,period_of_report,source_url) "
             f"select {sq(source)},{sq(form)},e.id,{sq(filed)},{sq(period)},{sq(url)} "
             f"from entities e where e.slug={sq(slug)} on conflict (source_url) do nothing;")

    filing("sec_edgar", "13F-HR", "scion-asset-management", "2025-11-03", "2025-09-30", SCION)
    filing("sec_edgar", "4", "cook-timothy-d-0000320193", "2025-06-11", None, COOK)
    filing("senate_efd", "PTR", "thomas-h-tuberville", "2024-01-15", "2024-01-02", TUB)
    filing("senate_efd", "PTR", "sheldon-whitehouse", "2024-03-28", "2024-03-10", WH)
    emit()

    def txn(url, ticker, ttype, txn_date, disclosed, shares="null", price="null",
            amin="null", amax="null", pc=""):
        emit("insert into transactions (filing_id,entity_id,security_id,txn_type,txn_date,disclosed_at,"
             "shares,price,amount_min,amount_max,put_call) "
             f"select f.id,f.entity_id,s.id,{sq(ttype)},{sq(txn_date)},{sq(disclosed)},{shares},{price},"
             f"{amin},{amax},{sq(pc)} from filings f join securities s on s.ticker={sq(ticker)} "
             f"where f.source_url={sq(url)} and not exists (select 1 from transactions t "
             f"where t.filing_id=f.id and t.security_id=s.id and t.txn_type={sq(ttype)} "
             f"and t.put_call={sq(pc)} and coalesce(t.txn_date,'1900-01-01')={sq(txn_date)});")

    for h in q3:
        txn(SCION, CT.get(h.cusip, h.cusip), "buy", "2025-09-30", "2025-11-03",
            shares=str(h.shares_or_prn), pc=h.put_call or "")
    for t in parse_form4((FX / "form4_sample.xml").read_bytes()):
        txn(COOK, "AAPL", t.txn_type, t.txn_date, "2025-06-11",
            shares=str(int(t.shares or 0)), price=str(t.price or 0))
    for t in normalize_all(json.loads((FX / "senate_sample.json").read_text())):
        if not t.ticker:
            continue
        url = {"AAPL": TUB, "NVDA": WH}[t.ticker]
        txn(url, t.ticker, t.txn_type, t.txn_date, t.disclosed_at,
            amin=str(int(t.amount_min)) if t.amount_min else "null",
            amax=str(int(t.amount_max)) if t.amount_max else "null")
    emit()

    latest = "2026-07-09"
    prices = {
        "PLTR": [("2025-11-03", 182), (latest, 240)],
        "NVDA": [("2024-03-28", 90), ("2025-11-03", 186), (latest, 205)],
        "PFE": [("2025-11-03", 25.5), (latest, 28)],
        "HAL": [("2025-11-03", 24.6), (latest, 30)],
        "MOH": [("2025-11-03", 191), (latest, 210)],
        "SLM": [("2025-11-03", 27.7), (latest, 33)],
        "BRKR": [("2025-11-03", 42), (latest, 55)],
        "LULU": [("2025-11-03", 178), (latest, 150)],
        "AAPL": [("2024-01-15", 185), ("2025-06-11", 200.5), (latest, 225)],
    }
    for tk, series in prices.items():
        for d, c in series:
            emit(f"insert into prices (security_id,date,close) select s.id,{sq(d)},{c} from securities s "
                 f"where s.ticker={sq(tk)} and not exists (select 1 from prices p "
                 f"where p.security_id=s.id and p.date={sq(d)});")
    emit()
    emit("commit;")
    return "\n".join(L) + "\n"


def main():
    sql = build()
    out = Path("../db/seed/0002_demo_seed.sql")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(sql)

    # TEST on SQLite (same schema shape + the app's feed query)
    from tests.integration_sqlite import FEED_SQL, SCHEMA

    conn = sqlite3.connect(":memory:")
    conn.executescript(SCHEMA)
    conn.executescript(sql)              # run once
    conn.executescript(sql)              # run AGAIN to prove idempotency
    counts = {k: conn.execute(f"select count(*) from {k}").fetchone()[0]
              for k in ("entities", "securities", "filings", "transactions", "prices")}
    rows = conn.execute(FEED_SQL).fetchall()

    print("seed applied twice (idempotency check):", counts)
    print(f"feed query returns {len(rows)} rows")
    assert counts["entities"] == 4, counts
    assert counts["transactions"] == 13, counts
    assert counts["securities"] == 9, counts
    with_pct = sum(1 for r in rows if r[-1] and r[-2])
    print(f"rows with a computed % since disclosure: {with_pct}")
    print(f"\nwrote {out} ({len(L)} SQL lines)")
    print("OK  seed is valid + idempotent")


if __name__ == "__main__":
    main()
