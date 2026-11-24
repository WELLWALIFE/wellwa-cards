// POST (bearer) { card_id? } → { ok, baked }: a Shubhora partner's website, exactly as it is drawn today, written into the card once
// (owner, 24 Nov 2026: "partner ho ya regular user, sab editable hone chahiye; purani site jaisi hai theek hai"). From then on the
// card is drawn as it is stored, like every other card, so every section can be edited, moved, renamed or hidden. Nothing on the
// website changes when this runs. Only the owner's own card; a card that is not a partner's, or is already done, is left alone.
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { myCard } from "@/lib/site-server";
import { isShubhoraSellerCard, sellerBaked, sellerDrawsPremium, withoutFreeCard } from "@/lib/shubhora-page";
import type { Card } from "@/lib/types";

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({})) as { card_id?: unknown };
  const row = await myCard(me.id, typeof b.card_id === "string" ? b.card_id : undefined);
  if (!row) return NextResponse.json({ error: "No card" }, { status: 404 });
  const stored = row.data as Card;
  if (!isShubhoraSellerCard(stored) || sellerBaked(stored)) return NextResponse.json({ ok: true, baked: false });
  // What the public page draws (app/c/[username]/render.tsx): the partner layer, and a Premium spec it did not draw switched off.
  let drawn = withoutFreeCard(stored, true);
  if (drawn.site?.advanced && !sellerDrawsPremium(drawn.site)) drawn = { ...drawn, site: { ...drawn.site, advancedOn: false } as Card["site"] };
  const data = { ...drawn, site: { ...(drawn.site ?? { enabled: true }), sellerBaked: true } as Card["site"] };
  const r = await restAsService(`cards?id=eq.${row.id}&owner_id=eq.${me.id}`, { method: "PATCH", body: JSON.stringify({ data }) });
  if (!r.ok) return NextResponse.json({ error: "Could not prepare the website for editing. Please try again." }, { status: 500 });
  return NextResponse.json({ ok: true, baked: true });
}
