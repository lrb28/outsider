"use client";

import { RollingNumber } from "@/components/RollingNumber";

/** A count whose digits roll up from zero once it scrolls into view. */
export function CountUp({ value, duration = 900, format = (n: number) => Math.round(n).toLocaleString("en-US") }: { value: number; duration?: number; format?: (n: number) => string }) {
  return <RollingNumber value={format(value)} duration={duration} rollIn />;
}
