import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots { return { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/me"] }, sitemap: "https://outsider-tracker.vercel.app/sitemap.xml" }; }
