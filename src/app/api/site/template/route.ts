// GET (bearer) → the website templates. POST { card_id?, key } → free: the website takes that template's pages and
// look; the owner's name, number, links and photo stay.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { applySiteTemplate, siteStatus } from "@/lib/site-server";
import { BUILT_IN_TEMPLATES } from "@/lib/templates";
import { brandSlugOf, callerBrandSlug, canUseTemplate } from "@/lib/template-access";

export async function GET(request: Request) {
  const mine = await callerBrandSlug(request);   // company designs only for that company's people
  return NextResponse.json({
    templates: BUILT_IN_TEMPLATES.filter((t) => t.key !== "blank" && canUseTemplate(t.brand, mine)).map((t) => ({
      key: t.key, name: t.name, category: t.category, emoji: t.emoji, description: t.description,
      color: t.data.themeColor, pages: t.data.pages.length,
    })),
  });
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const cardId = typeof b.card_id === "string" ? b.card_id : undefined;
  const tpl = BUILT_IN_TEMPLATES.find((t) => t.key === String(b.key ?? ""));
  if (tpl?.brand && !canUseTemplate(tpl.brand, await brandSlugOf(me.id))) return NextResponse.json({ error: "This design is only for that company's members." }, { status: 403 });
  try {
    await applySiteTemplate(me.id, String(b.key ?? ""), cardId);
    return NextResponse.json({ ok: true, status: await siteStatus(me.id, cardId) });
  } catch (e) {
    const msg = (e as Error).message;
    return NextResponse.json({ error: msg === "NO_CARD" ? "Create your digital card first." : msg }, { status: 400 });
  }
}
