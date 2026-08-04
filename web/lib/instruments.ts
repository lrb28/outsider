// ────────────────────────────────────────────────────────────────────────────
// Wertpapier-Identifikation.
//
// Broker-Exporte identifizieren Papiere über die ISIN, nicht über ein Kürzel.
// Aus einem Namen einen Ticker zu basteln ist gefährlich: aus dem Optionsschein
// "Call 82,5 $" würde "CALL" — und CALL ist das echte Kürzel von magicJack
// VocalTec. Genau so entstehen erfundene Positionen. Deshalb gilt hier:
// ISIN schlägt Kürzel schlägt Name, und was sich nicht sicher auflösen lässt,
// bleibt bewusst unaufgelöst statt geraten zu werden.
// ────────────────────────────────────────────────────────────────────────────

export const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
/** Yahoo-Symbole: AAPL, BRK-B, MC.PA, BTC-USD, EURUSD=X, ^GSPC */
export const SYMBOL_RE = /^[\^]?[A-Z0-9][A-Z0-9.\-=]{0,11}$/;

export function isIsin(s: string | null | undefined): boolean {
  return !!s && ISIN_RE.test(s.trim().toUpperCase());
}

/** ISIN-Prüfziffer nach ISO 6166 — filtert Tippfehler und Zufallstreffer. */
export function isinValid(s: string): boolean {
  const t = s.trim().toUpperCase();
  if (!ISIN_RE.test(t)) return false;
  let digits = "";
  for (const ch of t.slice(0, 11)) {
    const c = ch.charCodeAt(0);
    digits += c >= 65 ? String(c - 55) : ch;
  }
  let sum = 0;
  let dbl = true;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return (10 - (sum % 10)) % 10 === Number(t[11]);
}

/**
 * Gepflegte ISIN → Yahoo-Symbol-Tabelle. Bewusst nur Papiere, die eindeutig
 * zuzuordnen sind. Alles andere geht an die Yahoo-Suche oder bleibt offen.
 */
