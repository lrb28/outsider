"use client";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div role="alert" className="lcard p-8"><h1 className="text-2xl font-semibold">Diese Ansicht konnte nicht geladen werden.</h1><p className="my-4 text-subtle">Bitte versuche es erneut. Dein lokal gespeichertes Depot bleibt beim Neuladen erhalten.</p><button onClick={reset} className="btn-primary">Erneut versuchen</button></div>;
}
