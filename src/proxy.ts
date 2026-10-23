// Custom-domain routing for verified customer domains and white-label brands.
import { PLATFORM_HOSTS, SITE_HOST, SITE_URL } from "@/lib/site-url";
import { NextResponse, type NextRequest } from "next/server";

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const OWN = new Set([...PLATFORM_HOSTS, "localhost", "127.0.0.1"]);
const cache = new Map<string, { username: string | null; own: boolean; at: number }>();
const TTL = 60_000;
const MAX_CACHE = 1000;

/** The card served on this host, and whether the host is the member's OWN domain (not a white-label brand's subdomain). */
async function resolveDomain(host: string): Promise<{ username: string | null; own: boolean } | null> {
  const hit = cache.get(host);
  if (hit && Date.now() - hit.at < TTL) return hit;
  if (!SUPA || !ANON) return null;

  const auth = { apikey: ANON, Authorization: `Bearer ${ANON}` };
  let username: string | null = null;
  let own = false;
  try {
    const exact = await fetch(
      `${SUPA}/rest/v1/card_domains?domain=eq.${encodeURIComponent(host)}&verified=is.true&select=username`,
      { headers: auth, cache: "no-store" },
    );
    if (exact.ok) username = ((await exact.json()) as { username: string }[])[0]?.username ?? null;
    own = !!username;

    if (!username) {
      const brand = await fetch(`${SUPA}/rest/v1/rpc/resolve_brand_host`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ p_host: host }),
        cache: "no-store",
      });
      if (brand.ok) username = ((await brand.json()) as { username: string }[])[0]?.username ?? null;
    }
  } catch {
    return null;
  }

  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string);
  const got = { username, own, at: Date.now() };
  cache.set(host, got);
  return got;
}

export async function proxy(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];
  // One address for search engines: www → bare domain.
  if (host === `www.${SITE_HOST}`) return NextResponse.redirect(`${SITE_URL}${req.nextUrl.pathname}${req.nextUrl.search}`, 301);
  if (!host || OWN.has(host) || host.length > 253 || !/^[a-z0-9.-]+$/.test(host)) return NextResponse.next();

  const got = await resolveDomain(host);
  const username = got?.username ?? null;
  if (!username) return NextResponse.next();
  const url = req.nextUrl.clone();
  const p = url.pathname;
  // On a member's own address only the card and the app itself exist. Any
  // other path (a link a bot or a customer typed, an old page, a typo) shows
  // the card — never the platform's marketing pages, 404 page or their OG tags.
  const passThrough = /^\/(c\/|api\/|_next\/|wellwa\/|poster(\/|$)|login|signup|dashboard|cards|settings|leads|ads|analytics|whatsapp|tools|ai|studio|partner|admin|privacy|icon\.svg|favicon\.ico|robots\.txt|sitemap\.xml)/.test(p)
    || /\.[a-z0-9]{2,5}$/i.test(p);
  // "/products" on the owner's domain is that page of the card (each page has its own address for search engines).
  const page = /^\/[a-z0-9][a-z0-9_-]{0,60}\/?$/i.exec(p) ? p.replace(/\/$/, "") : "";
  url.pathname = passThrough ? p : `/c/${username}${page}`;
  if (passThrough || !got?.own) return NextResponse.rewrite(url);
  // The member's own domain (owner, 23 Oct 2026): the plain address is the WEBSITE on every screen; ?view=card is the card. The
  // choice is kept for the visit (cookie), so the card's own page links (which carry no ?view) stay on the card.
  const want = url.searchParams.get("view");
  const headers = new Headers(req.headers);
  headers.set("x-own-domain", "1");
  const res = NextResponse.rewrite(url, { request: { headers } });
  if (want === "card" || want === "site") res.cookies.set("sv", want, { path: "/", maxAge: 60 * 60, sameSite: "lax", secure: true, httpOnly: true });
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api|art|favicon.ico|robots.txt|sitemap.xml).*)"],
};
