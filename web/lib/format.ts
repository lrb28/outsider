export function pct(v: number | null): string {
  if (v === null || Number.isNaN(v)) return "—";
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
}

export function money(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

export function sizeDisplay(row: {
  shares: number | null;
  amount_min: number | null;
  amount_max: number | null;
}): string {
  if (row.amount_min !== null || row.amount_max !== null) {
    if (row.amount_min !== null && row.amount_max !== null) {
      return row.amount_min === row.amount_max
        ? money(row.amount_min)
        : `${money(row.amount_min)}–${money(row.amount_max)}`;
    }
    return row.amount_min !== null ? `≥ ${money(row.amount_min)}` : `≤ ${money(row.amount_max)}`;
  }
  if (row.shares !== null) return `${Math.round(row.shares).toLocaleString("en-US")} sh`;
  return "—";
}

export function signalLabel(txnType: string, putCall: string | null): {
  text: string;
  tone: "bull" | "bear" | "neutral";
} {
  const opening = txnType === "buy"; // opening/adding a position
  if (putCall === "Put")
    return opening ? { text: "PUT · bearish", tone: "bear" } : { text: "PUT · closed", tone: "neutral" };
  if (putCall === "Call")
    return opening ? { text: "CALL · bullish", tone: "bull" } : { text: "CALL · closed", tone: "neutral" };
  if (txnType === "buy") return { text: "BUY", tone: "bull" };
  if (txnType === "sell") return { text: "SELL", tone: "bear" };
  return { text: txnType.toUpperCase(), tone: "neutral" };
}
