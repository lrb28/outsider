export class HttpError extends Error {
  constructor(public status: number) { super(`HTTP ${status}`); }
}
type Options = { tries?: number; signal?: AbortSignal; timeoutMs?: number };
export async function fetchJson<T>(url: string, options: number | Options = {}): Promise<T> {
  const opts: Options = typeof options === "number" ? { tries: options } : options;
  const { tries = 2, signal, timeoutMs = 12_000 } = opts;
  let lastError: unknown;
  for (let i = 0; i < Math.max(1, tries); i++) {
    signal?.throwIfAborted();
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    const timer = setTimeout(cancel, timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new HttpError(response.status);
      return await response.json() as T;
    } catch (error) {
      signal?.throwIfAborted();
      if (error instanceof HttpError && error.status < 500 && error.status !== 429) throw error;
      lastError = error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
    }
    if (i + 1 < tries) await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(delay); reject(new DOMException("Aborted", "AbortError")); };
      const delay = setTimeout(() => { signal?.removeEventListener("abort", abort); resolve(); }, 300 * (i + 1));
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
    });
  }
  throw lastError;
}
const catalogue = new Map<string, { until: number; promise: Promise<unknown> }>();
export function fetchCatalogue<T>(url: string): Promise<T> {
  const hit = catalogue.get(url);
  if (hit && hit.until > Date.now()) return hit.promise as Promise<T>;
  if (catalogue.size >= 16) catalogue.delete(catalogue.keys().next().value as string);
  const promise = fetchJson<T>(url).catch(error => { catalogue.delete(url); throw error; });
  catalogue.set(url, { until: Date.now() + 10_000, promise });
  return promise;
}
