# Sicherheits- und Kostencheck – 27.09.2026

Anlass: ein Kurzvideo über fünf typische Lücken in schnell gebauten Apps (Bandbreitenrechnung, Barrierefreiheit, offene Supabase-Tabellen, SMS ohne Einwilligung, Endlosschleife mit Cloud-Rechnung). Geprüft wurde der Stand von `codex/outsider-audit-improvements`; die Änderungen liegen auf `claude/video-security-check`.

| # | Lücke aus dem Video | Befund in Outsider | Änderung |
| --- | --- | --- | --- |
| 1 | Hosting ohne Obergrenze, Rechnung nach Traffic-Spitze | Vercel-Konto im persönlichen Hobby-Bereich (Plan im Dashboard bestätigen), Datenrouten bereits CDN-gecacht. Offen waren die drei Yahoo-Proxy-Routen: eine Anfrage löst bis zu 40 externe Abrufe aus, ohne Begrenzung. | Limit pro Client für `/api/quotes`, `/api/history`, `/api/resolve` (60 Anfragen/Minute, danach HTTP 429 mit `Retry-After`). Speicher begrenzt; Limit gilt je Instanz. |
| 2 | Keine Tastaturbedienung, kein Alt-Text | Skip-Link, sichtbarer Fokus, Dialog-Fokus bereits vorhanden; Logos/Avatare korrekt als dekorativ (`alt=""`) markiert. Drei Eingabefelder im Depot unterdrückten den Fokusrahmen (`outline-none`). | Fokusrahmen bei diesen Feldern wiederhergestellt. Ein automatischer Barrierefreiheits-Scan (z. B. axe) ist nicht enthalten. |
| 3 | Supabase-Tabellen ohne RLS | Bereits seit 14.09. behoben: RLS auf allen neun Tabellen, keine Rechte für `anon`/`authenticated`, kein Supabase-Schlüssel im Frontend, SQL nur serverseitig und parametrisiert. Die Data API wurde seit Projektstart (11.07.) nie mit `anon`/`authenticated` genutzt (`pg_stat_statements`). Lücke: künftige oder manuell angelegte Tabellen und Funktionen hätten die Supabase-Standardrechte bekommen; fünf Sequenzen hatten noch Rechte für `anon`/`authenticated`. | Neue Migration `20260927143009_lock_default_privileges.sql`: entzieht `anon`/`authenticated` die Standardrechte für neue Tabellen, Sequenzen und Funktionen (bei Funktionen auch das PostgreSQL-Standardrecht für `PUBLIC`), entfernt Restrechte in `public` und aktiviert RLS überall. Test simuliert die Supabase-Standardrechte. **Angewandt am 27.09.2026, Security Advisor ohne Befund.** Grenze: Die Standardrechte von `supabase_admin` kann `postgres` nicht ändern. |
| 4 | SMS an Warteliste ohne Einwilligung | Nicht zutreffend: Outsider versendet keine SMS/E-Mails und speichert keine Kontaktdaten. | Keine. Vor künftigen Benachrichtigungen: ausdrückliche, protokollierte Einwilligung (Double-Opt-in). |
| 5 | Endlosschleife, Budgetwarnung stoppt nichts | GitHub-Jobs haben Timeout und Concurrency, Quellenabrufe sind gedeckelt. Gefunden: `OpenFigiProvider.resolve` rief sich bei HTTP 429 unbegrenzt selbst auf; bei 1.000 Positionen hätte der Job bis zum Timeout geschlafen. | Höchstens drei Wiederholungen mit Backoff (max. 30 s), danach pausiert der Dienst für den restlichen Lauf (Circuit Breaker). Die Pipeline fällt wie bisher auf CUSIP-Zeilen zurück. |

## Vor dem Zusammenführen erledigen

1. Erledigt am 27.09.2026: `supabase/migrations/20260927143009_lock_default_privileges.sql` angewandt, Security Advisor ohne Befund.
2. Supabase API-Einstellungen: Die App nutzt die Data API nicht. Wer sie deaktiviert bzw. `public` nicht mehr freigibt, schließt diese Angriffsfläche vollständig.
3. Vercel: Plan bestätigen (Hobby = keine nutzungsabhängige Abrechnung). Bei einem späteren Wechsel auf Pro ein Ausgabenlimit mit Pausierung setzen. Optional eine Firewall-Regel für die drei Proxy-Routen als plattformweites Limit.
4. Leser-Zugang für Vercel: Login `outsider_web` (nur Lesen, erbt `outsider_reader`) am 27.09.2026 angelegt, noch ohne Passwort. Offen: Passwort im Supabase SQL-Editor setzen und `DATABASE_URL` in Vercel auf `outsider_web.<project-ref>` umstellen.

Keine Rechtsberatung: Die im Video genannten Beträge beruhen auf US-Recht (ADA, TCPA). In Österreich/Deutschland greifen andere Regeln (u. a. Barrierefreiheitsgesetz/BFSG, § 174 TKG 2021/§ 7 UWG, DSGVO).
