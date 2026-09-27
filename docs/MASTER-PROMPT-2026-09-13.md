# Umsetzungsprompt – Outsider verbessern

Du arbeitest als verantwortlicher Product Engineer an Outsider, einer deutschsprachigen Recherche-Webanwendung für öffentlich gemeldete Transaktionen von Unternehmensinsidern, US-Politikern und institutionellen Investoren. Die Live-Seite ist https://outsider-tracker.vercel.app/. Der Arbeitsbereich enthält Next.js unter `web/`, eine Python-Ingestion unter `ingestion/` und Postgres-SQL unter `db/`. Lies zuerst `docs/AUDIT-2026-09-13.md`. Es enthält konkrete reproduzierte Befunde; benutze es als Ausgangspunkt und verifiziere Änderungen am aktuellen Code.

## Auftrag und Leitlinien

Verbessere die Anwendung funktional, visuell und technisch. Implementiere die nachfolgenden Kernänderungen, statt nur Empfehlungen zu wiederholen. Erhalte vorhandene Nutzeränderungen und bestehende Depotdaten. Behandle neue Features, die Zugangsdaten, Betreiberangaben oder belastbare zusätzliche Datenquellen benötigen, als ausdrücklich dokumentierte Folgearbeiten. Behaupte keine abgeschlossene Produktionsbehebung, wenn nur der Code oder eine Migration vorbereitet wurde.

Der wichtigste Produktwert ist nachvollziehbare Information. Erfinde keine Kurse, Renditen, Quellbelege, Zeitstempel, Abdeckungszahlen oder Live-Zustände. Stelle Teilportfolios nicht als vollständiges Vermögen, Bestandsänderungen nicht als beobachtete Ausführungen und reine Kursänderungen nicht als persönliche Renditen dar. Übernimm die bestehende helle Indigo-Marke, entwickle Hierarchie und Bedienbarkeit weiter und vermeide einen kompletten, unbegründeten Stackwechsel.

## 1. Repository und reproduzierbarer Betrieb

- Dokumentiere den anfänglichen Git-Status und Unterschiede zu GitHub. Der Hauptbranch enthält möglicherweise eine versehentliche Kopie unter `web/lib/web`. Arbeite am aktiven App-Root; entferne keine unbekannten Dateien ohne Vergleich.
- Aktualisiere Next.js auf eine gepatchte unterstützte Linie. Pinne Versionen, erzeuge einen Lockfile und ergänze reproduzierbare Befehle für TypeScript, Tests und Build.
- Verwende Tests gegen den aktuellen Quellcode, keine alten handgebauten `.tmp`-Bundles. Ergänze CI für Web und Python; erkenne versehentlich verschachtelte Apps und veröffentlichte Secrets.
- Prüfe reale Vercel-Einstellungen, Supabase-Rollen und Deployments, soweit die vorhandenen Verbindungen funktionieren. Bei fehlendem Zugriff dokumentiere die genaue Grenze und arbeite an allen unabhängigen Änderungen weiter. Keine pauschalen Erfolgsaussagen.

## 2. Explizite Datenzustände und ehrliche Kurse

- Entferne synthetische Kursgenerierung aus `/api/prices`. Ein unbekanntes Papier hat eine leere Kurshistorie, keinen zufälligen Chart.
- Erlaube Beispieldaten ausschließlich bei ausdrücklich aktiviertem Demo-Modus. Der Demo-Modus muss sofort sichtbar sein und APIs müssen `source: sample` ausliefern. Ein DB-Ausfall mit konfigurierter Datenbank führt zu HTTP 503 und einem verständlichen, unkritischen Fehlertext, niemals zu unbemerkten Ersatzdaten.
- Binde Quellenkennzeichnung an die tatsächlich geladenen Antworten. Ein unabhängiger Ping darf nicht darüber entscheiden, ob eine konkrete Tabelle als echt gilt.
- Ergänze Datenstand, letzte Offenlegung und Kursfrische, idealerweise nach Akteursgruppe. Unterschiedliche Quellen dürfen unterschiedliche Stichtage haben. „Frisch abgerufen“ ist nicht gleich „aktuelle Quelldaten“.
- Prozentberechnungen setzen eine geeignete Ausgangsnotierung voraus. Fehlen Kurse in einem begrenzten Zeitraum nach dem Referenzdatum, liefere null. Erkläre die verwendete Schlusskursmethode; ein Schlusskursvergleich ist keine garantierte handelbare Rendite.

## 3. Meldungen richtig klassifizieren

