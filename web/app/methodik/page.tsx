import type { Metadata } from "next";
import Link from "next/link";

import { PORTRAITS } from "@/lib/portraits";
export const metadata: Metadata = { title: "Quellen & Methodik" };
export default function Methodik() {
  return <article className="prose-copy lcard mx-auto max-w-3xl p-6 sm:p-10">
    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">Daten verstehen</span>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight">Was eine Meldung aussagt.</h1>
    <p>ĀURA macht öffentliche Finanzmeldungen durchsuchbar. Jede Meldungsart hat andere Fristen und Grenzen. Ein gemeldeter Bestand oder eine Zuteilung ist keine automatische Kaufempfehlung.</p>
    <h2>Investoren: Quartalsbestände aus Form 13F</h2>
    <p>13F-Berichte enthalten meldepflichtige Wertpapierbestände zum Quartalsende. ĀURA vergleicht zwei Berichtsstände und zeigt Bestandserhöhungen oder -reduzierungen. Daraus lassen sich weder ein genauer Handelstag noch ein Ausführungskurs ableiten. Optionspositionen werden gesondert als Put oder Call gekennzeichnet. Ein Fonds kann weitere, hier nicht sichtbare Anlagen oder Absicherungen halten.</p>
    <p>Die Angaben erscheinen mit Verzögerung. Berichtszeitraum und Veröffentlichungsdatum werden getrennt angezeigt. Mehrere Fonds können zur selben Person gehören; ein Ranking ist keine vollständige Vermögensübersicht.</p>
    <h2>Unternehmensinsider: Form 4</h2>
    <p>Nur die Transaktionscodes P und S werden als Kauf beziehungsweise Verkauf eingeordnet. Zuteilungen (A), steuerbedingte Einbehalte (F), Geschenke (G) und Optionsausübungen (M) sind eigene Vorgänge. Fehlt bei älteren importierten Daten der Originalcode, verwendet ĀURA eine neutrale Beschreibung. Derivate werden gekennzeichnet.</p>
    <p>Ein Insider kann aus vielen Gründen handeln. Die Größenangabe nennt gemeldete Stückzahlen; Bruchteile bleiben sichtbar.</p>
    <h2>US-Abgeordnete: gemeldete Transaktionen</h2>
    <p>Die Politikerdaten stammen aus den Periodic Transaction Reports (STOCK Act) des US-Repräsentantenhauses, die ĀURA täglich direkt beim Clerk of the House abruft und ausliest. Jede Meldung wird dem offiziellen Mitgliederverzeichnis zugeordnet (Name, Partei, Wahlkreis). Beträge werden als Spanne gemeldet und sind keine exakten Handelsvolumina; gemeldet wird bis zu 45 Tage nach dem Trade. Eingescannte Meldungen (Bild-PDFs) lassen sich noch nicht automatisch auslesen und fehlen. Der US-Senat ist nicht enthalten.</p>
    <h2>Kurse und Veränderung seit Offenlegung</h2>
    <p>Die Prozentangabe vergleicht den ersten verfügbaren Schlusskurs innerhalb von sieben Kalendertagen nach Offenlegung mit dem jüngsten gespeicherten Schlusskurs. Fehlt einer dieser Werte oder ist der letzte Kurs älter als sieben Tage, wird keine Prozentzahl berechnet. Sie ist weder die Rendite des meldenden Akteurs noch eine Rendite einschließlich Dividenden, Kosten oder Steuern.</p>
    <p>Charts zeigen verfügbare Kursdaten. Bei Datenlücken werden keine Kurse erfunden. Kurse im eigenen Depot werden bei Yahoo Finance angefragt und können verzögert sein. Der angezeigte Kursstand ist entscheidend; automatische Aktualisierung bedeutet keine garantierten Echtzeitkurse.</p>
    <h2>Abdeckung und Ausfälle</h2>
    <p>Der <Link href="/status">Datenstand</Link> zeigt die jeweils jüngste Offenlegung, die Kursabdeckung und Meldungen ohne Offenlegungsdatum. Ein technisch erfolgreicher Import garantiert nicht, dass alle Quellen aktuelle Daten liefern. Bei Datenbankfehlern zeigt die Anwendung einen Fehler mit Wiederholen-Aktion. Beispieldaten stehen ausschließlich im ausdrücklich aktivierten Demomodus zur Verfügung.</p>
    <h2>Primärquellen</h2>
    <p><a href="https://www.sec.gov/divisions/investment/13ffaq" target="_blank" rel="noopener noreferrer">SEC: Form 13F</a> · <a href="https://www.sec.gov/files/form4.pdf" target="_blank" rel="noopener noreferrer">SEC: Form 4 und Transaktionscodes</a> · <a href="https://disclosures-clerk.house.gov/" target="_blank" rel="noopener noreferrer">US-Repräsentantenhaus</a> · <a href="https://github.com/unitedstates/congress-legislators" target="_blank" rel="noopener noreferrer">@unitedstates/congress-legislators</a></p>
    <h2 id="bildnachweise">Bildnachweise</h2>
    <p>Porträts stammen von Wikimedia Commons und stehen unter den genannten freien Lizenzen. Für Investoren ohne frei lizenziertes Foto zeigt ĀURA das Logo ihres Fonds (aus dem Website-Symbol der jeweiligen Gesellschaft), sonst ein Aura-Monogramm mit Initialen. Unternehmensinsider erscheinen mit dem Logo ihres Unternehmens, weil es von ihnen keine freien Fotos gibt. Abgeordnete zeigen ihr offizielles, gemeinfreies Kongress-Porträt (bereitgestellt vom Projekt @unitedstates/images); Partei und Wahlkreis stammen aus @unitedstates/congress-legislators. Firmenlogos: Parqet und Financial Modeling Prep; sie bleiben Marken der jeweiligen Unternehmen.</p>
    <ul className="mt-3 space-y-1.5 text-sm text-zinc-700">
      {Object.values(PORTRAITS).map(p => <li key={p.name}><a href={p.page} target="_blank" rel="noopener noreferrer">{p.name}</a>: {p.author || "unbekannt"}, {p.license}</li>)}
    </ul>
    <p>Stand der Beschreibung: 13. September 2026. Die Originalmeldung ist maßgeblich. ĀURA dient der Information und erteilt keine Anlageberatung.</p>
  </article>;
}
