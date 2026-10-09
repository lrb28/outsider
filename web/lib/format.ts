import type { FeedRow } from "./types";

// Numbers are written the English way (1,234.5) and the percent sign follows
// the number directly (22.4%). NBSP still joins a number to a word unit.
export const NBSP = "\u00A0";
export const LOCALE = "en-US";

/** 1,234.5 with a fixed number of decimals. */
export function num(v: number, digits = 1): string {
  return v.toLocaleString(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** A ratio as percent: 0.224 -> "+22.4%" (signed) or "22.4%". */
export function pctOf(v: number | null | undefined, digits = 1, signed = true): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${signed && v >= 0 ? "+" : ""}${num(v * 100, digits)}%`;
}

export function pct(v: number | null): string {
  return pctOf(v, 1, true);
}

export function money(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return `$${Math.round(v).toLocaleString(LOCALE)}`;
}

// Compact money like Eaves: $263.1B, $12.4M, $980K.
export function abbrevMoney(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (a >= 1e12) return `${sign}$${num(a / 1e12)}T`;
  if (a >= 1e9) return `${sign}$${num(a / 1e9)}B`;
  if (a >= 1e6) return `${sign}$${num(a / 1e6)}M`;
  if (a >= 1e3) return `${sign}$${num(a / 1e3, 0)}K`;
  return `${sign}$${num(a, 0)}`;
}

// Key figures on phones: three significant digits, so $263B, $26.3B.
export function shortMoney(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  const units: [number, string][] = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];
  for (const [i, [size, unit]] of units.entries()) {
    const n = a / size;
    if (n < 1) continue;
    // Number() drops a trailing ".0": $71B, not $71.0B.
    const r = Number(n.toFixed(n >= 99.95 ? 0 : 1));
    // 999.6B would round to "1000B"; the next unit up reads better.
    if (i > 0 && r >= 1000) return `${sign}$1${units[i - 1][1]}`;
    return `${sign}$${r.toLocaleString(LOCALE, { maximumFractionDigits: 1 })}${unit}`;
  }
  return `${sign}$${a.toFixed(0)}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(iso: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const month = Number(m[2]);
  return month >= 1 && month <= 12 ? [Number(m[1]), month, Number(m[3])] : null;
}

// ISO date (2026-01-27) -> "Jan 27, 2026".
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const p = parts(iso);
  return p ? `${MONTHS[p[1] - 1]} ${p[2]}, ${p[0]}` : iso;
}

// ISO date (2026-01-27) -> "Jan 27" this year, "Jan 27 '25" before, for key figures.
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const p = parts(iso);
  if (!p) return iso;
  return p[0] === new Date().getFullYear() ? `${MONTHS[p[1] - 1]} ${p[2]}` : `${MONTHS[p[1] - 1]} ${p[2]} '${String(p[0]).slice(2)}`;
}

/**
 * Label for the "since disclosure" column.
 *
 * A bare dash looks broken. There are two quite different reasons for no
 * number: the filing is from today (no period yet), or there is no price
 * series for the security (nothing to compute). Both are spelt out rather
 * than inventing a return.
 */
export function disclosureLabel(
  pctSince: number | null,
  disclosedAt: string | null | undefined,
  today: string,
): { text: string; muted: boolean } {
  if (pctSince !== null && Number.isFinite(pctSince)) return { text: pct(pctSince), muted: false };
  const d = disclosedAt ? disclosedAt.slice(0, 10) : null;
  if (d && d >= today) return { text: "filed today", muted: true };
  return { text: "no price on file", muted: true };
}

/**
 * Folds runs of filings in the feed.
 *
 * In a vesting round a company files a dozen insider entries for the same
 * stock on the same day. Listed one below the other they push everything
 * else away and the feed looks like a single event. Consecutive rows with
 * the same day, stock, kind and signal are therefore bundled into one row
 * from three on; the single filings stay and can be expanded.
 */
export const SERIES_MIN = 3;

export function groupSeries<
  T extends {
    disclosedAt: string | null;
    ticker: string | null;
    entityType: string;
    txnType: string;
    putCall?: string | null;
    transactionCode?: string | null;
  },
>(rows: T[]): ({ key: string; rows: T[] })[] {
  const out: { key: string; rows: T[] }[] = [];
  for (const r of rows) {
    const key = [r.disclosedAt ?? "", r.ticker ?? "", r.entityType, r.txnType, r.putCall ?? "", r.transactionCode ?? ""].join("|");
    const last = out[out.length - 1];
    if (last && last.key === key) last.rows.push(r);
    else out.push({ key, rows: [r] });
  }
  return out;
}

