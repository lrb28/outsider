// Categorical colours for charts, as CSS colour strings that follow light and
// dark mode (tokens in app/globals.css). Assign in this order and never cycle:
// past eight, fold the tail into "Übrige" (OTHER).
export const CAT = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `rgb(var(--cat-${i}))`);
export const OTHER = "rgb(var(--cat-other))";

export const AURA = {
  investor: "rgb(var(--aura-investor))",
  insider: "rgb(var(--aura-insider))",
  politician: "rgb(var(--aura-politician))",
} as const;

export const UP = "rgb(var(--bull-fill))";
export const DOWN = "rgb(var(--bear-fill))";
