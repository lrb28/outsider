// Yahoo symbols run up to 20 characters: some funds only list as ISIN plus
// exchange (IE00BK5BQT80.SG). A shorter cap rejected the whole Depot request.
export const SYMBOL_RE = /^\^?[A-Z0-9][A-Z0-9.\-=]{0,19}$/;
export class InputError extends Error {}
export function integerParam(p: URLSearchParams, key: string, fallback: number, min: number, max: number): number {
  const raw = p.get(key);
  if (raw === null) return fallback;
  const n = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(n) || n < min || n > max) throw new InputError(`Invalid parameter: ${key}.`);
  return n;
}
export function textParam(p: URLSearchParams, key: string, max = 120): string | undefined {
  const v = p.get(key)?.trim();
  if (!v) return undefined;
  if (v.length > max || /[\u0000-\u001f]/.test(v)) throw new InputError(`Invalid parameter: ${key}.`);
  return v;
}
export function enumParam(p: URLSearchParams, key: string, allowed: string[]): string | undefined {
  const v = textParam(p, key, 40);
  if (v && !allowed.includes(v)) throw new InputError(`Invalid parameter: ${key}.`);
  return v;
}
export function dateParam(p: URLSearchParams, key: string): string | undefined {
  const v = textParam(p, key, 10);
  if (v && (!/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v)) throw new InputError(`Invalid date: ${key}.`);
  return v;
}
export function symbolList(raw: string, max = 30): string[] {
  const values = [...new Set(raw.split(",").map(t => t.trim().toUpperCase()).filter(Boolean))];
  if (values.length > max || values.some(t => !SYMBOL_RE.test(t))) throw new InputError(`Please give at most ${max} valid security identifiers.`);
  return values;
}
