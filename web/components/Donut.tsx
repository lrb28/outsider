export interface DonutSeg {
  label: string;
  value: number;
  color: string;
}

// Simple SVG donut chart with a centred label.
export function Donut({
  segments,
  size = 150,
  thickness = 18,
  centerTop,
  centerBottom,
}: {
  segments: DonutSeg[];
  size?: number;
  thickness?: number;
  centerTop?: string;
  centerBottom?: string;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef1f5" strokeWidth={thickness} />
        {segments.map((s, i) => {
          const len = (s.value / total) * c;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
      </g>
      {centerTop && (
        <text
          x="50%"
          y="47%"
          textAnchor="middle"
          className="fill-ink"
          style={{ fontSize: size * 0.2, fontWeight: 700 }}
        >
          {centerTop}
        </text>
      )}
      {centerBottom && (
        <text
          x="50%"
          y="62%"
          textAnchor="middle"
          className="fill-subtle"
          style={{ fontSize: size * 0.09 }}
        >
          {centerBottom}
        </text>
      )}
    </svg>
  );
}
