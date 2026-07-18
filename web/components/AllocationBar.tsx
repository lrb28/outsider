import { weightPct } from "@/lib/format";
import { HoldingRow } from "@/lib/types";

const COLORS = [
  "#4f46e5",
  "#0ea5e9",
  "#16a34a",
  "#f59e0b",
  "#db2777",
  "#8b5cf6",
  "#14b8a6",
  "#ef4444",
];

// Horizontal stacked allocation bar of the top holdings + a "Rest" segment.
export function AllocationBar({ holdings }: { holdings: HoldingRow[] }) {
  const withWeight = holdings.filter((h) => h.weight !== null);
  if (withWeight.length === 0) return null;

  const sorted = [...withWeight].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  const top = sorted.slice(0, 8);
  const topSum = top.reduce((a, h) => a + (h.weight ?? 0), 0);
  const rest = Math.max(0, 1 - topSum);

  const restCount = withWeight.length - top.length;
  const segs = [
    ...top.map((h, i) => ({
      label: h.company,
      weight: h.weight ?? 0,
      color: COLORS[i % COLORS.length],
    })),
    ...(rest > 0.001
      ? [{ label: `Übrige (${restCount} Positionen)`, weight: rest, color: "#cbd5e1" }]
      : []),
  ];

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">Verteilung</h2>
      <div className="rounded-2xl bg-card p-4 shadow-card">
        <div className="flex h-3 w-full overflow-hidden rounded-full">
          {segs.map((s, i) => (
            <div
              key={i}
              title={`${s.label} ${weightPct(s.weight)}`}
              style={{ width: `${Math.max(0.5, s.weight * 100)}%`, backgroundColor: s.color }}
            />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
          {segs.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="truncate text-ink">{s.label}</span>
              <span className="ml-auto font-medium text-subtle">{weightPct(s.weight)}</span>
            </div>
          ))}
        </div>
        {restCount > 0 && (
          <p className="mt-3 text-[11px] text-subtle">
            Zeigt die {top.length} größten Positionen einzeln — „Übrige“ fasst die restlichen{" "}
            {restCount} Positionen zusammen.
          </p>
        )}
      </div>
    </section>
  );
}
