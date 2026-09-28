// Sichert die Fehler ab, die beim ersten Import-Versuch echten Schaden angerichtet
// haben. Aufruf über den Test-Runner (esbuild-Bundle liegt daneben).
import * as B from "../.tmp-brokers.mjs";
import * as P from "../.tmp-portfolio.mjs";
import * as I from "../.tmp-instruments.mjs";

let pass = 0;
let fail = 0;
const ok = (name, cond, got, want) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}\n      erwartet: ${want}\n      bekommen: ${got}`);
  }
};
const near = (a, b, eps = 1e-6) => a !== null && Math.abs(a - b) < eps;

// ── Der Fehler, der ein erfundenes 75-%-Depot erzeugt hat ──────────────────
console.log("\nNamenskollision (der teure Fehler)");
{
  const csv =
    "date,type,symbol,name,shares,price,currency\n" +
    "2025-01-02,BUY,DE000HS3AA49,Call 82.50 $ NVIDIA Optionsschein,199,16.04,EUR\n";
  const r = B.importCsv(csv);
  ok("Optionsschein wird NICHT zu Ticker CALL", r.txns[0].ticker === "DE000HS3AA49", r.txns[0].ticker, "DE000HS3AA49");
  const res = I.resolveInstrument("DE000HS3AA49", "Call 82.50 $ NVIDIA Optionsschein", "DERIVATIVE", {}, {});
  ok("Derivat bekommt kein Kürzel", res.symbol === null, res.symbol, "null");
  ok("Grund wird benannt", !!res.unpriceable, res.unpriceable, "Text");
}

// ── Reihenfolge am selben Tag ──────────────────────────────────────────────
console.log("\nReihenfolge innerhalb eines Tages");
{
  const csv =
    "date,type,symbol,shares,price\n" +
    "2025-01-02,BUY,US0378331005,10,100\n" +
    "2025-01-02,SELL,US0378331005,-4,110\n" +
    "2025-01-02,BUY,US0378331005,2,105\n";
  const r = B.importCsv(csv);
  const [p] = P.positionsFrom(r.txns);
  ok("Bestand 8 Stück (nicht auf 0 gekappt)", near(p.shares, 8), p.shares, 8);
  ok("Reihenfolge nummeriert", r.txns.every((t, i) => t.seq !== undefined && (i === 0 || t.seq > r.txns[i - 1].seq)), "—", "aufsteigend");
}

// ── Verkauf mit negativer Stückzahl ────────────────────────────────────────
console.log("\nBroker-Eigenheiten");
{
  const csv = "date,type,symbol,shares,price,amount,fee\n2025-01-02,SELL,US0378331005,-2.5,200,500,-1\n";
  const r = B.importCsv(csv);
  ok("negative Stückzahl wird zum Verkauf", r.txns[0].kind === "sell" && near(r.txns[0].shares, 2.5), `${r.txns[0].kind}/${r.txns[0].shares}`, "sell/2.5");
  ok("Gebühr positiv normiert", near(r.txns[0].fee, 1), r.txns[0].fee, 1);
}
{
  // 10:1-Split: Stückzahl verzehnfacht sich, der Einstand je Stück zehntelt sich.
  const csv =
    "date,type,symbol,shares,price\n" +
    "2024-01-02,BUY,US67066G1040,1,500\n" +
    "2024-06-10,SPLIT,US67066G1040,9,\n";
  const r = B.importCsv(csv);
  const [p] = P.positionsFrom(r.txns);
  ok("Split ⇒ 10 Stück", near(p.shares, 10), p.shares, 10);
  ok("Einstand bleibt 500", near(p.costBasis, 500), p.costBasis, 500);
  ok("Ø-Einstand jetzt 50", near(p.avgPrice, 50), p.avgPrice, 50);
}
{
  // Depotübertrag: raus und rein am selben Tag ⇒ Bestand unverändert.
  const csv =
    "date,type,symbol,shares,price\n" +
    "2024-01-02,BUY,US0378331005,5,100\n" +
    "2025-05-07,MIGRATION,US0378331005,-5,178\n" +
    "2025-05-07,MIGRATION,US0378331005,5,178\n";
  const r = B.importCsv(csv);
  const [p] = P.positionsFrom(r.txns);
  ok("Depotübertrag ist neutral", near(p.shares, 5), p.shares, 5);
}
{
  const csv =
    "date,type,symbol,shares,price,amount,tax\n" +
    "2025-01-02,DIVIDEND,US0378331005,10,,1.00,-0.25\n";
  const r = B.importCsv(csv);
  ok("Dividende netto nach Steuer", near(r.txns[0].amount, 0.75), r.txns[0].amount, 0.75);
}
{
  const csv =
    "date,type,symbol,amount\n" +
    "2025-01-02,CARD_TRANSACTION,,-12.90\n" +
    "2025-01-03,CUSTOMER_INPAYMENT,,100\n";
  const r = B.importCsv(csv);
  ok("Kartenzahlung ist kein Fehler", r.counts.notPortfolio === 1 && r.counts.unusable === 0, JSON.stringify(r.counts), "notPortfolio 1");
  ok("Einzahlung erkannt", r.counts.cash === 1, r.counts.cash, 1);
}
{
  const csv = "date,type,symbol,shares,price\n2025-01-02,VOELLIG_NEUER_TYP,US0378331005,1,100\n";
  const r = B.importCsv(csv);
  ok("unbekannter Typ wird gemeldet statt geraten", r.counts.unknown === 1 && r.txns.length === 0, JSON.stringify(r.counts), "unknown 1, 0 Buchungen");
}

// ── ISIN-Prüfziffer ────────────────────────────────────────────────────────
console.log("\nISIN-Prüfung");
ok("Apple-ISIN gültig", I.isinValid("US0378331005"), "—", "true");
ok("NVIDIA-ISIN gültig", I.isinValid("US67066G1040"), "—", "true");
ok("Tippfehler erkannt", !I.isinValid("US0378331006"), "—", "false");
ok("Kürzel ist keine ISIN", !I.isIsin("AAPL"), "—", "false");

// ── Split-Rückrechnung ─────────────────────────────────────────────────────
// Kurshistorien sind split-bereinigt. Ohne Rückrechnung der Stückzahlen
// verzehnfacht sich der Depotwert am Split-Tag und erscheint als Tagesgewinn.
console.log("\nSplits und bereinigte Kurse");
{
  const csv =
    "date,type,symbol,shares,price\n" +
    "2024-01-02,BUY,US67066G1040,1,500\n" +
    "2024-06-10,SPLIT,US67066G1040,9,\n";
  const adj = P.adjustForSplits(B.importCsv(csv).txns);
  const buy = adj.find((t) => t.kind === "buy");
  ok("Kauf rückwirkend auf 10 Stück", near(buy.shares, 10), buy.shares, 10);
  ok("Kurs entsprechend gezehntelt", near(buy.price, 50), buy.price, 50);
  ok("Split-Buchung ist verrechnet", !adj.some((t) => t.kind === "split"), "—", "keine mehr");
  const [p] = P.positionsFrom(adj);
  ok("Bestand bleibt 10", near(p.shares, 10), p.shares, 10);
  ok("Einstand unverändert 500", near(p.costBasis, 500), p.costBasis, 500);

  // Mit bereinigter Kurshistorie darf am Split-Tag KEIN Sprung entstehen.
  const bars = [
    { date: "2024-06-07", close: 50 },
    { date: "2024-06-10", close: 50 },
    { date: "2024-06-11", close: 51 },
  ];
  const s = P.buildSeries(adj, { US67066G1040: bars });
  const rets = P.dailyReturns(s);
  ok(
    "kein Scheingewinn am Split-Tag",
    rets.every((r) => Math.abs(r.r) < 0.1),
    rets.map((r) => `${r.date}:${(r.r * 100).toFixed(0)}%`).join(" "),
    "alle < 10 %",
  );
}
{
  // Depotübertrag raus/rein darf NICHT als Split gedeutet werden.
  const csv =
    "date,type,symbol,shares,price\n" +
    "2024-01-02,BUY,US0378331005,5,100\n" +
    "2025-05-07,MIGRATION,US0378331005,-5,178\n" +
    "2025-05-07,MIGRATION,US0378331005,5,178\n";
  const adj = P.adjustForSplits(B.importCsv(csv).txns);
  const [p] = P.positionsFrom(adj);
  ok("Übertrag bleibt neutral", near(p.shares, 5), p.shares, 5);
  ok("Kaufkurs unverändert", near(adj.find((t) => t.kind === "buy").price, 100), "—", 100);
}

// ── Plausibilitätsprüfung des Kurses ───────────────────────────────────────
// Der zweitteuerste Fehler: eine ISIN wird der falschen Börsennotierung
// zugeordnet. Der ETF, den man für 13 € gekauft hat, steht plötzlich bei 127 €
// und meldet 861 % Gewinn. Das muss auffallen — echte Kursgewinne aber nicht.
console.log("\nPlausibilität von Kurs und Einstand");
{
  const cases = [
    ["falsch zugeordneter ETF (13,18 → 126,73 nach 2 J)", 13.18, 126.73, 2, true],
    ["Palantir, echter Verlauf (33,38 → 141,01)", 33.38, 141.01, 3, false],
    ["Microsoft, echter Verlauf (333,82 → 427,22)", 333.82, 427.22, 4, false],
    ["Broadcom, echter Verlauf (155,14 → 362,50)", 155.14, 362.5, 3, false],
    ["ETF nahe am Einstand (29,71 → 29,85)", 29.71, 29.85, 1, false],
    ["echte Verzehnfachung über 8 Jahre", 10, 100, 8, false],
    ["Kurs bricht auf 5 % ein", 100, 5, 2, true],
  ];
  for (const [name, avg, last, y, shouldWarn] of cases) {
    const w = I.priceMismatch(avg, last, y);
    ok(name, !!w === shouldWarn, w || "keine Warnung", shouldWarn ? "Warnung" : "keine Warnung");
  }
}

// ── Personennamen aus SEC-Meldungen ────────────────────────────────────────
// Form 4 liefert "NACHNAME VORNAME MITTELNAME" in Großbuchstaben. Ungefiltert
// steht auf jeder Seite "BARTON RICHARD N" statt "Richard N. Barton".
console.log("\nNamen aus Form-4-Meldungen");
{
  const F = await import("../.tmp-format.mjs");
  const cases = [
    ["BARTON RICHARD N", "Richard N. Barton"],
    ["KILGORE LESLIE J", "Leslie J. Kilgore"],
    ["SMITH BRADFORD L", "Bradford L. Smith"],
    ["MATHER ANN", "Ann Mather"],
    ["Zuckerberg Mark", "Mark Zuckerberg"],
    ["Karbowski Jeffrey William", "Jeffrey William Karbowski"],
    ["HASTINGS REED JR", "Reed Hastings Jr."],
    ["Berkshire Hathaway Inc", "Berkshire Hathaway Inc"],
    ["Point72 Asset Management", "Point72 Asset Management"],
  ];
  for (const [inp, exp] of cases) {
    const got = F.personName(inp);
    ok(`„${inp}“`, got === exp, got, exp);
  }
}

// ── Feed: „Seit Offenlegung“ ───────────────────────────────────────────────
// Ein nackter Strich sieht nach Fehler aus. Er muss sagen, warum die Zahl fehlt.
console.log("\nSpalte „Seit Offenlegung“");
{
  const F = await import("../.tmp-format.mjs");
  const heute = "2026-08-07";
  let r = F.disclosureLabel(0.045, "2026-06-17", heute);
  ok("Rendite wird gezeigt", r.text === "+4,5\u00A0%" && !r.muted, r.text, "+4,5\u00A0%");
  r = F.disclosureLabel(-0.009, "2026-05-29", heute);
  ok("negative Rendite", r.text === "-0,9\u00A0%" && !r.muted, r.text, "-0,9\u00A0%");
  r = F.disclosureLabel(null, "2026-08-07", heute);
  ok("heute gemeldet", r.text === "heute gemeldet" && r.muted, r.text, "heute gemeldet");
  r = F.disclosureLabel(null, "2026-05-01", heute);
  ok("ohne Kursreihe", r.text === "kein Kurs hinterlegt" && r.muted, r.text, "kein Kurs hinterlegt");
  r = F.disclosureLabel(null, null, heute);
  ok("ohne Datum", r.muted === true, r.text, "grauer Hinweis");
  r = F.disclosureLabel(0, "2026-05-01", heute);
  ok("null Prozent ist eine Zahl", r.text === "+0,0\u00A0%" && !r.muted, r.text, "+0,0\u00A0%");
}

// ── Feed: Meldeserien bündeln ──────────────────────────────────────────────
// Eine Vesting-Runde meldet ein Dutzend Insider am selben Tag. Ungebündelt
// verdrängt das den ganzen übrigen Feed.
console.log("\nMeldeserien im Feed");
{
  const F = await import("../.tmp-format.mjs");
  const row = (n, t, d, typ = "corporate_insider", tx = "buy") => ({
    id: n,
    entityName: `Person ${n}`,
    ticker: t,
    disclosedAt: d,
    entityType: typ,
    txnType: tx,
  });
  const feed = [
    row(1, "COIN", "2026-08-05", "corporate_insider", "sell"),
    row(2, "NFLX", "2026-08-04"),
    row(3, "NFLX", "2026-08-04"),
    row(4, "NFLX", "2026-08-04"),
    row(5, "NFLX", "2026-08-04"),
    row(6, "AMZN", "2026-08-03"),
  ];
  const g = F.groupSeries(feed);
  ok("drei Blöcke", g.length === 3, g.length, 3);
  ok("Netflix-Serie hat 4 Zeilen", g[1].rows.length === 4, g[1].rows.length, 4);
  ok("Einzelmeldung bleibt einzeln", g[0].rows.length === 1, g[0].rows.length, 1);
  ok("Schwelle ist 3", F.SERIES_MIN === 3, F.SERIES_MIN, 3);
  ok(
    "unter der Schwelle wird nicht gebündelt",
    F.groupSeries([row(1, "AAPL", "2026-08-04"), row(2, "AAPL", "2026-08-04")])[0].rows.length <
      F.SERIES_MIN,
    2,
    "< 3",
  );
  // Gegenprobe: gleiche Aktie, gleicher Tag, aber Kauf und Verkauf gemischt —
  // das darf nicht zu „4 Insider kauften“ verschmelzen.
  const mixed = F.groupSeries([
    row(1, "NFLX", "2026-08-04", "corporate_insider", "buy"),
    row(2, "NFLX", "2026-08-04", "corporate_insider", "sell"),
    row(3, "NFLX", "2026-08-04", "corporate_insider", "buy"),
  ]);
  ok("Kauf und Verkauf bleiben getrennt", mixed.length === 3, mixed.length, 3);
  // Gegenprobe: gleicher Tag, gleiche Aktie, aber Insider und Institution
  const kinds = F.groupSeries([
    row(1, "NFLX", "2026-08-04", "corporate_insider", "buy"),
    row(2, "NFLX", "2026-08-04", "institution", "buy"),
  ]);
  ok("Insider und Institution getrennt", kinds.length === 2, kinds.length, 2);
  ok("Reihenfolge bleibt erhalten", g[0].rows[0].id === 1 && g[2].rows[0].id === 6, "1/6", "1/6");
}

// ── Ausweichbörsen und stillgelegte Papiere ───────────────────────────────
// Beides betrifft die Frage, ob eine Position einen echten Kurs bekommt oder
// eine ehrliche Lücke. Ein falscher Treffer wäre hier teurer als gar keiner.
console.log("\nAusweichbörsen und stillgelegte Papiere");
{
  const r = (id, bad = []) =>
    I.resolveInstrument(id, null, null, {}, {}, new Set(bad));

  // SPDR S&P 500 (SPYL): Xetra zuerst, dann Amsterdam, dann London.
  ok("erster Börsenplatz zuerst", r("IE000XZSV718").symbol === "SPYL.DE", r("IE000XZSV718").symbol, "SPYL.DE");
  ok(
    "kursfreier Platz wird übersprungen",
    r("IE000XZSV718", ["SPYL.DE"]).symbol === "SPYL.AS",
    r("IE000XZSV718", ["SPYL.DE"]).symbol,
    "SPYL.AS",
  );
  ok(
    "zwei tote Plätze — dritter rückt nach",
    r("IE000XZSV718", ["SPYL.DE", "SPYL.AS"]).symbol === "SPYL.L",
    r("IE000XZSV718", ["SPYL.DE", "SPYL.AS"]).symbol,
    "SPYL.L",
  );
  const alleTot = r("IE000XZSV718", ["SPYL.DE", "SPYL.AS", "SPYL.L"]);
  ok("alle Plätze tot ⇒ kein geratenes Kürzel", alleTot.symbol === null, alleTot.symbol, "null");

  // Einzelnes Kürzel muss sich weiterhin genauso verhalten wie bisher.
  ok("einzelnes Kürzel unverändert", r("US0378331005").symbol === "AAPL", r("US0378331005").symbol, "AAPL");
  ok(
    "einzelnes Kürzel als kursfrei gemeldet",
    r("US0378331005", ["AAPL"]).symbol === null,
    r("US0378331005", ["AAPL"]).symbol,
    "null",
  );

  // Verschmolzener Fonds und eingestellter Hinterlegungsschein: niemals ein
  // Kürzel, immer eine Begründung — sonst greift die Suche und rät.
  const world = r("LU1781541179");
  ok("verschmolzener Fonds bekommt kein Kürzel", world.symbol === null, world.symbol, "null");
  ok("Verschmelzung wird begründet", /verschmolzen/i.test(world.unpriceable ?? ""), world.unpriceable, "Text");
  ok("Nachfolger wird genannt", (world.unpriceable ?? "").includes("IE000BI8OT95"), world.unpriceable, "IE000BI8OT95");

  const gdr = r("USY384721251");
  ok("eingestellter GDR bekommt kein Kürzel", gdr.symbol === null, gdr.symbol, "null");
  ok("Einstellung wird begründet", /eingestellt/i.test(gdr.unpriceable ?? ""), gdr.unpriceable, "Text");

  // Eigene Zuordnung schlägt weiterhin alles — auch ein stillgelegtes Papier.
  const eigen = I.resolveInstrument("LU1781541179", null, null, { LU1781541179: "MWRD.DE" }, {});
  ok("eigene Zuordnung sticht", eigen.symbol === "MWRD.DE", eigen.symbol, "MWRD.DE");
}

// ── Währungsumrechnung ─────────────────────────────────────────────────────
console.log("\nWährungsumrechnung");
{
  const usd = [
    { date: "2025-01-02", close: 110 },
    { date: "2025-01-03", close: 120 },
  ];
  const fx = [
    { date: "2025-01-02", close: 1.1 }, // 1 EUR = 1,10 USD
    { date: "2025-01-03", close: 1.2 },
  ];
  const eur = P.convertBars(usd, fx);
  ok("110 USD bei 1,10 ⇒ 100 EUR", near(eur[0].close, 100), eur[0].close, 100);
  ok("120 USD bei 1,20 ⇒ 100 EUR", near(eur[1].close, 100), eur[1].close, 100);
  ok("ohne Wechselkurs keine erfundene Umrechnung", P.convertBars(usd, null).length === 0, P.convertBars(usd, null).length, 0);
}

// ── Echte Datei, falls vorhanden ───────────────────────────────────────────
const real = process.argv[2];
if (real) {
  console.log("\nEchter Broker-Export");
  const fs = await import("fs");
  const r = B.importCsv(fs.readFileSync(real, "utf8"));
  ok("Format erkannt", r.format.includes("Trade Republic"), r.format, "Trade Republic / Parqet");
  ok("Währung EUR", r.currency === "EUR", r.currency, "EUR");
  ok("keine unbekannten Buchungsarten", r.counts.unknown === 0, r.counts.unknown, 0);
  ok("alle Buchungen datiert", r.dated === r.txns.length, `${r.dated}/${r.txns.length}`, "gleich");
  ok("Papiere über ISIN erkannt", r.instruments.every((i) => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$|^[A-Z]{3,4}$/.test(i.key)), "—", "nur ISIN/Kürzel");
  const pos = P.positionsFrom(r.txns);
  ok("keine negativen Bestände", pos.every((p) => p.shares >= 0), "—", "alle ≥ 0");
  const open = pos.filter((p) => p.shares > 1e-9);
  console.log(`     ${open.length} offene Positionen, ${r.instruments.length} Papiere insgesamt`);
}

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen\n`);
process.exit(fail === 0 ? 0 : 1);
