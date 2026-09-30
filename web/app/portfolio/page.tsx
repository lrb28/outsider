import { redirect } from "next/navigation";

// The old investor/stock list lives on as the Investors and Stocks tabs of
// Discover; this address only forwards there.
export default function PortfolioPage() {
  redirect("/discover?tab=investors");
}
