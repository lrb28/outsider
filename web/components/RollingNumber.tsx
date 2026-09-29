"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/*
 * A number whose digits roll like an odometer (from the reference wallet
 * apps): each digit is a column 0–9 that slides to its new value with a
 * short motion blur, digits that appear grow in from zero width and the ones
 * that go shrink away, so "999" becoming "1.000" pushes the number open
 * instead of jumping. Characters line up from the right, where units and
 * decimals sit.
 *
 * The in-flow content of every digit is one invisible glyph, so width and
 * baseline stay those of plain text and it lines up with text beside it.
 */

type Cell = { id: number; ch: string; leaving?: boolean; entering?: boolean };

const isDigit = (c: string) => c >= "0" && c <= "9";
const DIGITS = [..."0123456789"];
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

let nextId = 1;

/** Line the new text up with the shown cells from the right. */
function merge(prev: Cell[], text: string, animate: boolean): Cell[] {
  const chars = [...text];
  const live = prev.filter((c) => !c.leaving);
  const out: Cell[] = [];
  const gone: Cell[] = [];
  for (let k = 0; k < Math.max(chars.length, live.length); k++) {
    const ch = chars[chars.length - 1 - k];
    const old = live[live.length - 1 - k];
    if (ch === undefined) {
      if (old) gone.unshift({ ...old, leaving: true });
      continue;
    }
    if (old && (old.ch === ch || (isDigit(old.ch) && isDigit(ch)))) out.unshift({ id: old.id, ch });
    else {
      if (old) gone.unshift({ ...old, leaving: true });
      out.unshift({ id: nextId++, ch, entering: animate });
    }
  }
  return animate ? [...gone, ...out] : out;
}

function DigitCell({ ch, duration, delay, entering, leaving, onGone }: { ch: string; duration: number; delay: number; entering?: boolean; leaving?: boolean; onGone: () => void }) {
  const cell = useRef<HTMLSpanElement>(null);
  const stack = useRef<HTMLSpanElement>(null);
  const last = useRef(ch);
  const digit = isDigit(ch);

  // Motion blur while the column travels; longer trips blur more.
  useEffect(() => {
    if (!digit || last.current === ch) return;
    const trip = isDigit(last.current) ? Math.abs(Number(ch) - Number(last.current)) : 1;
    last.current = ch;
    if (reduced() || !stack.current?.animate) return;
    stack.current.getAnimations?.().forEach((a) => a.cancel());
    const blur = Math.min(3.5, 0.8 + trip * 0.35);
    stack.current.animate([{ filter: "blur(0px)" }, { filter: `blur(${blur}px)`, offset: 0.3 }, { filter: "blur(0px)" }], { duration: duration * 0.85, delay, easing: "ease-out" });
  }, [ch, digit, duration, delay]);

  useIsoLayoutEffect(() => {
    const el = cell.current;
    if (!entering || !el || reduced() || !el.animate) return;
    const w = el.getBoundingClientRect().width;
    el.animate([{ width: "0px", opacity: 0, transform: "translateY(40%)", filter: "blur(4px)" }, { width: `${w}px`, opacity: 1, transform: "none", filter: "blur(0px)" }], { duration, easing: EASE });
  }, []);

  useIsoLayoutEffect(() => {
    const el = cell.current;
    if (!leaving) return;
    if (!el || reduced() || !el.animate) return onGone();
    const w = el.getBoundingClientRect().width;
    const a = el.animate([{ width: `${w}px`, opacity: 1, transform: "none", filter: "blur(0px)" }, { width: "0px", opacity: 0, transform: "translateY(-40%)", filter: "blur(4px)" }], { duration: duration * 0.75, easing: EASE, fill: "forwards" });
    a.onfinish = onGone;
    return () => {
      a.onfinish = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving]);

  if (!digit) {
    return (
      <span ref={cell} className="inline-block whitespace-pre">
        {ch}
      </span>
    );
  }
  return (
    <span ref={cell} className="relative inline-block whitespace-pre" style={{ clipPath: "inset(-0.04em -0.25em)" }}>
      <span className="invisible">{ch}</span>
      <span
        ref={stack}
        className="absolute inset-x-0 top-0 flex flex-col items-center"
        style={{ transform: `translateY(${-Number(ch) * 10}%)`, transition: `transform ${duration}ms ${EASE} ${delay}ms` }}
      >
        {DIGITS.map((n) => (
          <span key={n} className="block">
            {n}
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * Formatted number with rolling digits. Pass the finished string (German
 * format, units included); only its digits roll.
 */
export function RollingNumber({
  value,
  className = "",
  duration = 700,
  rollIn = false,
  label,
}: {
  value: string;
  className?: string;
  /** Length of one roll in ms; short (≈250) for values that follow a finger. */
  duration?: number;
  /** Roll every digit up from 0 once the number scrolls into view. */
  rollIn?: boolean;
  /** Screen reader text; defaults to the value. */
  label?: string;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const [cells, setCells] = useState<Cell[]>(() => merge([], value, false));
  const [waiting, setWaiting] = useState(rollIn);
  const [intro, setIntro] = useState(false);

  useEffect(() => {
    if (!rollIn) return;
    const el = host.current;
    if (!el || reduced() || typeof IntersectionObserver === "undefined") return setWaiting(false);
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      // Two frames: the zeros must be painted before the columns travel.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setIntro(true);
        setWaiting(false);
      }));
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [rollIn]);

  useEffect(() => {
    if (!intro) return;
    const t = window.setTimeout(() => setIntro(false), duration * 1.6 + 500);
    return () => window.clearTimeout(t);
  }, [intro, duration]);

  useIsoLayoutEffect(() => {
    setCells((prev) => merge(prev, value, !reduced()));
  }, [value]);

  const drop = (id: number) => setCells((prev) => prev.filter((c) => c.id !== id));
  const digits = cells.filter((c) => !c.leaving && isDigit(c.ch)).length;
  let seen = 0;

  return (
    <span ref={host} className={`inline-flex items-baseline tabular-nums ${className}`}>
      <span className="sr-only">{label ?? value}</span>
      <span aria-hidden="true" className="inline-flex items-baseline">
        {cells.map((c) => {
          const order = isDigit(c.ch) && !c.leaving ? seen++ : 0;
          return (
            <DigitCell
              key={c.id}
              ch={waiting && isDigit(c.ch) ? "0" : c.ch}
              // The intro rolls a little slower, left to right, like a counter.
              duration={intro ? duration * 1.6 : duration}
              delay={intro ? Math.round((order / Math.max(1, digits)) * 260) : 0}
              entering={c.entering}
              leaving={c.leaving}
              onGone={() => drop(c.id)}
            />
          );
        })}
      </span>
    </span>
  );
}
