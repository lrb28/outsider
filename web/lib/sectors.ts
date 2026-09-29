// Diversifikationsanalyse: Sektor, Region und Anlageklasse je Position.
//
// Reihenfolge der Quellen: die gepflegte Liste unten (die gängigsten Titel),
// dann Fonds am Namen erkannt ("… S&P US Dividend Aristocrats UCITS ETF" ist
// ein ETF auf US-Aktien), dann Yahoos Sektorangabe für Aktien (/api/meta)
// und für die Region das Land der ISIN oder der Börsenplatz. Nichts davon
// wird geraten: was keine Quelle hergibt, landet in "Sonstige".

export type Sector =
  | "Technologie"
  | "Kommunikation"
  | "Zyklischer Konsum"
  | "Basiskonsum"
  | "Gesundheit"
  | "Finanzen"
  | "Industrie"
  | "Energie"
  | "Rohstoffe"
  | "Versorger"
  | "Immobilien"
  | "Breit gestreut (ETF)"
  | "Anleihen"
  | "Krypto"
  | "Sonstige";

export type Region = "USA" | "Europa" | "Asien" | "Schwellenländer" | "Global" | "Kanada" | "Australien" | "Sonstige";

export type AssetClass = "Aktie" | "ETF" | "Krypto" | "Anleihe" | "Rohstoff" | "Sonstige";

export interface AssetMeta {
  sector: Sector;
  region: Region;
  assetClass: AssetClass;
}

const S = (sector: Sector, region: Region = "USA", assetClass: AssetClass = "Aktie"): AssetMeta => ({
  sector,
  region,
  assetClass,
});

const TECH = S("Technologie");
const COMM = S("Kommunikation");
const CYC = S("Zyklischer Konsum");
const STAP = S("Basiskonsum");
const HLTH = S("Gesundheit");
const FIN = S("Finanzen");
const IND = S("Industrie");
const ENER = S("Energie");
const MAT = S("Rohstoffe");
const UTIL = S("Versorger");
const RE = S("Immobilien");

const ETF_US = S("Breit gestreut (ETF)", "USA", "ETF");
const ETF_GLOBAL = S("Breit gestreut (ETF)", "Global", "ETF");
const ETF_EU = S("Breit gestreut (ETF)", "Europa", "ETF");
const ETF_EM = S("Breit gestreut (ETF)", "Schwellenländer", "ETF");
const GOLD = S("Rohstoffe", "Global", "Rohstoff");
const BOND = S("Anleihen", "USA", "Anleihe");
const CRYPTO = S("Krypto", "Global", "Krypto");

