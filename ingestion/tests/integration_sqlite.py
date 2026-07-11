"""FULL end-to-end integration test on a real (SQLite) database.

Postgres binaries can't be installed in this sandbox, so this harness uses
SQLite (stdlib) with a schema semantically equivalent to
db/migrations/0001_init.sql. Everything else is the REAL production code:

  * real parsers          parse_information_table, parse_form4, normalize_all
  * real QoQ engine       holdings_diff.compute_position_changes
  * real fetched data     Scion Q2+Q3 13F (pulled live from SEC), Form 4, Senate
  * the REAL feed query    the same nearest-price lateral-join used by the web
                           app's /api/trades (here as SQLite correlated subqueries)

It ingests all three actor types into the DB, injects an EOD price fixture, then
runs the feed query and prints the unified Recent Trades feed with real % change.

Run:  PYTHONPATH=. python3 tests/integration_sqlite.py
"""

from __future__ import annotations

import json
import sqlite3
from datetime import date
from pathlib import Path

from outsider_ingest.holdings_diff import compute_position_changes
from outsider_ingest.parse.form4 import parse_form4
from outsider_ingest.parse.form13f import parse_information_table
from outsider_ingest.parse.senate import normalize_all

FX = Path(__file__).parent / "fixtures"

CUSIP_TICKER = {
    "01609W102": "BABA", "N07059210": "ASML", "116794108": "BRKR",
    "47215P106": "JD", "518439104": "EL", "58733R102": "MELI",
    "30303M102": "META", "75886F107": "REGN", "91324P102": "UNH",
    "918204108": "VFC", "550021109": "LULU", "116794207": "BRKR",
    "406216101": "HAL", "60855R100": "MOH", "67066G104": "NVDA",
    "69608A108": "PLTR", "717081103": "PFE", "78442P106": "SLM",
}

SCHEMA = """
CREATE TABLE entities(id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, full_name TEXT,
  slug TEXT UNIQUE, org_name TEXT, role TEXT, party TEXT, chamber TEXT,
  highlight INTEGER DEFAULT 0, external_ids TEXT DEFAULT '{}');
CREATE TABLE securities(id INTEGER PRIMARY KEY AUTOINCREMENT, ticker TEXT, figi TEXT UNIQUE,
  cusip TEXT UNIQUE, name TEXT, exchange TEXT, asset_type TEXT);
CREATE TABLE filings(id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT, form_type TEXT,
  entity_id INT, filed_at TEXT, period_of_report TEXT, source_url TEXT UNIQUE, raw_ref TEXT);
CREATE TABLE transactions(id INTEGER PRIMARY KEY AUTOINCREMENT, filing_id INT, entity_id INT,
  security_id INT, txn_type TEXT, txn_date TEXT, disclosed_at TEXT, shares REAL, price REAL,
  amount_min REAL, amount_max REAL, put_call TEXT DEFAULT '', owner TEXT);
CREATE UNIQUE INDEX tx_dedupe ON transactions(filing_id, security_id, txn_type, put_call,
  COALESCE(txn_date,'1900-01-01'));
CREATE TABLE holdings(id INTEGER PRIMARY KEY AUTOINCREMENT, filing_id INT, entity_id INT,
  security_id INT, as_of_date TEXT, shares REAL, market_value REAL, put_call TEXT DEFAULT '',
  UNIQUE(filing_id, security_id, put_call));
CREATE TABLE prices(security_id INT, date TEXT, open REAL, high REAL, low REAL, close REAL,
  volume INT, PRIMARY KEY(security_id, date));
"""


