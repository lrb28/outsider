"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";

import { Icon, type IconName } from "@/components/Icon";
import { Sheet } from "@/components/Sheet";

type Kind = "investor" | "insider" | "politician";

const SOURCES: { kind: Kind; title: string; form: string; lines: string[] }[] = [
  {
    kind: "investor",
    title: "Investoren",
    form: "Form 13F · vierteljährlich",
    lines: [
      "Bestände zum Quartalsende, bis zu 45 Tage später gemeldet.",
      "ĀURA vergleicht zwei Quartale: aufgestockt, reduziert, neu oder verkauft.",
      "Handelstag und Kaufkurs stehen nicht im Bericht.",
    ],
  },
  {
    kind: "insider",
    title: "Insider",
    form: "Form 4 · binnen 2 Werktagen",
    lines: [
      "Vorstände, Direktoren und Großaktionäre melden eigene Trades.",
      "Nur Code P (Kauf) und S (Verkauf) zählen als Kauf oder Verkauf.",
      "Zuteilungen, Steuer-Einbehalte und Optionsausübungen sind eigene Vorgänge.",
    ],
  },
  {
    kind: "politician",
    title: "Politiker",
    form: "STOCK Act · bis zu 45 Tage",
    lines: [
      "Abgeordnete des US-Repräsentantenhauses, täglich beim Clerk abgerufen.",
      "Beträge sind Spannen wie $1.001–$15.000, keine exakten Summen.",
      "Eingescannte PDFs fehlen noch; der Senat ist nicht enthalten.",
    ],
  },
];

const NOTES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "chart",
    title: "„seit Meldung“",
    text: "Vergleicht den ersten Schlusskurs nach der Offenlegung mit dem letzten. Das ist nicht die Rendite des Akteurs; ohne aktuellen Kurs steht keine Zahl da.",
  },
  {
    icon: "info",
    title: "Keine Anlageberatung",
    text: "Eine Meldung ist kein Kaufsignal. Fonds können Absicherungen halten, die im Bericht nicht auftauchen.",
  },
];

/** The short "how to read this" explainer, as a sheet over the page. */
export function DataGuideSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet
      title="So liest du die Daten"
      subtitle="Drei Meldearten, drei Fristen – was jede Zeile aussagt und was nicht."
      onClose={onClose}
      footer={
        <Link href="/methodik" onClick={onClose} className="flex min-h-11 items-center justify-between text-[15px] font-medium text-ink">
          Quellen, Methodik & Bildnachweise
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
export function DataGuideLink({ children = "So liest du die Daten", className = "" }: { children?: ReactNode; className?: string }) {
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
