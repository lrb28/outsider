import { getPool } from "./db";
import {
  abbrevMoney,
  companyName,
  investorBio,
  investorPerson,
  pctOf,
  personName,
  sizeDisplay,
} from "./format";
import { MIN_COVERAGE, summarize } from "./returns";
import {
  CollectionInvestor,
  CollectionItem,
  DiscoverData,
  Letter,
  LetterSummary,
  FeedRow,
  HoldingRow,
  InsiderDetail,
  InvestorDetail,
  InvestorRow,
  MatchRow,
  PoliticianDetail,
  PoliticianRow,
  StockDetail,
  StockHolder,
  StockMove,
  SpotlightData,
  SpotlightItem,
  SpotlightKind,
  StockRow,
} from "./types";
import { mixSpotlight, quarterOf, weightLabel } from "./spotlight";

export interface TradeFilters {
  type?: string;
  q?: string;
  txnType?: string;
  entitySlug?: string;
  ticker?: string;
  limit?: number;
  offset?: number;
  from?: string;
  to?: string;
}

// The Senate is out of scope: its old rows stay in the database but are never
// shown. Every query that lists politicians or their trades applies this.
const NOT_SENATE = "e.chamber is distinct from 'Senate'";

// "Abgeordnete·r CA-11" -> "CA-11"
const seatOf = (role: unknown) => (typeof role === "string" ? role.match(/[A-Z]{2}-(?:\d+|AL)$/)?.[0] ?? null : null);

// entry = close of nearest trading day ON OR AFTER the reference date (lateral
// joins); current = latest close. Percent change computed in JS from those.
const SQL = (whereSql: string, limIdx: number, offIdx: number) => `
  select t.id, e.full_name as entity_name, e.slug as entity_slug,
         e.type as entity_type, e.highlight, e.external_ids->>'portrait' as entity_photo,
         s.ticker, s.name as security_name,
         t.txn_type, nullif(t.put_call, '') as put_call,
         t.txn_date, t.disclosed_at, t.shares, t.amount_min, t.amount_max,
         f.source_url, f.period_of_report,
         t.transaction_code, t.is_derivative,
         et.close as entry_trade_close,
         ed.close as entry_disc_close,
         cur.close as current_close, cur.date as price_as_of
  from transactions t
  join entities e on e.id = t.entity_id
  join securities s on s.id = t.security_id
  join filings f on f.id = t.filing_id
  left join lateral (
    select close from prices p
    where p.security_id = t.security_id and t.txn_date is not null and p.date >= t.txn_date and p.date <= t.txn_date + 7
    order by p.date asc limit 1
  ) et on true
  left join lateral (
    select close from prices p
    where p.security_id = t.security_id and t.disclosed_at is not null and p.date >= t.disclosed_at and p.date <= t.disclosed_at + 7
    order by p.date asc limit 1
  ) ed on true
  left join lateral (
    select close, date from prices p
    where p.security_id = t.security_id and p.date <= current_date and p.close > 0
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
  const priceAsOf = r.price_as_of ? new Date(r.price_as_of as string).toISOString().slice(0, 10) : null;
  const fresh = priceAsOf && Date.now() - Date.parse(priceAsOf) <= 7 * 86400000;
  return {
    id: r.id as number,
    // Form 4 meldet den Meldenden als "NACHNAME VORNAME MITTELNAME" in
    // Großbuchstaben. Einmal hier lesbar gemacht, damit jede Seite dieselbe
    // Schreibweise zeigt.
    entityName:
      r.entity_type === "corporate_insider"
        ? personName(r.entity_name as string)
        : (r.entity_name as string),
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
    pctSinceTrade: r.entity_type === "institution" || !fresh ? null : pctChange(num(r.entry_trade_close), num(r.current_close)),
    pctSinceDisclosure: fresh ? pctChange(num(r.entry_disc_close), num(r.current_close)) : null,
    transactionCode: r.transaction_code as string | null,
    isDerivative: r.is_derivative === true || r.is_derivative === "true",
    priceAsOf,
    reportingDate: r.period_of_report ? new Date(r.period_of_report as string).toISOString().slice(0, 10) : null,
    sourceUrl: r.source_url as string,
    entityPhoto: (r.entity_photo as string) ?? null,
  };
}

export async function getTrades(f: TradeFilters): Promise<FeedRow[]> {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL not configured");

  const where: string[] = ["not t.superseded", NOT_SENATE];
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
  if (f.from) { params.push(f.from); where.push(`t.disclosed_at >= $${params.length}::date`); }
  if (f.to) { params.push(f.to); where.push(`t.disclosed_at <= $${params.length}::date`); }
  if (f.q) {
    params.push(`%${f.q.replace(/[\\%_]/g, "\\$&")}%`);
    const i = params.length;
    where.push(`(e.full_name ilike $${i} or s.ticker ilike $${i} or s.name ilike $${i})`);
  }
  const whereSql = where.length ? `where ${where.join(" and ")}` : "";

  const limit = Math.min(f.limit ?? 50, 201);
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
// Per investor: months, first month, growth over the series and over the
// twelve months to the latest computed month (13F clone, lib/returns.ts).
const RET_CTE = `
  ret_window as (select max(month) - interval '12 months' as start from investor_returns),
  ret as (
    select r.entity_id, count(*) as n, min(r.month) as first,
           exp(sum(ln(greatest(1 + r.ret, 1e-9)))) as g,
           exp(sum(ln(greatest(1 + r.ret, 1e-9))) filter (where r.month > w.start)) as g1,
           count(*) filter (where r.month > w.start) as n1,
           avg(r.coverage) filter (where r.month > w.start) as cov1
    from investor_returns r cross join ret_window w
    group by r.entity_id
  )