export const ASSET_META: Record<string, AssetMeta> = {
  // ── Technologie ───────────────────────────────────────────────────────────
  AAPL: TECH, MSFT: TECH, NVDA: TECH, AVGO: TECH, AMD: TECH, INTC: TECH,
  QCOM: TECH, MU: TECH, TXN: TECH, ADBE: TECH, CRM: TECH, ORCL: TECH,
  NOW: TECH, INTU: TECH, IBM: TECH, PLTR: TECH, SNOW: TECH, PANW: TECH,
  CRWD: TECH, DDOG: TECH, NET: TECH, SMCI: TECH, VRT: TECH, ANET: TECH,
  DELL: TECH, HPQ: TECH, CSCO: TECH, ACN: TECH, MDB: TECH, ZS: TECH,
  SNPS: TECH, CDNS: TECH, KLAC: TECH, LRCX: TECH, AMAT: TECH, MRVL: TECH,
  ON: TECH, NXPI: TECH, ADI: TECH, WDAY: TECH, TEAM: TECH, SHOP: S("Technologie", "Global"),
  TSM: S("Technologie", "Asien"), ASML: S("Technologie", "Europa"),
  SAP: S("Technologie", "Europa"), SONY: S("Technologie", "Asien"),
  INFY: S("Technologie", "Schwellenländer"), STM: S("Technologie", "Europa"),
  ARM: S("Technologie", "Europa"), IONQ: TECH, RGTI: TECH, APP: TECH,

  // ── Kommunikation & Medien ────────────────────────────────────────────────
  GOOGL: COMM, GOOG: COMM, META: COMM, NFLX: COMM, DIS: COMM, CMCSA: COMM,
  T: COMM, VZ: COMM, CHTR: COMM, SIRI: COMM, EA: COMM, TTWO: COMM,
  WBD: COMM, SPOT: S("Kommunikation", "Europa"), RBLX: COMM, PINS: COMM,
  SNAP: COMM, LYV: COMM, OMC: COMM, TME: S("Kommunikation", "Asien"),

  // ── Zyklischer Konsum ─────────────────────────────────────────────────────
  AMZN: CYC, TSLA: CYC, HD: CYC, MCD: CYC, NKE: CYC, SBUX: CYC, LOW: CYC,
  TJX: CYC, BKNG: CYC, ABNB: CYC, MAR: CYC, HLT: CYC, CMG: CYC, ORLY: CYC,
  AZO: CYC, LULU: CYC, DPZ: CYC, YUM: CYC, F: CYC, GM: CYC, RIVN: CYC,
  LCID: CYC, DKNG: CYC, EBAY: CYC, ETSY: CYC, RCL: CYC, CCL: CYC, DAL: CYC,
  UAL: CYC, LUV: CYC, LEN: CYC, DHI: CYC, PHM: CYC, NVR: CYC, WSM: CYC,
  BABA: S("Zyklischer Konsum", "Asien"), JD: S("Zyklischer Konsum", "Asien"),
  PDD: S("Zyklischer Konsum", "Asien"), SE: S("Zyklischer Konsum", "Asien"),
  MELI: S("Zyklischer Konsum", "Schwellenländer"), TM: S("Zyklischer Konsum", "Asien"),
  NIO: S("Zyklischer Konsum", "Asien"), LI: S("Zyklischer Konsum", "Asien"),

  // ── Basiskonsum ───────────────────────────────────────────────────────────
  WMT: STAP, COST: STAP, PG: STAP, KO: STAP, PEP: STAP, PM: STAP, MO: STAP,
  MDLZ: STAP, CL: STAP, KMB: STAP, GIS: STAP, KHC: STAP, HSY: STAP, STZ: STAP,
  KDP: STAP, MNST: STAP, SYY: STAP, KR: STAP, DG: STAP, TGT: STAP,
  EL: STAP, CHD: STAP, ADM: STAP, TSN: STAP,
  UL: S("Basiskonsum", "Europa"), NSRGY: S("Basiskonsum", "Europa"),
  BUD: S("Basiskonsum", "Europa"), DEO: S("Basiskonsum", "Europa"),

  // ── Gesundheit ────────────────────────────────────────────────────────────
  LLY: HLTH, UNH: HLTH, JNJ: HLTH, ABBV: HLTH, MRK: HLTH, PFE: HLTH,
  TMO: HLTH, ABT: HLTH, DHR: HLTH, BMY: HLTH, AMGN: HLTH, GILD: HLTH,
  CVS: HLTH, CI: HLTH, ELV: HLTH, HUM: HLTH, MOH: HLTH, ISRG: HLTH,
  VRTX: HLTH, REGN: HLTH, BIIB: HLTH, MRNA: HLTH, ZTS: HLTH, SYK: HLTH,
  BSX: HLTH, MDT: HLTH, BDX: HLTH, EW: HLTH, IDXX: HLTH, IQV: HLTH,
  A: HLTH, BRKR: HLTH, DVA: HLTH, MCK: HLTH, COR: HLTH, HCA: HLTH,
  NVO: S("Gesundheit", "Europa"), AZN: S("Gesundheit", "Europa"),
  NVS: S("Gesundheit", "Europa"), GSK: S("Gesundheit", "Europa"),
  SNY: S("Gesundheit", "Europa"),

  // ── Finanzen ──────────────────────────────────────────────────────────────
  "BRK.A": FIN, "BRK.B": FIN, JPM: FIN, BAC: FIN, WFC: FIN, C: FIN, GS: FIN,
  MS: FIN, SCHW: FIN, BLK: FIN, AXP: FIN, V: FIN, MA: FIN, PYPL: FIN,
  COF: FIN, ALLY: FIN, SPGI: FIN, MCO: FIN, ICE: FIN, CME: FIN, NDAQ: FIN,
  CB: FIN, AON: FIN, MMC: FIN, PGR: FIN, TRV: FIN, ALL: FIN, AIG: FIN,
  MET: FIN, PRU: FIN, USB: FIN, PNC: FIN, TFC: FIN, BK: FIN, STT: FIN,
  KKR: FIN, BX: FIN, APO: FIN, ARES: FIN, SLM: FIN, SOFI: FIN, HOOD: FIN,
  COIN: S("Finanzen", "USA"), NU: S("Finanzen", "Schwellenländer"),
  HSBC: S("Finanzen", "Europa"), UBS: S("Finanzen", "Europa"),
  ALV: S("Finanzen", "Europa"), DB: S("Finanzen", "Europa"),

  // ── Industrie ─────────────────────────────────────────────────────────────
  GE: IND, CAT: IND, BA: IND, HON: IND, UNP: IND, UPS: IND, FDX: IND,
  LMT: IND, RTX: IND, NOC: IND, GD: IND, DE: IND, EMR: IND, ETN: IND,
  ITW: IND, PH: IND, CSX: IND, NSC: IND, WM: IND, RSG: IND, CARR: IND,
  JCI: IND, CMI: IND, PCAR: IND, ROK: IND, TT: IND, URI: IND, PWR: IND,
  LHX: IND, TDG: IND, AXON: IND, LDOS: IND, HWM: IND, LAMR: RE, LPX: MAT,
  SIE: S("Industrie", "Europa"), ABBNY: S("Industrie", "Europa"),
  AIR: S("Industrie", "Europa"),

  // ── Energie ───────────────────────────────────────────────────────────────
  XOM: ENER, CVX: ENER, COP: ENER, OXY: ENER, SLB: ENER, HAL: ENER,
  EOG: ENER, PSX: ENER, VLO: ENER, MPC: ENER, KMI: ENER, WMB: ENER,
  OKE: ENER, DVN: ENER, FANG: ENER, HES: ENER, BKR: ENER, TRGP: ENER,
  SHEL: S("Energie", "Europa"), BP: S("Energie", "Europa"),
  TTE: S("Energie", "Europa"), E: S("Energie", "Europa"),
  PBR: S("Energie", "Schwellenländer"),

  // ── Rohstoffe & Chemie ────────────────────────────────────────────────────
  LIN: MAT, SHW: MAT, APD: MAT, ECL: MAT, FCX: MAT, NEM: MAT, NUE: MAT,
  DOW: MAT, DD: MAT, PPG: MAT, ALB: MAT, CTVA: MAT, VMC: MAT, MLM: MAT,
  BHP: S("Rohstoffe", "Global"), RIO: S("Rohstoffe", "Global"),
  VALE: S("Rohstoffe", "Schwellenländer"), GOLD: S("Rohstoffe", "Global"),

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
  INDA: ETF_EM, EWJ: S("Breit gestreut (ETF)", "Asien", "ETF"),
  GLD: GOLD, IAU: GOLD, SLV: GOLD, GDX: GOLD, PDBC: GOLD, USO: GOLD,
  AGG: BOND, BND: BOND, TLT: BOND, IEF: BOND, SHY: BOND, LQD: BOND,
  HYG: BOND, TIP: BOND, BNDX: S("Anleihen", "Global", "Anleihe"),

  // ── Krypto ────────────────────────────────────────────────────────────────
  "BTC-USD": CRYPTO, "ETH-USD": CRYPTO, "SOL-USD": CRYPTO, "XRP-USD": CRYPTO,
  "BNB-USD": CRYPTO, "ADA-USD": CRYPTO, "DOGE-USD": CRYPTO, "AVAX-USD": CRYPTO,
  "LINK-USD": CRYPTO, "DOT-USD": CRYPTO, "MATIC-USD": CRYPTO, "LTC-USD": CRYPTO,
  IBIT: S("Krypto", "Global", "ETF"), FBTC: S("Krypto", "Global", "ETF"),
  GBTC: S("Krypto", "Global", "ETF"), MSTR: S("Krypto", "USA"),
};

