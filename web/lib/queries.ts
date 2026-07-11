import { getPool } from "./db";
import { sizeDisplay } from "./format";
import { FeedRow } from "./types";

export interface TradeFilters {
  type?: string;
  q?: string;
  txnType?: string;
  limit?: number;
  offset?: number;
}

// entry = close of nearest trading day ON OR AFTER the reference date (lateral
// joins); current = latest close. Percent change computed in JS from those.
const SQL = (whereSql: string, limIdx: number, offIdx: number) => `
  select t.id, e.full_name as entity_name, e.type as entity_type, e.highlight,
         s.ticker, s.name as security_name,
         t.txn_type, nullif(t.put_call, '') as put_call,
         t.txn_date, t.disclosed_at, t.shares, t.amount_min, t.amount_max,
         f.source_url,
         et.close as entry_trade_close,
         ed.close as entry_disc_close,
         cur.close as current_close
  from transactions t
  join entities e on e.id = t.entity_id
  join securities s on s.id = t.security_id
  join filings f on f.id = t.filing_id
  left join lateral (
    select close from prices p
    where p.security_id = t.security_id and t.txn_date is not null and p.date >= t.txn_date
    order by p.date asc limit 1
  ) et on true
  left join lateral (
    select close from prices p
    where p.security_id = t.security_id and t.disclosed_at is not null and p.date >= t.disclosed_at
    order by p.date asc limit 1
  ) ed on true
  left join lateral (
    select close from prices p
    where p.security_id = t.security_id
    order by p.date desc limit 1
  ) cur on true
  ${whereSql}
  order by t.disclosed_at desc nulls last, t.id desc
  limit $${limIdx} offset $${offIdx}
`;

function pctChange(entry: number | null, current: number | null): number | null {
  if (entry === null || current === null || entry === 0) return null;
  return (current - entry) / entry;
}

export async function getTrades(f: TradeFilters): Promise<FeedRow[]> {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL not configured");

  const where: string[] = [];
  const params: unknown[] = [];
  if (f.type) {
    params.push(f.type);
    where.push(`e.type = $${params.length}`);
  }
  if (f.txnType) {
    params.push(f.txnType);
    where.push(`t.txn_type = $${params.length}`);
  }
  if (f.q) {
    params.push(`%${f.q}%`);
    const i = params.length;
    where.push(`(e.full_name ilike $${i} or s.ticker ilike $${i} or s.name ilike $${i})`);
  }
  const whereSql = where.length ? `where ${where.join(" and ")}` : "";

  const limit = Math.min(f.limit ?? 50, 200);
  const offset = f.offset ?? 0;
  params.push(limit);
  const limIdx = params.length;
  params.push(offset);
  const offIdx = params.length;

  const { rows } = await pool.query(SQL(whereSql, limIdx, offIdx), params);

  return rows.map((r): FeedRow => ({
    id: r.id,
    entityName: r.entity_name,
    entityType: r.entity_type,
    highlight: r.highlight,
    ticker: r.ticker,
    securityName: r.security_name,
    txnType: r.txn_type,
    putCall: r.put_call,
    txnDate: r.txn_date ? new Date(r.txn_date).toISOString().slice(0, 10) : null,
    disclosedAt: r.disclosed_at ? new Date(r.disclosed_at).toISOString().slice(0, 10) : null,
    sizeDisplay: sizeDisplay({
      shares: r.shares !== null ? Number(r.shares) : null,
      amount_min: r.amount_min !== null ? Number(r.amount_min) : null,
      amount_max: r.amount_max !== null ? Number(r.amount_max) : null,
    }),
    pctSinceTrade: pctChange(
      r.entry_trade_close !== null ? Number(r.entry_trade_close) : null,
      r.current_close !== null ? Number(r.current_close) : null,
    ),
    pctSinceDisclosure: pctChange(
      r.entry_disc_close !== null ? Number(r.entry_disc_close) : null,
      r.current_close !== null ? Number(r.current_close) : null,
    ),
    sourceUrl: r.source_url,
  }));
}
