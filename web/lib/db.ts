import "server-only";
import { Pool, types } from "pg";
import { SUPABASE_ROOT_CA } from "./supabaseCa";
// DATE has no timezone; retain the date the disclosure actually contains.
types.setTypeParser(1082, value => value);
let pool: Pool | null | undefined;
export function trustedCa(hostname: string, configured = process.env.DATABASE_CA_CERT): string | undefined {
  if (configured) return configured.replace(/\\n/g, "\n");
  // Other hosts keep Node's default trust store; a custom CA would replace it.
  return /(^|\.)supabase\.(co|com)$/.test(hostname) ? SUPABASE_ROOT_CA : undefined;
}
export function getPool(): Pool | null {
  if (pool !== undefined) return pool;
  const raw = process.env.DATABASE_URL;
  if (!raw) return pool = null;
  const url = new URL(raw);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  // URL sslmode flags must not override certificate verification.
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) url.searchParams.delete(key);
  const ca = trustedCa(url.hostname);
  pool = new Pool({
    connectionString: url.toString(),
    ssl: local ? false : { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
    max: 2,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 4_000,
    statement_timeout: 6_000,
    query_timeout: 7_000,
    allowExitOnIdle: true,
  });
  pool.on("error", () => console.error("[database] idle connection closed"));
  return pool;
}
