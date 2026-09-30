"use client";

import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";

import { useDragDismiss, useScrollLock } from "@/lib/sheetGestures";

/**
 * A sheet that slides up over the page (iOS "page sheet"). The page behind
 * stays visible but frosted: blurred and softly tinted, so the sheet reads as
 * a layer on top rather than a new page. Bottom sheet on phones, a centred
 * card on wider screens. There is no close button (the user asked for none):
 * it closes with a downward swipe (on the header, or anywhere while the
 * content is at its top; the header can be dragged with a mouse too), a tap
 * outside or Escape. The page behind does not scroll while it is open.
 *
 * Mount it only while open (`{open && <Sheet …/>}`); it animates out itself
 * and calls `onClose` once the animation is done.
 */
export function Sheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = "md",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Sticky area under the scrolling content, e.g. a link to the full page. */
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const scroller = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const close = useCallback(() => {
    if (closing) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return closeRef.current();
    setClosing(true);
    window.setTimeout(() => closeRef.current(), 260);
  }, [closing]);

  useScrollLock();
  useDragDismiss(dialog, scroller, () => closeRef.current());
  useEffect(() => {
    const el = dialog.current;
    const focused = document.activeElement as HTMLElement | null;
    el?.showModal();
    // Focus the sheet itself, not its first button: a ring on the close
    // button as the sheet opens looks like a selection.
    el?.focus({ preventScroll: true });
    return () => {
      el?.close();
      focused?.focus?.({ preventScroll: true });
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      tabIndex={-1}
      data-closing={closing ? "" : undefined}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target !== dialog.current) return;
        const r = dialog.current.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close();
      }}
      className={`sheet bottom-0 top-auto mx-auto my-0 flex max-h-[88dvh] w-full max-w-[100vw] flex-col overflow-hidden rounded-t-[2rem] border-0 bg-card p-0 text-ink shadow-float sm:top-0 sm:m-auto sm:max-h-[80dvh] sm:rounded-[2rem] ${size === "lg" ? "sm:w-[36rem]" : "sm:w-[28rem]"}`}
    >
      <div className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing" data-sheet-grip="">
        <div aria-hidden="true" className="mx-auto mt-2 h-[5px] w-9 rounded-full bg-ink/15" />
        <div className="px-5 pb-3 pt-3">
          <h2 id={titleId} className="font-display text-[22px] font-bold leading-tight tracking-[-0.01em]">{title}</h2>
          {subtitle && <p className="mt-1 text-[14px] leading-snug text-subtle">{subtitle}</p>}
        </div>
        {/* No visible close button: the sheet slides away. VoiceOver and
            keyboard users still get one. */}
        <button type="button" onClick={close} className="sr-only focus:not-sr-only">Close</button>
      </div>
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      {footer && <div className="shrink-0 border-t border-hair px-5 pt-3" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>{footer}</div>}
      {!footer && <div aria-hidden="true" className="shrink-0" style={{ height: "env(safe-area-inset-bottom)" }} />}
    </dialog>
  );
}