export const ISIN_TICKER: Record<string, string> = {
  // ── US-Aktien ─────────────────────────────────────────────────────────────
  US0378331005: "AAPL", US5949181045: "MSFT", US67066G1040: "NVDA",
  US0231351067: "AMZN", US02079K3059: "GOOGL", US02079K1079: "GOOG",
  US30303M1027: "META", US88160R1014: "TSLA", US11135F1012: "AVGO",
  US0079031078: "AMD", US64110L1061: "NFLX", US68389X1054: "ORCL",
  US79466L3024: "CRM", US69608A1088: "PLTR", US5949724083: "MSTR",
  US7561091049: "O", US5801351017: "MCD", US1912161007: "KO",
  US2546871060: "DIS", US9311421039: "WMT", US92840M1027: "VST",
  US6974351057: "PANW", US22788C1053: "CRWD", US12468P1049: "AI",
  US2358511028: "DHR", US4330001060: "HIMS", US91332U1016: "U",
  US72919P2020: "PLUG", US5324571083: "LLY", US70450Y1038: "PYPL",
  US0846707026: "BRK-B", US0846701086: "BRK-A", US8740391003: "TSM",
  US4581401001: "INTC", US7475251036: "QCOM", US5951121038: "MU",
  US00724F1012: "ADBE", US1729674242: "C", US46625H1005: "JPM",
  US0605051046: "BAC", US92826C8394: "V", US57636Q1040: "MA",
  US7427181091: "PG", US4781601046: "JNJ", US7134481081: "PEP",
  US4370761029: "HD", US22160K1051: "COST", US58933Y1055: "MRK",
  US7170811035: "PFE", US91324P1021: "UNH", US00287Y1091: "ABBV",
  US8835561023: "TMO", US0028241000: "ABT", US1101221083: "BMY",
  US0311621009: "AMGN", US3755581036: "GILD", US2441991054: "DE",
  US1491231015: "CAT", US0970231058: "BA", US3696043013: "GE",
  US4385161066: "HON", US9078181081: "UNP", US9113121068: "UPS",
  US5398301094: "LMT", US75513E1010: "RTX", US30231G1022: "XOM",
  US1667641005: "CVX", US6745991058: "OXY", US8064071025: "SLB",
  US4062161017: "HAL", US2605571031: "DOW", US5486611073: "LOW",
  US88579Y1010: "MMM", US6541061031: "NKE",
  US8552441094: "SBUX", US90184L1026: "TWLO",
  US8636671013: "SYK", US64110W1027: "NEE", US7433151039: "PSX",
  US25470M1099: "DAL", US8318652091: "SIRI", US92343V1044: "VZ",
  US00206R1023: "T", US17275R1023: "CSCO", US20030N1019: "CMCSA",
  US09247X1019: "BLK", US8085131055: "SCHW", US0258161092: "AXP",
  US4592001014: "IBM", US4612021034: "INTU", US46120E6023: "ISRG",
  US8825081040: "TXN", US7134271000: "PM",
  US02209S1033: "MO", US6092071058: "MDLZ", US1941621039: "CL",
  US4943681035: "KMB", US3703341046: "GIS", US5007541064: "KHC",
  US4282361033: "HSY", US21036P1084: "STZ", US49271V1008: "KDP",
  US61174X1090: "MNST", US8718291078: "SYY", "US5010441013": "KR",
  US2567461080: "DG", US87612E1064: "TGT", US2810201077: "EL",
  US7960508882: "SPGI", US6153691059: "MCO", US45866F1049: "ICE",
  US12572Q1058: "CME", US6311031081: "NDAQ", US1713401024: "CB",

  // ── Europäische Aktien (Heimatbörse) ──────────────────────────────────────
  FR0000121014: "MC.PA", FR0000120321: "OR.PA", FR0000120271: "TTE.PA",
  FR0000120578: "SAN.PA", FR0000121972: "SU.PA", FR0000131104: "BNP.PA",
  DE0008404005: "ALV.DE", DE000PAG9113: "P911.DE", DE0007100000: "MBG.DE",
  DE000DTR0CK8: "DTG.DE", DE0007164600: "SAP", DE0005557508: "DTE.DE",
  DE0007236101: "SIE.DE", DE0005190003: "BMW.DE", DE0008430026: "MUV2.DE",
  DE0008469008: "^GDAXI", DE000BASF111: "BAS.DE", DE0006048432: "HEN3.DE",
  DE000A1EWWW0: "ADS.DE", DE0007037129: "RWE.DE", DE000ENAG999: "EOAN.DE",
  NL0010273215: "ASML", NL0011585146: "RACE", NL0000235190: "AIR.PA",
  CH0038863350: "NESN.SW", CH0012032048: "ROG.SW", CH0012005267: "NOVN.SW",
  GB0009252882: "GSK", DK0060534915: "NVO", SE0000108656: "ERIC",
  USY384721251: "HYMTF", // Hyundai Motor GDR — außerbörslich in den USA
  LU1778762911: "SPOT", IE00B4BNMY34: "ACN",

  // ── ETFs ──────────────────────────────────────────────────────────────────
  // Nur Papiere, bei denen die Zuordnung zweifelsfrei ist. Alles andere geht
  // an die Yahoo-Suche: ein falsch zugeordneter ETF erzeugt sonst Kurse, die
  // um den Faktor 10 danebenliegen — und damit erfundene Renditen.
  IE00B5BMR087: "SXR8.DE", // iShares Core S&P 500 UCITS Acc
  IE00B53SZB19: "SXRV.DE", // iShares Nasdaq 100 UCITS Acc
  IE00B4L5Y983: "EUNL.DE", // iShares Core MSCI World UCITS Acc
  IE00B3YCGJ38: "SPXS.DE", // Invesco S&P 500 UCITS Acc — notiert bei ~13 €
  IE000SB4G4I4: "BCFP.DE", // Amundi Nasdaq-100 II UCITS Acc
  IE000XZSV718: "500U.DE", // Amundi S&P 500 II UCITS Acc
  LU1781541179: "LCUW.DE", // Amundi Core MSCI World UCITS Acc
  LU1829221024: "ANX.DE", // Amundi Nasdaq-100 UCITS EUR Acc
  IE00BLRPRL42: "QQQ3.L", // WisdomTree Nasdaq 100 3x — notiert in Pence

  // ── Krypto ────────────────────────────────────────────────────────────────
  BTC: "BTC-USD", ETH: "ETH-USD", SOL: "SOL-USD", XRP: "XRP-USD",
  ADA: "ADA-USD", DOGE: "DOGE-USD", AVAX: "AVAX-USD", DOT: "DOT-USD",
  LTC: "LTC-USD", LINK: "LINK-USD", BNB: "BNB-USD", MATIC: "MATIC-USD",
};

/**
 * Papiere, für die es öffentlich schlicht keinen laufenden Kurs gibt.
 * Sie werden getrennt ausgewiesen statt mit einem geratenen Wert zu
 * verunreinigen.
 */
export function unpriceableReason(
  isin: string,
  assetClass: string | null,
  name: string | null,
): string | null {
  const ac = (assetClass ?? "").toUpperCase();
  const n = (name ?? "").toLowerCase();
  if (ac === "DERIVATIVE") return "Optionsschein / Zertifikat — kein öffentlicher Kurs";
  if (ac === "PRIVATE_FUND" || ac === "PRIVATE_EQUITY") return "Privatmarkt-Fonds — nicht börsennotiert";
  if (/^US84615Q/.test(isin) || n.includes("spacex")) return "Nicht börsennotiert";
  if (/\b(call|put|faktor|optionsschein|turbo|knock)\b/.test(n) && !isIsin(isin))
    return "Derivat — kein öffentlicher Kurs";
  // Typische Emittenten-Kennungen für Optionsscheine/Zertifikate
  if (/^(DE000[A-Z]{2}\d|CH\d{10})/.test(isin) && /\b(call|put|long|short|faktor)\b/.test(n))
    return "Optionsschein / Zertifikat — kein öffentlicher Kurs";
  return null;
}

