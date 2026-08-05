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
  ok("ohne Kurs unverändert", P.convertBars(usd, null)[0].close === 110, "—", 110);
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