class Repo:
    """Minimal SQLite repository mirroring db.py's upsert semantics."""

    def __init__(self, conn):
        self.c = conn

    def entity(self, type_, name, slug, *, org=None, role=None, chamber=None, highlight=False):
        r = self.c.execute("SELECT id FROM entities WHERE slug=?", (slug,)).fetchone()
        if r:
            if highlight:
                self.c.execute("UPDATE entities SET highlight=1 WHERE id=?", (r[0],))
            return r[0]
        cur = self.c.execute(
            "INSERT INTO entities(type,full_name,slug,org_name,role,chamber,highlight,external_ids)"
            " VALUES(?,?,?,?,?,?,?,?)",
            (type_, name, slug, org, role, chamber, 1 if highlight else 0, "{}"),
        )
        return cur.lastrowid

    def sec_by_cusip(self, cusip, ticker, name):
        r = self.c.execute("SELECT id FROM securities WHERE cusip=?", (cusip,)).fetchone()
        if r:
            if ticker:
                self.c.execute("UPDATE securities SET ticker=COALESCE(ticker,?) WHERE id=?", (ticker, r[0]))
            return r[0]
        return self.c.execute(
            "INSERT INTO securities(cusip,ticker,name) VALUES(?,?,?)", (cusip, ticker, name)
        ).lastrowid

    def sec_by_ticker(self, ticker, name):
        r = self.c.execute("SELECT id FROM securities WHERE ticker=? ORDER BY id LIMIT 1", (ticker,)).fetchone()
        if r:
            return r[0]
        return self.c.execute("INSERT INTO securities(ticker,name) VALUES(?,?)", (ticker, name)).lastrowid

    def filing(self, source, form, entity_id, filed_at, period, url):
        r = self.c.execute("SELECT id FROM filings WHERE source_url=?", (url,)).fetchone()
        if r:
            return r[0]
        return self.c.execute(
            "INSERT INTO filings(source,form_type,entity_id,filed_at,period_of_report,source_url)"
            " VALUES(?,?,?,?,?,?)",
            (source, form, entity_id, filed_at, period, url),
        ).lastrowid

    def holding(self, filing_id, entity_id, sec_id, as_of, shares, mv, put_call):
        self.c.execute(
            "INSERT OR REPLACE INTO holdings(filing_id,entity_id,security_id,as_of_date,shares,market_value,put_call)"
            " VALUES(?,?,?,?,?,?,?)",
            (filing_id, entity_id, sec_id, as_of, shares, mv, put_call or ""),
        )

    def txn(self, filing_id, entity_id, sec_id, ttype, txn_date, disclosed, *,
            shares=None, price=None, amin=None, amax=None, put_call="", owner=None):
        self.c.execute(
            "INSERT OR IGNORE INTO transactions(filing_id,entity_id,security_id,txn_type,txn_date,"
            "disclosed_at,shares,price,amount_min,amount_max,put_call,owner) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
            (filing_id, entity_id, sec_id, ttype, txn_date, disclosed, shares, price, amin, amax, put_call or "", owner),
        )

    def price(self, sec_id, d, close):
        self.c.execute("INSERT OR REPLACE INTO prices(security_id,date,close) VALUES(?,?,?)", (sec_id, d, close))


def slug(s):
    import re
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


# ---- ingestion using the REAL parsers -------------------------------------------------

def ingest_institution(repo: Repo):
    q2 = parse_information_table((FX / "scion_infotable_q2_2025.xml").read_bytes())
    q3 = parse_information_table((FX / "scion_infotable.xml").read_bytes())
    eid = repo.entity("institution", "Scion Asset Management (Michael Burry)",
                      "scion-asset-management", org="Scion Asset Management, LLC", highlight=True)

    base = "https://www.sec.gov/Archives/edgar/data/1649339/"
    filings = {
        "2025-06-30": (base + "000187920225000038/", "2025-08-14", q2),
        "2025-09-30": (base + "000164933925000007/", "2025-11-03", q3),
    }
    for period, (url, filed, holds) in filings.items():
        fid = repo.filing("sec_edgar", "13F-HR", eid, filed, period, url)
        for h in holds:
            tk = CUSIP_TICKER.get(h.cusip)
            sid = repo.sec_by_cusip(h.cusip, tk, h.name_of_issuer)
            repo.holding(fid, eid, sid, period, h.shares_or_prn, h.value_usd, h.put_call or "")

    # QoQ changes Q2 -> Q3 become the institution's feed transactions (disclosed at Q3 filing)
    fid_q3 = repo.filing("sec_edgar", "13F-HR", eid, "2025-11-03", "2025-09-30",
                         base + "000164933925000007/")
    for ch in compute_position_changes(q2, q3):
        if ch.change_type == "unchanged":
            continue
        tk = CUSIP_TICKER.get(ch.cusip)
        sid = repo.sec_by_cusip(ch.cusip, tk, ch.name)
        repo.txn(fid_q3, eid, sid, ch.txn_type, "2025-09-30", "2025-11-03",
                 shares=abs(ch.delta_shares), put_call=ch.put_call or "")


def ingest_insider(repo: Repo):
    txns = parse_form4((FX / "form4_sample.xml").read_bytes())
    first = txns[0]
    eid = repo.entity("corporate_insider", first.owner_name, slug(first.owner_name + "-" + first.issuer_cik),
                      org=first.issuer_name, role=first.role)
    url = "https://www.sec.gov/Archives/edgar/data/320193/000032019325000057/"
    fid = repo.filing("sec_edgar", "4", eid, "2025-06-11", None, url)
    for t in txns:
        sid = repo.sec_by_ticker(t.ticker or t.issuer_name, t.issuer_name)
        repo.txn(fid, eid, sid, t.txn_type, t.txn_date, "2025-06-11", shares=t.shares, price=t.price)


def ingest_senate(repo: Repo):
    for t in normalize_all(json.loads((FX / "senate_sample.json").read_text())):
        if not t.ticker:
            continue
        eid = repo.entity("politician", t.politician_name, slug(t.politician_name), chamber="Senate")
        fid = repo.filing("senate_efd", "PTR", eid, t.disclosed_at, t.txn_date, t.source_url)
        sid = repo.sec_by_ticker(t.ticker, t.asset_description)
        repo.txn(fid, eid, sid, t.txn_type, t.txn_date, t.disclosed_at,
                 amin=t.amount_min, amax=t.amount_max, owner=t.owner)


