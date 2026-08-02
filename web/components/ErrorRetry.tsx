"use client";

export function ErrorRetry({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="fade-up rounded-3xl bg-white/80 p-10 text-center shadow-card ring-1 ring-black/5 backdrop-blur">
      <div className="text-sm font-medium text-ink">Verbindung kurz abgerissen.</div>
      <p className="mt-1 text-sm text-subtle">Das passiert selten — einmal neu versuchen hilft.</p>
      <button onClick={onRetry} className="btn-primary mt-4">
        Erneut versuchen
      </button>
    </div>
  );
}
