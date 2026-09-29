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

  // Fade only the side where more cards follow. A mask fades the cards
  // themselves, so it works on any background, glass included.
  const fade = 28;
  const mask = `linear-gradient(to right, ${edges.left ? "transparent" : "#000"} 0, #000 ${fade}px, #000 calc(100% - ${fade}px), ${edges.right ? "transparent" : "#000"} 100%)`;
  return (
    <div
      ref={ref}
      onScroll={update}
      style={{ WebkitMaskImage: mask, maskImage: mask }}
      // scroll-px keeps the snap point inside the padding; snapping flush to
      // the clip edge cut the first card's corner and switched on the fade.
      className={`no-scrollbar -mx-2 -my-2 flex snap-x scroll-px-2 gap-4 overflow-x-auto px-2 pb-4 pt-2 ${className}`}
    >
      {children}
    </div>
  );
}
