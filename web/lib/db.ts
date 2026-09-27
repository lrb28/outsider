import "server-only";
import { attachDatabasePool } from "@vercel/functions";
import { Pool, type PoolConfig, types } from "pg";
import { SUPABASE_ROOT_CA } from "./supabaseCa";
// DATE has no timezone; retain the date the disclosure actually contains.
types.setTypeParser(1082, value => value);
let pool: Pool | null | undefined;
export function trustedCa(hostname: string, configured = process.env.DATABASE_CA_CERT): string | undefined {
  if (configured) return configured.replace(/\\n/g, "\n");
  // Other hosts keep Node's default trust store; a custom CA would replace it.
  return /(^|\.)supabase\.(co|com)$/.test(hostname) ? SUPABASE_ROOT_CA : undefined;
}
export function poolConfig(raw: string, configuredCa = process.env.DATABASE_CA_CERT): PoolConfig {
  const url = new URL(raw);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  // URL sslmode flags must not override certificate verification.
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) url.searchParams.delete(key);
  const ca = trustedCa(url.hostname, configuredCa);
  // Port 6543 is a transaction pooler: it hands the server connection back
  // after each query, and session startup parameters are not reliably passed
  // through. There the role's own statement_timeout applies instead.
  const transactionPooler = url.port === "6543";
  return {
    connectionString: url.toString(),
    ssl: local ? false : { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
    // Serverless: one connection per instance. In the pooler's session mode
    // every open client occupies one of only a few server slots (15 by
    // default), and frozen Vercel instances used to keep theirs for minutes,
    // which locked out every other request with EMAXCONNSESSION.
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 4_000,
    ...(transactionPooler ? {} : { statement_timeout: 6_000 }),
    query_timeout: 7_000,
    allowExitOnIdle: true,
  };
}
export function getPool(): Pool | null {
  if (pool !== undefined) return pool;
  const raw = process.env.DATABASE_URL;
  if (!raw) return pool = null;
  pool = new Pool(poolConfig(raw));
  pool.on("error", () => console.error("[database] idle connection closed"));
  // Keeps the Vercel instance alive until idle connections are closed, so a
  // suspended instance never holds a pooler slot. No-op outside Vercel.
  attachDatabasePool(pool);
  return pool;
}
