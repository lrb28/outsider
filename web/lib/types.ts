export type EntityType = "politician" | "corporate_insider" | "institution";
export type TxnType = "buy" | "sell" | "exchange" | "option";

export interface FeedRow {
  id: number | string;
  entityName: string;
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
