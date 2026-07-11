#!/usr/bin/env bash
# First full load: all feeds -> Postgres, then EOD prices. Idempotent (safe to re-run).
#
#   export SEC_USER_AGENT="Outsider/0.1 you@example.com"
#   export DATABASE_URL="postgres://...pooler...:5432/postgres?sslmode=require"
#   bash scripts/first_run.sh
set -euo pipefail
: "${SEC_USER_AGENT:?set SEC_USER_AGENT (e.g. 'Outsider/0.1 you@example.com')}"
: "${DATABASE_URL:?set DATABASE_URL (Supabase pooler URI)}"

cd "$(dirname "$0")/.."
export PYTHONPATH=.

echo "[1/5] 13F institutions (Scion, Renaissance)"
python3 -m outsider_ingest.pipelines.ingest_13f --all

echo "[2/5] Form 4 insiders (Apple, Tesla, NVIDIA)"
python3 -m outsider_ingest.pipelines.ingest_form4 --all

echo "[3/5] Senate politicians"
python3 -m outsider_ingest.pipelines.ingest_senate || echo "   (senate mirror unreachable — skipped)"

echo "[4/5] House politicians ($(date +%Y))"
python3 -m outsider_ingest.pipelines.ingest_house --year "$(date +%Y)" || echo "   (house skipped)"

echo "[5/5] EOD price backfill (Stooq -> Yahoo)"
python3 -m outsider_ingest.pipelines.backfill_prices

echo
echo "Done. Now: cd ../web && npm install && cp .env.example .env.local && npm run dev"
