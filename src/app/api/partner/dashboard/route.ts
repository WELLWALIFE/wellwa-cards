// The Business page's data: the partner panel's overview for the signed-in account (handles only, never names).
//   GET (bearer) → { username, cardSlug, link, partner: {...panel dashboard...} | null, linked }
// An account without a partner ID yet is registered here first — every Shubhora account is a partner account.
import { NextResponse } from "next/server";
import { userFromRequest, restAsUser } from "@/lib/poster-server";
import { partnerCall, partnerLinked, registerPartner } from "@/lib/partner-link";
import { SITE_URL } from "@/lib/site-url";

type Prof = { username: string | null; referred_by: string | null };

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const [p, cards] = await Promise.all([
    // Always filtered to this account: live cards are publicly readable, so an unfiltered query returned the
    // oldest card on the whole site (another person's link on everybody's Share page — fixed 25 Sep 2026).
    restAsUser<Prof[]>(me.token, `profiles?select=username,referred_by&id=eq.${me.id}&limit=1`).then((r) => r.data?.[0] ?? null),
    restAsUser<{ username: string; active: boolean | null; kb: string | null; company: string | null }[]>(me.token, `cards?select=username,active,kb:data->>kb,company:data->>company&owner_id=eq.${me.id}&order=created_at.asc&limit=10`).then((r) => r.data ?? []),
  ]);
  const main = cards.find((c) => c.active !== false) ?? cards[0];
  const cardSlug = main?.username ?? null;
  // Sells Shubhora — the whole card ("shubhora") or alongside their own business ("both") — and the app then
  // shows the team join links up front; for everyone else they sit one tap lower, under the card link (a
  // referral does not make someone a networker).
  const shubhoraCard = cards.some((c) => c.kb === "shubhora" || c.kb === "both" || /shubhora/i.test(c.company ?? ""));
  const username = p?.username ?? null;
  // Two different links: the referral link (Business) and the card link (the person's own site). Never mixed up.
  const link = username ? `${SITE_URL}/join/${username}` : null;
  const cardLink = cardSlug ? `${SITE_URL}/c/${cardSlug}` : null;

  let partner: Record<string, unknown> | null = null;
  let error: string | undefined;
  if (partnerLinked()) {
    let r = await partnerCall<Record<string, unknown>>("dashboard", { suiteUserId: me.id }, 8000);
    if (r.status === 404 && username) {
      const reg = await registerPartner(me.id, username, p?.referred_by ?? null);
      if (reg.ok) r = await partnerCall<Record<string, unknown>>("dashboard", { suiteUserId: me.id }, 8000);
    }
    if (r.ok) partner = r.data;
    else error = r.status === 404 ? "no-id" : "unavailable";
  } else error = "unavailable";
  const team = (partner?.team ?? null) as { left?: number; right?: number } | null;
  const promoter = shubhoraCard || ((team?.left ?? 0) + (team?.right ?? 0)) > 0;
  return NextResponse.json({ username, cardSlug, link, cardLink, partner, linked: partnerLinked(), error, promoter });
}
