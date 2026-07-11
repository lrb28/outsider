import { FeedRow } from "./types";

// Bundled fallback so the UI renders before the DB is populated. Derived from a
// REAL filing (Scion Asset Management 13F-HR, Q3 2025, filed 2025-11-03) — but
// the % figures use ILLUSTRATIVE prices, since this is a static sample. Once
// ingestion runs, /api/trades serves live rows from Postgres instead.
const SRC =
  "https://www.sec.gov/Archives/edgar/data/1649339/000164933925000007/";

export const SAMPLE_TRADES: FeedRow[] = [
  row("PLTR", "PALANTIR TECHNOLOGIES INC", "buy", "Put", "5,000,000 sh", 0.319),
  row("NVDA", "NVIDIA CORPORATION", "buy", "Put", "1,000,000 sh", 0.102),
  row("PFE", "PFIZER INC", "buy", "Call", "6,000,000 sh", 0.098),
  row("HAL", "HALLIBURTON CO", "buy", "Call", "2,500,000 sh", 0.22),
  row("MOH", "MOLINA HEALTHCARE INC", "buy", null, "125,000 sh", 0.099),
  row("LULU", "LULULEMON ATHLETICA INC", "buy", null, "100,000 sh", -0.157),
  row("SLM", "SLM CORP", "buy", null, "480,054 sh", 0.191),
  row("BRKR", "BRUKER CORP", "buy", null, "48,334 sh", 0.31),
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
    entityName: "Scion Asset Management (Michael Burry)",
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
