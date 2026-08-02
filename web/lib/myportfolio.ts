// Local "my depot" store (localStorage). Holdings live only in this browser —
// no account needed. Emits a "mydepot" window event on change.

export interface MyHolding {
  ticker: string;
  shares: number;
  buyPrice?: number; // optional, USD per share
}

const KEY = "outsider:mydepot";

export function getMyHoldings(): MyHolding[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((h) => h && h.ticker && h.shares > 0) : [];
  } catch {
    return [];
  }
}

function write(h: MyHolding[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(h));
  window.dispatchEvent(new CustomEvent("mydepot"));
}

export function setMyHoldings(h: MyHolding[]) {
  write(h);
}

// Merge: same ticker -> shares summed (buyPrice from the newer entry wins).
export function upsertHolding(h: MyHolding) {
  const cur = getMyHoldings();
  const i = cur.findIndex((x) => x.ticker === h.ticker);
  if (i >= 0) {
    cur[i] = {
      ticker: h.ticker,
      shares: cur[i].shares + h.shares,
      buyPrice: h.buyPrice ?? cur[i].buyPrice,
    };
  } else {
    cur.push(h);
  }
  write(cur);
}

export function removeHolding(ticker: string) {
  write(getMyHoldings().filter((h) => h.ticker !== ticker));
}

export function clearHoldings() {
  write([]);
}

// Tolerant number parsing for German and US formats: "1.234,56" | "1234.56" | "1234"
export function parseNum(s: string): number {
  const t = (s || "").trim().replace(/\s/g, "").replace(/[$€]/g, "");
  if (!t) return NaN;
  if (t.includes(",") && t.includes(".")) return parseFloat(t.replace(/\./g, "").replace(",", "."));
  if (t.includes(",")) return parseFloat(t.replace(",", "."));
  return parseFloat(t);
}

// Parse a CSV: one holding per line, "TICKER,Anzahl[,Kaufpreis]" (also ; or Tab).
// Header lines and junk are skipped. Returns holdings + skipped line count.
export function parseCsv(text: string): { holdings: MyHolding[]; skipped: number } {
  const out: MyHolding[] = [];
  let skipped = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const sep = line.includes(";") ? ";" : line.includes("\t") ? "\t" : ",";
    const cols = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    const ticker = (cols[0] || "").toUpperCase();
    if (!/^[A-Z][A-Z0-9.\-]{0,7}$/.test(ticker)) {
      skipped++;
      continue;
    }
    const shares = parseNum(cols[1] || "");
    if (!Number.isFinite(shares) || shares <= 0) {
      skipped++;
      continue;
    }
    const bp = cols[2] !== undefined ? parseNum(cols[2]) : NaN;
    out.push({
      ticker,
      shares,
      ...(Number.isFinite(bp) && bp > 0 ? { buyPrice: bp } : {}),
    });
  }
  // merge duplicates within the file
  const merged = new Map<string, MyHolding>();
  for (const h of out) {
    const cur = merged.get(h.ticker);
    if (cur) {
      merged.set(h.ticker, {
        ticker: h.ticker,
        shares: cur.shares + h.shares,
        buyPrice: h.buyPrice ?? cur.buyPrice,
      });
    } else {
      merged.set(h.ticker, h);
    }
  }
  return { holdings: [...merged.values()], skipped };
}
