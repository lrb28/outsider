# Outsider

Englischsprachige Rechercheansicht (seit 30.09.2026, vorher Deutsch) für öffentliche Meldungen von institutionellen Investoren (SEC 13F), Unternehmensinsidern (SEC Form 4) und Abgeordneten des US-Repräsentantenhauses (STOCK Act). Next.js liegt ausschließlich unter `web/`, Python-Ingestion unter `ingestion/`. Designsystem: [`docs/brand.md`](docs/brand.md). (Früher „Outsider“; Repository, Domain, Umgebungsvariablen und Browser-Speicherschlüssel behalten den alten Namen, damit nichts bricht.)

## Lokal starten

Node.js 22 oder neuer, Python 3.11 oder neuer.

```sh
cd web
npm ci
OUTSIDER_DEMO_MODE=true npm run dev
```

Für die explizite Demo muss `DATABASE_URL` fehlen. Für echte Daten eine serverseitige, TLS-verifizierte Verbindung in `.env.local` konfigurieren; siehe `web/.env.example`. Bei fehlender oder nicht erreichbarer Datenbank liefern Recherche-APIs außerhalb der Demo HTTP 503. Es werden keine Kurse erfunden.

## Prüfen

```sh
cd web
npm run check:repository
npm run typecheck
npm test
npm run build
npm audit
```

```sh
python -m pip install -r ingestion/requirements.txt pytest==9.0.2
PYTHONPATH=ingestion python -m pytest ingestion/tests -q
```

`npm test` bündelt den aktuellen Quellcode isoliert, führt Depot-/Brokerregressionen sowie API- und PostgreSQL-Prüfungen aus und entfernt die Testbundles danach. Alte `.tmp`-Dateien werden nicht verwendet.

## Datenbank und Betrieb

Neue Datenbank: zuerst `db/migrations/0001_init.sql`, danach Migrationen unter `supabase/migrations/`. Im bestehenden Supabase-Projekt wurde `20260914185135_audit_disclosure_integrity` am 14.09.2026 angewandt. Migrationen nicht erneut unter einer anderen Version einspielen.

Die Web-API benötigt nur Leserechte. Die Ingestion benötigt getrennte Schreibrechte. Das Anlegen eines neuen Logins oder die Umstellung der Vercel-Verbindungsdaten ist nicht Bestandteil der vorbereiteten Leserrolle. Keine Secrets in Git oder `NEXT_PUBLIC_`-Variablen ablegen.

Die tägliche Ingestion führt Quellen unabhängig aus und meldet Ausfälle. Der Senatsmirror ist historisch; ein Import ohne frische Abdeckung meldet dies als Fehler. Nach dem Ausrollen der neuen Ingestion müssen alte Meldungen kontrolliert neu eingelesen und die Abdeckung verglichen werden. Bestehende Zeilen bleiben beim Ersatz archiviert erhalten.

### Investoren-Renditen und Briefe

- **Renditen** (`compute_returns`, Job `returns`): liest je Investor die 13F-HR-Meldungen seit Ende 2015, hält jede Meldung bis zur nächsten (Monatskurse von Yahoo inkl. Dividenden) und schreibt Monatsrenditen nach `investor_returns`, den S&P 500 (SPY) nach `benchmark_returns`. Alte CUSIPs landen in `return_symbols`, nie in `securities`. Der erste Lauf rechnet alles (rund 12 Minuten), danach nur neue Quartale und wöchentlich die letzten Monate. Komplett neu: `gh workflow run ingest.yml -f only=returns -f args="--full"`.
- **Briefe**: je Brief eine Datei unter `ingestion/letters/` (Zusammenfassung, Takeaways, Risiken, wörtliche Zitate, besprochene Aktien), per Pull Request geprüft; der Job `letters` lädt sie. Entwurf aus einem Original: `PYTHONPATH=ingestion python -m outsider_ingest.pipelines.draft_letter --url … --investor … --author … --kind … --slug …` (braucht `pip install anthropic` und einen API-Schlüssel); das Skript prüft Format und ob jedes Zitat wörtlich im Original steht.

## Audit und Umsetzung

- [Gründlicher Audit](docs/AUDIT-2026-09-13.md)
- [Vollständiger Umsetzungsprompt](docs/MASTER-PROMPT-2026-09-13.md)
- [Umsetzung, Prüfungen und offene Schritte](docs/IMPLEMENTATION-2026-09-14.md)
- [Sicherheits- und Kostencheck 27.09.2026](docs/SECURITY-CHECK-2026-09-27.md)

Kurse und Offenlegungen sind zeitversetzt, teils lückenhaft und keine Anlageberatung. Die Anwendung erläutert Quellen und Berechnung unter `/methodik` sowie den Datenfluss unter `/datenschutz`.
