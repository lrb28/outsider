# Outsider – Umsetzungsprotokoll

Stand: 15. September 2026. Grundlage: [Audit](AUDIT-2026-09-13.md) und [vollständiger Umsetzungsprompt](MASTER-PROMPT-2026-09-13.md). Die unabhängigen Kernänderungen sind implementiert. Der Audit enthält auch offene Produkt- und Betriebsaufgaben; nicht alle Befunde sind damit produktiv behoben.

## Implementiert

| Bereich | Ergebnis |
| --- | --- |
| Datenwahrheit | Keine zufälligen Ersatzkurse; Beispieldaten nur im expliziten Demo-Modus ohne DB-Konfiguration. Datenbankfehler liefern 503 mit Wiederholung in der Oberfläche. Datenstatus und Kursalter werden sichtbar. |
| Meldungen | Form-4-Originalcodes und Derivate werden erhalten. Unbekannte Altdaten bleiben neutral. 13F wird als Quartalsbestandsänderung erklärt. Bruchstücke und Optionsarten bleiben unterscheidbar. |
| Oberfläche | Klarer Einstieg, Quellenkontext, Watchlist-Onboarding, URL-Filter, Datumsfilter, Seitengröße und Nachladen ohne Duplikate; Fehlerzustände pro Bereich. |
| Bedienbarkeit | Tastatursuche, nativer Dialog mit Fokus-Rückgabe und Escape, größere Touchziele, sichtbarer Fokus, Skip-Link, korrigierte Tablet-Navigation und getrennte Link-/Follow-Aktionen. |
| Depot | Belegte FX-Umrechnung einschließlich Notierungsuntereinheiten, keine stille 1:1-Ersatzumrechnung, korrigierter Tagesänderungsbetrag, begrenzte API-Batches, sichtbare Speicherfehler und Tab-Synchronisation. |
| API und Betrieb | Eingabevalidierung, Timeouts, begrenzte Caches/Parallelität, verifizierte DB-TLS-Verbindungen, server-only SQL, Sicherheitsheader, gepinnte Abhängigkeiten und reproduzierbare Tests/CI. |
| Ingestion | Originalcodes, stabile Quellzeilen und schonende Ablösung alter Zeilen; unabhängige Quellenjobs mit sichtbarem Fehlerstatus; priorisierter Preis-Refresh und gespeicherte Abrufversuche. |
| Vertrauen | Methodik, Datenstatus und zutreffende Datenverarbeitungshinweise; Metadaten, Social-Preview, Sitemap, Depot-noindex. Echte Betreiberangaben werden nicht erfunden. |

## Bereits in Supabase angewandt

Am 14. September wurde die additive Migration `20260914185135_audit_disclosure_integrity` im Projekt `outsider` angewandt und anschließend direkt überprüft:

- Alle 14.400 vorhandenen Transaktionen blieben erhalten; keine pauschale Löschung oder rückwirkende Umklassifizierung.
- Fünf neue Transaktionsfelder, Quellzeilen-Indizes und die Tabelle für Preisabrufversuche sind vorhanden.
- RLS war bereits auf den acht bestehenden Tabellen aktiviert. Die Migration entzieht Browserrollen direkte Tabellenrechte und ergänzt neun Leserichtlinien für die Rolle `outsider_reader`.
- Nachprüfung: keine Tabellen-Grants für `anon`/`authenticated`; Supabase-Sicherheitsadvisor ohne Befunde. Das ist kein vollständiger Penetrationstest.
- Die bestehenden Live-Endpunkte `/api/trades` und `/api/stats` antworteten nach der Migration weiterhin mit HTTP 200.

Noch nicht angewandt: neue Frontend-/ETL-Version, Originalcode-Backfill und Umstellung der Vercel-Verbindung auf einen eigenen Login mit `outsider_reader`. Die Rolle ist NOLOGIN; ihre Erstellung allein ändert die App-Zugangsdaten nicht.

## Verifikation

Im ursprünglichen Arbeitsbereich bestanden: TypeScript, Produktionsbuild, 44 Depot-Regressionen, 72 Broker-/Import-Regressionen, 13 zusätzliche Audit-Tests und 28 Python-Tests. Ein bestehender Python-Test erzeugt eine Warnung wegen eines Rückgabewerts. npm meldete keine bekannten Schwachstellen.