/**
 * Warnt, wenn der abgerufene Kurs nicht zum Einstand passen kann.
 *
 * Der teuerste Fehler beim Auflösen einer ISIN ist die falsche Notierung: ein
 * ETF, den man für 13 € gekauft hat, wird plötzlich mit 127 € bewertet und
 * meldet 861 % Gewinn. Ein echter Kursverlauf schafft so etwas selten in
 * wenigen Jahren — ein Zuordnungsfehler immer.
 */
export function priceMismatch(
  avgPrice: number | null,
  lastPrice: number | null,
  years: number,
): string | null {
  if (!avgPrice || !lastPrice || avgPrice <= 0 || lastPrice <= 0) return null;
  const ratio = lastPrice / avgPrice;
  // Grenze wächst mit der Haltedauer, aber langsam: 7,2× nach einem Jahr,
  // 8,4× nach zwei, 15× nach acht Jahren. Ein Zuordnungsfehler liegt fast immer
  // um den Faktor 10 daneben; eine echte Vervielfachung braucht Zeit.
  const limit = Math.min(15, 6 * (1 + Math.max(0, years) / 5));
  if (ratio > limit) return `Kurs ist ${ratio.toFixed(0)}× so hoch wie dein Einstand`;
  if (ratio < 1 / limit) return `Kurs ist nur ${(ratio * 100).toFixed(1)} % deines Einstands`;
  return null;
}

// ── Manuelle Kurse für nicht handelbare Papiere ─────────────────────────────
//
// Optionsscheine und Privatmarkt-Anteile haben keinen öffentlichen Kurs. Statt
// sie dauerhaft auszublenden, kann der aktuelle Wert aus dem Broker eingetragen
// werden — klar als manuell gekennzeichnet.

const PRICE_KEY = "outsider:manualprice";

export function getManualPrices(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = JSON.parse(window.localStorage.getItem(PRICE_KEY) || "{}");
    if (!raw || typeof raw !== "object") return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw)) if (typeof v === "number" && v > 0) out[k] = v;
    return out;
  } catch {
    return {};
  }
}

export function setManualPrice(key: string, price: number | null) {
  if (typeof window === "undefined") return;
  const m = getManualPrices();
  const K = key.toUpperCase();
  if (price && price > 0) m[K] = price;
  else delete m[K];
  window.localStorage.setItem(PRICE_KEY, JSON.stringify(m));
  window.dispatchEvent(new CustomEvent("mydepot"));
}

// ── Benutzer-Zuordnungen (localStorage) ─────────────────────────────────────

const MAP_KEY = "outsider:isinmap";

export function getUserMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = JSON.parse(window.localStorage.getItem(MAP_KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

export function setUserSymbol(isin: string, symbol: string) {
  if (typeof window === "undefined") return;
  const m = getUserMap();
  const s = symbol.trim().toUpperCase();
  if (s) m[isin.toUpperCase()] = s;
  else delete m[isin.toUpperCase()];
  window.localStorage.setItem(MAP_KEY, JSON.stringify(m));
  window.dispatchEvent(new CustomEvent("mydepot"));
}

/** Vom Server aufgelöste ISINs zwischenspeichern, damit die Suche einmalig bleibt. */
const CACHE_KEY = "outsider:isincache";

export function getResolveCache(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = JSON.parse(window.localStorage.getItem(CACHE_KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

export function mergeResolveCache(add: Record<string, string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CACHE_KEY, JSON.stringify({ ...getResolveCache(), ...add }));
}

export interface Resolution {
  /** Yahoo-Symbol, mit dem Kurse abrufbar sind — oder null. */
  symbol: string | null;
  source: "benutzer" | "tabelle" | "suche" | "kürzel" | "offen";
  /** Grund, warum kein Kurs möglich ist (Derivat, Privatmarkt …). */
  unpriceable: string | null;
}

/**
 * Löst ein Papier in der Reihenfolge auf:
 * eigene Zuordnung → statische Tabelle → serverseitige Suche → direktes Kürzel.
 */
export function resolveInstrument(
  id: string,
  name: string | null,
  assetClass: string | null,
  userMap: Record<string, string>,
  resolveCache: Record<string, string>,
): Resolution {
  const key = (id || "").trim().toUpperCase();
  if (!key) return { symbol: null, source: "offen", unpriceable: null };

  if (userMap[key]) return { symbol: userMap[key], source: "benutzer", unpriceable: null };

  const why = unpriceableReason(key, assetClass, name);
  if (why) return { symbol: null, source: "offen", unpriceable: why };

  if (ISIN_TICKER[key]) return { symbol: ISIN_TICKER[key], source: "tabelle", unpriceable: null };
  if (resolveCache[key]) return { symbol: resolveCache[key], source: "suche", unpriceable: null };

  // Kein ISIN, aber ein plausibles Börsenkürzel? Dann direkt verwenden.
  if (!isIsin(key) && SYMBOL_RE.test(key) && key.length <= 8) {
    return { symbol: key, source: "kürzel", unpriceable: null };
  }
  return { symbol: null, source: "offen", unpriceable: null };
}
