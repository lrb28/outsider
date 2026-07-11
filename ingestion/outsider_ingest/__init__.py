"""Outsider ingestion package.

Free-source ETL for the Insider & Investor Tracker. Each external dependency
sits behind a provider interface (see outsider_ingest.providers.base) so paid
adapters (Polygon, Intrinio, ...) can be added later without touching business
logic.
"""

__version__ = "0.1.0"
