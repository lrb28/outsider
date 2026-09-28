import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Width of an element in CSS px, kept current with a ResizeObserver, for an
 * element that may mount later than its component (charts first
 * render a placeholder while data loads). A callback ref attaches the observer
 * whenever the element appears; a mount-only effect never saw it and left the
 * chart at its fallback width, wider than the card.
 */
export function useWidth<T extends HTMLElement>(fallback = 640) {
  const [width, setWidth] = useState(fallback);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    const update = () => setWidth(Math.max(1, Math.round(el.getBoundingClientRect().width)));
    update();
    observer.current = new ResizeObserver(update);
    observer.current.observe(el);
  }, []);
  useEffect(() => () => observer.current?.disconnect(), []);
  return { ref, width };
}

/**
 * Smooth path through points that never overshoots (monotone cubic,
 * Fritsch–Carlson), so a smoothed price line never shows a high or low that
 * did not happen.
 */
export function monotonePath(pts: [number, number][]): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;
  if (n === 2) return `M${pts[0][0]},${pts[0][1]}L${pts[1][0]},${pts[1][1]}`;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0]);
    m.push((pts[i + 1][1] - pts[i][1]) / (dx[i] || 1));
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const h = a * a + b * b;
    if (h > 9) {
      const k = 3 / Math.sqrt(h);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const h = dx[i] / 3;
    d += `C${(x0 + h).toFixed(1)},${(y0 + t[i] * h).toFixed(1)} ${(x1 - h).toFixed(1)},${(y1 - t[i + 1] * h).toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return d;
}

/** Up to `count` round tick values covering [min, max]. */
export function niceTicks(min: number, max: number, count = 3): number[] {
  const span = max - min || Math.abs(max) || 1;
  const raw = span / count;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * pow).find((s) => span / s <= count) ?? 10 * pow;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

/** Reduce a long series to at most `max` points, keeping first, last and extremes of each bucket. */
export function downsample<T>(rows: T[], value: (r: T) => number, max = 360): T[] {
  if (rows.length <= max) return rows;
  const bucket = rows.length / (max / 2);
  const out: T[] = [rows[0]];
  for (let b = 0; b < max / 2; b++) {
    const from = Math.floor(b * bucket);
    const to = Math.min(rows.length, Math.floor((b + 1) * bucket));
    let lo = from;
    let hi = from;
    for (let i = from; i < to; i++) {
      if (value(rows[i]) < value(rows[lo])) lo = i;
      if (value(rows[i]) > value(rows[hi])) hi = i;
    }
    for (const i of lo < hi ? [lo, hi] : [hi, lo]) if (out[out.length - 1] !== rows[i]) out.push(rows[i]);
  }
  if (out[out.length - 1] !== rows[rows.length - 1]) out.push(rows[rows.length - 1]);
  return out;
}
