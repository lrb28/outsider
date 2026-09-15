import type { Metadata } from "next";
import { DataStatus } from "@/components/DataStatus";
export const metadata: Metadata = { title: "Datenstand" };
export default function Status() { return <div className="space-y-6"><div><h1 className="text-3xl font-semibold tracking-tight">Wie aktuell sind die Daten?</h1><p className="mt-3 max-w-2xl text-subtle">Quellen werden unabhängig aktualisiert. Die jüngste Meldung allein sagt nichts über die Vollständigkeit aller Quellen aus.</p></div><DataStatus detailed /></div>; }
