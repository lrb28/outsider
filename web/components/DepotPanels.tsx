"use client";

import { useState } from "react";

import { Donut } from "@/components/Donut";
import { OTHER } from "@/lib/palette";
import { SegmentedControl } from "@/components/ui";
import { num, pctOf } from "@/lib/format";
import { cAbbrev as abbrevMoney } from "@/lib/money";
import { Icon } from "./Icon";

// ── Kennzahlen-Kachel ───────────────────────────────────────────────────────

export function Kpi({
  label,
  value,
  sub,
  tone,
  hint,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "bull" | "bear" | null;
  hint?: string;
}) {
  return (
    <div className="lcard p-4" title={hint}>
      <div
        className={`text-lg font-semibold tracking-tight ${
          tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : ""
        }`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-xs text-subtle">{label}</div>
      {sub && <div className="mt-0.5 text-[11px] text-subtle">{sub}</div>}
    </div>
  );
}

/**
 * Key figures of the Depot in one grouped card: hairline grid instead of six
 * floating tiles, so the eye reads a table of numbers, not a wall of cards.
 */
export function KpiGrid({ items }: { items: { label: string; value: string; sub?: string; tone?: "bull" | "bear" | null; hint?: string }[] }) {
  return (
    <div className="card overflow-hidden">
      <dl className="grid grid-cols-2 gap-px bg-hair sm:grid-cols-3">
        {items.map((k) => (
          <div key={k.label} title={k.hint} className="min-w-0 bg-card px-4 py-3.5 [container-type:inline-size] sm:px-5">
            <dt className="text-[12px] font-medium text-subtle">{k.label}</dt>
            <dd className={`mt-1 truncate font-display text-[clamp(17px,13cqi,22px)] font-bold leading-tight tracking-[-0.01em] tabular-nums ${k.tone === "bull" ? "text-bull" : k.tone === "bear" ? "text-bear" : ""}`}>{k.value}</dd>
            {k.sub && <dd className="mt-0.5 truncate text-[12px] text-subtle">{k.sub}</dd>}
          </div>
        ))}
      </dl>
    </div>
  );
}

/** One-line finding with a tinted badge (benchmark comparison and alike). */
export function Insight({ tone, title, text }: { tone: "bull" | "bear"; title: string; text: string }) {
  return (
    <div className="card flex items-start gap-3 p-4">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone === "bull" ? "bg-bull/10 text-bull" : "bg-bear/10 text-bear"}`}>
        <Icon name={tone === "bull" ? "arrowUp" : "arrowDown"} className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0">
        <div className={`text-[15px] font-semibold leading-snug ${tone === "bull" ? "text-bull" : "text-bear"}`}>{title}</div>
        <p className="mt-0.5 text-[13px] leading-snug text-subtle">{text}</p>
      </div>
    </div>
  );
}

// ── Gruppierte Allokation (Sektor / Region / Anlageklasse / Position) ───────

export interface Segment {
  label: string;
  value: number;
  color: string;
}

export function AllocView({
  segments,
  total,
  title,
  /** Ab diesem Anteil wird eine Klumpenrisiko-Warnung gezeigt. */
  warnAbove,
  emptyNote,
  format = abbrevMoney,
  max = 8,
}: {
  segments: Segment[];
  total: number;
  title: string;
  warnAbove?: number;
  emptyNote?: string;
  /** Betrag je Zeile, Standard „24,7 Mio. €“. */
  format?: (v: number) => string;
  /** So viele Gruppen einzeln, der Rest wird zu „Übrige“. */
  max?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const sorted = [...segments].filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  if (sorted.length === 0 || total <= 0) {
    return (
      <div className="lcard p-5">
        <div className="text-[15px] font-semibold">{title}</div>
        <p className="mt-2 text-sm text-subtle">{emptyNote ?? "Keine Daten."}</p>
      </div>
    );
  }
  // Everything past the first `max` folds into one grey "Übrige" share, so
  // the ring always adds up to the whole Depot.
  const head = sorted.slice(0, max);
  const tail = sorted.slice(max);
  const shown: Segment[] = tail.length
    ? [...head, { label: `Übrige (${tail.length})`, value: tail.reduce((a, s) => a + s.value, 0), color: OTHER }]
    : head;
  // Beim Antippen zeigt die Mitte das gewählte Segment, sonst das größte.
  const focus = hover !== null && shown[hover] ? shown[hover] : shown[0];
  const focusShare = focus.value / total;
  const warn = warnAbove !== undefined && sorted[0].value / total > warnAbove;

  return (
    <div className="lcard min-w-0 overflow-hidden p-5">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h3 className="text-[17px] font-semibold tracking-[-0.01em]">{title}</h3>
        <span className="shrink-0 text-[13px] text-subtle">
          {sorted.length} {sorted.length === 1 ? "Gruppe" : "Gruppen"}
        </span>
      </div>

      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        <div className="flex shrink-0 flex-col items-center">
          <Donut
            segments={shown}
            size={168}
            thickness={22}
            countTo={focusShare * 100}
            countFormat={(v) => pctOf(v / 100, 0, false)}
            centerBottom={focus.label}
            activeIndex={hover}
            onHover={setHover}
          />
          <div className="mt-2 text-[13px] font-semibold tabular-nums text-subtle">{format(focus.value)}</div>
        </div>
        <ul className="w-full min-w-0 flex-1">
          {shown.map((s, i) => {
            const p = s.value / total;
            const dim = hover !== null && hover !== i;
            return (
              <li key={s.label} className="min-w-0">
                <button
                  type="button"
                  onClick={() => setHover(hover === i ? null : i)}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  aria-pressed={hover === i}
                  className="block w-full min-w-0 rounded-xl px-1.5 py-2 text-left transition-opacity duration-200 !min-h-0"
                  style={{ opacity: dim ? 0.4 : 1 }}
                >
                  <span className="flex min-w-0 items-center gap-2.5 text-[14px]">
                    <span className="dot-3d" style={{ ["--c" as string]: s.color }} />
                    <span className="min-w-0 flex-1 truncate text-ink">{s.label}</span>
                    <span className="shrink-0 tabular-nums text-subtle">{format(s.value)}</span>
                    <span className="w-[3.25rem] shrink-0 text-right font-semibold tabular-nums">{pctOf(p, 1, false)}</span>
                  </span>
                  <span className="mt-1.5 block h-[3px] overflow-hidden rounded-full bg-surface2">
                    <span
                      className="block h-full origin-left rounded-full"
                      style={{ width: `${Math.max(0.8, p * 100)}%`, backgroundColor: s.color, animation: `growX 900ms cubic-bezier(0.32,0.72,0,1) ${120 + i * 50}ms both` }}
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {warn && (
        <p className="mt-3 text-[13px] leading-snug text-subtle">
          Die größte Gruppe macht über {pctOf(warnAbove!, 0, false)} aus.
        </p>
      )}
    </div>
  );
}

// ── Konzentrations-Übersicht ────────────────────────────────────────────────

export function Concentration({
  weights,
  count,
}: {
  weights: number[]; // absteigend sortierte Anteile (0–1)
  count: number;
}) {
  const cum = (n: number) => weights.slice(0, n).reduce((a, w) => a + w, 0);
  // Herfindahl-Index → "effektive Anzahl" wirklich unabhängiger Positionen
  const hhi = weights.reduce((a, w) => a + w * w, 0);
  const effective = hhi > 0 ? 1 / hhi : 0;

  const rows: [string, string, string][] = [
    ["Größte Position", pctOf(cum(1), 1, false), cum(1) > 0.25 ? "bear" : ""],
    ["Top 3", pctOf(cum(3), 1, false), cum(3) > 0.6 ? "bear" : ""],
    ["Top 5", pctOf(cum(5), 1, false), cum(5) > 0.8 ? "bear" : ""],
    ["Positionen", String(count), ""],
    [
      "Effektive Diversifikation",
      `${num(effective)} Positionen`,
      effective < 5 ? "bear" : effective > 12 ? "bull" : "",
    ],
  ];

  return (
    <div className="lcard p-5">
      <div className="mb-1 text-sm font-semibold">Konzentration</div>
      <p className="mb-3 text-[11px] text-subtle">
        „Effektive Diversifikation“ rechnet Übergewichte heraus: 20 Positionen, bei denen eine 80 %
        ausmacht, zählen wie gut 1,5.
      </p>
      <div className="space-y-2">
        {rows.map(([label, value, tone]) => (
          <div key={label} className="flex items-baseline gap-2 text-sm">
            <span className="text-subtle">{label}</span>
            <span className="ml-auto font-semibold tabular-nums">
              <span className={tone === "bear" ? "text-bear" : tone === "bull" ? "text-bull" : ""}>
                {value}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Auf-/Zuklappbarer Abschnitt ─────────────────────────────────────────────

export function Collapse({
  title,
  children,
  defaultOpen = false,
  right,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  right?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="lcard overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="press-sm flex w-full items-center gap-2 px-5 py-3.5 text-left"
      >
        <span className="text-sm font-semibold">{title}</span>
        {right}
        <span
          className={`ml-auto text-zinc-400 transition-transform ${open ? "rotate-90" : ""}`}
        >
          <Icon name="chevronRight" className="h-4 w-4" />
        </span>
      </button>
      {open && <div className="border-t border-hair px-5 py-4">{children}</div>}
    </div>
  );
}

// ── Segmentierte Reiter (Pillen) ────────────────────────────────────────────

/** The Depot's tab and filter rows: the same segmented control as elsewhere. */
export function Pills<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  label = "Auswahl",
}: {
  options: readonly (readonly [T, string])[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
  label?: string;
}) {
  return <SegmentedControl label={label} options={options} value={value} onChange={onChange} size={size} />;
}
