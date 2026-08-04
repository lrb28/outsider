// Prüft die Depot-Mathematik gegen von Hand nachgerechnete Werte.
// Aufruf:  node scripts/test-portfolio.mjs   (nach dem esbuild-Schritt im Test-Runner)
import * as P from "../.tmp-portfolio.mjs";

let pass = 0;
let fail = 0;

function ok(name, cond, got, want) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}\n      erwartet: ${want}\n      bekommen: ${got}`);
  }
}

const near = (a, b, eps = 1e-6) => a !== null && Math.abs(a - b) < eps;

const buy = (ticker, date, shares, price, fee = 0) =>
  P.makeTxn({ kind: "buy", ticker, date, shares, price, fee });
const sell = (ticker, date, shares, price, fee = 0) =>
  P.makeTxn({ kind: "sell", ticker, date, shares, price, fee });

// ── Positionen: Durchschnittskosten + realisierte Gewinne ──────────────────
console.log("\nPositionen");
{
  const t = [
    buy("AAPL", "2024-01-02", 10, 100),
    buy("AAPL", "2024-06-03", 10, 200),
    sell("AAPL", "2025-01-06", 10, 250),
  ];
  const [p] = P.positionsFrom(t);
  ok("Stückzahl nach Teilverkauf", p.shares === 10, p.shares, 10);
  ok("Durchschnittseinstand 150 $", near(p.avgPrice, 150), p.avgPrice, 150);
  ok("Buchwert 1.500 $", near(p.costBasis, 1500), p.costBasis, 1500);
  ok("Realisiert 1.000 $", near(p.realized, 1000), p.realized, 1000);
}
{
  // Gebühren erhöhen den Einstand und mindern den realisierten Gewinn.
  const t = [buy("X", "2024-01-02", 10, 100, 10), sell("X", "2024-02-02", 5, 100, 5)];
  const [p] = P.positionsFrom(t);
  ok("Gebühr im Einstand", near(p.avgPrice, 101), p.avgPrice, 101);
  ok("Realisiert = −5·1 − 5 Gebühr", near(p.realized, -10), p.realized, -10);
  ok("Gebühren summiert", near(p.fees, 15), p.fees, 15);
}

// ── IZF / XIRR ─────────────────────────────────────────────────────────────
console.log("\nIZF (interner Zinsfuß)");
{
  const r = P.xirr([
    { date: "2020-01-01", amount: -1000 },
    { date: "2021-01-01", amount: 1100 },
  ]);
  ok("1 Jahr, +10 %", near(r, 0.1, 2e-3), r, 0.1);
}
{
  const r = P.xirr([
    { date: "2020-01-01", amount: -1000 },
    { date: "2022-01-01", amount: 1210 },
  ]);
  ok("2 Jahre, 1.210 $ ⇒ 10 % p. a.", near(r, 0.1, 3e-3), r, 0.1);
}
{
  // Zwei Einzahlungen: die spätere wirkt kürzer, IZF muss über der reinen
  // Gesamtrendite liegen.
  const r = P.xirr([
    { date: "2020-01-01", amount: -1000 },
    { date: "2021-01-01", amount: -1000 },
    { date: "2022-01-01", amount: 2310 },
  ]);
  ok("Sparplan-Fall plausibel (8–13 %)", r > 0.08 && r < 0.13, r, "0,08…0,13");
}
{
  ok("Ohne Vorzeichenwechsel: null", P.xirr([{ date: "2020-01-01", amount: -100 }]) === null, "—", "null");
}

// ── Zeitreihe + zeitgewichtete Rendite ─────────────────────────────────────
console.log("\nZeitreihe & TWR");
const bars = (arr) => arr.map(([date, close]) => ({ date, close }));
{
  const t = [buy("A", "2024-01-01", 10, 100)];
  const s = P.buildSeries(t, {
    A: bars([
      ["2024-01-01", 100],
      ["2024-01-02", 110],
      ["2024-01-03", 121],
    ]),
  });
  ok("3 Handelstage", s.length === 3, s.length, 3);
  ok("Startwert 1.000 $", near(s[0].value, 1000), s[0].value, 1000);
  ok("Endwert 1.210 $", near(s[2].value, 1210), s[2].value, 1210);
  ok("Zugeführtes Kapital 1.000 $", near(s[2].invested, 1000), s[2].invested, 1000);
  ok("TWR +21 %", near(P.twr(s), 0.21, 1e-9), P.twr(s), 0.21);
}
{
  // Zukauf darf die Rendite NICHT aufblähen: Wert 1.000 → Zukauf 1.000 →
  // Gesamtwert 2.200 heißt +10 %, nicht +120 %.
  const t = [buy("A", "2024-01-01", 10, 100), buy("A", "2024-01-02", 10, 100)];
  const s = P.buildSeries(t, {
    A: bars([
      ["2024-01-01", 100],
      ["2024-01-02", 100],
      ["2024-01-03", 110],
    ]),
  });
  ok("Endwert 2.200 $", near(s[2].value, 2200), s[2].value, 2200);
  ok("Einzahlung verzerrt TWR nicht (+10 %)", near(P.twr(s), 0.1, 1e-9), P.twr(s), 0.1);
  ok("Zufluss am Kauftag erfasst", near(s[1].flow, 1000), s[1].flow, 1000);
}
{
  // Dividenden zählen als Ertrag, obwohl der Kurswert gleich bleibt.
  const t = [
    buy("A", "2024-01-01", 10, 100),
    P.makeTxn({ kind: "dividend", ticker: "A", date: "2024-01-02", amount: 50 }),
  ];
  const s = P.buildSeries(t, {
    A: bars([
      ["2024-01-01", 100],
      ["2024-01-02", 100],
    ]),
  });
  ok("Dividende ⇒ +5 % TWR", near(P.twr(s), 0.05, 1e-9), P.twr(s), 0.05);
}

// ── Drawdown ───────────────────────────────────────────────────────────────
console.log("\nDrawdown & Risiko");
{
  const t = [buy("A", "2024-01-01", 1, 100)];
  const s = P.buildSeries(t, {
    A: bars([
      ["2024-01-01", 100],
      ["2024-01-02", 120],
      ["2024-01-03", 90],
      ["2024-01-04", 130],
    ]),
  });
  const mdd = P.maxDrawdown(s);
  ok("Max. Rückgang −25 %", near(mdd.dd, -0.25, 1e-9), mdd.dd, -0.25);
  ok("Tiefpunkt am 03.01.", mdd.date === "2024-01-03", mdd.date, "2024-01-03");
  ok("Trefferquote-Fallback bei kurzer Reihe", P.hitRate(s) === null, P.hitRate(s), "null");
}
{
  const t = [buy("A", "2023-01-02", 1, 100)];
  const days = [];
  let v = 100;
  for (let i = 0; i < 400; i++) {
    const d = new Date(Date.UTC(2023, 0, 2 + i)).toISOString().slice(0, 10);
    v *= i % 2 === 0 ? 1.01 : 0.995;
    days.push([d, v]);
  }
  const s = P.buildSeries(t, { A: bars(days) });
  const vol = P.volatility(s);
  ok("Volatilität berechenbar und > 0", vol !== null && vol > 0, vol, "> 0");
  const yrs = P.annualReturns(s);
  ok("Zwei Kalenderjahre erkannt", yrs.length === 2, yrs.map((y) => y.key).join(","), "2023,2024");
  ok("Jahresrenditen positiv", yrs.every((y) => y.r > 0), yrs.map((y) => y.r.toFixed(3)).join(","), "> 0");
}

// ── Bestände ohne Kaufdatum ────────────────────────────────────────────────
console.log("\nBestände ohne Kaufdatum");
{
  const t = [P.makeTxn({ kind: "buy", ticker: "A", shares: 10, price: 90, date: "" })];
  const s = P.buildSeries(t, {
    A: bars([
      ["2024-01-01", 100],
      ["2024-01-02", 110],
    ]),
  });
  ok("gilt ab dem ersten Kurstag", s.length === 2 && near(s[0].value, 1000), s[0]?.value, 1000);
  ok("Einstand fließt ins Kapital", near(s[0].invested, 900), s[0].invested, 900);
}

// ── CSV ────────────────────────────────────────────────────────────────────
console.log("\nCSV-Import");
{
  const r = P.parseCsv("AAPL,10,180\nMSFT,5,320\nMüll;;;\n");
  ok("Bestandsliste: 2 Zeilen", r.txns.length === 2, r.txns.length, 2);
  ok("Müllzeile übersprungen", r.skipped === 1, r.skipped, 1);
  ok("Kurs übernommen", near(r.txns[0].price, 180), r.txns[0].price, 180);
}
{
  const csv =
    "Typ;Datum;Ticker;Anzahl;Kurs;Gebuehr\n" +
    "Kauf;17.03.2022;AAPL;10;158,20;1\n" +
    "Verkauf;14.06.2025;AAPL;4;201,50;1\n" +
    "Dividende;12.02.2025;AAPL;;;0\n";
  const r = P.parseCsv(csv);
  ok("Transaktionsformat erkannt", r.format === "transaktionen", r.format, "transaktionen");
  ok("Kauf + Verkauf gelesen", r.txns.filter((t) => t.kind !== "dividend").length === 2, r.txns.length, 2);
  ok("Datum normalisiert", r.txns[0].date === "2022-03-17", r.txns[0].date, "2022-03-17");
  ok("Deutsches Dezimalkomma", near(r.txns[0].price, 158.2), r.txns[0].price, 158.2);
}
{
  const r = P.parseCsv("symbol,quantity,price,date\nNVDA,3,88.50,2024-05-01\n");
  ok("Englische Kopfzeile", r.txns.length === 1 && r.txns[0].ticker === "NVDA", r.txns[0]?.ticker, "NVDA");
  ok("US-Datum gelesen", r.txns[0].date === "2024-05-01", r.txns[0].date, "2024-05-01");
}

// ── Zahlen & Datum ─────────────────────────────────────────────────────────
console.log("\nZahlen- und Datumsformate");
ok("1.234,56 (DE)", near(P.parseNum("1.234,56"), 1234.56), P.parseNum("1.234,56"), 1234.56);
ok("1,234.56 (US)", near(P.parseNum("1,234.56"), 1234.56), P.parseNum("1,234.56"), 1234.56);
ok("$1234.56", near(P.parseNum("$1234.56"), 1234.56), P.parseNum("$1234.56"), 1234.56);
ok("12,5 ⇒ 12,5", near(P.parseNum("12,5"), 12.5), P.parseNum("12,5"), 12.5);
ok("27.01.2026", P.parseDate("27.01.2026") === "2026-01-27", P.parseDate("27.01.2026"), "2026-01-27");
ok("2026-1-5 aufgefüllt", P.parseDate("2026-1-5") === "2026-01-05", P.parseDate("2026-1-5"), "2026-01-05");
ok("13/05/2026 ⇒ Tag zuerst", P.parseDate("13/05/2026") === "2026-05-13", P.parseDate("13/05/2026"), "2026-05-13");

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen\n`);
process.exit(fail === 0 ? 0 : 1);
