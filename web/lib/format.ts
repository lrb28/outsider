export function pct(v: number | null): string {
  if (v === null || Number.isNaN(v)) return "—";
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)} %`;
}

export function money(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return `$${Math.round(v).toLocaleString("de-DE")}`;
}

// Compact money like Eaves: $263.1B, $12.4M, $980K.
export function abbrevMoney(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const a = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (a >= 1e12) return `${sign}$${(a / 1e12).toFixed(1)} Bio.`;
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(1)} Mrd.`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)} Mio.`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(0)}K`;
  return `${sign}$${a.toFixed(0)}`;
}

export function weightPct(v: number | null): string {
  if (v === null || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(1)} %`;
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
  if (txnType === "exchange") return { text: "Umschichtung", tone: "neutral" };
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
  ["point72", "Steven_A._Cohen"],
  ["tiger global", "Chase_Coleman_III"],
  ["baupost", "Seth_Klarman"],
  ["pelosi", "Nancy_Pelosi"],
];

export function wikiTitleFor(name: string): string | null {
  const n = name.toLowerCase();
  for (const [sub, title] of WIKI_TITLES) if (n.includes(sub)) return title;
  return null;
}

// Display name of the person behind a fund (from the Wikipedia map).
export function investorPerson(name: string): string | null {
  const t = wikiTitleFor(name);
  return t ? t.replace(/_/g, " ") : null;
}

// One-line description shown on investor pages (Eaves-style bio line).
const INVESTOR_BIO: [string, string][] = [
  ["buffett", "Legendärer Value-Investor, CEO von Berkshire Hathaway."],
  ["berkshire", "Legendärer Value-Investor, CEO von Berkshire Hathaway."],
  ["burry", "Contrarian-Investor, bekannt aus „The Big Short“."],
  ["scion", "Contrarian-Investor, bekannt aus „The Big Short“."],
  ["ackman", "Aktivistischer Investor, Gründer von Pershing Square."],
  ["pershing", "Aktivistischer Investor, Gründer von Pershing Square."],
  ["druckenmiller", "Makro-Legende, früher Soros' rechte Hand."],
  ["duquesne", "Makro-Legende, früher Soros' rechte Hand."],
  ["soros", "Makro-Investor und Philanthrop, „brach die Bank of England“."],
  ["munger", "Buffetts langjähriger Partner, Value-Investor."],
  ["daily journal", "Buffetts langjähriger Partner, Value-Investor."],
  ["dalio", "Gründer von Bridgewater, dem größten Hedgefonds der Welt."],
  ["bridgewater", "Gründer von Bridgewater, dem größten Hedgefonds der Welt."],
  ["edelman", "Biotech-Investor, Gründer von Perceptive Advisors."],
  ["perceptive", "Biotech-Investor, Gründer von Perceptive Advisors."],
  ["pabrai", "Value-Investor im Stil von Buffett und Munger."],
  ["dalal", "Value-Investor im Stil von Buffett und Munger."],
  ["aschenbrenner", "KI-Investor, früher bei OpenAI's Superalignment-Team."],
  ["situational", "KI-Investor, früher bei OpenAI's Superalignment-Team."],
  ["point72", "Hedgefonds-Milliardär, Gründer von Point72 (früher SAC Capital)."],
  ["tiger global", "Tech-Investor, „Tiger Cub“, Gründer von Tiger Global."],
  ["baupost", "Value-Investor, Gründer der Baupost Group."],
];

export function investorBio(name: string): string | null {
  const n = name.toLowerCase();
  for (const [sub, bio] of INVESTOR_BIO) if (n.includes(sub)) return bio;
  return null;
}

// ── Company display names ────────────────────────────────────────────────────
// Show a clean company name instead of the ticker / raw SEC issuer name.
const COMPANY_BY_TICKER: Record<string, string> = {
  AAPL: "Apple", MSFT: "Microsoft", NVDA: "NVIDIA", AMZN: "Amazon",
  GOOGL: "Alphabet", GOOG: "Alphabet", META: "Meta", TSLA: "Tesla",
  AVGO: "Broadcom", AMD: "AMD", TSM: "TSMC", NFLX: "Netflix",
  ORCL: "Oracle", INTC: "Intel", CRM: "Salesforce", COIN: "Coinbase",
  PLTR: "Palantir", JPM: "JPMorgan Chase", KO: "Coca-Cola", WMT: "Walmart",
  PFE: "Pfizer", HAL: "Halliburton", MOH: "Molina Healthcare",
  LULU: "Lululemon", SLM: "SLM (Sallie Mae)", BRKR: "Bruker",
  "BRK.A": "Berkshire Hathaway", "BRK.B": "Berkshire Hathaway",
  AXP: "American Express", BAC: "Bank of America", V: "Visa", MA: "Mastercard",
  DIS: "Disney", NKE: "Nike", SBUX: "Starbucks", MCD: "McDonald's",
  UBER: "Uber", ABNB: "Airbnb", SHOP: "Shopify", PYPL: "PayPal",
  QCOM: "Qualcomm", MU: "Micron", ADBE: "Adobe", NOW: "ServiceNow",
  SPY: "S&P 500 ETF", QQQ: "Nasdaq 100 ETF", DVA: "DaVita",
  BABA: "Alibaba", UNH: "UnitedHealth", LLY: "Eli Lilly", MRK: "Merck",
  XOM: "ExxonMobil", CVX: "Chevron", GM: "General Motors", F: "Ford",
  C: "Citigroup", GS: "Goldman Sachs", MS: "Morgan Stanley", WFC: "Wells Fargo",
  // Berkshire & other commonly-held names (correct US tickers)
  OXY: "Occidental Petroleum", KHC: "Kraft Heinz", DAL: "Delta Air Lines",
  SIRI: "SiriusXM", VRSN: "Verisign", KR: "Kroger", CB: "Chubb", MCO: "Moody's",
  COF: "Capital One", ALLY: "Ally Financial", NU: "Nu Holdings",
  CHTR: "Charter Communications", LEN: "Lennar", DHI: "D.R. Horton",
  AON: "Aon", DPZ: "Domino's Pizza", LPX: "Louisiana-Pacific", LAMR: "Lamar",
  // Broad large caps
  JNJ: "Johnson & Johnson", PG: "Procter & Gamble", HD: "Home Depot",
  COST: "Costco", PEP: "PepsiCo", ABBV: "AbbVie", TMO: "Thermo Fisher",
  ACN: "Accenture", ABT: "Abbott", DHR: "Danaher", VZ: "Verizon", T: "AT&T",
  CSCO: "Cisco", CMCSA: "Comcast", BLK: "BlackRock", SCHW: "Charles Schwab",
  CAT: "Caterpillar", BA: "Boeing", GE: "GE Aerospace", HON: "Honeywell",
  UNP: "Union Pacific", UPS: "UPS", LMT: "Lockheed Martin", RTX: "RTX",
  DE: "Deere", LOW: "Lowe's", TJX: "TJX", MDLZ: "Mondelez", GILD: "Gilead",
  AMGN: "Amgen", BMY: "Bristol Myers Squibb", CVS: "CVS Health",
  SNOW: "Snowflake", PANW: "Palo Alto Networks", CRWD: "CrowdStrike",
  DDOG: "Datadog", NET: "Cloudflare", SPGI: "S&P Global", ICE: "ICE",
  CME: "CME Group", TXN: "Texas Instruments", IBM: "IBM", INTU: "Intuit",
  ISRG: "Intuitive Surgical", VRT: "Vertiv", SMCI: "Super Micro",
};

// A CUSIP (9-char security id) sometimes ends up in the name/ticker column when
// symbol resolution didn't return a clean name. Detect it so we never show it.
function isCusipLike(s: string | null | undefined): boolean {
  const t = (s || "").trim();
  return t.length >= 6 && t.length <= 9 && /^[0-9A-Za-z]+$/.test(t) && /[0-9]/.test(t);
}

const SUFFIX_RE =
  /\b(incorporated|inc|corporation|corp|company|co|plc|ltd|limited|llc|l\.?p|lp|sa|n\.?v|a\.?g|holdings?|group|the|com|new|sponsored|adr|ads)\b\.?/gi;

function prettifyCompany(raw: string): string {
  let s = (raw || "").toLowerCase();
  s = s.replace(/\b(class [a-c]|cl\.? [a-c]|series [a-c]|common stock|ordinary shares?|shares?)\b/gi, " ");
  s = s.replace(/[/].*$/, " "); // drop trailing /DE/ etc.
  s = s.replace(/\s+/g, " ").trim();
  // Title-case each word
  s = s
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
  s = s.replace(SUFFIX_RE, " ").replace(/[.,]+/g, " ").replace(/\s+/g, " ").trim();
  return s || raw;
}

// Some CUSIPs resolve to a non-US listing (CHV instead of CVX). Correct the
// display ticker to the familiar US symbol, and recover a symbol for a couple
// of names that came through without one. Used for the logo lookup and label;
// routing/DB lookups keep the raw ticker.
const TICKER_FIX: Record<string, string> = {
  CHV: "CVX",
  DUT: "MCO",
  TRL: "DVA",
};

export function fixTicker(ticker: string | null, name?: string | null): string | null {
  if (ticker) return TICKER_FIX[ticker.toUpperCase()] ?? ticker;
  if (name) {
    const n = name.toLowerCase();
    if (n.includes("chubb")) return "CB";
  }
  return ticker;
}

export function companyName(ticker: string | null, rawName: string | null): string {
  const rawT = (ticker || "").trim();
  const T = rawT && !isCusipLike(rawT) ? rawT.toUpperCase() : "";
  if (T && COMPANY_BY_TICKER[T]) return COMPANY_BY_TICKER[T];
  if (rawName && !isCusipLike(rawName)) {
    const pretty = prettifyCompany(rawName);
    if (pretty && !isCusipLike(pretty)) return pretty;
  }
  if (T) return T; // clean ticker symbol beats an unresolved CUSIP
  if (rawName && !isCusipLike(rawName)) return rawName;
  return rawT || rawName || "—";
}
