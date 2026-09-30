import Link from "next/link";
export function Disclaimer() {
  return <div className="text-xs leading-relaxed text-subtle"><strong className="font-medium text-ink">For information only, not investment advice.</strong>{" "}Filing data comes from public disclosures and can be delayed or incomplete. 13F reports show only certain reportable holdings. Prices and editorial attributions are not actual executions. <Link href="/methodik" className="underline">Sources and methodology</Link><span className="mt-2 block text-[11px]">Company logos: Parqet · Financial Modeling Prep. Portraits: Wikimedia Commons (<Link href="/methodik#bildnachweise" className="underline">image credits</Link>). Sample data is marked as a demo.</span></div>;
}