export function weightPct(v: number | null): string {
  return pctOf(v, 1, false);
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
  if (row.shares !== null && row.shares > 0 && row.shares < 0.000001) return "< 0.000001 sh.";
  if (row.shares !== null) return `${row.shares.toLocaleString(LOCALE, { maximumFractionDigits: 6 })} sh.`;
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
      : { text: "Put closed", tone: "neutral" };
  if (putCall === "Call")
    return opening
      ? { text: "Call · bullish", tone: "bull" }
      : { text: "Call closed", tone: "neutral" };
  if (txnType === "buy") return { text: "Buy", tone: "bull" };
  if (txnType === "sell") return { text: "Sell", tone: "bear" };
  if (txnType === "exchange") return { text: "Exchange", tone: "neutral" };
  return { text: txnType, tone: "neutral" };
}

// ── Person names from SEC filings ───────────────────────────────────────────
//
// Form 4 names the filer as "LAST FIRST MIDDLE", often all in capitals:
// "BARTON RICHARD N". Read like that every page looks like a government
// printout. This turns it into "Richard N. Barton".

const NAME_SUFFIX = new Set(["JR", "SR", "II", "III", "IV", "V", "MD", "PHD"]);
const NAME_PARTICLE = new Set(["van", "von", "de", "del", "der", "den", "di", "da", "la", "le"]);

