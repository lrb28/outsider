import type { Metadata } from "next";
import { DataStatus } from "@/components/DataStatus";
export const metadata: Metadata = { title: "Data status" };
export default function Status() { return <div className="space-y-6"><div><h1 className="large-title">How current is the data?</h1><p className="mt-3 max-w-2xl text-subtle">Sources are updated independently. The latest filing alone says nothing about whether every source is complete.</p></div><DataStatus detailed /></div>; }
