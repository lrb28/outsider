"""PostgreSQL (Supabase) access — thin repository over psycopg3, plain SQL.

Matches db/migrations/0001_init.sql. Upserts are idempotent so re-running an
ingestion never duplicates rows (safe for a cron that overlaps).

psycopg is imported lazily so unit tests that don't touch the DB (parser,
performance, holdings-diff) run without a database installed.
"""

from __future__ import annotations

import json
from datetime import date
from typing import Optional, Sequence

from outsider_ingest.models import PricePoint
from outsider_ingest.providers.base import SecurityIdentity


def connect(dsn: str):
    import psycopg  # lazy

    return psycopg.connect(dsn, autocommit=False)


class Repository:
    def __init__(self, conn):
        self.conn = conn

    def commit(self):
        self.conn.commit()

    # --- entities -------------------------------------------------------------

    def upsert_entity(
        self,
        entity_type: str,
        full_name: str,
        slug: str,
        external_ids: dict,
        org_name: Optional[str] = None,
        role: Optional[str] = None,
        party: Optional[str] = None,
        chamber: Optional[str] = None,
        highlight: bool = False,
    ) -> int:
        row = self.conn.execute(
            """
            INSERT INTO entities (type, full_name, slug, org_name, role, party, chamber, highlight, external_ids)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (slug) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                org_name  = EXCLUDED.org_name,
                highlight = entities.highlight OR EXCLUDED.highlight,
                external_ids = entities.external_ids || EXCLUDED.external_ids
            RETURNING id
            """,
            (entity_type, full_name, slug, org_name, role, party, chamber, highlight,
             json.dumps(external_ids)),
        ).fetchone()
        return row[0]

    # --- securities -----------------------------------------------------------

    def upsert_security(self, identity: SecurityIdentity) -> int:
        # Find an existing row by FIGI or CUSIP first. A security may already
        # exist (from the demo seed, or an earlier run that stored it under just
        # a CUSIP) — a plain INSERT ... ON CONFLICT (figi) would then trip the
        # separate UNIQUE(cusip) constraint. Find-or-create avoids that clash.
        if identity.figi:
            row = self.conn.execute(
                "SELECT id FROM securities WHERE figi = %s", (identity.figi,)
            ).fetchone()
            if row:
                self.conn.execute(
                    "UPDATE securities SET ticker = COALESCE(%s, ticker), "
                    "name = COALESCE(%s, name), cusip = COALESCE(cusip, %s) WHERE id = %s",
                    (identity.ticker, identity.name, identity.cusip, row[0]),
                )
                return row[0]
        if identity.cusip:
            row = self.conn.execute(
                "SELECT id FROM securities WHERE cusip = %s", (identity.cusip,)
            ).fetchone()
            if row:
                self.conn.execute(
                    "UPDATE securities SET figi = COALESCE(%s, figi), "
                    "ticker = COALESCE(%s, ticker), name = COALESCE(%s, name) WHERE id = %s",
                    (identity.figi, identity.ticker, identity.name, row[0]),
                )
                return row[0]
        row = self.conn.execute(
            "INSERT INTO securities (ticker, figi, cusip, name, exchange, asset_type) "
            "VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
            (
                identity.ticker,
                identity.figi,
                identity.cusip,
                identity.name,
                identity.exchange,
                identity.asset_type,
            ),
        ).fetchone()
        return row[0]

    def upsert_security_by_cusip(self, cusip: str, name: str) -> int:
        """Fallback when no FIGI resolved yet (keeps ingestion moving)."""
        row = self.conn.execute(
            """
            INSERT INTO securities (cusip, name)
            VALUES (%s, %s)
            ON CONFLICT (cusip) DO UPDATE SET name = COALESCE(securities.name, EXCLUDED.name)
            RETURNING id
            """,
            (cusip, name),
        ).fetchone()
        return row[0]

    def upsert_security_by_ticker(self, ticker: str, name: Optional[str]) -> int:
        """Find-or-create by ticker (Form 4 / politician feeds have ticker, not CUSIP)."""
        row = self.conn.execute(
            "SELECT id FROM securities WHERE ticker = %s ORDER BY id LIMIT 1", (ticker,)
        ).fetchone()
        if row:
            return row[0]
        row = self.conn.execute(
            "INSERT INTO securities (ticker, name) VALUES (%s, %s) RETURNING id", (ticker, name)
        ).fetchone()
        return row[0]

    def ensure_security_name(self, security_id: int, name: Optional[str]) -> None:
        """Upgrade a placeholder name (NULL, empty, or a CUSIP/ticker-ish token
        with no spaces) to the clean issuer name from the filing. Real names —
        which contain a space, e.g. 'CHEVRON CORPORATION' — are left untouched."""
        if not name or not name.strip():
            return
        self.conn.execute(
            "UPDATE securities SET name = %s "
            "WHERE id = %s AND (name IS NULL OR name = '' OR name !~ ' ')",
            (name.strip(), security_id),
        )

    # --- filings --------------------------------------------------------------

    def insert_filing(
        self,
        source: str,
        form_type: str,
        entity_id: int,
        filed_at: Optional[date],
        period_of_report: Optional[date],
        source_url: str,
        raw_ref: Optional[str] = None,
    ) -> int:
        row = self.conn.execute(
            """
            INSERT INTO filings (source, form_type, entity_id, filed_at, period_of_report, source_url, raw_ref)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (source_url) DO UPDATE SET filed_at = EXCLUDED.filed_at
            RETURNING id
            """,
            (source, form_type, entity_id, filed_at, period_of_report, source_url, raw_ref),
        ).fetchone()
        return row[0]

    # --- holdings / transactions ---------------------------------------------

    def upsert_holding(
        self,
        filing_id: int,
        entity_id: int,
        security_id: int,
        as_of_date: date,
        shares: int,
        market_value: int,
        put_call: Optional[str],
    ) -> None:
        self.conn.execute(
            """
            INSERT INTO holdings (filing_id, entity_id, security_id, as_of_date, shares, market_value, put_call)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (filing_id, security_id, put_call) DO UPDATE SET
                shares = EXCLUDED.shares, market_value = EXCLUDED.market_value
            """,
            (filing_id, entity_id, security_id, as_of_date, shares, market_value, put_call or ""),
        )

    def insert_transaction(
        self,
        filing_id: int,
        entity_id: int,
        security_id: int,
        txn_type: str,
        txn_date: Optional[date],
        disclosed_at: Optional[date],
        shares: Optional[int] = None,
        price: Optional[float] = None,
        amount_min: Optional[float] = None,
        amount_max: Optional[float] = None,
        put_call: Optional[str] = None,
        owner: Optional[str] = None,
    ) -> None:
        self.conn.execute(
            """
            INSERT INTO transactions
              (filing_id, entity_id, security_id, txn_type, txn_date, disclosed_at,
               shares, price, amount_min, amount_max, put_call, owner)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT DO NOTHING
            """,
            (filing_id, entity_id, security_id, txn_type, txn_date, disclosed_at,
             shares, price, amount_min, amount_max, put_call or "", owner),
        )

    # --- prices ---------------------------------------------------------------

    def upsert_prices(self, security_id: int, prices: Sequence[PricePoint]) -> int:
        n = 0
        for p in prices:
            self.conn.execute(
                """
                INSERT INTO prices (security_id, date, open, high, low, close, volume)
                VALUES (%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (security_id, date) DO UPDATE SET close = EXCLUDED.close
                """,
                (security_id, p.the_date, p.open, p.high, p.low, p.close, p.volume),
            )
            n += 1
        return n

    def upsert_prices_bulk(self, security_id: int, prices: Sequence[PricePoint]) -> int:
        """Batch upsert (one round-trip via executemany) — far faster than row-by-row."""
        if not prices:
            return 0
        with self.conn.cursor() as cur:
            cur.executemany(
                "INSERT INTO prices (security_id, date, open, high, low, close, volume) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s) "
                "ON CONFLICT (security_id, date) DO UPDATE SET close = EXCLUDED.close",
                [(security_id, p.the_date, p.open, p.high, p.low, p.close, p.volume) for p in prices],
            )
        return len(prices)

    def latest_price_date(self, security_id: int):
        row = self.conn.execute(
            "SELECT max(date) FROM prices WHERE security_id = %s", (security_id,)
        ).fetchone()
        return row[0] if row else None

    # --- symbol cache ---------------------------------------------------------

    def cache_get_symbol(self, raw_identifier: str) -> Optional[SecurityIdentity]:
        row = self.conn.execute(
            "SELECT ticker, figi, cusip, name, exchange, asset_type FROM symbols_cache "
            "JOIN securities ON securities.id = symbols_cache.security_id "
            "WHERE raw_identifier = %s",
            (raw_identifier,),
        ).fetchone()
        if not row:
            return None
        return SecurityIdentity(*row)

    def cache_put_symbol(self, raw_identifier: str, security_id: int) -> None:
        self.conn.execute(
            """
            INSERT INTO symbols_cache (raw_identifier, security_id, provider)
            VALUES (%s, %s, 'openfigi')
            ON CONFLICT (raw_identifier) DO NOTHING
            """,
            (raw_identifier, security_id),
        )
