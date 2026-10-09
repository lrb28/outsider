"use client";

import Link from "next/link";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { ErrorRetry } from "@/components/ErrorRetry";
import { FollowButton } from "@/components/FollowButton";
import { loadPolitician, PoliticianView } from "@/components/PoliticianView";
import { SkeletonPage } from "@/components/Skeleton";
import { DetailTopBar } from "@/components/ui";
import { WatchPager } from "@/components/WatchPager";
import type { PoliticianDetail } from "@/lib/types";
import { personFromPath } from "@/lib/watchlist";

export default function PoliticianPage() {
  return (
    <Suspense fallback={<SkeletonPage />}>
      <Politician />
    </Suspense>
  );
}

function Politician() {
  const params = useParams<{ slug: string }>();
  const path = usePathname() ?? "";
  const query = useSearchParams();
  // Opened from "Your watchlist" on Home: swipe through those people. The
  // path (not the route's params) says who, see the investor page.
  const [fromWatchlist] = useState(() => query?.get("from") === "watchlist");
  if (fromWatchlist) return <WatchPager start={personFromPath(path) ?? { kind: "politician", slug: params?.slug as string }} />;
  return <PoliticianScreen slug={params?.slug as string} />;
}

function PoliticianScreen({ slug }: { slug: string }) {
  const [pol, setPol] = useState<PoliticianDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!slug) return;
    let live = true;
    setLoading(true);
    setErr(false);
    loadPolitician(slug, tick > 0)
      .then((d) => live && setPol(d))
      .catch(() => live && setErr(true))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [slug, tick]);

  if (loading) return <SkeletonPage />;
  if (err) return <ErrorRetry onRetry={() => setTick((t) => t + 1)} />;
  if (!pol)
    return (
      <div className="py-16 text-center text-[15px] text-subtle">
        Politician not found.{" "}
        <Link href="/discover?tab=politicians" className="text-ink underline">Back</Link>
      </div>
    );

  return <PoliticianView pol={pol} top={<DetailTopBar back="/discover?tab=politicians" label="Politicians" action={<FollowButton kind="politician" id={pol.slug} />} />} />;
}
