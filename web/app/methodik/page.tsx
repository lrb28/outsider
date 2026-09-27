import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = { title: "Quellen & Methodik" };
export default function Methodik() {
  return <article className="prose-copy mx-auto max-w-3xl rounded-3xl bg-white p-6 sm:p-10">
    <span className="text-sm font-medium text-brand">Daten verstehen</span>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight">Was eine Meldung aussagt.</h1>
    <p>Outsider macht öffentliche Finanzmeldungen durchsuchbar. Jede Meldungsart hat andere Fristen und Grenzen. Ein gemeldeter Bestand oder eine Zuteilung ist keine automatische Kaufempfehlung.</p>
    <h2>Investoren: Quartalsbestände aus Form 13F</h2>
    <p>13F-Berichte enthalten meldepflichtige Wertpapierbestände zum Quartalsende. Outsider vergleicht zwei Berichtsstände und zeigt Bestandserhöhungen oder -reduzierungen. Daraus lassen sich weder ein genauer Handelstag noch ein Ausführungskurs ableiten. Optionspositionen werden gesondert als Put oder Call gekennzeichnet. Ein Fonds kann weitere, hier nicht sichtbare Anlagen oder Absicherungen halten.</p>
    <p>Die Angaben erscheinen mit Verzögerung. Berichtszeitraum und Veröffentlichungsdatum werden getrennt angezeigt. Mehrere Fonds können zur selben Person gehören; ein Ranking ist keine vollständige Vermögensübersicht.</p>
    <h2>Unternehmensinsider: Form 4</h2>
    <p>Nur die Transaktionscodes P und S werden als Kauf beziehungsweise Verkauf eingeordnet. Zuteilungen (A), steuerbedingte Einbehalte (F), Geschenke (G) und Optionsausübungen (M) sind eigene Vorgänge. Fehlt bei älteren importierten Daten der Originalcode, verwendet Outsider eine neutrale Beschreibung. Derivate werden gekennzeichnet.</p>
    <p>Ein Insider kann aus vielen Gründen handeln. Die Größenangabe nennt gemeldete Stückzahlen; Bruchteile bleiben sichtbar.</p>
    <h2>US-Politiker: gemeldete Transaktionen</h2>
    <p>Politikerdaten stammen aus öffentlich verfügbaren Kongressmeldungen beziehungsweise deren Datenaufbereitung. Beträge werden oft als Spanne gemeldet und sind keine exakten Handelsvolumina. Der Import deckt nicht alle Personen oder Zeiträume ab. Ein fehlendes Offenlegungsdatum bleibt unbekannt; historische Meldungen sind keine aktuellen Signale.</p>
    <h2>Kurse und Veränderung seit Offenlegung</h2>
    <p>Die Prozentangabe vergleicht den ersten verfügbaren Schlusskurs innerhalb von sieben Kalendertagen nach Offenlegung mit dem jüngsten gespeicherten Schlusskurs. Fehlt einer dieser Werte oder ist der letzte Kurs älter als sieben Tage, wird keine Prozentzahl berechnet. Sie ist weder die Rendite des meldenden Akteurs noch eine Rendite einschließlich Dividenden, Kosten oder Steuern.</p>
    <p>Charts zeigen verfügbare Kursdaten. Bei Datenlücken werden keine Kurse erfunden. Kurse im eigenen Depot werden bei Yahoo Finance angefragt und können verzögert sein. Der angezeigte Kursstand ist entscheidend; automatische Aktualisierung bedeutet keine garantierten Echtzeitkurse.</p>
    <h2>Abdeckung und Ausfälle</h2>
    <p>Der <Link href="/status">Datenstand</Link> zeigt die jeweils jüngste Offenlegung, die Kursabdeckung und Meldungen ohne Offenlegungsdatum. Ein technisch erfolgreicher Import garantiert nicht, dass alle Quellen aktuelle Daten liefern. Bei Datenbankfehlern zeigt die Anwendung einen Fehler mit Wiederholen-Aktion. Beispieldaten stehen ausschließlich im ausdrücklich aktivierten Demomodus zur Verfügung.</p>
    <h2>Primärquellen</h2>
    <p><a href="https://www.sec.gov/divisions/investment/13ffaq" target="_blank" rel="noopener noreferrer">SEC: Form 13F</a> · <a href="https://www.sec.gov/files/form4.pdf" target="_blank" rel="noopener noreferrer">SEC: Form 4 und Transaktionscodes</a> · <a href="https://disclosures-clerk.house.gov/" target="_blank" rel="noopener noreferrer">US-Repräsentantenhaus</a> · <a href="https://efdsearch.senate.gov/" target="_blank" rel="noopener noreferrer">US-Senat</a></p>
    <p>Stand der Beschreibung: 13. September 2026. Die Originalmeldung ist maßgeblich. Outsider dient der Information und erteilt keine Anlageberatung.</p>
  </article>;
}
