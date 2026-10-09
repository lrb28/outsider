"use client";

let toggle: HTMLLabelElement | null = null;

/**
 * A light haptic tick. Android has navigator.vibrate; Safari on iOS has no
 * vibration API, but since iOS 18 flipping an `<input switch>` plays the
 * system's selection haptic, so a hidden one is flipped instead. Does nothing
 * where neither exists (desktop).
 */
export function haptic() {
  try {
    if (typeof navigator.vibrate === "function") {
      navigator.vibrate(8);
      return;
    }
    if (!toggle) {
      toggle = document.createElement("label");
      toggle.setAttribute("aria-hidden", "true");
      toggle.style.display = "none";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.tabIndex = -1;
      input.setAttribute("switch", "");
      toggle.appendChild(input);
      document.body.appendChild(toggle);
    }
    toggle.click();
  } catch {
    /* no haptics here */
  }
}
