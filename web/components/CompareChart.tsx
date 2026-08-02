import { PriceBar } from "@/lib/types";

// Indexed performance chart (start = 100) comparing two series — like the
// Parqet "Wertentwicklung": your portfolio (solid) vs a benchmark (dashed).
export function CompareChart({
  a,
  b,
  labelA,
  labelB,
  height = 180,
}: {
  a: PriceBar[];
  b: PriceBar[] | null;
  labelA: string;
  labelB: string | null;
  height?: number;
}) {
  if (!a || a.length < 2) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-xs text-subtle">
        Noch nicht genug Kursdaten für einen Verlauf.
      </div>
    );
  }

  const width = 640;
  const pad = 8;

  const norm = (s: PriceBar[]) => {
    const base = s[0].close || 1;
    return s.map((x) => (x.close / base) * 100);
  };
  const na = norm(a);
  const nb = b && b.length > 1 ? norm(b) : null;

  const all = nb ? [...na, ...nb] : na;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;

  const toPts = (vals: number[]) =>
    vals
      .map(
        (v, i) =>
          `${pad + (i / (vals.length - 1)) * (width - 2 * pad)},${
            pad + (1 - (v - min) / span) * (height - 2 * pad)
          }`,
      )
      .join(" ");

  const endA = na[na.length - 1] - 100;
  const endB = nb ? nb[nb.length - 1] - 100 : null;
  const colA = endA >= 0 ? "#16a34a" : "#dc2626";

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
        {/* 100 % baseline */}
        <line
          x1={pad}
          x2={width - pad}
          y1={pad + (1 - (100 - min) / span) * (height - 2 * pad)}
          y2={pad + (1 - (100 - min) / span) * (height - 2 * pad)}
          stroke="#e6e8ec"
          strokeDasharray="4 4"
        />
        {nb && (
          <polyline
            points={toPts(nb)}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1.8"
            strokeDasharray="5 4"
            strokeLinejoin="round"
          />
        )}
        <polyline
          points={toPts(na)}
          fill="none"
          stroke={colA}
          strokeWidth="2.4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1 w-5 rounded-full" style={{ backgroundColor: colA }} />
          <span className="font-medium text-ink">{labelA}</span>
          <span className="font-semibold" style={{ color: colA }}>
            {endA >= 0 ? "+" : ""}
            {endA.toFixed(1)} %
          </span>
        </span>
        {nb && labelB && endB !== null && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0 w-5 border-t-2 border-dashed border-slate-400" />
            <span className="text-subtle">{labelB}</span>
            <span className="font-semibold text-slate-500">
              {endB >= 0 ? "+" : ""}
              {endB.toFixed(1)} %
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
