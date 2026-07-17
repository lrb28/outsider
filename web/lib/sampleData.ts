import { companyName, investorBio, investorPerson } from "./format";
import {
  CollectionItem,
  FeedRow,
  InvestorDetail,
  InvestorRow,
  PoliticianDetail,
  PoliticianRow,
  StockDetail,
  StockRow,
} from "./types";

// Bundled fallback so the UI renders before the DB is populated / if a query
// errors. Numbers are ILLUSTRATIVE. Once ingestion runs, the API routes serve
// live rows from Postgres instead.
const SRC = "https://www.sec.gov/Archives/edgar/data/1649339/000164933925000007/";

export const SAMPLE_TRADES: FeedRow[] = [
  row("PLTR", "PALANTIR TECHNOLOGIES INC", "buy", "Put", "5.000.000 St.", 0.319),
  row("NVDA", "NVIDIA CORPORATION", "buy", "Put", "1.000.000 St.", 0.102),
  row("PFE", "PFIZER INC", "buy", "Call", "6.000.000 St.", 0.098),
  row("HAL", "HALLIBURTON CO", "buy", "Call", "2.500.000 St.", 0.22),
  row("MOH", "MOLINA HEALTHCARE INC", "buy", null, "125.000 St.", 0.099),
  row("LULU", "LULULEMON ATHLETICA INC", "buy", null, "100.000 St.", -0.157),
  row("SLM", "SLM CORP", "buy", null, "480.054 St.", 0.191),
  row("BRKR", "BRUKER CORP", "buy", null, "48.334 St.", 0.31),
];

function row(
  ticker: string,
  securityName: string,
  txnType: FeedRow["txnType"],
  putCall: FeedRow["putCall"],
  size: string,
  pct: number,
): FeedRow {
  return {
    id: `sample-${ticker}`,
    entityName: "Scion Asset Management, LLC",
    entitySlug: "scion-asset-management",
    entityType: "institution",
    highlight: true,
    ticker,
    securityName,
    txnType,
    putCall,
    txnDate: "2025-09-30",
    disclosedAt: "2025-11-03",
    sizeDisplay: size,
    pctSinceTrade: pct,
    pctSinceDisclosure: pct,
    sourceUrl: SRC,
  };
}

// ── sample investors ────────────────────────────────────────────────────────
const FUNDS: [string, string, number, number][] = [
  // slug, fund, positions, portfolio value (USD)
  ["berkshire-hathaway", "Berkshire Hathaway Inc", 29, 263_100_000_000],
  ["bridgewater-associates", "Bridgewater Associates, LP", 984, 21_700_000_000],
  ["soros-fund-management", "Soros Fund Management LLC", 232, 6_400_000_000],
  ["duquesne-family-office", "Duquesne Family Office LLC", 70, 3_600_000_000],
  ["pershing-square", "Pershing Square Capital Management, L.P.", 11, 12_100_000_000],
  ["perceptive-advisors", "Perceptive Advisors LLC", 120, 8_900_000_000],
  ["scion-asset-management", "Scion Asset Management, LLC", 8, 210_000_000],
  ["daily-journal", "Daily Journal Corporation", 4, 320_000_000],
  ["dalal-street", "Dalal Street, LLC", 12, 140_000_000],
  ["situational-awareness", "Situational Awareness LP", 41, 1_500_000_000],
];

export const SAMPLE_INVESTORS: InvestorRow[] = FUNDS.map(([slug, fund, positions, value]) => ({
  slug,
  fund,
  person: investorPerson(fund),
  positions,
  value,
  asOf: "2026-03-31",
}));

const SAMPLE_HOLDINGS: Record<string, [string, string, number][]> = {
  // slug -> [ticker, rawName, value][]
  "berkshire-hathaway": [
    ["AAPL", "APPLE INC", 63_000_000_000],
    ["AXP", "AMERICAN EXPRESS CO", 46_000_000_000],
    ["KO", "COCA-COLA CO", 28_000_000_000],
    ["BAC", "BANK OF AMERICA CORP", 26_000_000_000],
  ],
  "scion-asset-management": [
    ["PLTR", "PALANTIR TECHNOLOGIES INC", 120_000_000],
    ["NVDA", "NVIDIA CORPORATION", 55_000_000],
    ["PFE", "PFIZER INC", 20_000_000],
  ],
};

export function sampleInvestor(slug: string): InvestorDetail | null {
  const base = SAMPLE_INVESTORS.find((i) => i.slug === slug);
  if (!base) return null;
  const raw = SAMPLE_HOLDINGS[slug] ?? [];
  const total = raw.reduce((a, [, , v]) => a + v, 0) || base.value || 1;
  return {
    slug: base.slug,
    fund: base.fund,
    person: base.person,
    bio: investorBio(base.fund),
    type: "institution",
    positions: base.positions,
    value: base.value,
    asOf: base.asOf,
    holdings: raw.map(([ticker, name, value]) => ({
      ticker,
      securityName: name,
      company: companyName(ticker, name),
      value,
      shares: null,
      weight: value / total,
      putCall: null,
    })),
    trades: slug === "scion-asset-management" ? SAMPLE_TRADES : [],
  };
}