`;

function returnFields(r: Record<string, unknown>) {
  const n = Number(r.ret_n) || 0;
  const g = r.ret_g == null ? null : Number(r.ret_g);
  const g1 = r.ret_g1 == null ? null : Number(r.ret_g1);
  return {
    oneYear: g1 !== null && Number(r.ret_n1) >= 12 ? g1 - 1 : null,
    cagr: g !== null && n >= 24 ? Math.pow(g, 12 / n) - 1 : null,
    since: r.ret_first ? String(r.ret_first).slice(0, 7) : null,
    coverage: r.ret_cov1 == null ? null : Number(r.ret_cov1),
  };
}

export async function getInvestors(): Promise<InvestorRow[]> {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL not configured");
  const { rows } = await pool.query(`
    ${CUR_CTE},
    ${RET_CTE}
    select e.slug, e.full_name as fund,
           (select max(as_of_date) from holdings where entity_id = e.id) as as_of,
           count(c.security_id) as positions,
           sum(c.market_value) as value,
           max(ret.n) as ret_n, max(ret.g) as ret_g, max(ret.g1) as ret_g1, max(ret.n1) as ret_n1,
           max(ret.cov1) as ret_cov1, to_char(min(ret.first), 'YYYY-MM') as ret_first
    from entities e
    left join cur c on c.entity_id = e.id and c.put_call is null
    left join ret on ret.entity_id = e.id
    where e.type = 'institution'
    group by e.id, e.slug, e.full_name
    order by value desc nulls last, e.full_name
  `);
  return rows
    .map((r) => ({
      slug: r.slug as string,
      fund: r.fund as string,
      person: investorPerson(r.fund as string),
      positions: Number(r.positions) || 0,
      value: r.value !== null ? Number(r.value) : null,
      asOf: r.as_of ? new Date(r.as_of as string).toISOString().slice(0, 10) : null,
      ...returnFields(r),
    }))
    // hide entities with no current holdings (e.g. a stale demo-seed row)
    .filter((r) => r.positions > 0 || r.value !== null);
}

// ── Single investor ─────────────────────────────────────────────────────────
export async function getInvestor(slug: string): Promise<InvestorDetail | null> {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL not configured");

  const ent = await pool.query(
    `select id, slug, full_name as fund, type from entities where slug = $1 and type = 'institution' limit 1`,
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

  const total = hold.rows.filter(r => !r.put_call).reduce(
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
      weight: !r.put_call && value !== null && total > 0 ? value / total : null,
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

  // The whole latest quarter, not just the trades loaded for the list.
  const moveRows = asOf
    ? (await pool.query(
        `select t.txn_type, count(*)::int as n
         from transactions t join filings f on f.id = t.filing_id
         where t.entity_id = $1 and not t.superseded and nullif(t.put_call, '') is null
           and coalesce(f.period_of_report, t.txn_date) = $2::date
         group by t.txn_type`,
        [e.id, asOf],
      )).rows
    : [];
  const moveCount = (type: string) => Number(moveRows.find((r) => r.txn_type === type)?.n ?? 0);

  const [monthly, bench, letters] = await Promise.all([
    pool.query(`select to_char(month, 'YYYY-MM') as m, ret, coverage from investor_returns where entity_id = $1 order by month`, [e.id]),
    pool.query(`select to_char(month, 'YYYY-MM') as m, ret from benchmark_returns where symbol = 'SPY' order by month`),
    getLetters({ investor: slug, limit: 12 }),
  ]);
  const returns = summarize(
    monthly.rows.map((r) => ({ month: r.m as string, ret: Number(r.ret), coverage: r.coverage == null ? null : Number(r.coverage) })),
    bench.rows.map((r) => ({ month: r.m as string, ret: Number(r.ret) })),
  );

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
    moves: { buys: moveCount("buy"), sells: moveCount("sell") },
    returns,
    letters,
  };
}

// ── Politicians ─────────────────────────────────────────────────────────────
export async function getPoliticians(): Promise<PoliticianRow[]> {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL not configured");
  const { rows } = await pool.query(`
    select e.slug, e.full_name as name, e.party, e.chamber, e.role,
           e.external_ids->>'portrait' as photo,
           count(t.id) as trades, max(t.disclosed_at) as last
    from entities e
    join transactions t on t.entity_id = e.id and not t.superseded
    where e.type = 'politician' and ${NOT_SENATE}
    group by e.id, e.slug, e.full_name, e.party, e.chamber, e.role, e.external_ids
    order by max(t.disclosed_at) desc nulls last, trades desc, e.full_name
  `);
  return rows
    .map((r) => ({
      slug: r.slug as string,
      name: r.name as string,
      party: (r.party as string) ?? null,
      chamber: (r.chamber as string) ?? null,
      seat: seatOf(r.role),
      photo: (r.photo as string) ?? null,
      trades: Number(r.trades) || 0,
      lastTrade: r.last ? new Date(r.last as string).toISOString().slice(0, 10) : null,
    }))
    .filter((r) => r.trades > 0);
}

export async function getPolitician(slug: string): Promise<PoliticianDetail | null> {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL not configured");
  const ent = await pool.query(
    `select e.slug, e.full_name as name, e.party, e.chamber, e.role, e.external_ids->>'portrait' as photo
     from entities e where e.slug = $1 and e.type = 'politician' and ${NOT_SENATE} limit 1`,
    [slug],
  );
  if (ent.rows.length === 0) return null;
  const e = ent.rows[0];
  const trades = await getTrades({ entitySlug: slug, limit: 200 });
  return {
    slug: e.slug as string,
    name: e.name as string,
    party: (e.party as string) ?? null,
    chamber: (e.chamber as string) ?? null,
    seat: seatOf(e.role),
    photo: (e.photo as string) ?? null,
    trades,
  };
}

// ── Insiders ────────────────────────────────────────────────────────────────
export async function getInsider(slug: string): Promise<InsiderDetail | null> {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL not configured");
  const ent = await pool.query(
    `select slug, full_name as name, role from entities where slug = $1 and type = 'corporate_insider' limit 1`,
    [slug],
  );
  if (ent.rows.length === 0) return null;
  const e = ent.rows[0];
  const trades = await getTrades({ entitySlug: slug, limit: 50 });
  const first = trades[0];
  return {
    slug: e.slug as string,
    name: personName(e.name as string),
    role: (e.role as string) ?? null,
    company: first ? companyName(first.ticker, first.securityName) : null,
    ticker: first?.ticker ?? null,
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
           (array_agg(distinct e.full_name))[1:3] as holder_names,
           (select count(*) from transactions t
            where t.security_id = s.id and t.txn_type = 'buy' and not t.superseded) as buys
    from cur c
    join securities s on s.id = c.security_id
    join entities e on e.id = c.entity_id
    where s.ticker is not null and c.put_call is null
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
    buys: Number(r.buys) || 0,
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
    tot as (select entity_id, sum(market_value) as v from cur where put_call is null group by entity_id)
    select e.slug, e.full_name as fund, c.market_value as value, c.shares, c.put_call,
           c.market_value / nullif(t.v, 0) as weight
    from cur c
    join entities e on e.id = c.entity_id
    join tot t on t.entity_id = c.entity_id
    where c.security_id in (select id from securities where upper(ticker) = $1)
    order by c.market_value desc nulls last
    `,
    [T],
  );

  // Ein Kürzel kann auf mehrere Wertpapier-Zeilen zeigen (13F nach CUSIP, Form 4
  // nach Kürzel). Ohne Zusammenfassung stünde derselbe Investor mehrfach in der
  // Liste und die Kopfzahl zählte Zeilen statt Investoren. Aktien und Optionen
  // bleiben dabei getrennt — eine Option ist kein Aktienbestand und darf nicht
  // stillschweigend dazuaddiert werden.
  const merged = new Map<string, StockHolder>();
  for (const r of holders.rows) {
    const putCall = (r.put_call as StockHolder["putCall"]) ?? null;
    const key = `${r.slug as string}|${putCall ?? ""}`;
    const prev = merged.get(key);
    const value = r.value !== null ? Number(r.value) : null;
    const shares = r.shares !== null ? Number(r.shares) : null;
    const weight = !putCall && r.weight !== null ? Number(r.weight) : null;
    if (!prev) {
      merged.set(key, {
        slug: r.slug as string,
        fund: r.fund as string,
        person: investorPerson(r.fund as string),
        value,
        shares,
        weight,
        putCall,
      });
      continue;
    }
    prev.value = prev.value === null && value === null ? null : (prev.value ?? 0) + (value ?? 0);
    prev.shares = prev.shares === null && shares === null ? null : (prev.shares ?? 0) + (shares ?? 0);
    prev.weight = prev.weight === null && weight === null ? null : (prev.weight ?? 0) + (weight ?? 0);
  }
  const holderRows: StockHolder[] = [...merged.values()].sort(
    (a, b) => (b.value ?? 0) - (a.value ?? 0),
  );

  const value = holderRows.reduce((a, r) => a + (r.value ?? 0), 0);
  // Kopfzahl: Investoren, nicht Zeilen. Wer Aktie und Option hält, zählt einmal.
  const investorCount = new Set(holderRows.map((r) => r.slug)).size;
  const trades = await getTrades({ ticker: ticker, limit: 25 });
  const activity = await getStockActivity(T);
  const letters = await getLetters({ ticker: T, limit: 8 });

  return {
    ticker: (s.ticker as string) ?? null,
    securityName: (s.security_name as string) ?? "",
    company: companyName((s.ticker as string) ?? null, (s.security_name as string) ?? null),
    investors: investorCount,
    value: value > 0 ? value : null,
    holders: holderRows,
    activity,
    trades,
    letters,
  };
}

