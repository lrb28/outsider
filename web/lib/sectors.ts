// Diversifikationsanalyse: Sektor, Region und Anlageklasse je Position.
//
// Reihenfolge der Quellen: die gepflegte Liste unten (die gängigsten Titel),
// dann Fonds am Namen erkannt ("… S&P US Dividend Aristocrats UCITS ETF" ist
// ein ETF auf US-Aktien), dann Yahoos Sektorangabe für Aktien (/api/meta)
// und für die Region das Land der ISIN oder der Börsenplatz. Nichts davon
// wird geraten: was keine Quelle hergibt, landet in "Other".

export type Sector =
  | "Technology"
  | "Communication"
  | "Consumer cyclical"
  | "Consumer staples"
  | "Healthcare"
  | "Financials"
  | "Industrials"
  | "Energy"
  | "Materials"
  | "Utilities"
  | "Real estate"
  | "Broad market (ETF)"
  | "Bonds"
  | "Crypto"
  | "Other";

export type Region = "USA" | "Europe" | "Asia" | "Emerging markets" | "Global" | "Canada" | "Australia" | "Other";

export type AssetClass = "Stock" | "ETF" | "Crypto" | "Bond" | "Commodity" | "Other";

export interface AssetMeta {
  sector: Sector;
  region: Region;
  assetClass: AssetClass;
}

const S = (sector: Sector, region: Region = "USA", assetClass: AssetClass = "Stock"): AssetMeta => ({
  sector,
  region,
  assetClass,
});

const TECH = S("Technology");
const COMM = S("Communication");
const CYC = S("Consumer cyclical");
const STAP = S("Consumer staples");
const HLTH = S("Healthcare");
const FIN = S("Financials");
const IND = S("Industrials");
const ENER = S("Energy");
const MAT = S("Materials");
const UTIL = S("Utilities");
const RE = S("Real estate");

const ETF_US = S("Broad market (ETF)", "USA", "ETF");
const ETF_GLOBAL = S("Broad market (ETF)", "Global", "ETF");
const ETF_EU = S("Broad market (ETF)", "Europe", "ETF");
const ETF_EM = S("Broad market (ETF)", "Emerging markets", "ETF");
const GOLD = S("Materials", "Global", "Commodity");
const BOND = S("Bonds", "USA", "Bond");
const CRYPTO = S("Crypto", "Global", "Crypto");