// ── sample stocks ───────────────────────────────────────────────────────────
const STOCKS: [string, string, number, number, string[]][] = [
  ["NVDA", "NVIDIA CORPORATION", 42, 12_400_000_000, ["Berkshire Hathaway Inc", "Bridgewater Associates, LP", "Soros Fund Management LLC"]],
  ["AAPL", "APPLE INC", 48, 71_000_000_000, ["Berkshire Hathaway Inc", "Bridgewater Associates, LP"]],
  ["MSFT", "MICROSOFT CORP", 48, 9_800_000_000, ["Bridgewater Associates, LP", "Soros Fund Management LLC"]],
  ["AMZN", "AMAZON.COM INC", 49, 8_200_000_000, ["Soros Fund Management LLC", "Bridgewater Associates, LP"]],
  ["TSLA", "TESLA INC", 33, 4_100_000_000, ["Bridgewater Associates, LP"]],
  ["AVGO", "BROADCOM INC", 37, 5_600_000_000, ["Bridgewater Associates, LP"]],
  ["AMD", "ADVANCED MICRO DEVICES INC", 30, 2_900_000_000, ["Perceptive Advisors LLC"]],
];

export const SAMPLE_STOCKS: StockRow[] = STOCKS.map(([ticker, name, investors, value, holders]) => ({
  ticker,
  securityName: name,
  company: companyName(ticker, name),
  investors,
  value,
  holderNames: holders,
}));

export function sampleStock(ticker: string): StockDetail | null {
  const base = SAMPLE_STOCKS.find((s) => s.ticker?.toUpperCase() === ticker.toUpperCase());
  if (!base) return null;
  return {
    ticker: base.ticker,
    securityName: base.securityName,
    company: base.company,
    investors: base.investors,
    value: base.value,
    holders: base.holderNames.map((fund, i) => ({
      slug: SAMPLE_INVESTORS.find((v) => v.fund === fund)?.slug ?? "",
      fund,
      person: investorPerson(fund),
      value: (base.value ?? 0) / (i + 2),
      shares: null,
      weight: 0.12 / (i + 1),
    })),
    trades: SAMPLE_TRADES.filter((t) => t.ticker === base.ticker),
  };
}

// ── sample discover ─────────────────────────────────────────────────────────
// ── sample politicians ──────────────────────────────────────────────────────
export const SAMPLE_POLITICIANS: PoliticianRow[] = [
  { slug: "nancy-pelosi", name: "Nancy Pelosi", party: "Democrat", chamber: "House", trades: 6, lastTrade: "2026-01-14" },
];

export function samplePolitician(slug: string): PoliticianDetail | null {
  if (slug !== "nancy-pelosi") return null;
  return { slug, name: "Nancy Pelosi", party: "Democrat", chamber: "House", trades: [] };
}

const coll = (ticker: string, name: string, metric: string): CollectionItem => ({
  ticker,
  company: companyName(ticker, name),
  securityName: name,
  metric,
});

const collInv = (slug: string, metric: string) => {
  const f = SAMPLE_INVESTORS.find((i) => i.slug === slug);
  return { slug, fund: f?.fund ?? slug, person: f?.person ?? null, metric };
};

export const SAMPLE_DISCOVER = {
  mostHeld: [
    coll("AMZN", "AMAZON.COM INC", "49 Investoren"),
    coll("MSFT", "MICROSOFT CORP", "48 Investoren"),
    coll("AAPL", "APPLE INC", "48 Investoren"),
    coll("NVDA", "NVIDIA CORPORATION", "42 Investoren"),
  ],
  highestConviction: [
    coll("AAPL", "APPLE INC", "24 % Gewicht"),
    coll("PLTR", "PALANTIR TECHNOLOGIES INC", "18 % Gewicht"),
    coll("NVDA", "NVIDIA CORPORATION", "15 % Gewicht"),
  ],
  biggest: [
    coll("AAPL", "APPLE INC", "$63.0 Mrd."),
    coll("AXP", "AMERICAN EXPRESS CO", "$46.0 Mrd."),
    coll("KO", "COCA-COLA CO", "$28.0 Mrd."),
  ],
  mostBoughtQ: [
    coll("NVDA", "NVIDIA CORPORATION", "6 Käufe"),
    coll("AMZN", "AMAZON.COM INC", "5 Käufe"),
    coll("META", "META PLATFORMS INC", "4 Käufe"),
  ],
  insiderBuys: [
    coll("PLTR", "PALANTIR TECHNOLOGIES INC", "5 Insider-Käufe"),
    coll("COIN", "COINBASE GLOBAL INC", "3 Insider-Käufe"),
    coll("TSLA", "TESLA INC", "2 Insider-Käufe"),
  ],
  biggestFunds: [
    collInv("berkshire-hathaway", "$263.1 Mrd."),
    collInv("bridgewater-associates", "$21.7 Mrd."),
    collInv("pershing-square", "$12.1 Mrd."),
  ],
  mostConcentrated: [
    collInv("scion-asset-management", "62 % Top-Position"),
    collInv("daily-journal", "40 % Top-Position"),
    collInv("pershing-square", "22 % Top-Position"),
  ],
};
