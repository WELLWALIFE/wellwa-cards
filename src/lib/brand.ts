// White-label brand lookup for server-rendered pages.
//
// Middleware rewrites rajkumar.wellwalife.com → /c/rajkumar, so by the time a
// page renders the URL no longer says which partner the visitor arrived
// through. The original Host header does, and that's what this reads.

import { PLATFORM_HOSTS } from "@/lib/site-url";
import type { CardBrand } from "@/components/card-view";

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export type Brand = CardBrand & { slug: string; baseDomain: string; themeColor: string };

/** One-line share description for a card (WhatsApp/FB/LinkedIn preview text).
 *  The member's own SEO description wins; otherwise a brand-specific line that
 *  says what the visitor will find — never a repeat of the job title. */
export function shareBlurb(
  brand: { slug: string; name: string } | null,
  card: { name?: string; seoDescription?: string; tagline?: string; jobTitle?: string; company?: string } | null,
): string {
  const own = card?.seoDescription?.trim();
  if (own) return own;
  const who = (card?.name ?? "").trim();
  if (brand?.slug === "wellwa-life") {
    return `Wellwa smart alkaline water ionizers — models, technology, benefits, offers & business plan. Tap to view${who ? ` and save ${who}'s contact` : ""}.`;
  }
  if (brand) return `${brand.name} — products, offers and contact details from ${card?.name ?? "our team"}, all in one tap.`;
  // Platform card: use the tagline unless it just repeats the title.
  const tag = card?.tagline?.trim() ?? "";
  const title = `${card?.jobTitle ?? ""} ${card?.company ?? ""}`.toLowerCase();
  const dup = tag && tag.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ").filter(Boolean).every((w) => title.includes(w));
  return tag && !dup ? tag : `Products, services and contact details from ${card?.name ?? "our team"} — save the contact in one tap.`;
}

/** The active brand whose domain this request came in on, or null. */
export async function brandForHost(host: string | null): Promise<Brand | null> {
  const h = (host ?? "").toLowerCase().split(":")[0];
  if (!h || !SUPA || !ANON) return null;
  // Platform hosts are never a partner.
  if (PLATFORM_HOSTS.has(h) || h.startsWith("localhost")) return null;

  try {
    const r = await fetch(
      `${SUPA}/rest/v1/brands?active=is.true&select=slug,name,base_domain,logo_url,theme_color,hide_platform_branding`,
      { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` }, next: { revalidate: 300 } },
    );
    if (!r.ok) return null;
    const rows = (await r.json()) as {
      slug: string; name: string; base_domain: string;
      logo_url: string | null; theme_color: string; hide_platform_branding: boolean;
    }[];
    // Longest domain first so a partner on card.example.com wins over example.com.
    const match = rows
      .sort((a, b) => b.base_domain.length - a.base_domain.length)
      .find((b) => h === b.base_domain || h.endsWith(`.${b.base_domain}`));
    if (!match) return null;
    return {
      slug: match.slug,
      name: match.name,
      baseDomain: match.base_domain,
      logoUrl: match.logo_url,
      themeColor: match.theme_color,
      hideBranding: match.hide_platform_branding,
    };
  } catch {
    return null; // a branding lookup must never take the card page down
  }
}
