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
  holderNames: string[];
}

export interface StockHolder {
  slug: string;
  fund: string;
  person: string | null;
  value: number | null;
  shares: number | null;
  weight: number | null;
}

export interface StockDetail {
  ticker: string | null;
  securityName: string;
  company: string;
  investors: number;
  value: number | null;
  holders: StockHolder[];
  trades: FeedRow[];
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
  trades: number;
  lastTrade: string | null;
}

export interface PoliticianDetail {
  slug: string;
  name: string;
  party: string | null;
  chamber: string | null;
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
  source: "database" | "sample";
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
}
