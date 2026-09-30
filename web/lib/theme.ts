// Appearance: follow the system, or force light or dark (Settings). The
// choice lives in localStorage and is applied as `data-theme` on <html>,
// which the colour tokens in globals.css already honour.

export type Theme = "system" | "light" | "dark";

export const THEME_KEY = "aura:theme";
const BG = { light: "#f5f5f7", dark: "#000000" } as const;

export function getTheme(): Theme {
  try {
    const t = window.localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") {
    delete root.dataset.theme;
    root.style.colorScheme = "";
  } else {
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  }
  // The status bar follows the page colour.
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", dark ? BG.dark : BG.light));
  window.dispatchEvent(new CustomEvent("aura:theme", { detail: theme }));
}

export function setTheme(theme: Theme) {
  try {
    if (theme === "system") window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* storage blocked: applies for this visit only */
  }
  applyTheme(theme);
}

/** Runs in <head> before the first paint, so a forced theme never flashes. */
export const THEME_BOOT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++)m[i].setAttribute("content",t==="dark"?"${BG.dark}":"${BG.light}")}}catch(e){}`;
