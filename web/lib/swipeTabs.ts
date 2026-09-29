"use client";

import { useEffect, useRef } from "react";

/*
 * Swiping the page sideways switches tabs. A page's own sections (its
 * ChipBar: Discover sections, Depot sections, Feed filters) register here;
 * the gesture (components/SwipeNav.tsx) steps through them first and moves
 * on to the neighbouring main tab past either end.
 */

type Tabs = { keys: readonly string[]; value: string; onChange: (key: string) => void };

const stack: { current: Tabs }[] = [];
const ENTER = "aura:swipe-enter";

/** Registers a row of tabs with the swipe gesture while it is mounted. */
export function useSwipeTabs(keys: readonly string[], value: string, onChange: (key: string) => void, enabled = true) {
  const ref = useRef<Tabs>({ keys, value, onChange });
  ref.current = { keys, value, onChange };
  useEffect(() => {
    if (!enabled) return;
    const entry = { get current() { return ref.current; } };
    stack.push(entry);
    // Arriving by a swipe to the right starts at the last section, so
    // swiping back and forth retraces the same path.
    try {
      if (sessionStorage.getItem(ENTER) === window.location.pathname) {
        sessionStorage.removeItem(ENTER);
        const { keys: k, value: v, onChange: go } = ref.current;
        if (k.length && v !== k[k.length - 1]) go(k[k.length - 1]);
      }
    } catch {
      /* storage blocked: start at the first section */
    }
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [enabled]);
}

function neighbour(dir: 1 | -1) {
  const tabs = stack[stack.length - 1]?.current;
  if (!tabs) return null;
  const next = tabs.keys.indexOf(tabs.value) + dir;
  return next < 0 || next >= tabs.keys.length ? null : { tabs, key: tabs.keys[next] };
}

/** Whether the page has a section further that way. */
export function canStepTabs(dir: 1 | -1): boolean {
  return neighbour(dir) !== null;
}

/** Steps the page's tabs; false when there is none further that way. */
export function stepTabs(dir: 1 | -1): boolean {
  const n = neighbour(dir);
  if (!n) return false;
  n.tabs.onChange(n.key);
  return true;
}

/** The page at `path` should open on its last section. */
export function enterAtLast(path: string) {
  try {
    sessionStorage.setItem(ENTER, path);
  } catch {
    /* ignore */
  }
}
