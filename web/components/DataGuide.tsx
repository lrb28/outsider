"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";

import { Icon, type IconName } from "@/components/Icon";
import { Sheet } from "@/components/Sheet";

type Kind = "investor" | "insider" | "politician";

const SOURCES: { kind: Kind; title: string; form: string; lines: string[] }[] = [
  {
    kind: "investor",
    title: "Investors",
    form: "Form 13F · quarterly",
    lines: [
      "Holdings at quarter end, filed up to 45 days later.",
      "Outsider compares two quarters: added to, reduced, new or sold.",
      "The report shows neither the trade date nor the price paid.",
    ],
  },
  {
    kind: "insider",
    title: "Insiders",
    form: "Form 4 · within 2 business days",
    lines: [
      "Officers, directors and large shareholders report their own trades.",
      "Only code P (purchase) and S (sale) count as a buy or sell.",
      "Grants, tax withholding and option exercises are separate transactions.",
    ],
  },
  {
    kind: "politician",
    title: "Politicians",
    form: "STOCK Act · up to 45 days",
    lines: [
      "Members of the US House of Representatives, fetched daily from the Clerk.",
      "Amounts are ranges like $1,001–$15,000, not exact sums.",
      "Scanned PDFs are still missing; the Senate is not included.",
    ],
  },
];

const NOTES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "chart",
    title: "“since filing”",
    text: "Compares the first close after the disclosure with the latest one. It is not the filer’s return; without a current price there is no number.",
  },
  {
    icon: "info",
    title: "Not investment advice",
    text: "A filing is not a buy signal. Funds can hold hedges that don’t appear in the report.",
  },
];

/** The short "how to read this" explainer, as a sheet over the page. */
export function DataGuideSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet
      title="How to read the data"
      subtitle="Three kinds of filing, three deadlines — what each row says and what it doesn’t."
      onClose={onClose}
      footer={
        <Link href="/methodik" onClick={onClose} className="flex min-h-11 items-center justify-between text-[15px] font-medium text-ink">
          Sources, methodology & image credits
          <Icon name="chevronRight" className="h-4 w-4 text-subtle" />
        </Link>
      }
    >
      <div className="space-y-3 px-5 pb-5">
        {SOURCES.map((s) => (
          <section key={s.kind} className="relative overflow-hidden rounded-[20px] bg-surface2 p-4">
            <span aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full blur-2xl" style={{ background: `rgb(var(--aura-${s.kind}) / 0.28)` }} />
            <div className="relative flex items-center gap-2">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: `rgb(var(--aura-${s.kind}))` }} />
              <h3 className="text-[16px] font-semibold">{s.title}</h3>
              <span className="ml-auto text-[12px] font-medium text-subtle">{s.form}</span>
            </div>
            <ul className="relative mt-2.5 space-y-1.5">
              {s.lines.map((l) => (
                <li key={l} className="flex gap-2 text-[14px] leading-snug text-ink/80">
                  <span aria-hidden="true" className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-ink/30" />
                  {l}
                </li>
              ))}
            </ul>
          </section>
        ))}
        {NOTES.map((n) => (
          <div key={n.title} className="flex gap-3 px-1 pt-2">
            <span className="icon-ring h-9 w-9"><Icon name={n.icon} className="h-[18px] w-[18px] text-subtle" /></span>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold">{n.title}</div>
              <p className="mt-0.5 text-[14px] leading-snug text-subtle">{n.text}</p>
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

/** Inline link that opens the explainer instead of leaving the page. */
export function DataGuideLink({ children = "How to read the data", className = "" }: { children?: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`!min-h-0 font-medium text-ink underline underline-offset-2 ${className}`}
      >
        {children}
      </button>
      {open && <DataGuideSheet onClose={() => setOpen(false)} />}
    </>
  );
}
