// The Premium website as an APP (owner, 31 Oct 2026: "Premium mein app ka option — site se download kar sake"): a web-app manifest of its
// own per business, so Chrome's "Install app" / "Add to Home Screen" puts THIS business on the customer's phone — its name, its logo as the
// icon, opening on its website. Only a card whose Premium website is live answers; everyone else gets 404 (the page then carries no manifest
// link, so nothing is installable there). The icon is drawn by ./app-icon.
import { fetchCloudCard, getPublicSupabase } from "@/lib/supabase/public";
import { getCardByUsername } from "@/lib/sample-data";
import { activeAdvanced } from "@/lib/site-advanced";
import { publicCard } from "@/lib/site-ready";

const safeHex = (v: unknown) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : "#2f5bf5");

export async function GET(_req: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const raw = (await fetchCloudCard(username)) ?? (getPublicSupabase() ? null : getCardByUsername(username));
  if (!raw) return new Response("Not found", { status: 404 });
  const card = publicCard(raw);
  if (card.active === false || !activeAdvanced(card.site, card.username)) return new Response("Not found", { status: 404 });
  const name = (card.company || card.name || username).trim().slice(0, 45);
  const short = name.length <= 12 ? name : name.split(/\s+/)[0].slice(0, 12);
  const base = `/c/${encodeURIComponent(card.username)}`;
  const body = {
    id: base,
    name,
    short_name: short,
    description: (card.tagline || card.about || "").trim().slice(0, 160) || `${name} — website and app`,
    start_url: `${base}?view=site&src=app`,
    scope: `${base}`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: safeHex(card.themeColor),
    icons: [
      { src: `${base}/app-icon?s=192`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${base}/app-icon?s=512`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${base}/app-icon?s=192&m=1`, sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: `${base}/app-icon?s=512&m=1`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
