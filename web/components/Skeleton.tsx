// Loading placeholders with a slow sheen (globals.css .shimmer) that match the
// shape of what is coming, so the page does not jump when data arrives.
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`shimmer rounded-lg ${className}`} />;
}

// A grouped list card with several placeholder rows.
export function SkeletonList({ n = 6 }: { n?: number }) {
  return (
    <div role="status" aria-label="Wird geladen" className="card overflow-hidden">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-hair px-4 py-3 last:border-0">
          <Skeleton className="h-11 w-11 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/5" />
          </div>
          <Skeleton className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  );
}

// A chart placeholder: a faint line sweeping across a card.
export function SkeletonChart({ height = 220 }: { height?: number }) {
  return (
    <div role="status" aria-label="Diagramm wird geladen" className="relative overflow-hidden rounded-2xl" style={{ height }}>
      <Skeleton className="absolute inset-0 rounded-2xl opacity-60" />
      <svg viewBox="0 0 400 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full text-ink/10">
        <path d="M0 70 C 40 60, 60 80, 100 62 S 160 40, 200 50 S 260 70, 300 38 S 360 30, 400 20" fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

// A detail-page header + block placeholder.
export function SkeletonPage() {
  return (
    <div role="status" aria-label="Wird geladen" className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-20 w-20 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-3.5 w-32" />
        </div>
      </div>
      <SkeletonChart height={240} />
      <SkeletonList n={5} />
    </div>
  );
}
