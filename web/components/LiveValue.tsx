"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Zeigt den Depotwert auf den Cent genau und läuft bei jeder Kursaktualisierung
 * weich zum neuen Stand — statt zu springen. Beim ersten Erscheinen zählt die
 * Zahl von null hoch.
 *
 * Kurz nach einer Änderung leuchtet der Wert in Grün oder Rot auf, damit man
 * die Richtung sieht, ohne hinzustarren.
 */
export function LiveValue({
  value,
  format,
  className = "",
  duration = 700,
}: {
  value: number;
  format: (v: number) => string;
  className?: string;
  duration?: number;
}) {
  const [shown, setShown] = useState(0);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const from = useRef(0);
  const raf = useRef<number>();
  const first = useRef(true);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const start = from.current;
    const delta = value - start;
    if (Math.abs(delta) < 0.005) {
      from.current = value;
      setShown(value);
      return;
    }

    if (!first.current && Math.abs(delta) >= 0.01) {
      setFlash(delta > 0 ? "up" : "down");
      const t = setTimeout(() => setFlash(null), 1100);
      if (reduce) {
        from.current = value;
        setShown(value);
        return () => clearTimeout(t);
      }
    }
    first.current = false;

    if (reduce) {
      from.current = value;
      setShown(value);
      return;
    }

    let t0: number | null = null;
    const tick = (ts: number) => {
      if (t0 === null) t0 = ts;
      const p = Math.min(1, (ts - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(start + delta * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, duration]);

  return (
    <span
      className={`tabular-nums transition-colors duration-500 ${className} ${
        flash === "up" ? "text-bull" : flash === "down" ? "text-bear" : ""
      }`}
    >
      {format(shown)}
    </span>
  );
}