- Form 4: P und S sind Kauf/Verkauf an der Börse oder privat. A steht für Zuteilung, F für Steuer-/Ausübungseinbehalt; M, G und weitere Codes brauchen neutrale, präzise Beschriftungen. Bewahre den Originalcode und den Derivathinweis in neuen Datensätzen.
- Leite ohne Originalcode keine gesicherte Handelsabsicht aus alten Daten ab. Kennzeichne sie als unklassifiziert/gemeldeten Zugang oder Abgang. Die Hervorhebung „Insider kaufen“ darf nicht unbestätigte Vergütungszuteilungen als Käufe zählen.
- Stelle 13F-Zeilen als Bestandsveränderung zwischen Quartalen dar. Benenne Quartalsende als Stichtag und zeige die begrenzte Aussagekraft zu Ausführungsdatum, Preis, Shorts und nicht meldepflichtigen Vermögenswerten.
- Erhalte echte Bruchstücke bei Stückzahlen. Positive Kleinstmengen dürfen nicht als „0 St.“ gerundet werden.
- Gruppiere Meldungsserien nach konsistentem Typ, Datum und Instrument; zähle Meldungen statt Personen, wenn mehrere Zeilen zur selben Person gehören. Gruppierung darf Put und Call nicht vermischen.
- Bereite eine additive, idempotente Datenbankänderung für Originalcodes und stabile Quellzeilen vor. Bestehende Daten werden nicht pauschal gelöscht. Dokumentiere nötige Backfills und deren Prüfungen getrennt.

## 4. Startseite und Informationsarchitektur

- Baue einen klaren Einstieg mit H1, kurzer Erklärung des Nutzens, Hauptaktion „Meldungen ansehen“ und Nebenaktion „Investoren entdecken“.
- Zeige die drei Akteursgruppen und ihren Informationsgehalt verständlich; ergänze einen Link zu Quellen und Methodik.
- Bewahre relevante Sammlungen, aber formuliere sie sachlich: gemeldete Bestandsaufstockungen, verifizierte Insider-Käufe, größte Positionen im gemeldeten Portfolio.
- Verteile aktuelle Karten auf unterschiedliche Akteure und Wertpapiere. Reduziere Wiederholungen, ohne einen falschen Eindruck repräsentativer Marktabdeckung zu erzeugen.
- Lass bei Fehlern eines einzelnen Bereichs die anderen Bereiche stehen. Jede Sektion benötigt einen sinnvollen Lade-, Leer- und Fehlerzustand mit Wiederholung.
- Verbessere Watchlist-Onboarding mit konkreten Einstiegslinks. Erkläre lokale Speicherung und fehlende Gerätesynchronisation.

## 5. Feed als brauchbares Recherchewerkzeug

- Speichere Akteursgruppe, Vorgangsart, Suchbegriff und Offenlegungszeitraum in der URL. Direktlinks sowie Zurück/Vorwärts müssen dieselbe Auswahl darstellen.
- Ergänze echte Pagination mit „Weitere Meldungen laden“. Nutze das API-Signal, verhindere Doppelklicks und Duplikate und unterscheide Erstladen vom Nachladen.
- Validiere Limit, Offset, Datumswerte, Suchlänge und Enum-Parameter serverseitig. Ungültige Parameter ergeben HTTP 400.
- Breche überholte Anfragen ab; ein langsamer alter Request darf neuere Suchresultate nicht überschreiben. Zeige bei Fehlern einen Retry, keine vermeintlich leere Datenbank.
- Beschrifte Suchfelder sichtbar oder zugänglich. Filter brauchen Auswahlsemantik, klare Gruppen und einen Reset. Nenne die Zahl der geladenen Meldungen, ohne sie als Gesamtzahl aller Treffer auszugeben.
- Auf kleinen Bildschirmen müssen Datenlabels und Aktionen verständlich bleiben, ohne den ganzen Bildschirm horizontal zu verschieben.

## 6. Globale Suche, Dialoge und Barrierefreiheit

- Suche: robustes Laden, verständlicher Fehlerzustand, keine endlose leere Suche nach einem einmaligen Netzwerkproblem. Duplizierte große Requests kurzzeitig deduplizieren.
- Unterstütze Pfeiltasten, Enter und Escape. Fokus und aktive Ergebnisse müssen korrekt erkennbar sein. Fehlende Ergebnisse sind ein anderer Zustand als noch ladende Ergebnisse.
- Trade-Dialog: native oder gleichwertige Dialogsemantik, zugänglicher Titel, Fokusfang, Escape, Fokus zurück zum Auslöser, begrenzte Höhe und Scrollen auf Mobilgeräten. Hintergrund darf bei offenem Dialog nicht mitbedient werden.
- Wichtige Touchziele mindestens 44px. Sichtbarer Tastaturfokus, Skip-Link, `aria-current` und `aria-pressed`. Trenne Links und darin bisher verschachtelte Follow-Buttons.
- Respektiere reduzierte Bewegung für Animationen. Verwende ausreichende Textkontraste; Gewinne und Verluste erhalten Vorzeichen/Wörter zusätzlich zur Farbe.

## 7. Depot, Kurse und lokale Daten

