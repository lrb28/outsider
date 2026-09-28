import { redirect } from "next/navigation";

// The old investor/stock list lives on as the Investoren and Aktien tabs of
// Entdecken; this address only forwards there.
export default function PortfolioPage() {
  redirect("/discover?tab=investors");
}
