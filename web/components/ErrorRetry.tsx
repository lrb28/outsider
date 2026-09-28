"use client";

export function ErrorRetry({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="fade-up rounded-3xl bg-card p-10 text-center shadow-card ">
      <div role="alert" className="text-sm font-medium text-ink">Daten derzeit nicht erreichbar.</div>
      <p className="mt-1 text-sm text-subtle">Die Anfrage konnte nicht abgeschlossen werden. Deine Auswahl bleibt erhalten.</p>
      <button onClick={onRetry} className="btn-primary mt-4">
        Erneut versuchen
      </button>
    </div>
  );
}
