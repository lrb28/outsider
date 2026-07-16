import { getPool } from "./db";
import { companyName, investorBio, investorPerson, sizeDisplay } from "./format";
import {
  CollectionItem,
  DiscoverData,
  FeedRow,
  HoldingRow,
  InvestorDetail,
  InvestorRow,
  StockDetail,
  StockHolder,
  StockRow,
} from "./types";

export interface TradeFilters {
  type?: string;
  q?: string;
  txnType?: string;
  entitySlug?: string;
  ticker?: string;
  limit?: number;
  offset?: number;
}

// entry = close of nearest trading day ON OR AFTER the reference date (lateral
// joins); current = latest close. Percent change computed in JS from those.
const SQL = (whereSql: string, limIdx: number, offIdx: number) => `
  select t.id, e.full_name as entity_name, e.slug as entity_slug,
         e.type as entity_type, e.highlight,
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

function toFeedRow(r: Record<string, unknown>): FeedRow {
  const num = (v: unknown) => (v !== null && v !== undefined ? Number(v) : null);
  return {
    id: r.id as number,
    entityName: r.entity_name as string,
    entitySlug: (r.entity_slug as string) ?? null,
    entityType: r.entity_type as FeedRow["entityType"],
    highlight: Boolean(r.highlight),
    ticker: (r.ticker as string) ?? null,
    securityName: (r.security_name as string) ?? "",
    txnType: r.txn_type as FeedRow["txnType"],
    putCall: (r.put_call as FeedRow["putCall"]) ?? null,
    txnDate: r.txn_date ? new Date(r.txn_date as string).toISOString().slice(0, 10) : null,
    disclosedAt: r.disclosed_at
      ? new Date(r.disclosed_at as string).toISOString().slice(0, 10)
      : null,
    sizeDisplay: sizeDisplay({
      shares: num(r.shares),
      amount_min: num(r.amount_min),
      amount_max: num(r.amount_max),
    }),
    pctSinceTrade: pctChange(num(r.entry_trade_close), num(r.current_close)),
    pctSinceDisclosure: pctChange(num(r.entry_disc_close), num(r.current_close)),
    sourceUrl: r.source_url as string,
  };
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
  if (f.entitySlug) {
    params.push(f.entitySlug);
    where.push(`e.slug = $${params.length}`);
  }
  if (f.ticker) {
    params.push(f.ticker.toUpperCase());
    where.push(`upper(s.ticker) = $${params.length}`);
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
  return rows.map(toFeedRow);
}

// Shared CTE: the current (latest-filing) holdings per entity.
const CUR_CTE = `
  with latest as (
    select entity_id, max(as_of_date) as as_of from holdings group by entity_id
  ),
  cur as (
    select h.entity_id, h.security_id, h.market_value, h.shares, nullif(h.put_call,'') as put_call
    from holdings h
    join latest l on l.entity_id = h.entity_id and h.as_of_date = l.as_of
  )
