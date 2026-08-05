import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f5f6f8",
        card: "#ffffff",
        ink: "#0f172a",
        subtle: "#64748b",
        hair: "#e6e8ec",
        brand: "#4f46e5",
        bull: "#16a34a",
        bear: "#dc2626",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)",
        cardhover: "0 4px 12px rgba(15,23,42,0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
