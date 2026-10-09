import type { Metadata } from "next";
import Link from "next/link";

import { PORTRAITS } from "@/lib/portraits";
export const metadata: Metadata = { title: "Sources & methodology" };
export default function Methodik() {
  return <article className="prose-copy lcard mx-auto max-w-3xl p-6 sm:p-10">
    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">About the data</span>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight">What a filing tells you.</h1>
    <p>ĀURA makes public financial disclosures searchable. Each kind of filing has its own deadlines and limits. A reported holding or a grant is never an automatic recommendation to buy.</p>
    <h2>Investors: quarterly holdings from Form 13F</h2>
    <p>13F reports list reportable securities held at quarter end. ĀURA compares two reports and shows which positions were raised or reduced. Neither the exact trade date nor the execution price can be derived from them. Option positions are marked separately as puts or calls. A fund can hold other investments or hedges that are not visible here.</p>
    <p>The data arrives with a delay. The reporting period and the publication date are shown separately. Several funds can belong to the same person; a ranking is not a complete picture of anyone’s wealth.</p>
    <h2>Corporate insiders: Form 4</h2>
    <p>Only transaction codes P and S count as a buy or a sell. Grants (A), tax withholding (F), gifts (G) and option exercises (M) are separate transactions. Where older imported data lacks the original code, ĀURA uses a neutral description. Derivatives are marked.</p>
    <p>An insider can trade for many reasons. The size shows the reported number of shares; fractions stay visible.</p>
    <h2>Members of Congress: reported transactions</h2>
    <p>The politician data comes from the Periodic Transaction Reports (STOCK Act) of the US House of Representatives, which ĀURA fetches and reads daily straight from the Clerk of the House. Each filing is matched to the official member directory (name, party, district). Amounts are reported as ranges, not exact trade sizes, and are filed up to 45 days after the trade. Scanned filings (image PDFs) can’t be read automatically yet and are missing. The US Senate is not included.</p>
    <h2>Prices and change since disclosure</h2>
    <p>The percentage compares the first available close within seven calendar days after the disclosure with the latest stored close. If either is missing, or the latest price is older than seven days, no percentage is calculated. It is neither the filer’s return nor a return including dividends, costs or taxes.</p>
    <p>Charts show the price data that is available. Gaps are never filled with invented prices. Prices in your own portfolio come from Yahoo Finance and can be delayed. The price date shown is what counts; automatic refreshes do not mean guaranteed real-time prices.</p>
    <h2>Coverage and outages</h2>
    <p>The <Link href="/status">data status</Link> shows the latest disclosure, the price coverage and filings without a disclosure date. A technically successful import does not guarantee that every source delivered current data. On database errors the app shows an error with a retry. Sample data only appears in an explicitly enabled demo mode.</p>
    <h2>Primary sources</h2>
    <p><a href="https://www.sec.gov/divisions/investment/13ffaq" target="_blank" rel="noopener noreferrer">SEC: Form 13F</a> · <a href="https://www.sec.gov/files/form4.pdf" target="_blank" rel="noopener noreferrer">SEC: Form 4 and transaction codes</a> · <a href="https://disclosures-clerk.house.gov/" target="_blank" rel="noopener noreferrer">US House of Representatives</a> · <a href="https://github.com/unitedstates/congress-legislators" target="_blank" rel="noopener noreferrer">@unitedstates/congress-legislators</a></p>
    <h2 id="bildnachweise">Image credits</h2>
    <p>Portraits come from Wikimedia Commons under the free licences listed. For investors without a freely licensed photo, ĀURA shows their fund’s logo — from the firm’s website icon or logo, or its public-domain text logo on Wikimedia Commons (D1 Capital, Glenview, Coatue, Tiger Global, Trian, Scion, Himalaya Capital), cut down to the mark — or else an aura monogram with initials. Corporate insiders appear with their company’s logo, because there are no free photos of them. Members of Congress show their official, public-domain congressional portrait (provided by the @unitedstates/images project); party and district come from @unitedstates/congress-legislators. Company logos: Parqet (by ISIN, otherwise ticker) and Financial Modeling Prep; they remain trademarks of their companies.</p>
    <ul className="mt-3 space-y-1.5 text-sm text-zinc-700">
      {Object.values(PORTRAITS).map(p => <li key={p.name}><a href={p.page} target="_blank" rel="noopener noreferrer">{p.name}</a>: {p.author || "unknown"}, {p.license}</li>)}
    </ul>
    <p>Description as of September 30, 2026. The original filing is authoritative. ĀURA is for information only and does not give investment advice.</p>
  </article>;
}
