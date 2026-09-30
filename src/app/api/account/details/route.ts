// The member changes their own name / mobile / photo (Me → "Edit name / mobile" → About you → Save).
// Owner's call (26 Sep 2026): one change, every place —
//   • the login: the new mobile signs in (the old one and the username keep working, the password stays the same)
//   • the account's name                    • the posters' default profile (the number printed on every poster)
//   • the V-Card: the old name / number on the card and its Call / WhatsApp buttons (see member-sync)
//   • the partner ID in the partner panel (team, wallet)
// The browser then runs the setup's own card sync as well (it owns the photo / logo rules for the card picture).
//   POST { name, phone, photo? } → { ok, done: string[], note? }   Bearer token, like every /api/poster/* route.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { SUPA_URL, serviceHeaders } from "@/lib/admin-guard";
import { currentMobile, last10, mobileUsedByOther, syncCardsIdentity, syncPartnerIdentity } from "@/lib/member-sync";

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as { name?: unknown; phone?: unknown; photo?: unknown };
  const name = String(b.name ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  const phone = last10(b.phone);
  if (name.length < 2) return NextResponse.json({ error: "Write your name." }, { status: 400 });
  if (phone.length !== 10) return NextResponse.json({ error: "Write your 10-digit mobile number." }, { status: 400 });
  // undefined = leave the photo as it is; "" = no photo; an https address = the new photo
  const photo = typeof b.photo === "string" ? (/^https:\/\/\S+$/.test(b.photo) && b.photo.length < 500 ? b.photo : b.photo === "" ? "" : undefined) : undefined;

  const h = serviceHeaders();
  const ur = await fetch(`${SUPA_URL}/auth/v1/admin/users/${me.id}`, { headers: h, cache: "no-store" });
  if (!ur.ok) return NextResponse.json({ error: "Could not read your account. Please try again." }, { status: 502 });
  const u = (await ur.json()) as { email?: string; phone?: string; user_metadata?: Record<string, unknown> };
  const md = { ...(u.user_metadata ?? {}) } as Record<string, unknown>;
  const oldName = String(md.display_name ?? md.full_name ?? md.name ?? "").trim();
  const oldPhone = currentMobile(u);
  if (phone !== oldPhone && (await mobileUsedByOther(u.email, phone))) {
    return NextResponse.json({ error: "This mobile number is already on another Shubhora account. Use another number, or message support on WhatsApp." }, { status: 409 });
  }
  const done: string[] = [];

  // 1. the login (user_metadata): name, mobile, photo
  md.full_name = name; md.display_name = name;
  if (typeof md.name === "string") md.name = name;
  md.phone = `+91${phone}`;
  if (photo !== undefined) md.photo_url = photo;
  const ar = await fetch(`${SUPA_URL}/auth/v1/admin/users/${me.id}`, { method: "PUT", headers: h, body: JSON.stringify({ user_metadata: md }) });
  if (!ar.ok) return NextResponse.json({ error: "Could not save your details. Please try again." }, { status: 502 });
  done.push("login");

  // 2. the account row (Super Admin lists and the partner tools read it)
  const pr = await fetch(`${SUPA_URL}/rest/v1/profiles?id=eq.${me.id}`, { method: "PATCH", headers: { ...h, Prefer: "return=minimal" }, body: JSON.stringify({ full_name: name }) });
  if (pr.ok) done.push("account");

  // 3. the posters' default profile: the number (and photo); the name only on a personal profile —
  //    a shop's posters carry the shop's name, which this screen does not change.
  const pp = await fetch(`${SUPA_URL}/rest/v1/poster_profiles?user_id=eq.${me.id}&is_default=eq.true&select=id,persona&limit=1`, { headers: h, cache: "no-store" })
    .then((r) => (r.ok ? r.json() : [])).catch(() => []) as { id: string; persona: string | null }[];
  if (pp[0]) {
    const patch: Record<string, unknown> = { phone };
    if (pp[0].persona !== "business") patch.name = name;
    if (photo !== undefined) patch.photo_url = photo || null;
    const r = await fetch(`${SUPA_URL}/rest/v1/poster_profiles?id=eq.${pp[0].id}`, { method: "PATCH", headers: { ...h, Prefer: "return=minimal" }, body: JSON.stringify(patch) });
    if (r.ok) done.push("posters");
  }

  // 4. the V-Card(s): wherever the old name / number still shows
  const cards = await syncCardsIdentity(me.id, { name, oldName, phone, oldPhone }).catch(() => 0);
  if (cards) done.push("V-Card");

  // 5. the partner ID
  const partner = await syncPartnerIdentity(me.id, { name, mobile: phone, by: `member ${me.email ?? me.id}` }).catch(() => ({ updated: false, note: "Partner ID not updated." }));
  if (partner.updated) done.push("partner ID");

  return NextResponse.json({ ok: true, done, ...(partner.note ? { note: partner.note } : {}) });
}
