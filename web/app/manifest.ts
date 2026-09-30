import type { MetadataRoute } from "next";

// Add to Home Screen / install: opens full screen like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ĀURA — investors, insiders and politicians",
    short_name: "AURA",
    description: "What investors, corporate insiders and members of the US House disclose — clear and sourced.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f5f7",
    theme_color: "#f5f5f7",
    lang: "en",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