Die zusätzlichen Tests prüfen unter anderem fehlende/veraltete FX-Daten, Tagesänderung, Meldungsklassifikation, API-Grenzen, 503 statt stiller Beispieldaten, Demo-Pagination, Kurszeitstempel und Speicherfehler. Ein isolierter PGlite/Postgres-Test wendet Basis- und Audit-Migration an, wiederholt die Audit-Migration, prüft Datenerhalt, reale Abfragen sowie Lese-/Schreibrechte.

Browserprüfung der lokalen Demo: 375, 768 und 1280 Pixel ohne horizontalen Seitenüberlauf; Feedfilter mit URL, Nachladen von sechs auf acht Meldungen ohne Duplikate, Tastatursuche, Dialog/Escape/Fokus-Rückgabe, Follow-Persistenz und leeres Depot. Das Test-Follow wurde anschließend entfernt. Kein Lighthouse-Score und kein vollständiger End-to-End-Brokerimport wurden gemessen. Die Fehlerantworten sind automatisiert geprüft; eine zusätzliche visuelle Fehlerzustandsprüfung steht noch aus.

Die Abschlussprüfung im isolierten Review-Branch bestand ebenfalls: Repository-Guard, TypeScript, alle oben genannten Tests, Produktionsbuild ohne Demo-Modus und npm audit (0 bekannte Schwachstellen). Ein HTTP-Smoke-Test des Produktionsservers ohne Datenbank bestätigte 503/source=unavailable für Trades, Stats und Prices, 400 bei ungültigem Limit, erreichbare Seiten mit Sicherheitsheadern und noindex/nofollow für das Depot. Git diff --check war sauber. Die Prüfungen liefen lokal unter Node 24.19.0 und Python 3.13; CI prüft zusätzlich Node 22 und Python 3.11.

## Repository und Auslieferung

Review-Branch: `codex/outsider-audit-improvements`, aufgebaut auf GitHub-main `04bb1306b38e29d19c454c92190c38163a621a5b`. Die 80 Quelldateien der versehentlich verschachtelten App `web/lib/web` wurden vor ihrer Entfernung mit dem aktiven App-Stand verglichen und waren identisch. Generierte Python-Bytecode-Dateien wurden aus dem Review entfernt; Basisschema und Ignore-Regeln wiederhergestellt.

Der ursprüngliche Arbeitsbereich und seine persönlichen Dateien bleiben erhalten. Die lokale Vorschau nutzt ausdrücklich Beispieldaten. Ein erfolgreicher lokaler Build ist kein Nachweis eines Vercel-Deployments. Vercel-Projektkonfiguration und Deploymentzugriff waren über die Verbindung nicht verfügbar.

## Vor dem produktiven Frontend-Release

1. Review/CI abschließen; Vercel-Root `web`, Node-Version und Umgebungsvariablen prüfen. Demo-Modus für Produktion deaktivieren.
2. Dedizierten SQL-Login mit Leserolle einrichten und die serverseitige `DATABASE_URL` samt gegebenenfalls benötigtem CA-Zertifikat konfigurieren. TLS-Prüfung nicht deaktivieren.
3. Preview mit echter Datenbank prüfen: Feed, Such-/Detailseiten, Datenstatus, leere und fehlerhafte Antworten sowie Depot-Kurs-/FX-Abfragen.
4. Frontend und Ingestion aus dem geprüften Branch ausrollen. Danach Quellenjobs einzeln ausführen, Zeilenanzahlen und Fehlermeldungen kontrollieren.
5. Form-4-/13F-/House-Backfills gezielt mit Vorher-/Nachher-Zählungen und Quellbelegen durchführen. Historische Zeilen ohne Originalcode bleiben bis dahin neutral. Preis-Refresh nachholen und tatsächliche Aktualitätsabdeckung prüfen.
6. Betreiber-/Kontaktangaben ergänzen und Datenschutztext an den realen Betrieb anpassen.

## Offene Folgephase

- Verlässliche aktuelle Politikerquelle, fehlende historische Datumsfelder, gegebenenfalls OCR sowie weitere Senate-Deduplizierung; der vorhandene historische Mirror wird durch ein UI-Update nicht aktuell.
- Vollständige historische Mehrwährungsperformance inklusive Buchungswährungen/Gebühren und kleinere Depotmodule; die umgesetzte Bewertungsabsicherung ersetzt diese Arbeit nicht.
- Verteiltes Rate-Limiting, Produktionsmonitoring, Provider-Lizenzen und messbare Performance-/Barrierefreiheitsprüfung unter echten Datenmengen.
- Konten, geräteübergreifende Synchronisation und Benachrichtigungen erst mit eigenen Anforderungen, Nutzerisolation und Zustellzustimmung.
