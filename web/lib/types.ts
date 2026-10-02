import type { ReturnSummary } from "./returns";

export type EntityType = "politician" | "corporate_insider" | "institution";
export type TxnType = "buy" | "sell" | "exchange" | "option";

export interface FeedRow {
  id: number | string;
  entityName: string;
  entitySlug: string | null;
  entityType: EntityType;
  highlight: boolean;
  ticker: string | null;
  securityName: string;
  txnType: TxnType;
  putCall: "Put" | "Call" | null;
  txnDate: string | null;
  disclosedAt: string | null;
  sizeDisplay: string;
  pctSinceTrade: number | null;
  pctSinceDisclosure: number | null;
  sourceUrl: string;
  /** Official portrait (politicians). */
  entityPhoto?: string | null;
  transactionCode?: string | null;
  isDerivative?: boolean;
  priceAsOf?: string | null;
  reportingDate?: string | null;
}

export interface TradesResponse {
  source: "database" | "sample";
  rows: FeedRow[];
  nextOffset: number | null;
  note?: string;
}

// ── Investors (institutions) ────────────────────────────────────────────────
export interface InvestorRow {
  slug: string;
  fund: string;
  person: string | null;
  positions: number;
  value: number | null;
  asOf: string | null;
  /** 13F-clone return over the last twelve months and since its first
   *  month (lib/returns.ts); null without enough history. */
  oneYear?: number | null;
  cagr?: number | null;
  since?: string | null;
  /** Share of the reported value that could be priced, last twelve months. */
  coverage?: number | null;
}

export interface HoldingRow {
  ticker: string | null;
  securityName: string;
  company: string;
  weight: number | null;
  value: number | null;
  shares: number | null;
  putCall: "Put" | "Call" | null;
}

export interface InvestorDetail {
  slug: string;
  fund: string;
  person: string | null;
  bio: string | null;
  type: EntityType;
  positions: number;
  value: number | null;
  asOf: string | null;
  holdings: HoldingRow[];
  trades: FeedRow[];
  /** Stock positions raised and cut in the latest reported quarter. */
  moves?: { buys: number; sells: number };
  returns?: ReturnSummary | null;
  letters?: LetterSummary[];
}

export interface InvestorsResponse {
  source: "database" | "sample";
  rows: InvestorRow[];
}

export interface InvestorResponse {
  source: "database" | "sample";
  investor: InvestorDetail | null;
}

// ── Stocks (securities) ─────────────────────────────────────────────────────
export interface StockRow {
  ticker: string | null;
  securityName: string;
  company: string;
  investors: number;
  value: number | null;
  buys: number;
  holderNames: string[];
}

// ── My-depot investor match ─────────────────────────────────────────────────
export interface MatchRow {
  slug: string;
  fund: string;
  person: string | null;
  sharedCount: number;
  invWeight: number; // share of the INVESTOR's portfolio in the shared tickers
  sharedTickers: string[];
}

export interface MatchResponse {
  source: "database" | "sample";
  rows: MatchRow[];
}

export interface StockHolder {
  slug: string;
  fund: string;
  person: string | null;
  value: number | null;
  shares: number | null;
  weight: number | null;
  // Optionsbestände werden getrennt ausgewiesen, damit sie nicht wie ein
  // Aktienbestand aussehen.
  putCall: "Put" | "Call" | null;
}

/**
 * What one tracked investor did with a stock in its latest 13F, against the
 * quarter before: opened, added, kept, trimmed or sold out. Option positions
 * are left out; they are not a stake in the company.
 */
export type StockMoveKind = "new" | "added" | "held" | "reduced" | "exited";
export interface StockMove {
  slug: string;
  fund: string;
  person: string | null;
  kind: StockMoveKind;
  shares: number | null;
  prevShares: number | null;
  value: number | null;
  asOf: string | null;
}