export const ASSET_META: Record<string, AssetMeta> = {
  // ── Technologie ───────────────────────────────────────────────────────────
  AAPL: TECH, MSFT: TECH, NVDA: TECH, AVGO: TECH, AMD: TECH, INTC: TECH,
  QCOM: TECH, MU: TECH, TXN: TECH, ADBE: TECH, CRM: TECH, ORCL: TECH,
  NOW: TECH, INTU: TECH, IBM: TECH, PLTR: TECH, SNOW: TECH, PANW: TECH,
  CRWD: TECH, DDOG: TECH, NET: TECH, SMCI: TECH, VRT: TECH, ANET: TECH,
  DELL: TECH, HPQ: TECH, CSCO: TECH, ACN: TECH, MDB: TECH, ZS: TECH,
  SNPS: TECH, CDNS: TECH, KLAC: TECH, LRCX: TECH, AMAT: TECH, MRVL: TECH,
  ON: TECH, NXPI: TECH, ADI: TECH, WDAY: TECH, TEAM: TECH, SHOP: S("Technology", "Global"),
  TSM: S("Technology", "Asia"), ASML: S("Technology", "Europe"),
  SAP: S("Technology", "Europe"), SONY: S("Technology", "Asia"),
  INFY: S("Technology", "Emerging markets"), STM: S("Technology", "Europe"),
  ARM: S("Technology", "Europe"), IONQ: TECH, RGTI: TECH, APP: TECH,

  // ── Kommunikation & Medien ────────────────────────────────────────────────
  GOOGL: COMM, GOOG: COMM, META: COMM, NFLX: COMM, DIS: COMM, CMCSA: COMM,
  T: COMM, VZ: COMM, CHTR: COMM, SIRI: COMM, EA: COMM, TTWO: COMM,
  WBD: COMM, SPOT: S("Communication", "Europe"), RBLX: COMM, PINS: COMM,
  SNAP: COMM, LYV: COMM, OMC: COMM, TME: S("Communication", "Asia"),

  // ── Zyklischer Konsum ─────────────────────────────────────────────────────
  AMZN: CYC, TSLA: CYC, HD: CYC, MCD: CYC, NKE: CYC, SBUX: CYC, LOW: CYC,
  TJX: CYC, BKNG: CYC, ABNB: CYC, MAR: CYC, HLT: CYC, CMG: CYC, ORLY: CYC,
  AZO: CYC, LULU: CYC, DPZ: CYC, YUM: CYC, F: CYC, GM: CYC, RIVN: CYC,
  LCID: CYC, DKNG: CYC, EBAY: CYC, ETSY: CYC, RCL: CYC, CCL: CYC, DAL: CYC,
  UAL: CYC, LUV: CYC, LEN: CYC, DHI: CYC, PHM: CYC, NVR: CYC, WSM: CYC,
  BABA: S("Consumer cyclical", "Asia"), JD: S("Consumer cyclical", "Asia"),
  PDD: S("Consumer cyclical", "Asia"), SE: S("Consumer cyclical", "Asia"),
  MELI: S("Consumer cyclical", "Emerging markets"), TM: S("Consumer cyclical", "Asia"),
  NIO: S("Consumer cyclical", "Asia"), LI: S("Consumer cyclical", "Asia"),

  // ── Basiskonsum ───────────────────────────────────────────────────────────
  WMT: STAP, COST: STAP, PG: STAP, KO: STAP, PEP: STAP, PM: STAP, MO: STAP,
  MDLZ: STAP, CL: STAP, KMB: STAP, GIS: STAP, KHC: STAP, HSY: STAP, STZ: STAP,
  KDP: STAP, MNST: STAP, SYY: STAP, KR: STAP, DG: STAP, TGT: STAP,
  EL: STAP, CHD: STAP, ADM: STAP, TSN: STAP,
  UL: S("Consumer staples", "Europe"), NSRGY: S("Consumer staples", "Europe"),
  BUD: S("Consumer staples", "Europe"), DEO: S("Consumer staples", "Europe"),

  // ── Gesundheit ────────────────────────────────────────────────────────────
  LLY: HLTH, UNH: HLTH, JNJ: HLTH, ABBV: HLTH, MRK: HLTH, PFE: HLTH,
  TMO: HLTH, ABT: HLTH, DHR: HLTH, BMY: HLTH, AMGN: HLTH, GILD: HLTH,
  CVS: HLTH, CI: HLTH, ELV: HLTH, HUM: HLTH, MOH: HLTH, ISRG: HLTH,
  VRTX: HLTH, REGN: HLTH, BIIB: HLTH, MRNA: HLTH, ZTS: HLTH, SYK: HLTH,
  BSX: HLTH, MDT: HLTH, BDX: HLTH, EW: HLTH, IDXX: HLTH, IQV: HLTH,
  A: HLTH, BRKR: HLTH, DVA: HLTH, MCK: HLTH, COR: HLTH, HCA: HLTH,
  NVO: S("Healthcare", "Europe"), AZN: S("Healthcare", "Europe"),
  NVS: S("Healthcare", "Europe"), GSK: S("Healthcare", "Europe"),
  SNY: S("Healthcare", "Europe"),

  // ── Finanzen ──────────────────────────────────────────────────────────────
  "BRK.A": FIN, "BRK.B": FIN, JPM: FIN, BAC: FIN, WFC: FIN, C: FIN, GS: FIN,
  MS: FIN, SCHW: FIN, BLK: FIN, AXP: FIN, V: FIN, MA: FIN, PYPL: FIN,
  COF: FIN, ALLY: FIN, SPGI: FIN, MCO: FIN, ICE: FIN, CME: FIN, NDAQ: FIN,
  CB: FIN, AON: FIN, MMC: FIN, PGR: FIN, TRV: FIN, ALL: FIN, AIG: FIN,
  MET: FIN, PRU: FIN, USB: FIN, PNC: FIN, TFC: FIN, BK: FIN, STT: FIN,
  KKR: FIN, BX: FIN, APO: FIN, ARES: FIN, SLM: FIN, SOFI: FIN, HOOD: FIN,
  COIN: S("Financials", "USA"), NU: S("Financials", "Emerging markets"),
  HSBC: S("Financials", "Europe"), UBS: S("Financials", "Europe"),
  ALV: S("Financials", "Europe"), DB: S("Financials", "Europe"),

  // ── Industrie ─────────────────────────────────────────────────────────────
  GE: IND, CAT: IND, BA: IND, HON: IND, UNP: IND, UPS: IND, FDX: IND,
  LMT: IND, RTX: IND, NOC: IND, GD: IND, DE: IND, EMR: IND, ETN: IND,
  ITW: IND, PH: IND, CSX: IND, NSC: IND, WM: IND, RSG: IND, CARR: IND,
  JCI: IND, CMI: IND, PCAR: IND, ROK: IND, TT: IND, URI: IND, PWR: IND,
  LHX: IND, TDG: IND, AXON: IND, LDOS: IND, HWM: IND, LAMR: RE, LPX: MAT,
  SIE: S("Industrials", "Europe"), ABBNY: S("Industrials", "Europe"),
  AIR: S("Industrials", "Europe"),

  // ── Energie ───────────────────────────────────────────────────────────────
  XOM: ENER, CVX: ENER, COP: ENER, OXY: ENER, SLB: ENER, HAL: ENER,
  EOG: ENER, PSX: ENER, VLO: ENER, MPC: ENER, KMI: ENER, WMB: ENER,
  OKE: ENER, DVN: ENER, FANG: ENER, HES: ENER, BKR: ENER, TRGP: ENER,
  SHEL: S("Energy", "Europe"), BP: S("Energy", "Europe"),
  TTE: S("Energy", "Europe"), E: S("Energy", "Europe"),
  PBR: S("Energy", "Emerging markets"),

  // ── Rohstoffe & Chemie ────────────────────────────────────────────────────
  LIN: MAT, SHW: MAT, APD: MAT, ECL: MAT, FCX: MAT, NEM: MAT, NUE: MAT,
  DOW: MAT, DD: MAT, PPG: MAT, ALB: MAT, CTVA: MAT, VMC: MAT, MLM: MAT,
  BHP: S("Materials", "Global"), RIO: S("Materials", "Global"),
  VALE: S("Materials", "Emerging markets"), GOLD: S("Materials", "Global"),

  // ── Versorger & Immobilien ────────────────────────────────────────────────
  NEE: UTIL, DUK: UTIL, SO: UTIL, D: UTIL, AEP: UTIL, SRE: UTIL, EXC: UTIL,
  XEL: UTIL, ED: UTIL, PEG: UTIL, VST: UTIL, CEG: UTIL, NRG: UTIL,
  PLD: RE, AMT: RE, EQIX: RE, CCI: RE, SPG: RE, PSA: RE, O: RE, WELL: RE,
  DLR: RE, VICI: RE, AVB: RE, EQR: RE, IRM: RE,

  // ── ETFs & Indizes ────────────────────────────────────────────────────────
  SPY: ETF_US, IVV: ETF_US, VOO: ETF_US, VTI: ETF_US, QQQ: ETF_US,
  DIA: ETF_US, IWM: ETF_US, RSP: ETF_US, SCHD: ETF_US, VIG: ETF_US,
  VYM: ETF_US, SPYG: ETF_US, SPYV: ETF_US, XLK: ETF_US, XLF: ETF_US,
  XLE: ETF_US, XLV: ETF_US, XLY: ETF_US, XLP: ETF_US, XLI: ETF_US,
  XLU: ETF_US, XLB: ETF_US, XLRE: ETF_US, XLC: ETF_US, SMH: ETF_US,
  SOXX: ETF_US, ARKK: ETF_US, VUG: ETF_US, VTV: ETF_US, MGK: ETF_US,
  VT: ETF_GLOBAL, ACWI: ETF_GLOBAL, URTH: ETF_GLOBAL, IOO: ETF_GLOBAL,
  VXUS: ETF_GLOBAL, EFA: ETF_EU, VGK: ETF_EU, IEUR: ETF_EU, EZU: ETF_EU,
  EEM: ETF_EM, VWO: ETF_EM, IEMG: ETF_EM, FXI: ETF_EM, MCHI: ETF_EM,
  INDA: ETF_EM, EWJ: S("Broad market (ETF)", "Asia", "ETF"),
  GLD: GOLD, IAU: GOLD, SLV: GOLD, GDX: GOLD, PDBC: GOLD, USO: GOLD,
  AGG: BOND, BND: BOND, TLT: BOND, IEF: BOND, SHY: BOND, LQD: BOND,
  HYG: BOND, TIP: BOND, BNDX: S("Bonds", "Global", "Bond"),

  // ── Krypto ────────────────────────────────────────────────────────────────
  "BTC-USD": CRYPTO, "ETH-USD": CRYPTO, "SOL-USD": CRYPTO, "XRP-USD": CRYPTO,
  "BNB-USD": CRYPTO, "ADA-USD": CRYPTO, "DOGE-USD": CRYPTO, "AVAX-USD": CRYPTO,
  "LINK-USD": CRYPTO, "DOT-USD": CRYPTO, "MATIC-USD": CRYPTO, "LTC-USD": CRYPTO,
  IBIT: S("Crypto", "Global", "ETF"), FBTC: S("Crypto", "Global", "ETF"),
  GBTC: S("Crypto", "Global", "ETF"), MSTR: S("Crypto", "USA"),
};

