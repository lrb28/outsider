"""US Senate financial-disclosure adapter (FilingsProvider) — free.

The official source (efdsearch.senate.gov) is behind an agreement/CSRF gate and
bot protection. For the MVP we read the maintained free JSON mirror, which is
built from the official eFD data, and keep it behind this interface so it can be
swapped for direct-from-source scraping later without touching business logic.

  Mirror: https://raw.githubusercontent.com/timothycarambat/
          senate-stock-watcher-data/master/aggregate/all_transactions.json

Each record already contains the transaction (ticker, type, amount range, dates)
so — unlike the House — no PDF parsing is needed for the MVP.
"""

from __future__ import annotations

from datetime import date
from typing import Optional, Sequence

import requests

from outsider_ingest.providers.base import FilingRef, FilingsProvider

MIRROR_URL = (
    "https://raw.githubusercontent.com/timothycarambat/"
    "senate-stock-watcher-data/master/aggregate/all_transactions.json"
)


class SenateDisclosureProvider(FilingsProvider):
    source = "senate_efd"

    def __init__(self, user_agent: str = "Outsider/0.1 (+senate-efd)"):
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": user_agent})

    def load_transactions(self) -> list[dict]:
        """Return the raw mirror records (already transaction-level)."""
        resp = self.session.get(MIRROR_URL, timeout=120)
        resp.raise_for_status()
        return resp.json()

    def list_filings(
        self,
        external_entity_id: str,
        form_types: Sequence[str],
        since: Optional[date] = None,
    ) -> list[FilingRef]:
        # The mirror is transaction-level, not filing-level; the pipeline
        # (pipelines/ingest_senate.py, task 8) consumes load_transactions()
        # directly. This method is provided for interface symmetry.
        raise NotImplementedError(
            "Senate mirror is transaction-level; use load_transactions() from "
            "pipelines/ingest_senate.py (task 8)."
        )

    def fetch_document(self, ref: FilingRef, filename: Optional[str] = None) -> bytes:
        raise NotImplementedError("Senate mirror has no per-filing documents in the MVP path.")
