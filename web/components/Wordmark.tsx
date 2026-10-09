import type { CSSProperties } from "react";

import { MARK_DOT_R, MARK_DOTS, MARK_SIZE, MARK_X, MARK_Y, WORD_PATH, WORDMARK_HEIGHT, WORDMARK_WIDTH } from "@/lib/wordmark";

function Dots({ x = 0, y = 0, motion }: { x?: number; y?: number; motion?: "pop" | "spin" }) {
  return (
    <g transform={x || y ? `translate(${x} ${y})` : undefined} className={motion ? `mark-${motion}` : undefined}>
      {MARK_DOTS.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={MARK_DOT_R} style={motion ? ({ "--i": i } as CSSProperties) : undefined} />
      ))}
    </g>
  );
}

/**
 * The OUTSIDER wordmark: the word in heavy capitals with the ring of dots
 * beside it, after the Trade Republic wordmark (user, 2026-10-09). Flat, in
 * the current text colour, so it follows light and dark mode. `animate`
 * lets the word come in and the dots pop up one after another, clockwise
 * (welcome screen).
 */
export function Wordmark({ height = 15, fluid = false, animate = false, className = "" }: { height?: number; fluid?: boolean; animate?: boolean; className?: string }) {
  const width = (height * WORDMARK_WIDTH) / WORDMARK_HEIGHT;
  const box = fluid ? { width: "100%", aspectRatio: `${WORDMARK_WIDTH} / ${WORDMARK_HEIGHT}` } : { width, height };
  return (
    <svg role="img" aria-label="Outsider" viewBox={`0 0 ${WORDMARK_WIDTH} ${WORDMARK_HEIGHT}`} style={box} className={`block shrink-0 fill-current ${className}`}>
      <path d={WORD_PATH} className={animate ? "word-in" : undefined} />
      <Dots x={MARK_X} y={MARK_Y} motion={animate ? "pop" : undefined} />
    </svg>
  );
}

/**
 * The mark alone, eight dots in a ring. `spin` makes it an activity
 * indicator: a brighter dot runs round the ring, as in iOS's spinner.
 */
export function Mark({ size = 24, spin = false, className = "" }: { size?: number; spin?: boolean; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${MARK_SIZE} ${MARK_SIZE}`} width={size} height={size} className={`block shrink-0 fill-current ${className}`}>
      <Dots motion={spin ? "spin" : undefined} />
    </svg>
  );
}
