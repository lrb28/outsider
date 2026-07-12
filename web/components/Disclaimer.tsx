export function Disclaimer() {
  return (
    <div className="text-xs text-subtle leading-relaxed">
      <strong className="text-ink font-medium">
        Nur zu Informations- und Bildungszwecken — keine Anlageberatung.
      </strong>{" "}
      Alle Daten stammen aus offiziellen öffentlichen Offenlegungen (SEC EDGAR, US-Kongress)
      und werden mit der üblichen Meldeverzögerung gezeigt: 13F-Portfolios werden bis zu 45
      Tage nach Quartalsende gemeldet und enthalten nur Long-US-Positionen (Leerverkäufe sind
      nicht dabei); Politiker-Trades erscheinen Tage bis Wochen nach dem Handel. Jede Zahl
      verweist auf ihre Quell-Offenlegung.
    </div>
  );
}