const UNKNOWN: AssetMeta = { sector: "Other", region: "Other", assetClass: "Other" };

export function assetMeta(ticker: string | null | undefined): AssetMeta {
  if (!ticker) return UNKNOWN;
  const t = ticker.toUpperCase();
  if (ASSET_META[t]) return ASSET_META[t];
  // Krypto-Paare wie "BTC-USD" auch ohne Eintrag erkennen
  if (/-USD$/.test(t)) return CRYPTO;
  return UNKNOWN;
}

// ── Klassifizierung aus mehreren Quellen ────────────────────────────────────

/** What Yahoo's search knows about a listing (see /api/meta). */
export interface ListingMeta {
  type?: string | null;
  sector?: string | null;
  industry?: string | null;
  exchange?: string | null;
}

const YAHOO_SECTOR: Record<string, Sector> = {
  Technology: "Technology",
  "Communication Services": "Communication",
  "Consumer Cyclical": "Consumer cyclical",
  "Consumer Defensive": "Consumer staples",
  Healthcare: "Healthcare",
  "Financial Services": "Financials",
  Industrials: "Industrials",
  Energy: "Energy",
  "Basic Materials": "Materials",
  Utilities: "Utilities",
  "Real Estate": "Real estate",
};

const EUROPE = new Set(["AT", "BE", "CH", "CZ", "DE", "DK", "ES", "FI", "FR", "GB", "GR", "HU", "IE", "IT", "LU", "NL", "NO", "PL", "PT", "SE", "IS", "JE", "GG", "IM", "FO", "LI", "MC"]);
const ASIA = new Set(["JP", "HK", "SG"]);
const EMERGING = new Set(["CN", "IN", "BR", "MX", "ZA", "KR", "TW", "ID", "TH", "MY", "PH", "CL", "PE", "CO", "TR", "SA", "AE", "QA", "KW", "EG", "AR", "VN"]);
// Seats of holding companies whose business sits elsewhere (Medtronic,
// Accenture: Ireland; many Chinese ADRs: Cayman): the listing decides.
const DOMICILES = new Set(["IE", "LU", "NL", "JE", "GG", "BM", "KY", "VG", "PA", "CW", "MH", "LR"]);