/**
 * Each tracked investor's latest 13F position in a stock against its filing
 * the quarter before. Unlike the loaded trade list (25 rows, mostly Form 4),
 * this covers every fund that holds or held the stock, so the activity ring
 * and the "Zugänge"/"Abgänge" figures agree with the holder count.
 */
export async function getStockActivity(ticker: string): Promise<StockMove[]> {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL not configured");
  const { rows } = await pool.query(
    `
    with hs as (
      select h.entity_id, h.as_of_date, sum(h.shares) as sh, sum(h.market_value) as v
      from holdings h
      where h.security_id = any(array(select id from securities where upper(ticker) = $1))
        and nullif(h.put_call, '') is null
      group by 1, 2
    ),
    ent as (
      select x.entity_id, d.cur,
             (select max(as_of_date) from holdings where entity_id = x.entity_id and as_of_date < d.cur) as prev
      from (select distinct entity_id from hs) x
      cross join lateral (select max(as_of_date) as cur from holdings where entity_id = x.entity_id) d
    )
    select e.slug, e.full_name as fund, ent.cur as as_of, ent.prev as prev_as_of,
           c.sh as cur_shares, c.v as cur_value, p.sh as prev_shares
    from ent
    join entities e on e.id = ent.entity_id
    left join hs c on c.entity_id = ent.entity_id and c.as_of_date = ent.cur
    left join hs p on p.entity_id = ent.entity_id and p.as_of_date = ent.prev
    where c.entity_id is not null or p.entity_id is not null
    order by coalesce(c.v, 0) desc
    `,
    [ticker],
  );
  return rows.map((r) => {
    const shares = r.cur_shares !== null ? Number(r.cur_shares) : null;
    const prevShares = r.prev_shares !== null ? Number(r.prev_shares) : null;
    // Without an earlier filing on record nothing can be said about a change.
    const kind: StockMove["kind"] =
      shares === null ? "exited"
      : r.prev_as_of === null ? "held"
      : prevShares === null ? "new"
      : Math.abs(shares - prevShares) <= prevShares * 0.001 ? "held"
      : shares > prevShares ? "added" : "reduced";
    return {
      slug: r.slug as string,
      fund: r.fund as string,
      person: investorPerson(r.fund as string),
      kind,
      shares,
      prevShares,
      value: r.cur_value !== null ? Number(r.cur_value) : null,
      asOf: r.as_of ? String(r.as_of).slice(0, 10) : null,
    };
  });
}

