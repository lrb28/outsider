import Link from "next/link";
export function SampleBanner({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return <div className="border-b border-amber-200 bg-amber-50" role="status">
    <div className="mx-auto flex max-w-5xl flex-wrap gap-x-3 gap-y-1 px-4 py-3 text-sm text-amber-900">
      <strong>Demo-Modus</strong>
      <span>Die Rechercheansichten zeigen Beispieldaten, keine aktuellen Meldungen.</span>
      <Link href="/methodik" className="font-medium underline">Daten verstehen</Link>
    </div>
  </div>;
}
