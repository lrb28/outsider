import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // neutral, placeholder palette — naming/design intentionally open
        ink: "#0d1117",
        panel: "#161b22",
        edge: "#232a33",
        muted: "#8b949e",
        bull: "#2ea043",
        bear: "#f85149",
      },
    },
  },
  plugins: [],
};

export default config;
