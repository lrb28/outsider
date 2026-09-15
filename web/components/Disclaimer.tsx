import Link from "next/link";
export function Disclaimer() {
  return <div className="text-xs leading-relaxed text-subtle"><strong className="font-medium text-ink">Zur Information, keine Anlageberatung.</strong>{" "}Meldungsdaten basieren auf öffentlichen Offenlegungen und können verzögert oder unvollständig sein. 13F-Berichte zeigen nur bestimmte gemeldete Bestände. Kurse und redaktionelle Zuordnungen sind keine Originalausführungen. <Link href="/methodik" className="underline">Quellen und Methodik</Link><span className="mt-2 block text-[11px]">Firmenlogos: Parqet · Financial Modeling Prep. Personenbilder: Wikimedia Commons. Beispieldaten sind als Demo gekennzeichnet.</span></div>;
}