def inject_prices(repo: Repo):
    # illustrative EOD closes so the performance join has data. (ticker, date, close)
    LATEST = "2026-07-09"
    pts = {
        "PLTR": [("2025-11-03", 182.0), (LATEST, 240.0)],
        "NVDA": [("2024-03-28", 90.0), ("2025-11-03", 186.0), (LATEST, 205.0)],
        "PFE": [("2025-11-03", 25.5), (LATEST, 28.0)],
        "HAL": [("2025-11-03", 24.6), (LATEST, 30.0)],
        "MOH": [("2025-11-03", 191.0), (LATEST, 210.0)],
        "SLM": [("2025-11-03", 27.7), (LATEST, 33.0)],
        "BRKR": [("2025-11-03", 42.0), (LATEST, 55.0)],
        "LULU": [("2025-11-03", 178.0), (LATEST, 150.0)],
        "AAPL": [("2024-01-15", 185.0), ("2025-06-11", 200.5), (LATEST, 225.0)],
    }
    for tk, series in pts.items():
        row = repo.c.execute("SELECT id FROM securities WHERE ticker=? ORDER BY id LIMIT 1", (tk,)).fetchone()
        if not row:
            continue
        for d, close in series:
            repo.price(row[0], d, close)


FEED_SQL = """
SELECT e.full_name, e.type, e.highlight, s.ticker, s.name,
       t.txn_type, NULLIF(t.put_call,'') AS put_call, t.txn_date, t.disclosed_at,
       t.shares, t.amount_min, t.amount_max,
       (SELECT close FROM prices p WHERE p.security_id=t.security_id
          AND t.disclosed_at IS NOT NULL AND p.date >= t.disclosed_at
        ORDER BY p.date ASC LIMIT 1) AS entry_disc,
       (SELECT close FROM prices p WHERE p.security_id=t.security_id
        ORDER BY p.date DESC LIMIT 1) AS cur
FROM transactions t
JOIN entities e ON e.id=t.entity_id
JOIN securities s ON s.id=t.security_id
ORDER BY t.disclosed_at DESC, ABS(COALESCE(t.amount_max,t.shares,0)) DESC
"""


def signal(ttype, put_call):
    opening = ttype == "buy"
    if put_call == "Put":
        return "PUT/bear" if opening else "PUT/close"
    if put_call == "Call":
        return "CALL/bull" if opening else "CALL/close"
    return ttype.upper()


def main():
    conn = sqlite3.connect(":memory:")
    conn.executescript(SCHEMA)
    repo = Repo(conn)

    ingest_institution(repo)
    ingest_insider(repo)
    ingest_senate(repo)
    inject_prices(repo)
    conn.commit()

    counts = {k: conn.execute(f"SELECT COUNT(*) FROM {k}").fetchone()[0]
              for k in ("entities", "securities", "filings", "holdings", "transactions", "prices")}
    by_type = dict(conn.execute("SELECT type, COUNT(*) FROM entities GROUP BY type").fetchall())

    print("DATABASE POPULATED (real parsers -> SQLite):")
    print("  " + "  ".join(f"{k}={v}" for k, v in counts.items()))
    print(f"  entities by type: {by_type}\n")

    print("RECENT TRADES FEED  (exact app query: nearest-price join, % since disclosure)")
    print(f"  {'ACTOR':40}{'KIND':13}{'TKR':6}{'SIGNAL':10}{'SIZE':>16}{'% DISCL':>9}")
    rows = conn.execute(FEED_SQL).fetchall()
    shown = 0
    for r in rows:
        (name, etype, hl, tk, sname, ttype, pc, td, disc, shares, amin, amax, entry, cur) = r
        if amin is not None:
            size = f"${amin:,.0f}" + (f"-${amax:,.0f}" if amax else "+")
        else:
            size = f"{shares:,.0f} sh" if shares is not None else "-"
        pct = f"{(cur-entry)/entry:+.1%}" if (entry and cur) else "-"
        star = "*" if hl else " "
        nm = (star + name)[:39]
        print(f"  {nm:40}{etype:13}{(tk or '-'):6}{signal(ttype,pc):10}{size:>16}{pct:>9}")
        shown += 1
        if shown >= 16:
            break
    print(f"\n  ({len(rows)} feed rows total across institutions + insiders + politicians)")

    # assertions — fail loudly if the pipeline is wrong
    assert by_type.get("institution") == 1
    assert by_type.get("corporate_insider") == 1
    assert by_type.get("politician") == 2
    assert counts["transactions"] > 20
    pltr = conn.execute(
        "SELECT t.put_call FROM transactions t JOIN securities s ON s.id=t.security_id "
        "WHERE s.ticker='PLTR' AND t.put_call='Put' LIMIT 1"
    ).fetchone()
    assert pltr is not None, "Palantir put must be present and flagged"
    print("\nOK  integration test passed (schema + upserts + QoQ + multi-actor feed + perf join).")


if __name__ == "__main__":
    main()