- Fremdwährungen dürfen niemals still mit Faktor 1 in eine andere Währung übernommen werden. Nutze nur belegte Wechselkurse; behandle unbekannte Notierungswährungen und Untereinheiten nachvollziehbar. Ohne passende Umrechnung keine erfundene Bewertung.
- Berechne Tagesänderungen aus Stückzahl mal Preisänderung mit richtiger Währung, nicht aus einer bereits gestiegenen Positionsbewertung.
- Teile Quote-, History- und Resolve-Abfragen in API-konforme Batches. >30/40/60 Eingaben dürfen weder verschwinden noch Endlosschleifen erzeugen.
- Ein temporärer Kursausfall beweist keine falsche ISIN-Zuordnung. Vermeide dauerhaftes Sperren gültiger Symbole nach einem Netzwerkfehler.
- Prüfe lokale Speicherformate beim Lesen, behandle fehlenden oder vollen Browser-Speicher sichtbar und synchronisiere Veränderungen zwischen Tabs.
- Beschreibe Datenschutz präzise: Buchungen/CSV bleiben lokal; Ticker/ISIN können für Kurs- und Zuordnungsabfragen an die App und externe Anbieter gesendet werden. Keine falsche Aussage „keine Weitergabe“.
- Bestehende Exporte/Importe und Transaktionsreihenfolge erhalten. Tests für echte kritische Depotfälle, Bruchstücke, fehlende FX-Daten, Gebühren und Tagesänderungen ergänzen.
- Vollständige historische Mehrwährungsperformance, Context-basierte Währungsformatierung und Zerlegung des Depotmonolithen werden als getrennte Folgephase spezifiziert, falls sie nicht in der aktuellen stabilen Umsetzung abgeschlossen werden können.

## 8. Datenbank, API und ETL

- Server-only DB-Zugriff, sichere TLS-Zertifikatsprüfung, kurze Connect-/Query-Timeouts und begrenzte Verbindungen. Geheimnisse nicht loggen oder im Client ausgeben.
- Für public-Tabellen RLS und passende GRANT/REVOKE-Regeln vorbereiten. Frontend greift über Next.js-APIs zu; daher keine pauschalen anonymen Schreibrechte. Serverrolle und Ingestion getrennt prüfen. SQL auf einer isolierten Postgres-Umgebung testen und angewandten Produktionszustand separat verifizieren.
- Öffentliche Provider-Proxies mit Inputgrenzen, Timeout, begrenzter Parallelität und begrenztem Cache absichern. Nutze kurze negative Caches und erneute Versuche bei temporären Fehlern.
- ETL: Quellen dürfen unabhängig weiterlaufen. Am Ende müssen Fehler trotzdem einen fehlgeschlagenen Lauf erzeugen. Preis-Refresh nicht hinter einem 90-Minuten-13F-Job blockieren. Veraltete/ungepreiste Symbole priorisieren; leere oder veraltete Providerantworten sind kein Erfolg.
- Senatsmirror und historische Abdeckung offenlegen. Fehlende Datumsfelder und ungültige Ticker nicht als aktuelle vollständige Meldungen präsentieren. Neue Quellen oder OCR nicht ohne eigene Verifikation als fertig ausgeben.

## 9. Vertrauen, Metadaten und nächste Produktphase

- Ergänze eine verständliche Quellen-/Methodikseite und eine Datenstatusansicht. Verlinke beides aus dem Footer.
- Ergänze präzise Datenverarbeitungshinweise, Icon, Social-Preview, Robots und eine kuratierte Sitemap. Depot aus der Suchindexierung ausschließen. Betreiber-/Kontaktangaben bleiben offen, bis echte Angaben vorliegen.
- Keine Konten, kostenpflichtigen Datenanbieter, E-Mail-Alerts oder externen Veröffentlichungen erfinden. Beschreibe diese als Folgephase mit Abnahmekriterien: Nutzerisolation/RLS, Zustellzustimmung, Backfill-Qualität, Messbarkeit.

## Abnahme und Lieferung

Führe TypeScript, den produktiven Build, bestehende Finanz-/Importtests, neue Regressionen für die kritischen Änderungen und Python-Parsertests aus. Prüfe lokal per Browser mindestens Startseite, Feedfilter mit URL, Nachladen, Suche per Tastatur, Dialog, Demo- und Fehlerzustand sowie 375px/768px/1280px. Prüfe Fokus und horizontalen Overflow. Nenne durchgeführte Tests und Ergebnisse; behaupte keinen Lighthouse-Score ohne Messung.

Liefere anschließend: die geänderte Anwendung; diesen vollständigen Prompt; den Audit mit Prioritäten; ein Umsetzungsprotokoll, das umgesetzt, vorbereitet/noch nicht ausgerollt und Folgephase unterscheidet. Nenne notwendige Produktionsschritte konkret. Zeige eine lokale Vorschau, wenn sie verfügbar ist. Arbeite bis zur überprüften Umsetzung der unabhängigen Kernänderungen weiter.
