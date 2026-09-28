"""Replace 13F name abbreviations with the SEC's official company names.

13F information tables abbreviate issuer names ("AMERICAN ELEC PWR",
"STMICROELECTRONICS N V"). The SEC's ticker file lists the registrant's name
for every ticker, e.g. "AMERICAN ELECTRIC POWER CO INC", so one request fixes
every security whose ticker is listed. The web app turns names into display
form (case, legal suffixes).

Run:
  PYTHONPATH=. SEC_USER_AGENT='Outsider/0.1 you@example.com' DATABASE_URL=... \
    python3 -m outsider_ingest.pipelines.refresh_company_names [--dry-run]
"""

from __future__ import annotations

import argparse

from outsider_ingest import config

TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"


def official_names(payload: dict) -> dict[str, str]:
    """ticker -> registrant name; the first listing wins for share classes."""
    names: dict[str, str] = {}
    for row in payload.values():
        ticker = str(row.get("ticker") or "").strip().upper()
        title = " ".join(str(row.get("title") or "").split())
        if ticker and title and ticker not in names:
            names[ticker] = title
    return names


def refresh_company_names(dry_run: bool = False) -> int:
    import requests

    if not config.SEC_USER_AGENT or "@" not in config.SEC_USER_AGENT:
        raise ValueError("Set SEC_USER_AGENT, e.g. 'Outsider/0.1 you@example.com' (SEC fair-access rule).")
    resp = requests.get(TICKERS_URL, headers={"User-Agent": config.SEC_USER_AGENT}, timeout=60)
    resp.raise_for_status()
    names = official_names(resp.json())
    if len(names) < 1000:
        raise RuntimeError(f"SEC ticker file looks incomplete ({len(names)} tickers)")

    from outsider_ingest.db import connect

    conn = connect(config.DATABASE_URL)
    rows = conn.execute("SELECT id, upper(ticker), name FROM securities WHERE ticker IS NOT NULL").fetchall()
    changes = [(names[t], sid) for sid, t, current in rows if t in names and names[t] != current]
    if dry_run:
        for name, sid in changes[:25]:
            print(f"  {sid}: -> {name}")
    else:
        with conn.cursor() as cur:
            cur.executemany("UPDATE securities SET name = %s WHERE id = %s", changes)
        conn.commit()
    conn.close()
    print(f"Company names: {len(changes)} of {len(rows)} securities updated from {len(names)} SEC tickers"
          f"{' — dry run, nothing written' if dry_run else ''}")
    return len(changes)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    refresh_company_names(ap.parse_args().dry_run)


if __name__ == "__main__":
    main()