export interface StockDetail {
  ticker: string | null;
  securityName: string;
  company: string;
  investors: number;
  value: number | null;
  holders: StockHolder[];
  /** Latest quarter's moves of the tracked investors (13F vs the one before). */
  activity?: StockMove[];
  trades: FeedRow[];
  /** Investor letters that discuss the stock. */
  letters?: LetterSummary[];
}

export interface StocksResponse {
  source: "database" | "sample";
  rows: StockRow[];
}

export interface StockResponse {
  source: "database" | "sample";
  stock: StockDetail | null;
}

// ── Politicians ─────────────────────────────────────────────────────────────
export interface PoliticianRow {
  slug: string;
  name: string;
  party: string | null;
  chamber: string | null;
  /** "CA-11" */
  seat?: string | null;
  photo?: string | null;
  trades: number;
  lastTrade: string | null;
}

export interface PoliticianDetail {
  slug: string;
  name: string;
  party: string | null;
  chamber: string | null;
  seat?: string | null;
  photo?: string | null;
  trades: FeedRow[];
}

export interface PoliticiansResponse {
  source: "database" | "sample";
  rows: PoliticianRow[];
}

export interface PoliticianResponse {
  source: "database" | "sample";
  politician: PoliticianDetail | null;
}

// ── Insiders ────────────────────────────────────────────────────────────────
export interface InsiderDetail {
  slug: string;
  name: string;
  role: string | null;
  company: string | null;
  ticker: string | null;
  trades: FeedRow[];
}

export interface InsiderResponse {
  source: "database" | "sample";
  insider: InsiderDetail | null;
}

// ── Prices (for the trade sparkline) ────────────────────────────────────────
export interface PriceBar {
  date: string;
  close: number;
}

export interface PricesResponse {
  source: "database" | "sample" | "none";
  asOf?: string | null;
  stale?: boolean;
  ticker: string;
  bars: PriceBar[];
}

// ── Discover collections ────────────────────────────────────────────────────
export interface CollectionItem {
  ticker: string | null;
  company: string;
  securityName: string;
  metric: string;
}

export interface CollectionInvestor {
  slug: string;
  fund: string;
  person: string | null;
  metric: string;
  photo?: string | null;
}

export interface DiscoverData {
  source: "database" | "sample";
  mostHeld: CollectionItem[];
  highestConviction: CollectionItem[];
  biggest: CollectionItem[];
  mostBoughtQ: CollectionItem[];
  insiderBuys: CollectionItem[];
  biggestFunds: CollectionInvestor[];
  mostConcentrated: CollectionInvestor[];
  topPoliticians: CollectionInvestor[];
  /** Highest 13F-clone return over the last twelve months. */
  bestPerformers?: CollectionInvestor[];
}

// ── Investor letters ────────────────────────────────────────────────────────
export type Stance = "bullish" | "neutral" | "bearish";
export type LetterKind = "annual_letter" | "quarterly_letter" | "memo" | "activist_letter" | "commentary";

export interface LetterSummary {
  slug: string;
  title: string;
  author: string;
  org: string | null;
  investorSlug: string | null;
  kind: LetterKind;
  publishedOn: string;
  precision: "day" | "month";
  stance: Stance;
  headline: string;
  summary: string;
  /** Tickers the letter discusses, in its order. */
  tickers: string[];
}

export interface LetterStock {
  ticker: string | null;
  company: string;
  stance: Stance;
  note?: string;
  /** ĀURA has a page for it. */
  known: boolean;
}

export interface Letter extends LetterSummary {
  sourceUrl: string;
  sourceName: string | null;
  takeaways: { label: "Move" | "View" | "Watch"; text: string; tickers: string[] }[];
  risks: { scope: "Company" | "Industry" | "Market" | "Macro"; text: string }[];
  quotes: { text: string; context?: string }[];
  stocks: LetterStock[];
  summarizedBy: string | null;
}

export interface LettersResponse {
  source: "database" | "sample";
  rows: LetterSummary[];
}

export interface LetterResponse {
  source: "database" | "sample";
  letter: Letter | null;
}
