import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f2f2f7",
        card: "rgb(255 255 255 / 0.72)",
        ink: "#1c1c1e",
        subtle: "#636366",
        hair: "#e5e5ea",
        // Graphite accent. Buy/sell text colours meet 4.5:1 on white; the
        // brighter fills (#34c759 / #ff3b30) are for dots, bars and charts.
        brand: "#1c1c1e",
        "brand-hover": "#3a3a3c",
        bull: "#248a3d",
        "bull-fill": "#34c759",
        bear: "#d70015",
        "bear-fill": "#ff3b30",
        // Neon lime, used sparingly for data highlights (chart dots, live marks).
        accent: "#d4f24a",
      },
      boxShadow: {
        card: "inset 0 1px 0 rgb(255 255 255 / 0.9), 0 1px 2px rgb(28 28 30 / 0.04), 0 8px 24px rgb(28 28 30 / 0.06)",
        cardhover: "inset 0 1px 0 rgb(255 255 255 / 0.95), 0 2px 6px rgb(28 28 30 / 0.06), 0 16px 40px rgb(28 28 30 / 0.1)",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};

export default config;
