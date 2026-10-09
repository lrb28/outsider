"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { ErrorRetry } from "@/components/ErrorRetry";
import { FollowButton } from "@/components/FollowButton";
import { InvestorView, loadInvestor } from "@/components/InvestorView";
import { SkeletonPage } from "@/components/Skeleton";
import { DetailTopBar } from "@/components/ui";
import type { InvestorDetail } from "@/lib/types";
import { swipeHref } from "@/lib/watchlist";

export default function InvestorPage() {
  return (
    <Suspense fallback={<SkeletonPage />}>
      <Investor />
    </Suspense>
  );
}

function Investor() {
  const params = useParams<{ slug: string }>();
  const query = useSearchParams();
  const router = useRouter();
  const slug = params?.slug as string;
  // Links from before the swipe view moved to the star tab (2026-10-09).
  const fromWatchlist = query?.get("from") === "watchlist";
  useEffect(() => {
    if (fromWatchlist && slug) router.replace(swipeHref({ kind: "investor", slug }));
  }, [fromWatchlist, router, slug]);
  if (fromWatchlist) return <SkeletonPage />;
  return <InvestorScreen slug={slug} />;
}

function InvestorScreen({ slug }: { slug: string }) {
  const [inv, setInv] = useState<InvestorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!slug) return;
    let live = true;
    setLoading(true);
    setErr(false);
    loadInvestor(slug, tick > 0)
      .then((d) => live && setInv(d))
      .catch(() => live && setErr(true))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [slug, tick]);

  if (loading) return <SkeletonPage />;
  if (err) return <ErrorRetry onRetry={() => setTick((t) => t + 1)} />;
  if (!inv)
    return (
      <div className="py-16 text-center text-[15px] text-subtle">
        Investor not found.{" "}
        <Link href="/discover" className="text-ink underline">
          Back to Discover
        </Link>
      </div>
    );

  return <InvestorView inv={inv} top={<DetailTopBar back="/discover?tab=investors" label="Investors" action={<FollowButton kind="investor" id={inv.slug} />} />} />;
}