function regionOfCountry(cc: string): Region | null {
  if (cc === "US") return "USA";
  if (cc === "CA") return "Canada";
  if (cc === "AU" || cc === "NZ") return "Australia";
  if (EUROPE.has(cc)) return "Europe";
  if (ASIA.has(cc)) return "Asia";
  if (EMERGING.has(cc)) return "Emerging markets";
  return null;
}

/** Region of a Yahoo symbol from its exchange suffix; none means a US listing. */
function regionOfSymbol(symbol: string): Region {
  const m = /\.([A-Z]{1,3})$/.exec(symbol.toUpperCase());
  if (!m) return "USA";
  const sfx = m[1];
  if (["DE", "F", "SG", "MU", "BE", "HM", "DU", "HA", "PA", "AS", "BR", "MI", "MC", "LS", "VI", "SW", "L", "IL", "IR", "ST", "CO", "HE", "OL", "WA", "PR", "AT", "IC"].includes(sfx)) return "Europe";
  if (["TO", "V", "CN", "NE"].includes(sfx)) return "Canada";
  if (["AX", "NZ"].includes(sfx)) return "Australia";
  if (["T", "HK", "SI"].includes(sfx)) return "Asia";
  if (["SS", "SZ", "NS", "BO", "SA", "MX", "JO", "KS", "KQ", "TW", "TWO", "JK", "BK", "KL", "IS", "SN"].includes(sfx)) return "Emerging markets";
  return "Other";
}

