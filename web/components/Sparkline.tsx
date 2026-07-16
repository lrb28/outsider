import { PriceBar } from "@/lib/types";

// Lightweight price sparkline (pure SVG). Marks the disclosure date with a dot
// and shades the area under the line. Colour follows up/down.
export function Sparkline({
  bars,
  markDate,
  up = true,
  width = 620,
  height = 150,
}: {
  bars: PriceBar[];
  markDate?: string | null;
  up?: boolean;
  width?: number;
  height?: number;
}) {
  if (!bars || bars.length < 2) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-xs text-subtle"
      >
        Kein Kursverlauf verfügbar.
      </div>
    );
  }

  const pad = 6;
  const closes = bars.map((b) => b.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  const n = bars.length;

  const x = (i: number) => pad + (i / (n - 1)) * (width - 2 * pad);
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - 2 * pad);

  const line = bars.map((b, i) => `${x(i)},${y(b.close)}`).join(" ");
  const area = `${x(0)},${height - pad} ${line} ${x(n - 1)},${height - pad}`;

  let markIdx = -1;
  if (markDate) {
    for (let i = 0; i < n; i++) {
      if (bars[i].date >= markDate) {
        markIdx = i;
        break;
      }
    }
  }

  const stroke = up ? "#16a34a" : "#dc2626";
  const gid = `spark-${up ? "u" : "d"}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gid})`} />
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {markIdx >= 0 && (
        <g>
          <line
            x1={x(markIdx)}
            y1={pad}
            x2={x(markIdx)}
            y2={height - pad}
            stroke={stroke}
            strokeOpacity="0.35"
            strokeDasharray="3 3"
          />
          <circle cx={x(markIdx)} cy={y(bars[markIdx].close)} r="4.5" fill={stroke} stroke="#fff" strokeWidth="2" />
        </g>
      )}
    </svg>
  );
}
