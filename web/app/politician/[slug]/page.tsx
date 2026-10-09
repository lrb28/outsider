"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { ErrorRetry } from "@/components/ErrorRetry";
import { FollowButton } from "@/components/FollowButton";
import { loadPolitician, PoliticianView } from "@/components/PoliticianView";
import { SkeletonPage } from "@/components/Skeleton";
import { DetailTopBar } from "@/components/ui";
import type { PoliticianDetail } from "@/lib/types";
import { swipeHref } from "@/lib/watchlist";

export default function PoliticianPage() {
  return (
    <Suspense fallback={<SkeletonPage />}>
      <Politician />
    </Suspense>
  );
}

function Politician() {
  const params = useParams<{ slug: string }>();
  const query = useSearchParams();
  const router = useRouter();
  const slug = params?.slug as string;
  // Links from before the swipe view moved to the star tab (2026-10-09).
  const fromWatchlist = query?.get("from") === "watchlist";
  useEffect(() => {
    if (fromWatchlist && slug) router.replace(swipeHref({ kind: "politician", slug }));
  }, [fromWatchlist, router, slug]);
  if (fromWatchlist) return <SkeletonPage />;
  return <PoliticianScreen slug={slug} />;
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
