import { useId } from "react";

import { WORDMARK_HEIGHT, WORDMARK_PATH, WORDMARK_WIDTH } from "@/lib/wordmark";

const VIEWBOX = `0 0 ${WORDMARK_WIDTH} ${WORDMARK_HEIGHT}`;
const MASK = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}"><path fill-rule="evenodd" d="${WORDMARK_PATH}"/></svg>`,
)}")`;

/**
 * The OUTSIDER wordmark in liquid glass.
 *
 * - "smoke": graphite glass for light surfaces such as the header — dark body,
 *   a specular bevel from an SVG lighting filter, a bright rim and a slow
 *   sheen that travels across the letters.
 * - "clear": transparent glass for colourful backgrounds. The letters are a
 *   masked backdrop blur, so whatever lies behind shows through them frosted
 *   and brightened, with the same bevel and rim on top.
 */
export function Wordmark({ height = 20, fluid = false, variant = "smoke", className = "" }: { height?: number; fluid?: boolean; variant?: "smoke" | "clear"; className?: string }) {
  const id = useId().replace(/:/g, "");
  const width = (height * WORDMARK_WIDTH) / WORDMARK_HEIGHT;
  // Fluid: fills its container's width, height follows the aspect ratio.
  const box = fluid ? { width: "100%", aspectRatio: `${WORDMARK_WIDTH} / ${WORDMARK_HEIGHT}` } : { width, height };
  const overlay = (
    <svg viewBox={VIEWBOX} width="100%" height="100%" aria-hidden="true" className="absolute inset-0 overflow-visible">
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#636366" />
          <stop offset="0.48" stopColor="#1c1c1e" />
          <stop offset="1" stopColor="#0b0b0c" />
        </linearGradient>
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity={variant === "smoke" ? 0.42 : 0.7} />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-gloss`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={variant === "smoke" ? 0.38 : 0.75} />
          <stop offset="0.42" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id={`${id}-bevel`} x="-5%" y="-20%" width="110%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2.4" result="blur" />
          <feSpecularLighting in="blur" surfaceScale="5" specularConstant="1.05" specularExponent="26" lightingColor="#ffffff" result="spec">
            <feDistantLight azimuth="235" elevation="50" />
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceAlpha" operator="in" result="lit" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="lit" />
          </feMerge>
        </filter>
        <clipPath id={`${id}-clip`}>
          <path fillRule="evenodd" d={WORDMARK_PATH} />
        </clipPath>
      </defs>
      <path
        fillRule="evenodd"
        d={WORDMARK_PATH}
        fill={variant === "smoke" ? `url(#${id}-body)` : "rgb(255 255 255 / 0.12)"}
        filter={`url(#${id}-bevel)`}
      />
      <g clipPath={`url(#${id}-clip)`}>
        <rect x="0" y="0" width={WORDMARK_WIDTH} height={WORDMARK_HEIGHT} fill={`url(#${id}-gloss)`} />
        <rect className="wordmark-sheen" x={-WORDMARK_WIDTH * 0.35} y="-10" width={WORDMARK_WIDTH * 0.3} height="120" fill={`url(#${id}-sheen)`} transform="skewX(-18)" />
      </g>
      <path fillRule="evenodd" d={WORDMARK_PATH} fill="none" stroke="#fff" strokeOpacity={variant === "smoke" ? 0.3 : 0.85} strokeWidth="1.4" />
      {variant === "clear" && <path fillRule="evenodd" d={WORDMARK_PATH} fill="none" stroke="#1c1c1e" strokeOpacity="0.22" strokeWidth="1" transform="translate(0 1.4)" />}
    </svg>
  );
  return (
    <span role="img" aria-label="Outsider" className={`relative ${fluid ? "block" : "inline-block"} shrink-0 ${className}`} style={box}>
      {variant === "clear" && (
        <svg viewBox={VIEWBOX} width="100%" height="100%" aria-hidden="true" className="absolute inset-0 translate-y-[3%] overflow-visible blur-[3px]">
          <path fillRule="evenodd" d={WORDMARK_PATH} fill="rgb(28 28 30 / 0.14)" />
        </svg>
      )}
      {variant === "clear" && (
        <span
          aria-hidden="true"
          className="wordmark-glass absolute inset-0"
          style={{ WebkitMaskImage: MASK, maskImage: MASK, WebkitMaskSize: "100% 100%", maskSize: "100% 100%" }}
        />
      )}
      {overlay}
    </span>
  );
}
