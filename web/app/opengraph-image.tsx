import { ImageResponse } from "next/og";

import { MARK_PATH, MARK_X, MARK_Y, WORD_PATH, WORDMARK_HEIGHT, WORDMARK_WIDTH } from "@/lib/wordmark";

export const alt = "Outsider – what investors, insiders and politicians disclose";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Share card: the white wordmark over the three auras on black.
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        color: "white",
        backgroundColor: "#050506",
        backgroundImage:
          "radial-gradient(circle at 18% 30%, rgba(57,135,229,0.85) 0%, rgba(57,135,229,0) 42%), radial-gradient(circle at 62% 12%, rgba(235,104,52,0.8) 0%, rgba(235,104,52,0) 38%), radial-gradient(circle at 78% 88%, rgba(213,95,174,0.85) 0%, rgba(213,95,174,0) 45%)",
      }}
    >
      <svg width="520" height={(520 * WORDMARK_HEIGHT) / WORDMARK_WIDTH} viewBox={`0 0 ${WORDMARK_WIDTH} ${WORDMARK_HEIGHT}`}>
        <path fill="#ffffff" d={WORD_PATH} />
        <path fill="#ffffff" transform={`translate(${MARK_X} ${MARK_Y})`} d={MARK_PATH} />
      </svg>
      <div style={{ display: "flex", flexDirection: "column", fontSize: 76, fontWeight: 700, lineHeight: 1.02, letterSpacing: -3 }}>
        <span>See what the powerful buy.</span>
      </div>
      <div style={{ fontSize: 26, letterSpacing: 3, color: "rgba(255,255,255,0.78)" }}>INVESTORS · INSIDERS · CONGRESS</div>
    </div>,
    size,
  );
}
