import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { PLATFORM_HOSTS } from "@/lib/site-url";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

// Per host: on an owner's own domain the sitemap is that domain's own (only their card's pages).
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = ((await headers()).get("host") ?? "").toLowerCase().split(":")[0];
  const own = !!host && !PLATFORM_HOSTS.has(host) && !host.startsWith("localhost") && host !== "127.0.0.1";
  const origin = own ? `https://${host}` : SITE;
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/dashboard", "/admin", "/api", "/cards", "/poster", "/settings", "/login", "/signup"] },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
