import type { MetadataRoute } from "next";

// Add to Home Screen / install: opens full screen like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ĀURA — Investoren, Insider und Politiker",
    short_name: "AURA",
    description: "Was Investoren, Unternehmensinsider und US-Abgeordnete offenlegen – verständlich und mit Quelle.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f5f7",
    theme_color: "#f5f5f7",
    lang: "de",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
