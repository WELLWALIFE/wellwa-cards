// Opens the Business section (the partner panel, /partners on this site) for the signed-in person — one login.
//   GET /api/partner-panel            → the panel's home
//   GET /api/partner-panel?next=/team → that page of the panel (the panel sends people here too, when it finds no
//                                        session of its own: it comes back to the same page after the app signs them in)
// The panel decides who the person is by their account id and answers with a one-time address. An account without a
// partner ID yet gets one here on the spot (every Shubhora account is a partner account). Nothing here ever sends
// anyone to the panel's own login form — that would loop.
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-security";
import { registerPartner } from "@/lib/partner-link";
import { SUPA_URL, serviceHeaders } from "@/lib/admin-guard";

const PANEL = (process.env.PARTNER_PANEL_URL || `${(process.env.NEXT_PUBLIC_SITE_URL || "https://shubhora.com").replace(/\/$/, "")}/partners`).replace(/\/$/, "");
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://shubhora.com").replace(/\/$/, "");
const LINK_IN = () => process.env.PARTNER_LINK_IN_URL || "http://127.0.0.1:3002/partners/api/link-in";

async function oneTimeLink(userId: string, next: string): Promise<{ url?: string; status: number }> {
  const secret = process.env.LINK_SECRET ?? "";
  const raw = JSON.stringify({ suiteUserId: userId, next, ts: Date.now() });
  const sig = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const r = await fetch(LINK_IN(), { method: "POST", headers: { "content-type": "application/json", "x-link-signature": sig }, body: raw, cache: "no-store", signal: AbortSignal.timeout(8000) });
  const j = (await r.json().catch(() => ({}))) as { url?: string };
  return { url: r.ok && j.url && j.url.startsWith(PANEL) ? j.url : undefined, status: r.status };
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const raw = q.get("next") || "";
  // "activate" is the old word; otherwise a page of the panel, e.g. /team, /wallet, /kyc.
  const next = raw === "activate" ? "activate" : /^\/[a-z0-9][a-z0-9/_-]{0,80}$/i.test(raw) ? raw : "/dashboard";
  const self = `/api/partner-panel${raw ? `?next=${encodeURIComponent(raw)}` : ""}`;

  const session = await requireUser();
  if (!session) return NextResponse.redirect(`${SITE}/login?next=${encodeURIComponent(self)}`);
  if (!process.env.LINK_SECRET) return NextResponse.redirect(`${SITE}/poster/business?panel=unavailable`);

  try {
    let r = await oneTimeLink(session.user.id, next);
    if (r.status === 404) {
      // No partner ID yet (an account from before the one-account model, or a sign-up while the panel was down).
      const pr = await fetch(`${SUPA_URL}/rest/v1/profiles?id=eq.${session.user.id}&select=username,referred_by&limit=1`, { headers: serviceHeaders(), cache: "no-store" });
      const prof = ((pr.ok ? await pr.json() : [])[0] ?? {}) as { username?: string | null; referred_by?: string | null };
      const reg = await registerPartner(session.user.id, prof.username ?? null, prof.referred_by ?? null);
      if (reg.ok) r = await oneTimeLink(session.user.id, next);
    }
    if (r.url) return NextResponse.redirect(r.url);
    console.error("[partner-panel] no link", session.user.id, r.status);
  } catch (e) {
    console.error("[partner-panel]", e);
  }
  return NextResponse.redirect(`${SITE}/poster/business?panel=unavailable`);
}
