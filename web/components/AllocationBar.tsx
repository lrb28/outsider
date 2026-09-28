import { weightPct } from "@/lib/format";
import { CAT, OTHER } from "@/lib/palette";
import type { HoldingRow } from "@/lib/types";

// Stacked allocation bar of the eight largest holdings plus "Übrige". Colours
// follow the fixed categorical order, segments are separated by a 2 px gap,
// and every segment is named in the legend with its weight.
export function AllocationBar({ holdings, title = "Verteilung" }: { holdings: HoldingRow[]; title?: string }) {
  const withWeight = holdings.filter((h) => h.weight !== null);
  if (withWeight.length === 0) return null;

  const sorted = [...withWeight].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  const top = sorted.slice(0, 8);
  const topSum = top.reduce((a, h) => a + (h.weight ?? 0), 0);
  const rest = Math.max(0, 1 - topSum);
  const restCount = withWeight.length - top.length;
  const segs = [
    ...top.map((h, i) => ({ label: h.company, weight: h.weight ?? 0, color: CAT[i] })),
    ...(rest > 0.001 ? [{ label: `Übrige (${restCount})`, weight: rest, color: OTHER }] : []),
  ];

  return (
    <section className="space-y-3">
      <h2 className="font-display text-[22px] font-bold tracking-[-0.02em]">{title}</h2>
      <div className="card p-4 sm:p-5">
        <div className="flex h-3.5 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={segs.map((s) => `${s.label} ${weightPct(s.weight)}`).join(", ")}>
          {segs.map((s, i) => (
            <div
              key={i}
              title={`${s.label} ${weightPct(s.weight)}`}
              className="h-full origin-left first:rounded-l-full last:rounded-r-full"
              style={{ width: `${Math.max(0.6, s.weight * 100)}%`, backgroundColor: s.color, animation: `growX .8s cubic-bezier(.32,.72,0,1) ${i * 40}ms both` }}
            />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-3">
          {segs.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-[13px]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="min-w-0 truncate text-ink">{s.label}</span>
              <span className="ml-auto whitespace-nowrap font-medium tabular-nums text-subtle">{weightPct(s.weight)}</span>
            </div>
          ))}
        </div>
        {restCount > 0 && (
          <p className="mt-3 text-[12px] text-subtle">Die {top.length} größten Positionen einzeln, „Übrige“ fasst {restCount} weitere zusammen.</p>
        )}
      </div>
    </section>
  );
}
