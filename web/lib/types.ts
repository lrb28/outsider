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

// ── Discover collections ────────────────────────────────────────────────────
export interface CollectionItem {
  ticker: string | null;
  company: string;
  securityName: string;
  metric: string;
}

export interface DiscoverData {
  source: "database" | "sample";
  mostHeld: CollectionItem[];
  highestConviction: CollectionItem[];
  biggest: CollectionItem[];
}