const UNKNOWN: AssetMeta = { sector: "Sonstige", region: "Sonstige", assetClass: "Sonstige" };

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
  Technology: "Technologie",
  "Communication Services": "Kommunikation",
  "Consumer Cyclical": "Zyklischer Konsum",
  "Consumer Defensive": "Basiskonsum",
  Healthcare: "Gesundheit",
  "Financial Services": "Finanzen",
  Industrials: "Industrie",
  Energy: "Energie",
  "Basic Materials": "Rohstoffe",
  Utilities: "Versorger",
  "Real Estate": "Immobilien",
};

const EUROPE = new Set(["AT", "BE", "CH", "CZ", "DE", "DK", "ES", "FI", "FR", "GB", "GR", "HU", "IE", "IT", "LU", "NL", "NO", "PL", "PT", "SE", "IS", "JE", "GG", "IM", "FO", "LI", "MC"]);
const ASIA = new Set(["JP", "HK", "SG"]);
const EMERGING = new Set(["CN", "IN", "BR", "MX", "ZA", "KR", "TW", "ID", "TH", "MY", "PH", "CL", "PE", "CO", "TR", "SA", "AE", "QA", "KW", "EG", "AR", "VN"]);
// Seats of holding companies whose business sits elsewhere (Medtronic,
// Accenture: Ireland; many Chinese ADRs: Cayman): the listing decides.
const DOMICILES = new Set(["IE", "LU", "NL", "JE", "GG", "BM", "KY", "VG", "PA", "CW", "MH", "LR"]);

