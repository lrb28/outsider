import { getPool } from "./db";

export interface Stats {
  entities: number;
  institutions: number;
  insiders: number;
  politicians: number;
  trades: number;
}

export async function getStats(): Promise<Stats> {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL not configured");
  const { rows } = await pool.query(`
    select
      (select count(*) from entities) as entities,
      (select count(*) from entities where type = 'institution') as institutions,
      (select count(*) from entities where type = 'corporate_insider') as insiders,
      (select count(*) from entities where type = 'politician') as politicians,
      (select count(*) from transactions) as trades
  `);
  const r = rows[0];
  return {
    entities: Number(r.entities),
    institutions: Number(r.institutions),
    insiders: Number(r.insiders),
    politicians: Number(r.politicians),
    trades: Number(r.trades),
  };
}
