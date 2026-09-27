import { ImageResponse } from "next/og";
export const alt = "Outsider – Öffentliche Meldungen verstehen";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Graphite card with the chrome Outsider mark (ring + the sphere outside it).
export default function Image() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 80, color: "white", background: "radial-gradient(circle at 85% 0%, #48484a 0%, #1c1c1e 45%, #0e0e10 100%)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <svg width="88" height="88" viewBox="0 0 512 512">
          <defs><linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset=".45" stopColor="#c7c7cc" /><stop offset=".7" stopColor="#8e8e93" /><stop offset="1" stopColor="#e5e5ea" /></linearGradient></defs>
          <path fill="url(#m)" fillRule="evenodd" d="M40,286a186,186 0 1,0 372,0a186,186 0 1,0 -372,0zM122,286a104,104 0 1,1 208,0a104,104 0 1,1 -208,0z" />
          <circle cx="418" cy="96" r="60" fill="url(#m)" />
        </svg>
        <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>Outsider</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
        <span>Die Meldung dahinter.</span>
        <span style={{ color: "#aeaeb2" }}>Dein eigener Blick.</span>
      </div>
      <div style={{ fontSize: 26, color: "#c7c7cc" }}>Investoren · Unternehmensinsider · US-Politiker</div>
    </div>,
    size,
  );
}