function regionOfCountry(cc: string): Region | null {
  if (cc === "US") return "USA";
  if (cc === "CA") return "Kanada";
  if (cc === "AU" || cc === "NZ") return "Australien";
  if (EUROPE.has(cc)) return "Europa";
  if (ASIA.has(cc)) return "Asien";
  if (EMERGING.has(cc)) return "Schwellenländer";
  return null;
}

/** Region of a Yahoo symbol from its exchange suffix; none means a US listing. */
function regionOfSymbol(symbol: string): Region {
  const m = /\.([A-Z]{1,3})$/.exec(symbol.toUpperCase());
  if (!m) return "USA";
  const sfx = m[1];
  if (["DE", "F", "SG", "MU", "BE", "HM", "DU", "HA", "PA", "AS", "BR", "MI", "MC", "LS", "VI", "SW", "L", "IL", "IR", "ST", "CO", "HE", "OL", "WA", "PR", "AT", "IC"].includes(sfx)) return "Europa";
  if (["TO", "V", "CN", "NE"].includes(sfx)) return "Kanada";
  if (["AX", "NZ"].includes(sfx)) return "Australien";
  if (["T", "HK", "SI"].includes(sfx)) return "Asien";
  if (["SS", "SZ", "NS", "BO", "SA", "MX", "JO", "KS", "KQ", "TW", "TWO", "JK", "BK", "KL", "IS", "SN"].includes(sfx)) return "Schwellenländer";
  return "Sonstige";
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
  if (/EMERGING|\bEM\b|SCHWELLEN|CHINA|INDIA|BRAZIL|LATIN|\bBRIC/.test(n)) return "Schwellenländer";
  if (/\b(US|U\.S\.|USA|AMERICA|AMERICAN|S&P ?500|S&P|NASDAQ|DOW JONES|RUSSELL|NYSE)\b/.test(n) && !/\bEX[- ]?US\b/.test(n)) return "USA";
  if (/EUROPE|EUROPA|EURO STOXX|STOXX|EUROZONE|\bEMU\b|\bDAX\b|MDAX|GERMANY|DEUTSCHLAND|FTSE 100|FTSE 250|\bUK\b|UNITED KINGDOM|FRANCE|\bCAC\b|SWITZERLAND|\bSMI\b|\bIBEX\b|\bAEX\b|NORDIC/.test(n)) return "Europa";
  if (/JAPAN|NIKKEI|TOPIX|ASIA|PACIFIC|HONG KONG|SINGAPORE/.test(n)) return "Asien";
  if (/CANADA|\bTSX\b/.test(n)) return "Kanada";
  if (/AUSTRALIA|\bASX\b/.test(n)) return "Australien";
  return "Global";
}

