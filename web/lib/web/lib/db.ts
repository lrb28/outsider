import { Pool } from "pg";

// Singleton pool (Next.js hot-reload safe). Returns null when DATABASE_URL is
// unset so the app can fall back to bundled sample data.
//
// Serverless tuning: each lambda keeps at most ONE connection (many lambdas ×
// big pools exhaust Supabase's pooler and cause random failures), with tight
// timeouts so a dead connection fails fast and the retry wrapper can recover.
let pool: Pool | null | undefined;

export function getPool(): Pool | null {
  if (pool !== undefined) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) {
    pool = null;
    return pool;
  }
  pool = new Pool({
    connectionString: url,
    ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false },
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
    allowExitOnIdle: true,
  });
  // never let an idle-connection error crash the lambda
  pool.on("error", () => {});
  return pool;
}
