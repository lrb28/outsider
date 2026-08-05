// Client-side fetch with retries + backoff. One transient API hiccup should
// never surface as "nicht gefunden" — we try three times before failing.
export async function fetchJson<T>(url: string, tries = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()) as T;
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) await new Promise((res) => setTimeout(res, 300 * (i + 1)));
    }
  }
  throw lastErr;
}
