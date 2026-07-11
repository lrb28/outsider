import { Pool } from "pg";

// Singleton pool (Next.js hot-reload safe). Returns null when DATABASE_URL is
// unset so the app can fall back to bundled sample data.
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
    max: 3,
  });
  return pool;
}
