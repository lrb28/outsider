import { pctOf } from "./format";
import type { SpotlightItem } from "./types";

/**
 * The lists take turns (most bought, Buffett, most held, insiders, then the
 * second of each …), so consecutive pulls never show the same kind twice. A
 * company shows up once: GOOG and GOOGL, or a stock that is both most bought
 * and Buffett's, keep the first slot they reach.
 */
export function mixSpotlight(lists: SpotlightItem[][]): SpotlightItem[] {
  const out: SpotlightItem[] = [];
  const seen = new Set<string>();
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    for (const list of lists) {
      const it = list[i];
      if (!it) continue;
      const key = it.company.toLowerCase();
      if (seen.has(key) || seen.has(it.ticker)) continue;
      seen.add(key);
      seen.add(it.ticker);
      out.push(it);
    }
  }
  return out;
}

/** "22%" for big weights, "0.4%" for small ones. */
export const weightLabel = (w: number) => pctOf(w, w < 0.1 ? 1 : 0, false);

/** "Q2 2026" for a 13F period ending 2026-06-30. */
export function quarterOf(isoDate: string | null): string | null {
  const m = isoDate?.match(/^(\d{4})-(\d{2})/);
  return m ? `Q${Math.ceil(Number(m[2]) / 3)} ${m[1]}` : null;
}