function titleCasePart(w: string): string {
  const low = w.toLowerCase();
  if (NAME_PARTICLE.has(low)) return low;
  // O'Brien, McDonald-Smith
  return low
    .split(/(['\-])/)
    .map((p, i) => (i % 2 === 1 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join("");
}

/**
 * "BARTON RICHARD N" → "Richard N. Barton"
 * "Zuckerberg Mark"  → "Mark Zuckerberg"
 * "SMITH BRADFORD L JR" → "Bradford L. Smith Jr."
 *
 * Company names are left alone, recognised by legal forms and digits.
 */
export function personName(raw: string | null | undefined): string {
  const s = (raw || "").trim().replace(/\s+/g, " ");
  if (!s) return "";
  // Looks like a company? Leave it.
  if (/\b(inc|corp|llc|lp|ltd|plc|trust|fund|capital|partners|holdings?|group|management|gmbh|ag|s\.?a)\b/i.test(s))
    return s;
  if (/\d/.test(s)) return s;
  if (s.includes(",")) {
    // Some sources already give "Last, First".
    const [last, rest] = s.split(",", 2);
    const given = (rest || "").trim();
    if (given) return `${formatGiven(given)} ${titleCasePart(last.trim())}`.trim();
  }

  const parts = s.split(" ").filter(Boolean);
  if (parts.length < 2) return titleCasePart(s);

  // Split off suffixes like JR/III and put them back at the end.
  const suffixes: string[] = [];
  while (parts.length > 2 && NAME_SUFFIX.has(parts[parts.length - 1].replace(/\./g, "").toUpperCase())) {
    suffixes.unshift(parts.pop() as string);
  }
  if (parts.length < 2) return titleCasePart(s);

  const last = parts.shift() as string;
  const given = parts.join(" ");
  const suffix = suffixes.map((x) => {
    const u = x.replace(/\./g, "").toUpperCase();
    return u === "JR" || u === "SR" ? `${u.charAt(0)}${u.slice(1).toLowerCase()}.` : u;
  });
  return [formatGiven(given), titleCasePart(last), ...suffix].filter(Boolean).join(" ");
}

/** Given names in proper case; single letters get a full stop. */
function formatGiven(given: string): string {
  return given
    .split(" ")
    .filter(Boolean)
    .map((w) => {
      const clean = w.replace(/\./g, "");
      return clean.length === 1 ? `${clean.toUpperCase()}.` : titleCasePart(clean);
    })
    .join(" ");
}

export function initials(name: string): string {
  const parts = name.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] ?? "";
  return (a + b).toUpperCase();
}

// Aura of an entity type: the identity colour used for avatars, glows and
// chart marks (CSS variable names from globals.css).
export type AuraKind = "investor" | "insider" | "politician";
export function auraOf(entityType: string | null | undefined): AuraKind {
  if (entityType === "politician") return "politician";
  if (entityType === "corporate_insider") return "insider";
  return "investor";
}

// Curated registry: an entity's fund OR person name -> portrait key and the
// person's display name. Matched by substring, so it works whether the feed
// shows the fund or the person; keys are specific enough not to hit other
// names. Portraits live in lib/portraits.ts (free licences only).
const INVESTOR_PEOPLE: [string, string, string][] = [
  ["berkshire", "Warren_Buffett", "Warren Buffett"],
  ["buffett", "Warren_Buffett", "Warren Buffett"],
  ["scion", "Michael_Burry", "Michael Burry"],
  ["burry", "Michael_Burry", "Michael Burry"],
  ["pershing", "Bill_Ackman", "Bill Ackman"],
  ["ackman", "Bill_Ackman", "Bill Ackman"],
  ["duquesne", "Stanley_Druckenmiller", "Stanley Druckenmiller"],
  ["druckenmiller", "Stanley_Druckenmiller", "Stanley Druckenmiller"],
  ["soros", "George_Soros", "George Soros"],
  ["daily journal", "Charlie_Munger", "Charlie Munger"],
  ["munger", "Charlie_Munger", "Charlie Munger"],
  ["bridgewater", "Ray_Dalio", "Ray Dalio"],
  ["dalio", "Ray_Dalio", "Ray Dalio"],
  ["perceptive", "Joseph_Edelman", "Joseph Edelman"],
  ["edelman", "Joseph_Edelman", "Joseph Edelman"],
  ["dalal street", "Mohnish_Pabrai", "Mohnish Pabrai"],
  ["pabrai", "Mohnish_Pabrai", "Mohnish Pabrai"],
  ["situational", "Leopold_Aschenbrenner", "Leopold Aschenbrenner"],
  ["aschenbrenner", "Leopold_Aschenbrenner", "Leopold Aschenbrenner"],
  ["point72", "Steven_A._Cohen", "Steven A. Cohen"],
  ["tiger global", "Chase_Coleman_III", "Chase Coleman"],
  ["baupost", "Seth_Klarman", "Seth Klarman"],
  ["icahn", "Carl_Icahn", "Carl Icahn"],
  ["gates foundation", "Bill_Gates", "Bill Gates"],
  ["ark investment", "Cathie_Wood", "Cathie Wood"],
  ["cathie wood", "Cathie_Wood", "Cathie Wood"],
  ["appaloosa", "David_Tepper", "David Tepper"],
  ["himalaya capital", "Li_Lu", "Li Lu"],
  ["third point", "Daniel_Loeb", "Daniel Loeb"],
  ["fundsmith", "Terry_Smith", "Terry Smith"],
  ["trian fund", "Nelson_Peltz", "Nelson Peltz"],
  ["akre capital", "Chuck_Akre", "Chuck Akre"],
  ["gardner russo", "Thomas_Russo", "Thomas Russo"],
  ["oaktree", "Howard_Marks", "Howard Marks"],
  ["coatue", "Philippe_Laffont", "Philippe Laffont"],
  ["viking global", "Andreas_Halvorsen", "Andreas Halvorsen"],
  ["lone pine", "Stephen_Mandel", "Stephen Mandel"],
  ["altimeter", "Brad_Gerstner", "Brad Gerstner"],
  ["d1 capital", "Dan_Sundheim", "Dan Sundheim"],
  ["fairfax financial", "Prem_Watsa", "Prem Watsa"],
  ["markel", "Tom_Gayner", "Tom Gayner"],
  ["starboard value", "Jeff_Smith", "Jeff Smith"],
  // Starboard's letters are signed with the full first name.
  ["jeffrey smith", "Jeff_Smith", "Jeff Smith"],
  ["glenview", "Larry_Robbins", "Larry Robbins"],
  // Greenlight files its 13F as DME Capital Management since 2024.
  ["dme capital", "David_Einhorn", "David Einhorn"],
  ["greenlight", "David_Einhorn", "David Einhorn"],
  ["elliott investment", "Paul_Singer", "Paul Singer"],
  ["elliott management", "Paul_Singer", "Paul Singer"],
  ["renaissance tech", "Jim_Simons", "Jim Simons"],
  ["tudor investment", "Paul_Tudor_Jones", "Paul Tudor Jones"],
  ["tci fund", "Chris_Hohn", "Chris Hohn"],
  ["h&h international", "Duan_Yongping", "Duan Yongping"],
  ["southeastern asset", "Mason_Hawkins", "Mason Hawkins"],
  ["longleaf", "Mason_Hawkins", "Mason Hawkins"],
  ["valueact", "Mason_Morfit", "Mason Morfit"],
  ["abrams capital", "David_Abrams", "David Abrams"],
  ["fairholme", "Bruce_Berkowitz", "Bruce Berkowitz"],
  ["valley forge", "Dev_Kantesaria", "Dev Kantesaria"],
  ["semper augustus", "Chris_Bloomstran", "Chris Bloomstran"],
  ["giverny", "Francois_Rochon", "François Rochon"],
  ["paulson & co", "John_Paulson", "John Paulson"],
  ["maverick capital", "Lee_Ainslie", "Lee Ainslie"],
  ["lindsell train", "Nick_Train", "Nick Train"],
  ["harris associates", "Bill_Nygren", "Bill Nygren"],
  ["oakmark", "Bill_Nygren", "Bill Nygren"],
  ["dorsey asset", "Pat_Dorsey", "Pat Dorsey"],
  ["brave warrior", "Glenn_Greenberg", "Glenn Greenberg"],
  ["miller value", "Bill_Miller", "Bill Miller"],
  ["durable capital", "Henry_Ellenbogen", "Henry Ellenbogen"],
  ["thiel macro", "Peter_Thiel", "Peter Thiel"],
  ["jana partners", "Barry_Rosenstein", "Barry Rosenstein"],
  // Akre's quarterly letters are signed by portfolio manager John Neff.
  ["john neff", "Chuck_Akre", "Chuck Akre"],
  ["pelosi", "Nancy_Pelosi", "Nancy Pelosi"],
];

function investorEntry(name: string): [string, string, string] | null {
  const n = name.toLowerCase();
  for (const entry of INVESTOR_PEOPLE) if (n.includes(entry[0])) return entry;
  // Pages often pass the person ("David Tepper") rather than the fund
  // ("Appaloosa LP"); both must find the same portrait.
  for (const entry of INVESTOR_PEOPLE) if (n === entry[2].toLowerCase()) return entry;
  return null;
}

/** Portrait key (lib/portraits.ts) for a fund or person name. */
export function wikiTitleFor(name: string): string | null {
  return investorEntry(name)?.[1] ?? null;
}

// Display name of the person behind a fund.
export function investorPerson(name: string): string | null {
  return investorEntry(name)?.[2] ?? null;
}

// Short bio shown on investor pages (Eaves-style, 2–3 punchy sentences).
const BIO_BUFFETT =
  "The “Oracle of Omaha”. Built Berkshire Hathaway over six decades into the world’s largest investment holding company — value investing, favourite holding period: forever. Announced in 2025 that Greg Abel would take over as CEO.";
const BIO_BURRY =
  "Became world-famous for his bet against the US housing market (“The Big Short”). Runs a small, extremely concentrated portfolio and likes to bet against the consensus — lately with puts on the AI darlings too.";
const BIO_ACKMAN =
  "Activist investor: buys large stakes in a few companies and gets involved with management. Known for public campaigns — and a concentrated portfolio of around ten positions.";
const BIO_DRUCK =
  "Macro legend: managed money for three decades without a single losing year and was Soros’ right hand on the 1992 pound trade. Invests through his family office today — few bets, high conviction.";
const BIO_SOROS =
  "“The man who broke the Bank of England” — his 1992 bet against the pound made him a legend. His family office invests broadly across stocks, bonds and currencies.";
const BIO_MUNGER =
  "Buffett’s partner for 45 years and Berkshire’s vice chairman (1924–2023). The Daily Journal portfolio he shaped still holds only a handful of long-term positions.";
const BIO_DALIO =
  "Founded Bridgewater, the world’s largest hedge fund — close to 1,000 positions, extremely diversified. Known for his “Principles” and the All Weather portfolio.";
const BIO_EDELMAN =
  "Biotech specialist: Perceptive Advisors invests almost only in life sciences and counts among the most successful healthcare funds of all.";
const BIO_PABRAI =
  "Calls himself a “shameless cloner” of Buffett and Munger. Extremely concentrated — often just a handful of positions, gladly off the beaten US track.";
const BIO_ASCHEN =
  "Former OpenAI researcher who wrote the much-debated 2024 essay “Situational Awareness”. Then founded a fund that goes all in on the AI age — from chips to energy.";
const BIO_COHEN =
  "Hedge fund billionaire and owner of the New York Mets. Point72 (successor to SAC Capital) trades thousands of positions across dozens of teams.";
const BIO_COLEMAN =
  "A “Tiger Cub” from Julian Robertson’s stable. Tiger Global grew big on early tech bets like Facebook and JD.com — focus: internet and software worldwide.";
const BIO_KLARMAN =
  "Value legend and author of the cult book “Margin of Safety”. Baupost invests patiently and happily holds a lot of cash when nothing is cheap.";

const BIO_ICAHN =
  "Activist from the very start: buys large blocks and then publicly demands change — from TWA to Apple. His stakes run mainly through Icahn Enterprises today.";
const BIO_GATES =
  "The Gates Foundation Trust manages the foundation’s endowment — a calm, concentrated portfolio of long-term quality stocks.";
const BIO_WOOD =
  "Founder of ARK Invest and the best-known champion of “disruptive innovation”: AI, robotics, genomics, crypto. Her active ETFs trade almost daily; here you see the quarterly holdings.";
const BIO_TEPPER =
  "Founder of Appaloosa, famous for his bet on US banks after the 2009 financial crisis. One of the most successful hedge fund managers for years, and owner of the Carolina Panthers.";
const BIO_LILU =
  "Founder of Himalaya Capital; Charlie Munger trusted him with part of his family’s fortune. Holds only a handful of positions, often in Asia and financials.";
const BIO_LOEB =
  "Activist investor with Third Point — known for sharply worded letters to boards and a mix of tech, consumer and special situations.";
const BIO_SMITH =
  "The “British Buffett”: Fundsmith buys only quality companies, never overpays and then tries to do nothing. Very concentrated, very patient.";
const BIO_PELTZ =
  "Activist with Trian: buys large stakes in established consumer and industrial companies and pushes onto the board — at Procter & Gamble and Disney, for example.";
const BIO_AKRE =
  "Akre Capital looks for “compounding machines” — companies that earn high returns on their capital for decades — and holds a few positions for a very long time.";
const BIO_RUSSO =
  "Thomas Russo has invested for decades in global brand owners with staying power — drinks, luxury, consumer goods — and often holds them for decades.";
const BIO_MARKS =
  "Co-founder of Oaktree and author of the famous client memos many professionals read at once. Oaktree is known mainly for bonds and special situations; the 13F shows only the stock side.";
const BIO_LAFFONT =
  "A “Tiger Cub” and founder of Coatue: bets heavily on technology — from the big platforms to fast-growing software.";
const BIO_HALVORSEN =
  "Another “Tiger Cub”: Viking Global combines thorough company research with a broad portfolio across healthcare, financials and tech.";
const BIO_MANDEL =
  "“Tiger Cub” Stephen Mandel made Lone Pine one of the best-known growth funds — concentrated on quality companies with strong brands.";
const BIO_GERSTNER =
  "Founder of Altimeter: invests early in tech platforms, holds public winners for a long time and bets big on the infrastructure behind AI.";
const BIO_SUNDHEIM =
  "Founded D1 Capital after years at Viking: listed tech and consumer stocks, plus private stakes.";
const BIO_WATSA =
  "The “Canadian Buffett”: runs Fairfax Financial like Berkshire — insurance money, invested patiently and often against the cycle.";
const BIO_GAYNER =
  "Runs Markel, often called “Baby Berkshire”: an insurer with a long-term stock portfolio of quality names.";
const BIO_STARBOARD =
  "Starboard Value is one of Wall Street’s most active activists: a big stake, a concrete plan for better margins and, if needed, a proxy fight.";
const BIO_ROBBINS =
  "Glenview Capital specialises in healthcare and is known for a few thoroughly researched bets.";
const BIO_EINHORN =
  "Founded Greenlight Capital in 1996 and became known for public short calls, above all against Lehman Brothers before its 2008 collapse. Runs a concentrated value portfolio; since 2024 Greenlight’s 13F is filed as DME Capital Management.";
const BIO_SINGER =
  "Founded Elliott in 1977, one of the oldest hedge funds under continuous management. Among the most feared activists anywhere — from Argentina’s defaulted bonds to boardroom fights at companies around the world.";
const BIO_SIMONS =
  "Mathematician and former codebreaker who founded Renaissance Technologies and pioneered quantitative investing; its Medallion fund, closed to outsiders, is considered the most successful ever. Simons died in 2024. The 13F shows thousands of model-driven positions.";
const BIO_TUDOR =
  "Macro trader who called the 1987 crash and founded Tudor Investment Corp. Also founded the Robin Hood Foundation, which fights poverty in New York.";
const BIO_HOHN =
  "Founded TCI (The Children’s Investment Fund), one of Britain’s most successful hedge funds. A tough activist with a tiny portfolio of near-monopolies such as Visa, Moody’s and GE Aerospace.";
const BIO_DUAN =
  "Chinese entrepreneur behind BBK Electronics, the root of Oppo and Vivo, and an early backer of Pinduoduo. Invests like Buffett — he won the 2006 charity lunch with him — and his US portfolio is dominated by Apple and Berkshire.";
const BIO_HAWKINS =
  "Founded Southeastern Asset Management in 1975. Its Longleaf funds buy a small number of companies at deep discounts to their appraised value and push management for change when needed.";
const BIO_MORFIT =
  "ValueAct is a quiet activist: it takes large stakes and works with boards behind the scenes — Mason Morfit once sat on Microsoft’s board. He has led the firm since co-founder Jeff Ubben left in 2020.";
const BIO_ABRAMS =
  "A Baupost alumnus who keeps an extremely low profile. Abrams Capital runs a very concentrated portfolio and holds its positions for years.";
const BIO_BERKOWITZ =
  "Founder of Fairholme and Morningstar’s US stock fund manager of the decade for 2000–2009. Known for huge contrarian bets — today the portfolio is mostly one stock, the Florida land owner St. Joe.";
const BIO_KANTESARIA =
  "Valley Forge owns only a handful of “toll-road” businesses with near-monopoly positions — credit scores, credit ratings and payment networks — and holds them for the long run.";
const BIO_BLOOMSTRAN =
  "Founded Semper Augustus in St. Louis in 1998. His annual letter to clients runs to well over 100 pages and is a cult read among Berkshire fans; Berkshire has been his largest holding for two decades.";
const BIO_ROCHON =
  "Montreal-based founder of Giverny Capital and an art collector — every annual letter opens with a painting. His family portfolio has compounded at about 14.7% a year since 1993.";
const BIO_PAULSON =
  "Made billions betting against subprime mortgages in 2007, often called “the greatest trade ever”. Paulson & Co. now manages mainly his own money, with big bets on gold miners and drug developers.";
const BIO_AINSLIE =
  "A “Tiger Cub” who has run Maverick Capital since 1993: a stock picker with a long and short book across technology, healthcare, financials and consumer stocks.";
const BIO_TRAIN =
  "Co-founder of London’s Lindsell Train: a short list of brands and data businesses, held for decades with hardly any trading.";
const BIO_NYGREN =
  "Has run the Oakmark Fund at Harris Associates since 2000: classic value investing in large US companies, explained in famously readable quarterly letters.";
const BIO_DORSEY =
  "Former director of equity research at Morningstar and author of books on “economic moats”. Dorsey Asset Management owns about a dozen wide-moat companies.";
const BIO_GREENBERG =
  "Co-founded Chieftain Capital in 1984 and went his own way with Brave Warrior Advisors in 2009: a concentrated portfolio of quality companies bought when they are out of favour.";
const BIO_MILLER =
  "Beat the S&P 500 fifteen years in a row at Legg Mason, a record. Now advises Miller Value Partners, run by his son Bill Miller IV, and is a famous Bitcoin bull.";
const BIO_ELLENBOGEN =
  "Ran T. Rowe Price’s New Horizons fund before founding Durable Capital in 2019: growth companies he expects to own for many years.";
const BIO_THIEL =
  "PayPal co-founder and Facebook’s first outside investor, today one of Silicon Valley’s best-known venture capitalists. His small public portfolio, Thiel Macro, leans on Amazon and power utilities.";
const BIO_ROSENSTEIN =
  "Founded JANA Partners in 2001: an activist that pushes companies to sell themselves or split up — Whole Foods sold itself to Amazon after JANA’s 2017 campaign.";

const INVESTOR_BIO: [string, string][] = [
  ["dme capital", BIO_EINHORN],
  ["greenlight", BIO_EINHORN],
  ["elliott investment", BIO_SINGER],
  ["renaissance tech", BIO_SIMONS],
  ["tudor investment", BIO_TUDOR],
  ["tci fund", BIO_HOHN],
  ["h&h international", BIO_DUAN],
  ["southeastern asset", BIO_HAWKINS],
  ["valueact", BIO_MORFIT],
  ["abrams capital", BIO_ABRAMS],
  ["fairholme", BIO_BERKOWITZ],
  ["valley forge", BIO_KANTESARIA],
  ["semper augustus", BIO_BLOOMSTRAN],
  ["giverny", BIO_ROCHON],
  ["paulson & co", BIO_PAULSON],
  ["maverick capital", BIO_AINSLIE],
  ["lindsell train", BIO_TRAIN],
  ["harris associates", BIO_NYGREN],
  ["dorsey asset", BIO_DORSEY],
  ["brave warrior", BIO_GREENBERG],
  ["miller value", BIO_MILLER],
  ["durable capital", BIO_ELLENBOGEN],
  ["thiel macro", BIO_THIEL],
  ["jana partners", BIO_ROSENSTEIN],
  ["icahn", BIO_ICAHN],
  ["gates foundation", BIO_GATES],
  ["ark investment", BIO_WOOD],
  ["appaloosa", BIO_TEPPER],
  ["himalaya capital", BIO_LILU],
  ["third point", BIO_LOEB],
  ["fundsmith", BIO_SMITH],
  ["trian fund", BIO_PELTZ],
  ["akre capital", BIO_AKRE],
  ["gardner russo", BIO_RUSSO],
  ["oaktree", BIO_MARKS],
  ["coatue", BIO_LAFFONT],
  ["viking global", BIO_HALVORSEN],
  ["lone pine", BIO_MANDEL],
  ["altimeter", BIO_GERSTNER],
  ["d1 capital", BIO_SUNDHEIM],
  ["fairfax financial", BIO_WATSA],
  ["markel", BIO_GAYNER],
  ["starboard value", BIO_STARBOARD],
  ["glenview", BIO_ROBBINS],
  ["buffett", BIO_BUFFETT],
  ["berkshire", BIO_BUFFETT],
  ["burry", BIO_BURRY],
  ["scion", BIO_BURRY],
  ["ackman", BIO_ACKMAN],
  ["pershing", BIO_ACKMAN],
  ["druckenmiller", BIO_DRUCK],
  ["duquesne", BIO_DRUCK],
  ["soros", BIO_SOROS],
  ["munger", BIO_MUNGER],
  ["daily journal", BIO_MUNGER],
  ["dalio", BIO_DALIO],
  ["bridgewater", BIO_DALIO],
  ["edelman", BIO_EDELMAN],
  ["perceptive", BIO_EDELMAN],
  ["pabrai", BIO_PABRAI],
  ["dalal", BIO_PABRAI],
  ["aschenbrenner", BIO_ASCHEN],
  ["situational", BIO_ASCHEN],
  ["point72", BIO_COHEN],
  ["tiger global", BIO_COLEMAN],
  ["baupost", BIO_KLARMAN],
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
  // Companies whose insiders we follow (Form 4)
  HOOD: "Robinhood", MSTR: "Strategy", RKLB: "Rocket Lab", SOFI: "SoFi",
  RDDT: "Reddit", CMG: "Chipotle", DASH: "DoorDash", DELL: "Dell",
  GME: "GameStop", APP: "AppLovin", ANET: "Arista Networks", HIMS: "Hims & Hers",
  // Names that 13F abbreviations mangle beyond repair
  SPCX: "SpaceX", CART: "Instacart", JCI: "Johnson Controls", JHX: "James Hardie",
  USFD: "US Foods", MELI: "MercadoLibre", CBRS: "Cerebras", HHH: "Howard Hughes",
  BBD: "Bradesco", IEP: "Icahn Enterprises", HCC: "Warrior Met Coal",
};

// 13F issuer names are cut to fit a fixed-width column ("JOHNSON CTLS INTL",
// "US FOODS HLDG"). After title-casing, the usual cuts are spelt out again.
const ABBREV: Record<string, string> = {
  Ctls: "Controls", Intl: "International", Inds: "Industries", Hldg: "Holdings",
  Hldgs: "Holdings", Techn: "Technologies", Technolog: "Technologies", Svcs: "Services",
  Svc: "Service", Sys: "Systems", Pptys: "Properties", Ppty: "Property", Mgmt: "Management",
  Mfg: "Manufacturing", Finl: "Financial", Hlth: "Health", Hlthcare: "Healthcare",
  Entmt: "Entertainment", Natl: "National", Amer: "American", Dev: "Development",
  Elec: "Electric", Equip: "Equipment", Instrs: "Instruments", Invts: "Investments",
  Matls: "Materials", Pwr: "Power", Semicndtr: "Semiconductor", Solutns: "Solutions",
  Util: "Utilities", Commun: "Communications", Communctns: "Communications",
  Pharmaceutica: "Pharmaceuticals", Therapeutc: "Therapeutics", Bancorporatn: "Bancorporation",
  Us: "US", Ai: "AI", Usa: "USA", Nv: "NV", Etf: "ETF", Reit: "REIT",
};

// A CUSIP (9-char security id) sometimes ends up in the name/ticker column when
// symbol resolution didn't return a clean name. Detect it so we never show it.
function isCusipLike(s: string | null | undefined): boolean {
  const t = (s || "").trim();
  return t.length >= 6 && t.length <= 9 && /^[0-9A-Za-z]+$/.test(t) && /[0-9]/.test(t);
}

const SUFFIX_RE =
  /(?:^|\s)(incorporated|inc|corporation|corp|company|co|plc|ltd|limited|llc|l\.?p|lp|sa|s\.a|n\.?\s?v|a\.?g|a\/s|se|oyj|asa|holdings?|group|the|com|new|sponsored|adr|ads)\.?(?=\s|$)/gi;

function prettifyCompany(raw: string, ticker = ""): string {
  // SEC registrant names are often already in proper case ("STMicroelectronics
  // N.V."); keep that. Only ALL-CAPS 13F abbreviations are title-cased.
  const shouting = raw === raw.toUpperCase();
  let s = (raw || "").replace(/\b(class [a-c]|cl\.? [a-c]|series [a-c]|common stock|ordinary shares?|shares?)\b/gi, " ");
  s = s.replace(/\s\/[a-z]{2}\/?\s*$/i, " "); // drop trailing /DE/ etc.
  s = s.replace(/[,]+/g, " ").replace(/\s+/g, " ").trim();
  if (shouting) {
    s = s.toLowerCase().replace(/(^|[\s\-&(])([a-z])/g, (_, lead: string, c: string) => lead + c.toUpperCase());
    s = s.replace(/[A-Za-z]+/g, (w) => ABBREV[w] ?? w);
    // Initialisms stay capitals: short words without a vowel (RGC, BCB) and
    // a word that is the ticker itself (UMH Properties).
    s = s.replace(/[A-Za-z]+/g, (w) => (w.length <= 4 && !/[aeiouy]/i.test(w) && w !== "St") || (w.length <= 5 && w.toUpperCase() === ticker) ? w.toUpperCase() : w);
  }
  let prev = "";
  while (prev !== s) {
    prev = s;
    s = s.replace(SUFFIX_RE, " ").replace(/\s+/g, " ").trim();
  }
  // Registrant tails: state of incorporation ("DEL"), trust ("TR"), dangling "&".
  s = s.replace(/\s(del|tr|&)$/i, "").replace(/[\s.&]+$/, "");
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
  if (ticker) {
    // Share classes are written with a dot (BRK.B); OpenFIGI used a slash.
    const t = ticker.trim().toUpperCase().replace("/", ".");
    return TICKER_FIX[t] ?? t;
  }
  if (name) {
    const n = name.toLowerCase();
    if (n.includes("chubb")) return "CB";
  }
  return ticker;
}

/** Link to a stock page; a share class never splits the path (BRK.B). */
export function stockHref(ticker: string): string {
  return `/stock/${encodeURIComponent(ticker.trim().toUpperCase().replace("/", "."))}`;
}

export function companyName(ticker: string | null, rawName: string | null): string {
  const rawT = (ticker || "").trim();
  const T = rawT && !isCusipLike(rawT) ? rawT.toUpperCase() : "";
  if (T && COMPANY_BY_TICKER[T]) return COMPANY_BY_TICKER[T];
  if (rawName && !isCusipLike(rawName)) {
    const pretty = prettifyCompany(rawName, T);
    if (pretty && !isCusipLike(pretty)) return pretty;
  }
  if (T) return T; // clean ticker symbol beats an unresolved CUSIP
  if (rawName && !isCusipLike(rawName)) return rawName;
  return rawT || rawName || "—";
}

/** Interpretation depends on disclosure type, not just the stored direction. */
export function tradeSignal(row: Pick<FeedRow, "entityType" | "txnType" | "putCall" | "transactionCode" | "isDerivative">): { text: string; tone: "bull" | "bear" | "neutral" } {
  if (row.entityType === "institution") {
    const suffix = row.putCall ? ` · ${row.putCall}` : "";
    return { text: (row.txnType === "buy" ? "Position raised" : row.txnType === "sell" ? "Position cut" : "Position changed") + suffix, tone: "neutral" };
  }
  if (row.entityType === "corporate_insider") {
    const code = row.transactionCode;
    if (!code) return { text: row.txnType === "buy" ? "Acquisition filed" : row.txnType === "sell" ? "Disposal filed" : "Change filed", tone: "neutral" };
    const codes: Record<string, string> = { A: "Grant", F: "Tax withholding / exercise", D: "Returned to issuer", G: "Gift", M: "Exercise / conversion", C: "Conversion", X: "Option exercise", J: "Other transaction" };
    if (code !== "P" && code !== "S") return { text: codes[code] ?? `SEC code ${code}`, tone: "neutral" };
    if (row.isDerivative) return { text: `${code === "P" ? "Derivative bought" : "Derivative sold"}`, tone: "neutral" };
  }
  return signalLabel(row.txnType, row.putCall);
}
export function isStaleDate(value: string | null | undefined, days = 7): boolean {
  return !value || !Number.isFinite(Date.parse(value)) || Date.parse(value) > Date.now() + 86400000 || Date.now() - Date.parse(value) > days * 86400000;
}
export function sourceLink(value: string | null | undefined): string | null {
  if (!value) return null;
  try { const u = new URL(value); return u.protocol === "https:" ? u.toString() : null; } catch { return null; }
}

/**
 * The trade card's headline as a sentence (after Eaves: "Zhang Ning sold
 * Pony AI"): the verb for "{who} … {company}" and its tone. 13F changes stay
 * neutral, like everywhere else: a quarter's difference is not a dated trade.
 */
export function tradeVerb(row: Pick<FeedRow, "entityType" | "txnType" | "putCall" | "transactionCode" | "isDerivative">): { verb: string; tone: "bull" | "bear" | "neutral" } {
  if (row.entityType === "institution") {
    const verb = row.txnType === "buy" ? "added to" : row.txnType === "sell" ? "cut" : "changed";
    return { verb: row.putCall ? `${verb} a ${row.putCall.toLowerCase()} on` : verb, tone: "neutral" };
  }
  if (row.entityType === "corporate_insider") {
    const code = row.transactionCode;
    if (!code) return { verb: row.txnType === "buy" ? "reported an acquisition of" : row.txnType === "sell" ? "reported a disposal of" : "reported a change in", tone: "neutral" };
    const codes: Record<string, string> = { A: "was granted", F: "withheld for tax", D: "returned", G: "gifted", M: "exercised", C: "converted", X: "exercised options in", J: "reported a transaction in" };
    if (code !== "P" && code !== "S") return { verb: codes[code] ?? "filed a change in", tone: "neutral" };
    if (row.isDerivative) return { verb: code === "P" ? "bought derivatives of" : "sold derivatives of", tone: "neutral" };
  }
  if (row.putCall) {
    const opening = row.txnType === "buy";
    const kind = row.putCall.toLowerCase();
    return opening ? { verb: `bought a ${kind} on`, tone: row.putCall === "Put" ? "bear" : "bull" } : { verb: `closed a ${kind} on`, tone: "neutral" };
  }
  if (row.txnType === "buy") return { verb: "bought", tone: "bull" };
  if (row.txnType === "sell") return { verb: "sold", tone: "bear" };
  if (row.txnType === "exchange") return { verb: "exchanged", tone: "neutral" };
  return { verb: "filed", tone: "neutral" };
}

/** Quarter of a 13F report date: "2026-06-30" → "Q2 2026". */
export function quarterOf(iso: string | null | undefined): string | null {
  const p = iso ? parts(iso) : null;
  return p ? `Q${Math.ceil(p[1] / 3)} ${p[0]}` : null;
}
