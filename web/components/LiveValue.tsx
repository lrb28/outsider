"use client";

import { useEffect, useRef, useState } from "react";

import { RollingNumber } from "@/components/RollingNumber";

/**
 * Der Depotwert auf den Cent genau. Beim ersten Erscheinen rollen die Ziffern
 * von null hoch, bei jeder Kursaktualisierung rollen nur die Stellen, die sich
 * ändern (wie ein Zählwerk) – statt dass die ganze Zahl springt.
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
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const last = useRef<number | null>(null);

  useEffect(() => {
    const prev = last.current;
    last.current = value;
    if (prev === null || Math.abs(value - prev) < 0.01) return;
    setFlash(value > prev ? "up" : "down");
    const t = setTimeout(() => setFlash(null), 1100);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <RollingNumber
      value={format(value)}
      duration={duration}
      rollIn
      className={`transition-colors duration-500 ${className} ${flash === "up" ? "text-bull" : flash === "down" ? "text-bear" : ""}`}
    />
  );
}
