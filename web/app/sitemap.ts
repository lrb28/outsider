import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap { return ["", "/discover", "/feed", "/methodik", "/status", "/datenschutz"].map(path => ({ url: `https://outsider-tracker.vercel.app${path}` })); }
