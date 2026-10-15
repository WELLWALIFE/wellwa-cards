// Change the account password from Business › Profile.
//   POST { current, password, password2 } (bearer) → { ok: "…" } or { error }
// The password of an app account lives in the Shubhora login itself. The partner record keeps only a random secret for an account made in
// the app, so the partner service cannot check what the person remembers: the current password is checked against the login here
// (the same way /api/login does) and the new one is set on that same login.
// Then (best effort) the partner service is told, over the signed server-to-server link, to put the same new password on the partner record
// (members.password_hash, used by /login?legacy=1 for old panel IDs), so the old password stops working there too. If that call fails the
// person is NOT told it failed — their Shubhora password did change — it is only logged (never with the password).
// The password travels in that signed call, so PARTNER_LINK_IN_URL must stay the same-machine address (or https), never plain http to another host.
// 5 wrong "current password" tries per account lock this for 15 minutes; a right one clears the count.
// HONEST NOTE: these counters live in THIS server process only (a Map). A restart, a deploy or a second pm2 instance starts them from
// zero, so this slows guessing down but is not a hard guarantee. For a firm limit it would have to move to a shared store (the database).
// The new password is set with the person's own token (PUT /auth/v1/user): Supabase "secure password change" must stay OFF, or that call fails.
import { NextResponse } from "next/server";
import { SUPA_URL } from "@/lib/admin-guard";
import { userFromRequest, userHeaders } from "@/lib/poster-server";
import { partnerCall, partnerLinked } from "@/lib/partner-link";

const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const WRONG_MAX = 5;
const WRONG_MS = 15 * 60_000;
const wrong = new Map<string, { n: number; first: number; until: number }>();

function locked(id: string): boolean {
  const w = wrong.get(id);
  if (!w) return false;
  const now = Date.now();
  if (w.until > now) return true;
  if (now - w.first > WRONG_MS) wrong.delete(id);
  return false;
}
function noteWrong(id: string) {
  const now = Date.now();
  let w = wrong.get(id);
  if (!w || now - w.first > WRONG_MS) w = { n: 0, first: now, until: 0 };
  w.n += 1;
  if (w.n >= WRONG_MAX) w.until = now + WRONG_MS;
  wrong.set(id, w);
  if (wrong.size > 2000) for (const [k, v] of wrong) if (v.until < now && now - v.first > WRONG_MS) wrong.delete(k);
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (!me.email || !SUPA_URL || !ANON) return NextResponse.json({ error: "The password cannot be changed right now. Please try again later." }, { status: 503 });
  if (locked(me.id)) return NextResponse.json({ error: "Too many tries. Please wait 15 minutes and try again." }, { status: 429 });

  const b = (await request.json().catch(() => ({}))) as { current?: unknown; password?: unknown; password2?: unknown };
  const current = String(b.current ?? "").slice(0, 200);
  const next = String(b.password ?? "");
  if (!current) return NextResponse.json({ error: "Enter your current password." }, { status: 400 });
  if (next.length < 8) return NextResponse.json({ error: "The new password must be at least 8 characters." }, { status: 422 });
  if (next.length > 200) return NextResponse.json({ error: "The new password is too long." }, { status: 422 });
  if (next !== String(b.password2 ?? "")) return NextResponse.json({ error: "The two new passwords do not match." }, { status: 422 });
  if (next === current) return NextResponse.json({ error: "The new password must be different from the current one." }, { status: 422 });

  const check = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email: me.email, password: current }), cache: "no-store",
  }).catch(() => null);
  if (!check) return NextResponse.json({ error: "The password cannot be changed right now. Please try again later." }, { status: 503 });
  if (!check.ok) {
    noteWrong(me.id);
    return NextResponse.json({ error: "The current password is not correct." }, { status: 401 });
  }
  wrong.delete(me.id);

  const set = await fetch(`${SUPA_URL}/auth/v1/user`, { method: "PUT", headers: userHeaders(me.token), body: JSON.stringify({ password: next }), cache: "no-store" }).catch(() => null);
  if (!set?.ok) {
    const j = (await set?.json().catch(() => ({}))) as { msg?: string; message?: string; error_description?: string } | undefined;
    const why = `${j?.msg ?? j?.message ?? j?.error_description ?? ""}`;
    if (/different from the old/i.test(why)) return NextResponse.json({ error: "The new password must be different from the current one." }, { status: 422 });
    if (/weak|short|characters|pwned|easy/i.test(why)) return NextResponse.json({ error: "This password is too easy to guess. Please choose a longer one." }, { status: 422 });
    return NextResponse.json({ error: "The password could not be changed. Please try again." }, { status: 502 });
  }

  // Keep the partner record's own password the same (best effort; it never fails the person's change).
  if (partnerLinked()) {
    try {
      const r = await partnerCall("password_sync", { suiteUserId: me.id, password: next }, 6000);
      // 404 = this account has no partner record (nothing to keep in step); anything else not ok is worth a line in the log.
      if (!r.ok && r.status !== 404) console.error("[business/password] partner password not synced", me.id, r.status, r.data.error);
    } catch (e) {
      console.error("[business/password] partner password not synced", me.id, (e as Error).message);
    }
  }
  return NextResponse.json({ ok: "Password changed." });
}
