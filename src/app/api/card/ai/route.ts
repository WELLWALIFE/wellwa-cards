// POST (signed in) { business, person?, category, city?, phone?, email?, details, lang?, photos?, reference? }
// → the AI writes a complete card. Credits every time: CARD_TEXT_CREDITS (returned if the AI fails). The pictures are
// real photos of the trade from our photo library — free, no AI-made pictures (owner's call, 27 Sep 2026).
// The card is returned, not saved.
import { NextResponse } from "next/server";
import { clientKey, rateLimited, requireUser, sameOrigin } from "@/lib/api-security";
import { restAsService, stockEngineMod } from "@/lib/poster-server";
import { readReference } from "@/lib/reference-site";
import { assembleCard, writeCard, type CardBrief } from "@/lib/card-ai";
import { cardAiCost } from "@/lib/site-pricing";

export const maxDuration = 150;
const S = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const session = await requireUser();
  if (!session) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const uid = session.user.id;
  if (rateLimited(clientKey(request, `card-ai:${uid}`), 6, 10 * 60_000)) return NextResponse.json({ error: "Please wait a moment and try again." }, { status: 429 });
  const b = await request.json().catch(() => ({}));
  const brief: CardBrief = {
    business: S(b.business, 80), person: S(b.person, 60) || undefined, category: S(b.category, 60), city: S(b.city, 60) || undefined,
    phone: S(b.phone, 20) || undefined, email: S(b.email, 120) || undefined, details: S(b.details, 3000),
    lang: ["en", "hi", "hinglish"].includes(b.lang) ? b.lang : "en",
  };
  if (brief.business.length < 2 || brief.category.length < 2) return NextResponse.json({ error: "Write the business name and what you do." }, { status: 400 });
  if (brief.details.length < 30) return NextResponse.json({ error: "Tell the AI a little more about your business (at least a couple of lines)." }, { status: 400 });
  const cost = cardAiCost(0);

  let reference = null;
  if (typeof b.reference === "string" && b.reference.trim()) {
    reference = await readReference(b.reference.slice(0, 300));
    if (!reference) return NextResponse.json({ error: "We could not open that reference website. Check the link, or leave it empty." }, { status: 400 });
  }

  const ref = `card-ai:${uid}:${Date.now()}`;
  const spend = await restAsService("rpc/spend_credits", { method: "POST", body: JSON.stringify({ p_user: uid, p_amount: cost, p_reason: "ai-card", p_ref: ref }) });
  if (!spend.ok) return NextResponse.json({ error: spend.text.includes("INSUFFICIENT_CREDITS") ? `Not enough credits (${cost} needed).` : "Could not charge credits.", cost }, { status: 402 });
  const refund = (amount: number, why: string) => amount > 0
    ? restAsService("rpc/grant_credits", { method: "POST", body: JSON.stringify({ p_user: uid, p_amount: amount, p_reason: why, p_ref: ref }) })
    : Promise.resolve(null);
  try {
    const stock = (async () => {
      try {
        const st = await stockEngineMod();
        const m = await Promise.race([st.ensureCardMedia({ category: brief.category, label: brief.category }), new Promise<null>((r) => setTimeout(() => r(null), 45_000))]);
        const urls: string[] = (m?.photos ?? []).map((p: { url: string }) => p.url).filter(Boolean);
        return [urls[0] && { key: "cover", url: urls[0] }, urls[1] && { key: "about", url: urls[1] }].filter((x): x is { key: string; url: string } => !!x);
      } catch { return []; }
    })();
    const [copy, made] = await Promise.all([writeCard(brief, reference), stock]);
    return NextResponse.json({ ok: true, card: assembleCard(brief, copy, made), charged: cost, photos: made.length });
  } catch {
    await refund(cost, "ai-card-refund");
    return NextResponse.json({ error: "The AI did not respond. Your credits were returned — please try again." }, { status: 502 });
  }
}
