"use client";

import { useState } from "react";

import { Donut } from "@/components/Donut";
import { cAbbrev as abbrevMoney } from "@/lib/money";

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
}: {
  segments: Segment[];
  total: number;
  title: string;
  warnAbove?: number;
  emptyNote?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const sorted = [...segments].filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  if (sorted.length === 0 || total <= 0) {
    return (
      <div className="lcard p-5">
        <div className="text-sm font-semibold">{title}</div>
        <p className="mt-2 text-sm text-subtle">{emptyNote ?? "Keine Daten."}</p>
      </div>
    );
  }
  const shown = sorted.slice(0, 8);
  // Beim Überfahren zeigt die Mitte das ausgewählte Segment, sonst das größte.
  const focus = hover !== null && shown[hover] ? shown[hover] : sorted[0];
  const focusShare = focus.value / total;

  return (
    <div className="lcard p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-subtle">{sorted.length} Gruppen</span>
      </div>

      <div className="flex flex-col items-center gap-5 sm:flex-row">
        <div className="shrink-0">
          <Donut
            segments={shown}
            size={150}
            countTo={focusShare * 100}
            countFormat={(v) => `${v.toFixed(0)} %`}
            centerBottom={focus.label.length > 15 ? focus.label.slice(0, 14) + "…" : focus.label}
            activeIndex={hover}
            onHover={setHover}
          />
          <div className="mt-1 text-center text-xs font-semibold tabular-nums">
            {abbrevMoney(focus.value)}
          </div>
        </div>
        <div className="w-full flex-1 space-y-1.5">
          {shown.map((s, i) => {
            const p = (s.value / total) * 100;
            const dim = hover !== null && hover !== i;
            return (
              <div
                key={s.label}
                className="cursor-default rounded-lg px-1 py-0.5 text-xs transition-colors hover:bg-slate-50"
                style={{ opacity: dim ? 0.45 : 1 }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="truncate text-ink">{s.label}</span>
                  <span className="ml-auto shrink-0 tabular-nums text-subtle">
                    {abbrevMoney(s.value)}
                  </span>
                  <span className="w-12 shrink-0 text-right font-semibold tabular-nums">
                    {p.toFixed(1)} %
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(1, p)}%`,
                      backgroundColor: s.color,
                      transition: "width 900ms cubic-bezier(0.22,1,0.36,1)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
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
    ["Größte Position", `${(cum(1) * 100).toFixed(1)} %`, cum(1) > 0.25 ? "bear" : ""],
    ["Top 3", `${(cum(3) * 100).toFixed(1)} %`, cum(3) > 0.6 ? "bear" : ""],
    ["Top 5", `${(cum(5) * 100).toFixed(1)} %`, cum(5) > 0.8 ? "bear" : ""],
    ["Positionen", String(count), ""],
    [
      "Effektive Diversifikation",
      `${effective.toFixed(1)} Positionen`,
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
          className={`ml-auto text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
        >
          ›
        </span>
      </button>
      {open && <div className="border-t border-hair px-5 py-4">{children}</div>}
    </div>
  );
}

// ── Segmentierte Reiter (Pillen) ────────────────────────────────────────────

export function Pills<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: readonly (readonly [T, string])[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="no-scrollbar inline-flex max-w-full overflow-x-auto rounded-full bg-slate-100 p-0.5 text-xs font-medium">
      {options.map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`press-sm shrink-0 rounded-full transition-colors ${
            size === "sm" ? "px-2.5 py-1" : "px-3.5 py-1.5"
          } ${value === key ? "bg-white text-ink shadow-card" : "text-subtle hover:text-ink"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
