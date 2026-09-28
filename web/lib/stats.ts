import { getPool } from "./db";
export interface Stats {
  entities: number; institutions: number; insiders: number; politicians: number; trades: number;
  latestDisclosure: string | null;
  latestPrice: string | null;
  priceSymbols: number;
  freshPriceSymbols: number;
  groups: { type: string; latestDisclosure: string | null; missingDates: number; trades: number }[];
}
export type StatsResponse = Stats & { source: "database" | "sample" };
export async function getStats(): Promise<Stats> {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL not configured");
  // Price coverage counts only what the app shows (trades of the last 90
  // days and current 13F positions). The newest close per security comes from
  // the (security_id, date) index instead of scanning every stored price.
  const [counts, groups] = await Promise.all([
    pool.query(`with shown as (
        select t.security_id as id from transactions t where not t.superseded and t.disclosed_at >= current_date - 90
        union
        select h.security_id from holdings h
        join (select entity_id, max(as_of_date) as as_of from holdings group by entity_id) l on l.entity_id = h.entity_id and l.as_of = h.as_of_date
      ), price_dates as (
        select upper(s.ticker) as symbol, max(lp.d) as latest
        from securities s join shown on shown.id = s.id
        left join lateral (select max(p.date) as d from prices p where p.security_id = s.id) lp on true
        where s.ticker is not null group by upper(s.ticker)
      )
      select (select count(*) from entities where chamber is distinct from 'Senate') as entities,
      (select count(*) from entities where type = 'institution') as institutions,
      (select count(*) from entities where type = 'corporate_insider') as insiders,
      (select count(*) from entities where type = 'politician' and chamber is distinct from 'Senate') as politicians,
      (select count(*) from transactions t join entities e on e.id=t.entity_id where e.chamber is distinct from 'Senate' and not t.superseded) as trades,
      (select max(t.disclosed_at)::text from transactions t join entities e on e.id=t.entity_id where e.chamber is distinct from 'Senate' and not t.superseded) as disclosure,
      (select max(latest)::text from price_dates) as price,
      (select count(*) from price_dates) as price_symbols,
      (select count(*) from price_dates where latest >= current_date - 7) as fresh`),
    pool.query(`select e.type, max(t.disclosed_at)::text as latest,
      count(t.id) filter (where t.id is not null and t.disclosed_at is null) as missing, count(t.id) as trades
      from entities e left join transactions t on t.entity_id=e.id and not t.superseded where e.chamber is distinct from 'Senate' group by e.type`),
  ]);
  const r = counts.rows[0];
  return { entities: Number(r.entities), institutions: Number(r.institutions), insiders: Number(r.insiders),
    politicians: Number(r.politicians), trades: Number(r.trades), latestDisclosure: r.disclosure, latestPrice: r.price,
    priceSymbols: Number(r.price_symbols), freshPriceSymbols: Number(r.fresh),
    groups: groups.rows.map(g => ({ type: g.type, latestDisclosure: g.latest, missingDates: Number(g.missing), trades: Number(g.trades) })) };
}
