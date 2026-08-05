export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200/70 ${className}`} />;
}

// A card with several shimmer rows — matches the list layouts.
export function SkeletonList({ n = 6 }: { n?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-card">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-hair px-4 py-3 last:border-0">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-1/5" />
          </div>
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

// A detail-page header + block shimmer.
export function SkeletonPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <Skeleton className="h-24 w-full rounded-2xl" />
      <SkeletonList n={5} />
    </div>
  );
}
