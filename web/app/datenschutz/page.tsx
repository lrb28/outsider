import type { Metadata } from "next";
export const metadata: Metadata = { title: "Datenschutz & lokale Speicherung" };
export default function Privacy() {
  return <article className="prose-copy mx-auto max-w-3xl rounded-3xl bg-card p-6 sm:p-10">
    <h1 className="text-3xl font-semibold tracking-tight">Deine Daten im Depot</h1>
    <p>Depottransaktionen und Watchlist werden in diesem Browser gespeichert. Ein Konto ist dafür nicht erforderlich. Brokerdateien werden im Browser eingelesen. Ohne eigenen Export gibt es keine Sicherung: Beim Löschen der Browserdaten können Depot und Watchlist verloren gehen.</p>
    <h2>Welche Anfragen den Browser verlassen</h2>
    <p>Für Kursverläufe, aktuelle Kurse und die Zuordnung von Wertpapieren sendet die Anwendung Ticker oder ISINs an ihre API. Diese fragt gegebenenfalls Yahoo Finance ab. Für den Vergleich mit öffentlichen Meldungen werden Wertpapierkennungen an die ĀURA-Datenbankabfrage übergeben. Stückzahlen, Anschaffungskosten und die vollständige Brokerdatei werden dafür nicht übertragen.</p>
    <p>Beim Laden der Website erhält der Hostinganbieter technisch notwendige Verbindungsdaten, etwa IP-Adresse und angefragte URL. Extern geladene Unternehmenslogos oder Personenbilder können ebenfalls eine Anfrage an den jeweiligen Bildanbieter auslösen.</p>
    <h2>Speichern und sichern</h2>
    <p>Die lokale Speicherung dient Depot, Watchlist und Einstellungen. Du kannst dein Depot in der Depotansicht exportieren und importieren. Die Anwendung meldet, wenn das Speichern im Browser fehlschlägt. Prüfe Sicherungen vor dem Löschen von Browserdaten.</p>
    <h2>Transparenzhinweis zum Projektstand</h2>
    <p>Diese Seite beschreibt den technischen Datenfluss der Anwendung. Die Angaben zum verantwortlichen Betreiber, Kontakt und den tatsächlich eingesetzten Hostingverträgen sind noch zu ergänzen. Sie ist bis dahin keine vollständige Datenschutzerklärung.</p>
  </article>;
}