// A fund by its name: a fund word, or a brand that only issues funds. Asset
// managers that are listed companies themselves (Amundi, Invesco, Franklin,
// BlackRock) only count together with a fund word.
const FUND_WORD = /\b(ETF|ETC|ETN|UCITS|FUND|FONDS|TRACKER)\b/i;
const FUND_BRAND = /\b(ISHARES|VANGUARD|SPDR|XTRACKERS|LYXOR|WISDOMTREE|VANECK|HANETF|GLOBAL X|COMSTAGE|PROSHARES|DIREXION)\b/i;
const isFundName = (name: string) => FUND_WORD.test(name) || FUND_BRAND.test(name);

/** Region a fund invests in, read from its name ("S&P 500", "MSCI World"). */
function fundRegion(name: string): Region {
  const n = ` ${name.toUpperCase()} `;
  if (/EMERGING|\bEM\b|SCHWELLEN|CHINA|INDIA|BRAZIL|LATIN|\bBRIC/.test(n)) return "Emerging markets";
  if (/\b(US|U\.S\.|USA|AMERICA|AMERICAN|S&P ?500|S&P|NASDAQ|DOW JONES|RUSSELL|NYSE)\b/.test(n) && !/\bEX[- ]?US\b/.test(n)) return "USA";
  if (/EUROPE|EUROPA|EURO STOXX|STOXX|EUROZONE|\bEMU\b|\bDAX\b|MDAX|GERMANY|DEUTSCHLAND|FTSE 100|FTSE 250|\bUK\b|UNITED KINGDOM|FRANCE|\bCAC\b|SWITZERLAND|\bSMI\b|\bIBEX\b|\bAEX\b|NORDIC/.test(n)) return "Europe";
  if (/JAPAN|NIKKEI|TOPIX|ASIA|PACIFIC|HONG KONG|SINGAPORE/.test(n)) return "Asia";
  if (/CANADA|\bTSX\b/.test(n)) return "Canada";
  if (/AUSTRALIA|\bASX\b/.test(n)) return "Australia";
  return "Global";
}

