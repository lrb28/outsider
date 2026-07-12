export function pct(v: number | null): string {
  if (v === null || Number.isNaN(v)) return "—";
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)} %`;
}

export function money(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return `$${Math.round(v).toLocaleString("de-DE")}`;
}

export function sizeDisplay(row: {
  shares: number | null;
  amount_min: number | null;
  amount_max: number | null;
}): string {
  if (row.amount_min !== null || row.amount_max !== null) {
    if (row.amount_min !== null && row.amount_max !== null) {
      return row.amount_min === row.amount_max
        ? money(row.amount_min)
        : `${money(row.amount_min)}–${money(row.amount_max)}`;
    }
    return row.amount_min !== null ? `≥ ${money(row.amount_min)}` : `≤ ${money(row.amount_max)}`;
  }
  if (row.shares !== null) return `${Math.round(row.shares).toLocaleString("de-DE")} St.`;
  return "—";
}

export function signalLabel(txnType: string, putCall: string | null): {
  text: string;
  tone: "bull" | "bear" | "neutral";
} {
  const opening = txnType === "buy";
  if (putCall === "Put")
    return opening
      ? { text: "Put · bearish", tone: "bear" }
      : { text: "Put geschlossen", tone: "neutral" };
  if (putCall === "Call")
    return opening
      ? { text: "Call · bullish", tone: "bull" }
      : { text: "Call geschlossen", tone: "neutral" };
  if (txnType === "buy") return { text: "Kauf", tone: "bull" };
  if (txnType === "sell") return { text: "Verkauf", tone: "bear" };
  return { text: txnType, tone: "neutral" };
}

export function initials(name: string): string {
  const parts = name.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] ?? "";
  return (a + b).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-indigo-100 text-indigo-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-teal-100 text-teal-700",
  "bg-cyan-100 text-cyan-700",
];

export function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// Curated map: an entity's fund OR person name -> Wikipedia article title.
// Matched by substring so it works whether the feed shows the fund or the person.
// The app fetches the portrait from Wikipedia at runtime (CORS-enabled); anything
// not listed / without a photo keeps the coloured initials avatar.
const WIKI_TITLES: [string, string][] = [
  ["berkshire", "Warren_Buffett"],
  ["buffett", "Warren_Buffett"],
  ["scion", "Michael_Burry"],
  ["burry", "Michael_Burry"],
  ["pershing", "Bill_Ackman"],
  ["ackman", "Bill_Ackman"],
  ["duquesne", "Stanley_Druckenmiller"],
  ["druckenmiller", "Stanley_Druckenmiller"],
  ["soros", "George_Soros"],
  ["daily journal", "Charlie_Munger"],
  ["munger", "Charlie_Munger"],
  ["bridgewater", "Ray_Dalio"],
  ["dalio", "Ray_Dalio"],
  ["perceptive", "Joseph_Edelman"],
  ["edelman", "Joseph_Edelman"],
  ["dalal", "Mohnish_Pabrai"],
  ["pabrai", "Mohnish_Pabrai"],
  ["situational", "Leopold_Aschenbrenner"],
  ["aschenbrenner", "Leopold_Aschenbrenner"],
];

export function wikiTitleFor(name: string): string | null {
  const n = name.toLowerCase();
  for (const [sub, title] of WIKI_TITLES) if (n.includes(sub)) return title;
  return null;
}
