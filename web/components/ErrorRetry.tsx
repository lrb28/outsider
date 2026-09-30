"use client";

export function ErrorRetry({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="fade-up rounded-3xl bg-card p-10 text-center shadow-card ">
      <div role="alert" className="text-sm font-medium text-ink">Data is unavailable right now.</div>
      <p className="mt-1 text-sm text-subtle">The request couldn’t be completed. Your selection is kept.</p>
      <button onClick={onRetry} className="btn-primary mt-4">
        Try again
      </button>
    </div>
  );
}
