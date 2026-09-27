"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";

/**
 * Waagerechte Kartenreihe zum Wischen.
 *
 * Ohne Hinweis sieht eine angeschnittene Karte am rechten Rand nach einem
 * Layoutfehler aus statt nach „hier geht es weiter". Deshalb blendet die Reihe
 * an der Seite aus, an der noch etwas kommt — und nur dort. Am Anfang und am
 * Ende der Reihe verschwindet die Blende wieder, sonst wirkte die letzte Karte
 * dauerhaft verwaschen.
 *
 * Die Scrollleiste selbst bleibt ausgeblendet (no-scrollbar), damit auf dem Mac
 * keine graue Leiste unter den Karten steht.
 */
export function SwipeRow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // 4 px Toleranz: Browser runden die Scrollposition, sonst flackert die
    // Blende am Ende der Reihe.
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEdges((p) => (p.left === left && p.right === right ? p : { left, right }));
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [update]);

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={update}
        className={`no-scrollbar -mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-1 ${className}`}
      >
        {children}
      </div>
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#f6f7fb] to-transparent transition-opacity duration-200 ${
          edges.left ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#f6f7fb] to-transparent transition-opacity duration-200 ${
          edges.right ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