// ── My-depot match: which tracked investors hold the user's tickers ─────────
export async function getMatch(tickers: string[]): Promise<MatchRow[]> {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL not configured");
  // Yahoo writes share classes with a dash (BRK-B), the filings with a dot
  // (BRK.B): ask for both. A whole Depot fits (58 positions were cut at 40).
  const T = [...new Set(tickers.flatMap((t) => {
    const u = t.toUpperCase();
    return u.includes("-") && !u.endsWith("-USD") ? [u, u.replace(/-/g, ".")] : [u];
  }))].slice(0, 160);
  if (T.length === 0) return [];
  const { rows } = await pool.query(
    `
    ${CUR_CTE},
    tot as (select entity_id, sum(market_value) as v from cur where put_call is null group by entity_id)
    select e.slug, e.full_name as fund,
           count(distinct upper(s.ticker)) as n,
           sum(c.market_value / nullif(t.v, 0)) as w,
           array_agg(distinct upper(s.ticker)) as ts
    from cur c
    join entities e on e.id = c.entity_id and e.type = 'institution'
    join tot t on t.entity_id = c.entity_id
    join securities s on s.id = c.security_id
    where upper(s.ticker) = any($1) and c.put_call is null
    group by e.id, e.slug, e.full_name
    order by w desc nulls last
    limit 6
    `,
    [T],
  );
  return rows.map((r) => ({
    slug: r.slug as string,
    fund: r.fund as string,
    person: investorPerson(r.fund as string),
    sharedCount: Number(r.n) || 0,
    invWeight: r.w !== null ? Number(r.w) : 0,
    sharedTickers: (r.ts as string[]) ?? [],
  }));
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
      order by max(date) desc, count(*) desc
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
const W_CTE = `
  ${CUR_CTE},
  tot as (select entity_id, sum(market_value) as v from cur where put_call is null group by entity_id),
  w as (
    select c.security_id, c.entity_id, c.market_value,
           c.market_value / nullif(t.v, 0) as weight
    from cur c join tot t on t.entity_id = c.entity_id where c.put_call is null
  )
`;

// Shared by Discover and the portfolio's pull-to-refresh spotlight.
const MOST_HELD_SQL = (limit: number) => `
  ${W_CTE}
  select s.ticker, s.name as security_name, count(distinct w.entity_id) as n
  from w join securities s on s.id = w.security_id
  where s.ticker is not null
  group by s.id, s.ticker, s.name
  order by n desc, sum(w.market_value) desc
  limit ${limit}
`;

// Meistgekaufte Aktien im aktuellen Quartal (institutionelle Käufe).
const MOST_BOUGHT_SQL = (limit: number) => `
  select s.ticker, s.name as security_name, count(distinct t.entity_id) as n
  from transactions t
  join entities e on e.id = t.entity_id and e.type = 'institution'
  join securities s on s.id = t.security_id
  join filings f on f.id = t.filing_id
  where t.txn_type = 'buy' and s.ticker is not null and nullif(t.put_call,'') is null
    and not t.superseded
    and coalesce(f.period_of_report, t.txn_date) = (select max(h.as_of_date) from holdings h where h.entity_id=t.entity_id)
  group by s.id, s.ticker, s.name order by n desc, s.ticker limit ${limit}
`;

// Ranked by how many different insiders bought, then by the money they put in.
const INSIDER_BUYS_SQL = (limit: number) => `
  select s.ticker, s.name as security_name, count(distinct t.entity_id) as insiders,
    sum(t.shares * t.price) filter (where t.shares > 0 and t.price > 0) as value
  from transactions t
  join entities e on e.id = t.entity_id and e.type = 'corporate_insider'
  join securities s on s.id = t.security_id
  where t.txn_type = 'buy' and s.ticker is not null and t.transaction_code = 'P'
    and not t.is_derivative and not t.superseded
    and t.disclosed_at >= current_date - 90
  group by s.id, s.ticker, s.name order by insiders desc, value desc nulls last, s.ticker limit ${limit}
`;

const insiderMetric = (r: Record<string, unknown>) => {
  const insiders = Number(r.insiders);
  const value = r.value == null ? null : Number(r.value);
  return `${insiders} ${insiders === 1 ? "insider" : "insiders"}${value ? ` · ${abbrevMoney(value)}` : ""}`;
};

export async function getDiscover(): Promise<Omit<DiscoverData, "source">> {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL not configured");

  const mostHeldQ = pool.query(MOST_HELD_SQL(12));
  const convictionQ = pool.query(`
    ${W_CTE}
    select s.ticker, s.name as security_name, max(w.weight) as mw
    from w join securities s on s.id = w.security_id
    where s.ticker is not null
    group by s.id, s.ticker, s.name
    order by mw desc nulls last
    limit 12
  `);
  const biggestQ = pool.query(`
    ${W_CTE}
    select s.ticker, s.name as security_name, max(w.market_value) as mv
    from w join securities s on s.id = w.security_id
    where s.ticker is not null
    group by s.id, s.ticker, s.name
    order by mv desc nulls last
    limit 12
  `);

  const boughtQ = pool.query(MOST_BOUGHT_SQL(12));
  const insiderBuysQ = pool.query(INSIDER_BUYS_SQL(12));
  // Größte Fonds (nach Portfolio-Wert).
  const fundsQ = pool.query(`
    ${CUR_CTE}
    select e.slug, e.full_name as fund, sum(c.market_value) as v
    from entities e join cur c on c.entity_id = e.id
    where e.type = 'institution'
    group by e.id, e.slug, e.full_name
    order by v desc nulls last
    limit 12
  `);
  // Am konzentriertesten (höchstes Einzelpositions-Gewicht).
  const concQ = pool.query(`
    ${CUR_CTE},
    tot as (select entity_id, sum(market_value) as v from cur where put_call is null group by entity_id)
    select e.slug, e.full_name as fund, max(c.market_value / nullif(t.v, 0)) as mw
    from entities e
    join cur c on c.entity_id = e.id
    join tot t on t.entity_id = e.id
    where e.type = 'institution' and c.put_call is null
    group by e.id, e.slug, e.full_name
    order by mw desc nulls last
    limit 12
  `);

  // Aktivste Politiker (nach Anzahl gemeldeter Trades).
  const polQ = pool.query(`
    select e.slug, e.full_name as name, e.party, e.chamber, e.role, e.external_ids->>'portrait' as photo, count(t.id) as n
    from entities e join transactions t on t.entity_id = e.id
    where e.type = 'politician' and ${NOT_SENATE} and not t.superseded
      and t.disclosed_at >= current_date - 365
    group by e.id, e.slug, e.full_name, e.party, e.chamber, e.role, e.external_ids
    order by n desc
    limit 12
  `);

  // Best performers: twelve-month 13F-clone return, only where most of the
  // reported value could be priced (MIN_COVERAGE) and the year is complete.
  const bestQ = pool.query(`
    with ${RET_CTE}
    select e.slug, e.full_name as fund, ret.g1 - 1 as r
    from ret join entities e on e.id = ret.entity_id
    where ret.n1 >= 12 and ret.cov1 >= $1
    order by r desc
    limit 12
  `, [MIN_COVERAGE]);

  const [mostHeld, conviction, biggest, bought, insiderBuys, funds, conc, pols, best] = await Promise.all([
    mostHeldQ,
    convictionQ,
    biggestQ,
    boughtQ,
    insiderBuysQ,
    fundsQ,
    concQ,
    polQ,
    bestQ.catch(() => ({ rows: [] as Record<string, unknown>[] })),
  ]);

  const item = (r: Record<string, unknown>, metric: string): CollectionItem => ({
    ticker: (r.ticker as string) ?? null,
    company: companyName((r.ticker as string) ?? null, (r.security_name as string) ?? null),
    securityName: (r.security_name as string) ?? "",
    metric,
  });
  const inv = (r: Record<string, unknown>, metric: string): CollectionInvestor => ({
    slug: r.slug as string,
    fund: r.fund as string,
    person: investorPerson(r.fund as string),
    metric,
  });

  return {
    mostHeld: mostHeld.rows.map((r) => item(r, `${Number(r.n)} investors`)),
    highestConviction: conviction.rows.map((r) =>
      item(r, `${pctOf(Number(r.mw) || 0, 0, false)} weight`),
    ),
    biggest: biggest.rows.map((r) => {
      const mv = Number(r.mv) || 0;
      return item(r, abbrevMoney(mv));
    }),
    mostBoughtQ: bought.rows.map((r) => item(r, `${Number(r.n)} added`)),
    insiderBuys: insiderBuys.rows.map((r) => item(r, insiderMetric(r))),
    biggestFunds: funds.rows.map((r) => inv(r, abbrevMoney(Number(r.v)))),
    mostConcentrated: conc.rows.map((r) =>
      inv(r, `${pctOf(Number(r.mw) || 0, 0, false)} top position`),
    ),
    bestPerformers: best.rows.map((r) => inv(r, pctOf(Number(r.r), 1))),
    topPoliticians: pols.rows.map((r) => ({
      slug: r.slug as string,
      fund: [r.party, seatOf(r.role)].filter(Boolean).join("-") || "US House",
      person: (r.name as string) ?? null,
      metric: `${Number(r.n)} trades`,
      photo: (r.photo as string) ?? null,
    })),
  };
}

// ── Portfolio pull-to-refresh spotlight ─────────────────────────────────────
// Berkshire by its SEC number: the slug comes from the filer's name.
const BERKSHIRE_CIK = "0001067983";

// Berkshire's latest 13F: what it added that quarter first, then the rest by
// size. Weights are of the stock positions (options left out).
const BUFFETT_SQL = `
  with b as (select id from entities where type = 'institution' and external_ids->>'cik' = $1 limit 1),
  latest as (select max(as_of_date) as as_of from holdings where entity_id = (select id from b)),
  cur as (
    select h.security_id, h.market_value from holdings h, latest l
    where h.entity_id = (select id from b) and h.as_of_date = l.as_of and nullif(h.put_call,'') is null
  ),
  tot as (select sum(market_value) as v from cur),
  added as (
    select distinct t.security_id from transactions t join filings f on f.id = t.filing_id
    where t.entity_id = (select id from b) and t.txn_type = 'buy' and not t.superseded
      and nullif(t.put_call,'') is null
      and coalesce(f.period_of_report, t.txn_date) = (select as_of from latest)
  )
  select s.ticker, s.name as security_name, c.market_value / nullif(t.v, 0) as weight,
         c.security_id in (select security_id from added) as added,
         to_char((select as_of from latest), 'YYYY-MM-DD') as as_of
  from cur c cross join tot t join securities s on s.id = c.security_id
  where s.ticker is not null
  order by c.market_value desc nulls last
  limit 40
`;

export async function getSpotlight(): Promise<Omit<SpotlightData, "source">> {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL not configured");

  const [bought, held, insiders, buffett] = await Promise.all([
    pool.query(MOST_BOUGHT_SQL(4)),
    pool.query(MOST_HELD_SQL(4)),
    pool.query(INSIDER_BUYS_SQL(2)),
    pool.query(BUFFETT_SQL, [BERKSHIRE_CIK]),
  ]);

  const item = (r: Record<string, unknown>, kind: SpotlightKind, label: string, metric: string): SpotlightItem => ({
    ticker: r.ticker as string,
    company: companyName((r.ticker as string) ?? null, (r.security_name as string) ?? null),
    kind,
    label,
    metric,
  });

  const quarter = quarterOf((buffett.rows[0]?.as_of as string) ?? null);
  const buying = buffett.rows
    .filter((r) => r.added)
    .slice(0, 2)
    .map((r) => item(r, "buffett-buying", "Buffett is buying", `Added${quarter ? ` in ${quarter}` : ""} · ${weightLabel(Number(r.weight) || 0)} of Berkshire`));
  const holding = buffett.rows
    .slice(0, 3)
    .map((r, i) => item(r, "buffett", "In Buffett’s portfolio", `No. ${i + 1} position · ${weightLabel(Number(r.weight) || 0)} of Berkshire`));

  return {
    items: mixSpotlight([
      bought.rows.map((r) => item(r, "bought", "Most bought by star investors", `Added by ${Number(r.n)} star investors`)),
      [...buying, ...holding],
      held.rows.map((r) => item(r, "held", "Most held by star investors", `Held by ${Number(r.n)} star investors`)),
      insiders.rows.map((r) => item(r, "insiders", "Insiders are buying", `${insiderMetric(r)} in 90 days`)),
    ]),
  };
}

// ── Investor letters ────────────────────────────────────────────────────────
export interface LetterFilters {
  investor?: string;
  ticker?: string;
  stance?: string;
  limit?: number;
  offset?: number;
}

const LETTER_COLS = `
  l.slug, l.title, l.author, l.org, e.slug as investor_slug, l.kind,
  to_char(l.published_on, 'YYYY-MM-DD') as published_on, l.published_precision,
  l.stance, l.headline, l.summary, l.stocks
`;

function toLetterSummary(r: Record<string, unknown>): LetterSummary {
  const stocks = Array.isArray(r.stocks) ? (r.stocks as { ticker?: string | null }[]) : [];
  return {
    slug: r.slug as string,
    title: r.title as string,
    author: r.author as string,
    org: (r.org as string) ?? null,
    investorSlug: (r.investor_slug as string) ?? null,
    kind: r.kind as LetterSummary["kind"],
    publishedOn: r.published_on as string,
    precision: r.published_precision === "month" ? "month" : "day",
    stance: r.stance as LetterSummary["stance"],
    headline: r.headline as string,
    summary: r.summary as string,
    tickers: [...new Set(stocks.map((s) => s.ticker).filter((t): t is string => !!t))],
  };
}

export async function getLetters(f: LetterFilters = {}): Promise<LetterSummary[]> {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL not configured");
  const where: string[] = [];
  const args: unknown[] = [];
  if (f.investor) {
    args.push(f.investor);
    where.push(`e.slug = $${args.length}`);
  }
  if (f.ticker) {
    // Named in "stocks discussed" or in a takeaway.
    args.push(f.ticker.toUpperCase());
    where.push(`(l.stocks @> jsonb_build_array(jsonb_build_object('ticker', $${args.length}::text))
      or exists (select 1 from jsonb_array_elements(l.takeaways) t where t->'tickers' ? $${args.length}))`);
  }
  if (f.stance && ["bullish", "neutral", "bearish"].includes(f.stance)) {
    args.push(f.stance);
    where.push(`l.stance = $${args.length}`);
  }
  args.push(Math.min(Math.max(f.limit ?? 30, 1), 100), Math.max(f.offset ?? 0, 0));
  const { rows } = await pool.query(
    `select ${LETTER_COLS}
     from letters l left join entities e on e.id = l.entity_id
     ${where.length ? `where ${where.join(" and ")}` : ""}
     order by l.published_on desc, l.id desc
     limit $${args.length - 1} offset $${args.length}`,
    args,
  );
  return rows.map(toLetterSummary);
}

export async function getLetter(slug: string): Promise<Letter | null> {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL not configured");
  const { rows } = await pool.query(
    `select ${LETTER_COLS}, l.source_url, l.source_name, l.takeaways, l.risks, l.quotes, l.summarized_by
     from letters l left join entities e on e.id = l.entity_id
     where l.slug = $1`,
    [slug],
  );
  if (!rows.length) return null;
  const r = rows[0];
  const stocks = (Array.isArray(r.stocks) ? r.stocks : []) as Letter["stocks"];
  const tickers = stocks.map((s) => s.ticker?.toUpperCase()).filter((t): t is string => !!t);
  const known = tickers.length
    ? new Set((await pool.query(`select distinct upper(ticker) as t from securities where upper(ticker) = any($1)`, [tickers])).rows.map((x) => x.t as string))
    : new Set<string>();
  return {
    ...toLetterSummary(r),
    sourceUrl: r.source_url as string,
    sourceName: (r.source_name as string) ?? null,
    takeaways: (Array.isArray(r.takeaways) ? r.takeaways : []).map((t: Letter["takeaways"][number]) => ({ ...t, tickers: t.tickers ?? [] })),
    risks: Array.isArray(r.risks) ? r.risks : [],
    quotes: Array.isArray(r.quotes) ? r.quotes : [],
    stocks: stocks.map((s) => ({ ...s, known: !!s.ticker && known.has(s.ticker.toUpperCase()) })),
    summarizedBy: (r.summarized_by as string) ?? null,
  };
}
