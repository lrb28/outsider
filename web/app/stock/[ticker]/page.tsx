"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ErrorRetry } from "@/components/ErrorRetry";
import { SkeletonPage } from "@/components/Skeleton";
import { loadStock, StockView } from "@/components/StockView";
import { DetailTopBar } from "@/components/ui";
import type { StockDetail } from "@/lib/types";

export default function StockPage() {
  const params = useParams<{ ticker: string }>();
  const ticker = params?.ticker as string;
  const [stock, setStock] = useState<StockDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!ticker) return;
    let live = true;
    setLoading(true);
    setErr(false);
    loadStock(ticker, tick > 0)
      .then((d) => live && setStock(d))
      .catch(() => live && setErr(true))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [ticker, tick]);

  if (loading) return <SkeletonPage />;
  if (err) return <ErrorRetry onRetry={() => setTick((t) => t + 1)} />;
  if (!stock)
    return (
      <div className="py-16 text-center text-[15px] text-subtle">
        Stock not found.{" "}
        <Link href="/discover" className="text-ink underline">
          Back to Discover
        </Link>
      </div>
    );

  return <StockView key={stock.ticker ?? ticker} stock={stock} actions top={<DetailTopBar back="/discover?tab=stocks" label="Stocks" />} />;
}