`;

// ── Investors list ──────────────────────────────────────────────────────────
export async function getInvestors(): Promise<InvestorRow[]> {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL not configured");
  const { rows } = await pool.query(`
    ${CUR_CTE}
    select e.slug, e.full_name as fund,
           (select max(as_of_date) from holdings where entity_id = e.id) as as_of,
           count(c.security_id) as positions,
           sum(c.market_value) as value
    from entities e
    left join cur c on c.entity_id = e.id
    where e.type = 'institution'
    group by e.id, e.slug, e.full_name
    order by value desc nulls last, e.full_name
  `);
  return rows.map((r) => ({
    slug: r.slug as string,
    fund: r.fund as string,
    person: investorPerson(r.fund as string),
    positions: Number(r.positions) || 0,
    value: r.value !== null ? Number(r.value) : null,
    asOf: r.as_of ? new Date(r.as_of as string).toISOString().slice(0, 10) : null,
  }));
}

// ── Single investor ─────────────────────────────────────────────────────────
export async function getInvestor(slug: string): Promise<InvestorDetail | null> {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL not configured");

  const ent = await pool.query(
    `select id, slug, full_name as fund, type from entities where slug = $1 limit 1`,
    [slug],
  );
  if (ent.rows.length === 0) return null;
  const e = ent.rows[0];

  const hold = await pool.query(
    `
    with latest as (select max(as_of_date) as as_of from holdings where entity_id = $1)
    select s.ticker, s.name as security_name, h.market_value as value, h.shares,
           nullif(h.put_call,'') as put_call
    from holdings h
    join securities s on s.id = h.security_id
    where h.entity_id = $1 and h.as_of_date = (select as_of from latest)
    order by h.market_value desc nulls last
    `,
    [e.id],
  );

  const total = hold.rows.reduce(
    (a, r) => a + (r.value !== null ? Number(r.value) : 0),
    0,
  );
  const holdings: HoldingRow[] = hold.rows.map((r) => {
    const value = r.value !== null ? Number(r.value) : null;
    return {
      ticker: (r.ticker as string) ?? null,
      securityName: (r.security_name as string) ?? "",
      company: companyName((r.ticker as string) ?? null, (r.security_name as string) ?? null),
      value,
      shares: r.shares !== null ? Number(r.shares) : null,
      weight: value !== null && total > 0 ? value / total : null,
      putCall: (r.put_call as HoldingRow["putCall"]) ?? null,
    };
  });

  const trades = await getTrades({ entitySlug: slug, limit: 25 });

  const asOfRow = await pool.query(
    `select max(as_of_date) as as_of from holdings where entity_id = $1`,
    [e.id],
  );
  const asOf = asOfRow.rows[0]?.as_of
    ? new Date(asOfRow.rows[0].as_of as string).toISOString().slice(0, 10)
    : null;

  return {
    slug: e.slug as string,
    fund: e.fund as string,
    person: investorPerson(e.fund as string),
    bio: investorBio(e.fund as string),
    type: e.type as InvestorDetail["type"],
    positions: holdings.length,
    value: total > 0 ? total : null,
    asOf,
    holdings,
    trades,
  };
}

// ── Stocks list ─────────────────────────────────────────────────────────────
export async function getStocks(): Promise<StockRow[]> {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL not configured");
  const { rows } = await pool.query(`
    ${CUR_CTE}
    select s.ticker, s.name as security_name,
           count(distinct c.entity_id) as investors,
           sum(c.market_value) as value,
           (array_agg(distinct e.full_name))[1:3] as holder_names
    from cur c
    join securities s on s.id = c.security_id
    join entities e on e.id = c.entity_id
    where s.ticker is not null
    group by s.id, s.ticker, s.name
    order by investors desc, value desc nulls last
    limit 300
  `);
  return rows.map((r) => ({
    ticker: (r.ticker as string) ?? null,
    securityName: (r.security_name as string) ?? "",
    company: companyName((r.ticker as string) ?? null, (r.security_name as string) ?? null),
    investors: Number(r.investors) || 0,
    value: r.value !== null ? Number(r.value) : null,
    holderNames: (r.holder_names as string[]) ?? [],
  }));
}

// ── Single stock ────────────────────────────────────────────────────────────
export async function getStock(ticker: string): Promise<StockDetail | null> {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL not configured");

  const T = ticker.toUpperCase();
  const sec = await pool.query(
    `select s.id, s.ticker, s.name as security_name,
            (select count(*) from holdings h where h.security_id = s.id) as hc
     from securities s
     where upper(s.ticker) = $1
     order by hc desc, s.id asc`,
    [T],
  );
  if (sec.rows.length === 0) return null;
  const s = sec.rows[0];

  // A ticker can map to more than one securities row (a 13F row keyed by CUSIP
  // and a Form 4 row keyed by ticker). Aggregate holders across all of them so
  // the 13F holdings aren't missed when the wrong row is picked as the header.
  const holders = await pool.query(
    `
    ${CUR_CTE},
    tot as (select entity_id, sum(market_value) as v from cur group by entity_id)
    select e.slug, e.full_name as fund, c.market_value as value, c.shares,
           c.market_value / nullif(t.v, 0) as weight
    from cur c
    join entities e on e.id = c.entity_id
    join tot t on t.entity_id = c.entity_id
    where c.security_id in (select id from securities where upper(ticker) = $1)
    order by c.market_value desc nulls last
    `,
    [T],
  );

  const holderRows: StockHolder[] = holders.rows.map((r) => ({
    slug: r.slug as string,
    fund: r.fund as string,
    person: investorPerson(r.fund as string),
    value: r.value !== null ? Number(r.value) : null,
    shares: r.shares !== null ? Number(r.shares) : null,
    weight: r.weight !== null ? Number(r.weight) : null,
  }));

  const value = holderRows.reduce((a, r) => a + (r.value ?? 0), 0);
  const trades = await getTrades({ ticker: ticker, limit: 25 });

  return {
    ticker: (s.ticker as string) ?? null,
    securityName: (s.security_name as string) ?? "",
    company: companyName((s.ticker as string) ?? null, (s.security_name as string) ?? null),
    investors: holderRows.length,
    value: value > 0 ? value : null,
    holders: holderRows,
    trades,
  };
}

// ── Price series (for the trade sparkline) ──────────────────────────────────
export async function getPrices(
  ticker: string,
  limit = 260,
): Promise<{ date: string; close: number }[]> {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL not configured");
  const { rows } = await pool.query(
    `
    select p.date, p.close
    from prices p
    where p.security_id = (
      select security_id from prices
      where security_id in (select id from securities where upper(ticker) = $1)
      group by security_id
      order by count(*) desc
      limit 1
    )
    order by p.date desc
    limit $2
    `,
    [ticker.toUpperCase(), limit],
  );
  return rows
    .map((r) => ({
      date: new Date(r.date as string).toISOString().slice(0, 10),
      close: Number(r.close),
    }))
    .reverse();
}

// ── Discover collections ────────────────────────────────────────────────────
export async function getDiscover(): Promise<Omit<DiscoverData, "source">> {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL not configured");

  const wCte = `
    ${CUR_CTE},
    tot as (select entity_id, sum(market_value) as v from cur group by entity_id),
    w as (
      select c.security_id, c.entity_id, c.market_value,
             c.market_value / nullif(t.v, 0) as weight
      from cur c join tot t on t.entity_id = c.entity_id
    )
  `;

  const mostHeldQ = pool.query(`
    ${wCte}
    select s.ticker, s.name as security_name, count(distinct w.entity_id) as n
    from w join securities s on s.id = w.security_id
    where s.ticker is not null
    group by s.id, s.ticker, s.name
    order by n desc, sum(w.market_value) desc
    limit 12
  `);
  const convictionQ = pool.query(`
    ${wCte}
    select s.ticker, s.name as security_name, max(w.weight) as mw
    from w join securities s on s.id = w.security_id
    where s.ticker is not null
    group by s.id, s.ticker, s.name
    order by mw desc nulls last
    limit 12
  `);
  const biggestQ = pool.query(`
    ${wCte}
    select s.ticker, s.name as security_name, max(w.market_value) as mv
    from w join securities s on s.id = w.security_id
    where s.ticker is not null
    group by s.id, s.ticker, s.name
    order by mv desc nulls last
    limit 12
  `);

  const [mostHeld, conviction, biggest] = await Promise.all([mostHeldQ, convictionQ, biggestQ]);

  const item = (r: Record<string, unknown>, metric: string): CollectionItem => ({
    ticker: (r.ticker as string) ?? null,
    company: companyName((r.ticker as string) ?? null, (r.security_name as string) ?? null),
    securityName: (r.security_name as string) ?? "",
    metric,
  });

  return {
    mostHeld: mostHeld.rows.map((r) => item(r, `${Number(r.n)} Investoren`)),
    highestConviction: conviction.rows.map((r) =>
      item(r, `${((Number(r.mw) || 0) * 100).toFixed(0)} % Gewicht`),
    ),
    biggest: biggest.rows.map((r) => {
      const mv = Number(r.mv) || 0;
      const s =
        mv >= 1e9 ? `$${(mv / 1e9).toFixed(1)} Mrd.` : `$${(mv / 1e6).toFixed(0)} Mio.`;
      return item(r, s);
    }),
  };
}
