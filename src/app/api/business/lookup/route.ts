// POST (bearer) { url, hint? } → the business behind a Google Maps / Instagram / Facebook / JustDial / IndiaMART / store link
// (lib/business-lookup.ts). Used by the set-up when the owner's "website" is one of those (owner, 2 Nov 2026).
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { rateLimited } from "@/lib/api-security";
import { cleanSiteUrl } from "@/lib/site-role";
import { lookupBusiness } from "@/lib/business-lookup";

export const maxDuration = 60;

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (rateLimited(`biz-lookup:${me.id}`, 12, 10 * 60_000)) return NextResponse.json({ ok: false, error: "Too many tries. Please wait a few minutes." }, { status: 429 });
  const b = (await request.json().catch(() => ({}))) as { url?: unknown; hint?: unknown };
  const url = cleanSiteUrl(typeof b.url === "string" ? b.url : "");
  if (!url) return NextResponse.json({ ok: false, error: "Paste the link." }, { status: 400 });
  const r = await lookupBusiness(url, typeof b.hint === "string" ? b.hint : "").catch(() => null);
  if (!r) return NextResponse.json({ ok: false, error: "Could not read it just now." }, { status: 200 });
  return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } });
}
