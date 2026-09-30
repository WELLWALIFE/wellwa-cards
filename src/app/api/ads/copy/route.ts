// POST (bearer) { profile_id, goal, product_id?, offer? } → the ad's words from the owner's own facts (₹0.05 via flash-lite).
import { NextResponse } from "next/server";
import { userFromRequest, ownProfile, restAsService, cardLinkFor } from "@/lib/poster-server";
import { rateLimited } from "@/lib/api-security";
import { writeAdCopy, type AdGoal } from "@/lib/ads-server";

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (rateLimited(`ad-copy:${me.id}`, 30, 60 * 60_000)) return NextResponse.json({ error: "Please wait a little and try again." }, { status: 429 });
  const b = await request.json().catch(() => ({}));
  const profile = await ownProfile(me.token, String(b.profile_id ?? ""));
  if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  const goal: AdGoal = ["whatsapp", "calls", "website"].includes(b.goal) ? b.goal : "whatsapp";
  let product = null;
  if (typeof b.product_id === "string" && /^[0-9a-f-]{36}$/i.test(b.product_id)) {
    const p = (await restAsService<{ name: string; price?: string; benefits?: string[]; offer?: string; user_id: string }[]>(`poster_products?id=eq.${b.product_id}&select=name,price,benefits,offer,user_id`)).data?.[0];
    if (p && p.user_id === me.id) product = { name: p.name, price: p.price, benefits: p.benefits ?? [], offer: p.offer };
  }
  const link = await cardLinkFor(me.id, (profile as unknown as { card_facts?: { primaryCardId?: string } | null }).card_facts?.primaryCardId);
  const card = (link?.data ?? {}) as { company?: string; name?: string; jobTitle?: string; seo?: { city?: string; category?: string }; pages?: { blocks?: { kind: string; items?: string[] }[] }[] };
  const usps = (card.pages ?? []).flatMap((pg) => pg.blocks ?? []).filter((x) => x.kind === "highlights").flatMap((x) => x.items ?? []).slice(0, 5);
  const p = profile as unknown as { name: string; tagline?: string | null; city?: string | null; phone?: string | null; lang?: string; category?: string };
  const copy = await writeAdCopy({
    business: card.company || p.tagline || card.name || p.name, trade: card.seo?.category || card.jobTitle || p.category || "business", city: card.seo?.city || p.city || "",
    goal, product, offer: typeof b.offer === "string" ? b.offer.slice(0, 80) : "", lang: p.lang || "hinglish", phone: p.phone || "", usps,
  });
  return NextResponse.json({ copy, link: link?.url ?? "", phone: p.phone ?? "" });
}
