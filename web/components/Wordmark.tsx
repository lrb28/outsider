import { WORDMARK_HEIGHT, WORDMARK_PATH, WORDMARK_WIDTH } from "@/lib/wordmark";

/**
 * The ĀURA wordmark: one flat path in the current text colour. No effects —
 * it follows light and dark mode through `currentColor`.
 */
export function Wordmark({ height = 18, fluid = false, className = "" }: { height?: number; fluid?: boolean; className?: string }) {
  const width = (height * WORDMARK_WIDTH) / WORDMARK_HEIGHT;
  const box = fluid ? { width: "100%", aspectRatio: `${WORDMARK_WIDTH} / ${WORDMARK_HEIGHT}` } : { width, height };
  return (
    <svg
      role="img"
      aria-label="AURA"
      viewBox={`0 0 ${WORDMARK_WIDTH} ${WORDMARK_HEIGHT}`}
      style={box}
      className={`block shrink-0 fill-current ${className}`}
    >
      <path d={WORDMARK_PATH} />
    </svg>
  );
}
