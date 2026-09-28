import { ImageResponse } from "next/og";

import { WORDMARK_HEIGHT, WORDMARK_PATH, WORDMARK_WIDTH } from "@/lib/wordmark";

export const alt = "Outsider – Öffentliche Meldungen verstehen";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Graphite card with the OUTSIDER wordmark in chrome glass.
export default function Image() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 80, color: "white", background: "radial-gradient(circle at 85% 0%, #48484a 0%, #1c1c1e 45%, #0e0e10 100%)" }}>
      <svg width="760" height={(760 * WORDMARK_HEIGHT) / WORDMARK_WIDTH} viewBox={`0 0 ${WORDMARK_WIDTH} ${WORDMARK_HEIGHT}`}>
        <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset=".5" stopColor="#d1d1d6" /><stop offset="1" stopColor="#8e8e93" /></linearGradient></defs>
        <path fill="url(#g)" fillRule="evenodd" d={WORDMARK_PATH} />
      </svg>
      <div style={{ display: "flex", flexDirection: "column", fontSize: 64, fontWeight: 700, lineHeight: 1.08, letterSpacing: -2 }}>
        <span>Die Meldung dahinter.</span>
        <span style={{ color: "#aeaeb2" }}>Dein eigener Blick.</span>
      </div>
      <div style={{ fontSize: 24, letterSpacing: 4, color: "#c7c7cc" }}>INVESTOREN · UNTERNEHMENSINSIDER · US-POLITIKER</div>
    </div>,
    size,
  );
}