/** What a fund holds, from its name: a sector, bonds, a commodity or crypto. */
function fundKind(name: string): { sector: Sector; assetClass: AssetClass } {
  const n = name.toUpperCase();
  if (/BITCOIN|ETHEREUM|CRYPTO|KRYPTO|SOLANA/.test(n)) return { sector: "Crypto", assetClass: "Crypto" };
  if (/\bGOLD\b(?! MINERS)|SILVER|SILBER|PLATIN|PHYSICAL|COMMODIT|ROHSTOFF|\bETC\b/.test(n)) return { sector: "Materials", assetClass: "Commodity" };
  if (/BOND|TREASURY|ANLEIHE|RENTEN|\bGOVT\b|GOVERNMENT|CORPORATE|AGGREGATE|T-BILL|MONEY MARKET|GELDMARKT|\bTIPS\b|INFLATION LINKED/.test(n)) return { sector: "Bonds", assetClass: "Bond" };
  const sectors: [RegExp, Sector][] = [
    [/INFORMATION TECH|TECHNOLOGY|\bTECH\b|SEMICONDUCTOR|CYBER|ROBOTIC|ARTIFICIAL INTELLIGENCE|\bAI\b|CLOUD|SOFTWARE/, "Technology"],
    [/HEALTH ?CARE|BIOTECH|PHARMA|MEDICAL/, "Healthcare"],
    [/FINANCIAL|\bBANKS?\b|INSURANCE/, "Financials"],
    [/ENERGY|\bOIL\b|\bGAS\b/, "Energy"],
    [/REAL ESTATE|\bREITS?\b|PROPERTY|IMMOBILIEN/, "Real estate"],
    [/UTILITIES|VERSORGER/, "Utilities"],
    [/CONSUMER STAPLES/, "Consumer staples"],
    [/CONSUMER DISCRETIONARY/, "Consumer cyclical"],
    [/INDUSTRIAL|DEFEN[CS]E|AEROSPACE/, "Industrials"],
    [/MATERIALS|MINING|MINERS|METALS/, "Materials"],
    [/COMMUNICATION|TELECOM|MEDIA/, "Communication"],
  ];
  for (const [re, sector] of sectors) if (re.test(n)) return { sector, assetClass: "ETF" };
  return { sector: "Broad market (ETF)", assetClass: "ETF" };
}

/**
 * Sector, region and asset class of one position from everything known about
 * it: the curated list, the name, the ISIN, the listing and Yahoo's data.
 */
export function classify({
  symbol,
  isin,
  name,
  assetClass,
  meta,
}: {
  symbol: string | null;
  isin: string | null;
  name: string;
  /** Asset class column of the broker export, if any ("ETF", "AKTIE", …). */
  assetClass?: string | null;
  meta?: ListingMeta | null;
}): AssetMeta {
  const sym = symbol?.toUpperCase() ?? null;
  if (sym && ASSET_META[sym]) return ASSET_META[sym];
  if (sym && /-USD$/.test(sym)) return CRYPTO;

  const hint = (assetClass ?? "").toUpperCase();
  const type = (meta?.type ?? "").toUpperCase();
  const isFund = type === "ETF" || type === "MUTUALFUND" || /ETF|ETC|FONDS|FUND/.test(hint) || isFundName(name);
  if (isFund) {
    const kind = fundKind(name);
    return { sector: kind.sector, region: kind.assetClass === "Commodity" || kind.assetClass === "Crypto" ? "Global" : fundRegion(name), assetClass: kind.assetClass };
  }
  if (type === "CRYPTOCURRENCY") return CRYPTO;

  const cc = isin && /^[A-Z]{2}/.test(isin) ? isin.slice(0, 2).toUpperCase() : null;
  let region: Region | null = cc && !DOMICILES.has(cc) ? regionOfCountry(cc) : null;
  if (!region && sym) region = regionOfSymbol(sym);
  if (!region && cc) region = regionOfCountry(cc);
  const sector = (meta?.sector && YAHOO_SECTOR[meta.sector]) || "Other";
  const known = !!(sym || cc || meta);
  return { sector, region: region ?? "Other", assetClass: known ? "Stock" : "Other" };
}
