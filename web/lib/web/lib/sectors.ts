// Nachschlagetabelle für die Diversifikationsanalyse: Ticker → Sektor, Region,
// Anlageklasse. Bewusst als statische Liste gepflegt, damit die Auswertung ohne
// zusätzlichen API-Aufruf und ohne Rate-Limits funktioniert. Unbekannte Ticker
// landen ehrlich in "Unbekannt" statt geraten zu werden.

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
  | "Index / ETF"
  | "Krypto"
  | "Unbekannt";

export type Region = "USA" | "Europa" | "Asien" | "Schwellenländer" | "Global" | "Unbekannt";

export type AssetClass = "Aktie" | "ETF" | "Krypto" | "Anleihe" | "Rohstoff" | "Unbekannt";

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

const ETF_US = S("Index / ETF", "USA", "ETF");
const ETF_GLOBAL = S("Index / ETF", "Global", "ETF");
const ETF_EU = S("Index / ETF", "Europa", "ETF");
const ETF_EM = S("Index / ETF", "Schwellenländer", "ETF");
const GOLD = S("Rohstoffe", "Global", "Rohstoff");
const BOND = S("Finanzen", "USA", "Anleihe");
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
  INDA: ETF_EM, EWJ: S("Index / ETF", "Asien", "ETF"),
  GLD: GOLD, IAU: GOLD, SLV: GOLD, GDX: GOLD, PDBC: GOLD, USO: GOLD,
  AGG: BOND, BND: BOND, TLT: BOND, IEF: BOND, SHY: BOND, LQD: BOND,
  HYG: BOND, TIP: BOND, BNDX: S("Finanzen", "Global", "Anleihe"),

  // ── Krypto ────────────────────────────────────────────────────────────────
  "BTC-USD": CRYPTO, "ETH-USD": CRYPTO, "SOL-USD": CRYPTO, "XRP-USD": CRYPTO,
  "BNB-USD": CRYPTO, "ADA-USD": CRYPTO, "DOGE-USD": CRYPTO, "AVAX-USD": CRYPTO,
  "LINK-USD": CRYPTO, "DOT-USD": CRYPTO, "MATIC-USD": CRYPTO, "LTC-USD": CRYPTO,
  IBIT: S("Krypto", "Global", "ETF"), FBTC: S("Krypto", "Global", "ETF"),
  GBTC: S("Krypto", "Global", "ETF"), MSTR: S("Krypto", "USA"),
};

const UNKNOWN: AssetMeta = { sector: "Unbekannt", region: "Unbekannt", assetClass: "Unbekannt" };

export function assetMeta(ticker: string | null | undefined): AssetMeta {
  if (!ticker) return UNKNOWN;
  const t = ticker.toUpperCase();
  if (ASSET_META[t]) return ASSET_META[t];
  // Krypto-Paare wie "BTC-USD" auch ohne Eintrag erkennen
  if (/-USD$/.test(t)) return CRYPTO;
  return UNKNOWN;
}

export const SECTOR_COLOR: Record<Sector, string> = {
  Technologie: "#4f46e5",
  Kommunikation: "#0ea5e9",
  "Zyklischer Konsum": "#f59e0b",
  Basiskonsum: "#16a34a",
  Gesundheit: "#db2777",
  Finanzen: "#7c3aed",
  Industrie: "#64748b",
  Energie: "#ea580c",
  Rohstoffe: "#a16207",
  Versorger: "#0d9488",
  Immobilien: "#be123c",
  "Index / ETF": "#2563eb",
  Krypto: "#f97316",
  Unbekannt: "#cbd5e1",
};

export const REGION_COLOR: Record<Region, string> = {
  USA: "#4f46e5",
  Europa: "#0ea5e9",
  Asien: "#f59e0b",
  Schwellenländer: "#16a34a",
  Global: "#7c3aed",
  Unbekannt: "#cbd5e1",
};

export const ASSET_COLOR: Record<AssetClass, string> = {
  Aktie: "#4f46e5",
  ETF: "#0ea5e9",
  Krypto: "#f97316",
  Anleihe: "#16a34a",
  Rohstoff: "#a16207",
  Unbekannt: "#cbd5e1",
};
