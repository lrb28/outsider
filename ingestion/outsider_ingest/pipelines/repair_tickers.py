"""Re-map stored CUSIPs to their US tickers.

Earlier 13F imports asked OpenFIGI for a CUSIP without an exchange filter and
kept whichever foreign line came first: Chevron became CHV (Frankfurt), Morgan
Stanley DWD, Philip Morris 4I1, and non-US issuers (ASML, Spotify, Linde) got
no ticker at all because their CINS numbers were sent as CUSIPs. Those rows
never received prices or logos.

This pass resolves every security that has a CUSIP again (US listing first,
CINS aware, see providers/openfigi.py) and updates ticker and exchange where
the US answer differs. The FIGI is only moved when no other row owns it (it is
unique). Changed rows get their failed price attempts cleared so the next
price run picks them up at once.

Run:
  PYTHONPATH=. DATABASE_URL=... python -m outsider_ingest.pipelines.repair_tickers [--dry-run]
"""
from __future__ import annotations

import argparse
import os

from outsider_ingest import config
from outsider_ingest.db import connect
from outsider_ingest.providers.openfigi import OpenFigiProvider


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    symbols = OpenFigiProvider(api_key=config.OPENFIGI_API_KEY)
    with connect(config.DATABASE_URL) as conn:
        rows = conn.execute(
            "SELECT id, cusip, ticker, figi FROM securities WHERE cusip IS NOT NULL ORDER BY id"
        ).fetchall()
        print(f"{len(rows)} securities with a CUSIP")
        identities = symbols.resolve_batch([cusip for _, cusip, _, _ in rows])
        print(f"{len(identities)} resolved")
        changed = figi_moved = 0
        samples: list[str] = []
        for sid, cusip, ticker, figi in rows:
            identity = identities.get(cusip)
            if not identity or not identity.ticker or identity.exchange != "US":
                continue
            if identity.ticker == (ticker or "").upper():
                continue
            changed += 1
            if len(samples) < 40:
                samples.append(f"{ticker or '—'} → {identity.ticker}")
            if args.dry_run:
                continue
            new_figi = figi
            if identity.figi and identity.figi != figi:
                owner = conn.execute("SELECT id FROM securities WHERE figi = %s", (identity.figi,)).fetchone()
                if owner is None:
                    new_figi = identity.figi
                    figi_moved += 1
            conn.execute(
                "UPDATE securities SET ticker = %s, exchange = 'US', figi = %s WHERE id = %s",
                (identity.ticker, new_figi, sid),
            )
            conn.execute("DELETE FROM ingestion_price_attempts WHERE security_id = %s", (sid,))
        if not args.dry_run:
            # Share classes from other feeds (House PTRs, old imports) too.
            slashed = conn.execute(
                "UPDATE securities SET ticker = replace(ticker, '/', '.') WHERE ticker LIKE '%/%'"
            ).rowcount
            print(f"{slashed} share-class tickers rewritten from / to .")
            conn.commit()
        print("Examples: " + ", ".join(samples))
        summary = f"Tickers: {changed} corrected{' (dry run)' if args.dry_run else ''}, {figi_moved} FIGIs moved to the US line."
        print(summary)
        if os.environ.get("GITHUB_STEP_SUMMARY"):
            with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as output:
                output.write(summary + "\n")


if __name__ == "__main__":
    main()
