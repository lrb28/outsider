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
  const [counts, groups] = await Promise.all([
    pool.query(`with price_dates as (select upper(s.ticker) as symbol, max(p.date) as latest from securities s left join prices p on p.security_id=s.id where s.ticker is not null group by upper(s.ticker))
      select (select count(*) from entities) as entities,
      (select count(*) from entities where type = 'institution') as institutions,
      (select count(*) from entities where type = 'corporate_insider') as insiders,
      (select count(*) from entities where type = 'politician') as politicians,
      (select count(*) from transactions t where coalesce(to_jsonb(t)->>'superseded','false') = 'false') as trades,
      (select max(disclosed_at)::text from transactions t where coalesce(to_jsonb(t)->>'superseded','false') = 'false') as disclosure,
      (select max(latest)::text from price_dates) as price,
      (select count(*) from price_dates) as price_symbols,
      (select count(*) from price_dates where latest >= current_date - 7) as fresh`),
    pool.query(`select e.type, max(t.disclosed_at)::text as latest,
      count(t.id) filter (where t.id is not null and t.disclosed_at is null) as missing, count(t.id) as trades
      from entities e left join transactions t on t.entity_id=e.id and coalesce(to_jsonb(t)->>'superseded','false') = 'false' group by e.type`),
  ]);
  const r = counts.rows[0];
  return { entities: Number(r.entities), institutions: Number(r.institutions), insiders: Number(r.insiders),
    politicians: Number(r.politicians), trades: Number(r.trades), latestDisclosure: r.disclosure, latestPrice: r.price,
    priceSymbols: Number(r.price_symbols), freshPriceSymbols: Number(r.fresh),
    groups: groups.rows.map(g => ({ type: g.type, latestDisclosure: g.latest, missingDates: Number(g.missing), trades: Number(g.trades) })) };
}