/** What a fund holds, from its name: a sector, bonds, a commodity or crypto. */
function fundKind(name: string): { sector: Sector; assetClass: AssetClass } {
  const n = name.toUpperCase();
  if (/BITCOIN|ETHEREUM|CRYPTO|KRYPTO|SOLANA/.test(n)) return { sector: "Krypto", assetClass: "Krypto" };
  if (/\bGOLD\b(?! MINERS)|SILVER|SILBER|PLATIN|PHYSICAL|COMMODIT|ROHSTOFF|\bETC\b/.test(n)) return { sector: "Rohstoffe", assetClass: "Rohstoff" };
  if (/BOND|TREASURY|ANLEIHE|RENTEN|\bGOVT\b|GOVERNMENT|CORPORATE|AGGREGATE|T-BILL|MONEY MARKET|GELDMARKT|\bTIPS\b|INFLATION LINKED/.test(n)) return { sector: "Anleihen", assetClass: "Anleihe" };
  const sectors: [RegExp, Sector][] = [
    [/INFORMATION TECH|TECHNOLOGY|\bTECH\b|SEMICONDUCTOR|CYBER|ROBOTIC|ARTIFICIAL INTELLIGENCE|\bAI\b|CLOUD|SOFTWARE/, "Technologie"],
    [/HEALTH ?CARE|BIOTECH|PHARMA|MEDICAL/, "Gesundheit"],
    [/FINANCIAL|\bBANKS?\b|INSURANCE/, "Finanzen"],
    [/ENERGY|\bOIL\b|\bGAS\b/, "Energie"],
    [/REAL ESTATE|\bREITS?\b|PROPERTY|IMMOBILIEN/, "Immobilien"],
    [/UTILITIES|VERSORGER/, "Versorger"],
    [/CONSUMER STAPLES/, "Basiskonsum"],
    [/CONSUMER DISCRETIONARY/, "Zyklischer Konsum"],
    [/INDUSTRIAL|DEFEN[CS]E|AEROSPACE/, "Industrie"],
    [/MATERIALS|MINING|MINERS|METALS/, "Rohstoffe"],
    [/COMMUNICATION|TELECOM|MEDIA/, "Kommunikation"],
  ];
  for (const [re, sector] of sectors) if (re.test(n)) return { sector, assetClass: "ETF" };
  return { sector: "Breit gestreut (ETF)", assetClass: "ETF" };
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
    return { sector: kind.sector, region: kind.assetClass === "Rohstoff" || kind.assetClass === "Krypto" ? "Global" : fundRegion(name), assetClass: kind.assetClass };
  }
  if (type === "CRYPTOCURRENCY") return CRYPTO;

  const cc = isin && /^[A-Z]{2}/.test(isin) ? isin.slice(0, 2).toUpperCase() : null;
  let region: Region | null = cc && !DOMICILES.has(cc) ? regionOfCountry(cc) : null;
  if (!region && sym) region = regionOfSymbol(sym);
  if (!region && cc) region = regionOfCountry(cc);
  const sector = (meta?.sector && YAHOO_SECTOR[meta.sector]) || "Sonstige";
  const known = !!(sym || cc || meta);
  return { sector, region: region ?? "Sonstige", assetClass: known ? "Aktie" : "Sonstige" };
}
