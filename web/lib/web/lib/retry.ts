// Retry a DB-backed call once after a short pause. Serverless + pooled
// Postgres occasionally drops a connection; one retry turns those blips into
// successes instead of silently falling back to sample data.
export async function withRetry<T>(fn: () => Promise<T>, tries = 2, delayMs = 250): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}
