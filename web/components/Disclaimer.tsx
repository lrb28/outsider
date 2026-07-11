export function Disclaimer() {
  return (
    <div className="text-xs text-muted leading-relaxed">
      <strong className="text-slate-300">Informational / educational only — not investment advice.</strong>{" "}
      Data comes from official public disclosures (SEC EDGAR, US House &amp; Senate
      financial disclosures) and is shown with an inherent reporting lag: 13F
      holdings are filed up to 45 days after quarter-end and reflect long US
      positions only (short stock is not disclosed); politician trades are
      reported days to weeks after the fact. Every figure links back to its
      source filing. Nothing here is a recommendation to buy or sell.
    </div>
  );
}
