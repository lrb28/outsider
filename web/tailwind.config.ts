import type { Config } from "tailwindcss";

// Every colour is a CSS variable (app/globals.css) so light and dark mode swap
// in one place. Values are "R G B" triplets, which keeps Tailwind's opacity
// modifiers working (bg-ink/5, text-bull/80 …).
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

// Neutral ramp shared by the old slate/zinc utilities: it follows the theme,
// so bg-slate-100 is a light fill in light mode and a dark fill in dark mode.
const neutral = Object.fromEntries(
  [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((step) => [step, v(`n-${step}`)]),
);

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: v("bg"),
        card: v("surface"),
        surface2: v("surface-2"),
        ink: v("ink"),
        subtle: v("subtle"),
        muted: v("muted"),
        hair: v("hair"),
        // Monochrome primary action: black in light mode, white in dark mode.
        brand: v("brand"),
        "brand-hover": v("brand-hover"),
        "on-brand": v("on-brand"),
        // Price moves. Text steps meet 4.5:1; *-fill steps are for marks.
        bull: v("bull"),
        "bull-fill": v("bull-fill"),
        bear: v("bear"),
        "bear-fill": v("bear-fill"),
        warn: v("warn"),
        // The three auras: who disclosed. Identity colours, validated for
        // colour-vision deficiency in both modes (see docs/brand.md).
        investor: v("aura-investor"),
        insider: v("aura-insider"),
        politician: v("aura-politician"),
        accent: v("aura-investor"),
        slate: neutral,
        zinc: neutral,
      },
      boxShadow: {
        card: "var(--shadow-card)",
        cardhover: "var(--shadow-card-hover)",
        float: "var(--shadow-float)",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", '"SF Pro Text"', '"Inter Tight"', '"Segoe UI"', "Roboto", "Helvetica", "Arial", "sans-serif"],
        display: ['"Inter Tight"', "-apple-system", "BlinkMacSystemFont", '"SF Pro Display"', "system-ui", "sans-serif"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      transitionTimingFunction: {
        // iOS-like spring: quick start, long soft landing.
        spring: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
