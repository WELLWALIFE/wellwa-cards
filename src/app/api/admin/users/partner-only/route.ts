// Super Admin → a partner ID that has no app login yet ("partner-only": made by hand in Staff Admin, or whose account
// was never created). Owner, 20 Oct 2026: "such IDs should be normal too" — editable here like every other user, and
// given an app login with one click.
//   GET   ?code=SH100180                      → the ID's details (for the edit form)
//   PATCH { code, name?, username?, mobile?, email?, dob?, gender? }
//                                             → saved on the partner ID (Staff Admin, tree, welcome letter)
//   POST  { op: "create_login", code }        → an app account for the ID: mobile login (like a mobile sign-up),
//                                               its name / username / contact email copied over, tied to the ID.
//                                               The person signs in with the mobile; the password is set with
//                                               "Edit login" or sent with "Login as" (temporary password).
import crypto from "node:crypto";
import { adminAllowed, serviceConfigured, serviceHeaders, SUPA_URL } from "@/lib/admin-guard";
import { partnerCall } from "@/lib/partner-link";
import { phoneEmail } from "@/lib/phone";
import { USERNAME_RE } from "@/lib/username";

type Member = { code: string; username: string | null; name: string; mobile: string | null; email: string | null; status: string; dob: string | null; gender: string | null; joined: string | null; suiteUserId: string | null };
const S = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const CODE = /^[A-Z]{1,6}\d{3,10}$/;

async function who(request: Request): Promise<string> {
  const token = request.headers.get("x-owner-token") ?? "";
  if (token && SUPA_URL) {
    try {
      const r = await fetch(`${SUPA_URL}/auth/v1/user`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (r.ok) return String((await r.json())?.email ?? "owner");
    } catch { /* fall through */ }
  }
  return "Super Admin password";
}

async function member(code: string): Promise<{ ok: true; m: Member } | { ok: false; status: number; error: string }> {
  const r = await partnerCall<Member>("member", { code });
  if (!r.ok) return { ok: false, status: r.status === 404 ? 404 : 502, error: r.status === 404 ? `No partner ID ${code}.` : (r.data.error ?? "partner panel not reachable") };
  return { ok: true, m: r.data };
}

export async function GET(request: Request) {
  if (!(await adminAllowed(request))) return Response.json({ error: "unauthorized" }, { status: 401 });
  const code = S(new URL(request.url).searchParams.get("code"), 20).toUpperCase();
  if (!CODE.test(code)) return Response.json({ error: "bad code" }, { status: 400 });
  const r = await member(code);
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  return Response.json({ member: r.m });
}

export async function PATCH(request: Request) {
  if (!(await adminAllowed(request))) return Response.json({ error: "unauthorized" }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const code = S(b.code, 20).toUpperCase();
  if (!CODE.test(code)) return Response.json({ error: "bad code" }, { status: 400 });
  const pb: Record<string, unknown> = { code, by: await who(request) };
  if (b.name !== undefined) { const v = S(b.name, 80); if (v.length < 2) return Response.json({ error: "Write the name." }, { status: 422 }); pb.name = v; }
  if (b.username !== undefined) { const v = S(b.username, 20); if (!USERNAME_RE.test(v)) return Response.json({ error: "Username: 4 to 20 letters, numbers or _." }, { status: 422 }); pb.username = v; }
  if (b.mobile !== undefined) { const v = S(b.mobile, 20).replace(/\D/g, "").slice(-10); if (v.length !== 10) return Response.json({ error: "Mobile must be 10 digits." }, { status: 422 }); pb.mobile = v; }
  if (b.email !== undefined) { const v = S(b.email, 120).toLowerCase(); if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return Response.json({ error: "Email looks wrong." }, { status: 422 }); pb.email = v; }
  if (b.dob !== undefined) pb.dob = S(b.dob, 10);
  if (b.gender !== undefined) pb.gender = S(b.gender, 10);
  if (Object.keys(pb).length <= 2) return Response.json({ error: "Nothing to change." }, { status: 400 });
  const r = await partnerCall("member_update", pb, 10000);
  if (!r.ok) return Response.json({ error: r.data.error ?? (r.status === 404 ? `No partner ID ${code}.` : "partner panel not reachable") }, { status: r.status || 502 });
  return Response.json({ ok: true, code });
}

export async function POST(request: Request) {
  if (!(await adminAllowed(request))) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return Response.json({ error: "service key missing" }, { status: 400 });
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (b.op !== "create_login") return Response.json({ error: "bad request" }, { status: 400 });
  const code = S(b.code, 20).toUpperCase();
  if (!CODE.test(code)) return Response.json({ error: "bad code" }, { status: 400 });
  const got = await member(code);
  if (!got.ok) return Response.json({ error: got.error }, { status: got.status });
  const m = got.m;
  if (m.suiteUserId) return Response.json({ error: `${code} already has an app account.` }, { status: 409 });
  const mobile = String(m.mobile ?? "").replace(/\D/g, "").slice(-10);
  if (mobile.length !== 10 || !/^[6-9]/.test(mobile)) return Response.json({ error: `${code} has no valid 10-digit mobile — add one first (Edit), the mobile is the app login.` }, { status: 422 });
  const h = serviceHeaders();
  // The mobile must not be another account's login (a mobile sign-up signs in AS its mobile).
  const taken = await fetch(`${SUPA_URL}/rest/v1/rpc/signup_taken`, { method: "POST", headers: h, cache: "no-store", body: JSON.stringify({ p_mobile: mobile, p_email: "" }) })
    .then((r) => (r.ok ? r.json() : {})).catch(() => ({})) as { mobile?: boolean };
  if (taken.mobile) return Response.json({ error: `+91 ${mobile} is already the login of another app account. If that account is this person, use "Link app account" instead.` }, { status: 409 });
  const email = phoneEmail(`+91${mobile}`);
  const contactEmail = (m.email ?? "").trim().toLowerCase();
  const md: Record<string, unknown> = { name: m.name, full_name: m.name, display_name: m.name, phone: mobile, associate_id: code, signed_up_via: "super-admin" };
  if (contactEmail) md.contact_email = contactEmail;
  if (m.dob) md.dob = m.dob;
  if (m.gender) md.gender = m.gender;
  const c = await fetch(`${SUPA_URL}/auth/v1/admin/users`, {
    method: "POST", headers: h,
    body: JSON.stringify({ email, email_confirm: true, password: crypto.randomBytes(24).toString("base64url"), user_metadata: md }),
  });
  const cj = await c.json().catch(() => ({}));
  if (!c.ok || !cj?.id) return Response.json({ error: `Could not create the app account: ${cj?.msg ?? cj?.error_description ?? c.status}` }, { status: 400 });
  const userId: string = cj.id;
  // The profile row is made by the database trigger; give it the name and, when free, the partner's username.
  const pr: Record<string, unknown> = { full_name: m.name };
  if (m.username && USERNAME_RE.test(m.username)) {
    const same = await fetch(`${SUPA_URL}/rest/v1/profiles?username=ilike.${encodeURIComponent(m.username)}&id=neq.${userId}&select=id`, { headers: h, cache: "no-store" }).then((r) => (r.ok ? r.json() : [])).catch(() => []);
    if (!(same as unknown[]).length) pr.username = m.username;
  }
  for (let i = 0; i < 5; i++) { // the trigger's row can land a moment after the auth user
    const r = await fetch(`${SUPA_URL}/rest/v1/profiles?id=eq.${userId}`, { method: "PATCH", headers: { ...h, Prefer: "return=representation" }, body: JSON.stringify(pr) });
    if (r.ok && ((await r.json().catch(() => [])) as unknown[]).length) break;
    await new Promise((res) => setTimeout(res, 400));
  }
  // Tie the account to the ID (the partner panel keeps suite_user_id; the app keeps associate_id as its copy).
  const link = await partnerCall("link", { code, suiteUserId: userId, email, by: await who(request) });
  if (!link.ok) return Response.json({ error: `Account created (${mobile}) but not tied to ${code}: ${link.data.error ?? "partner panel not reachable"}. Use "Link app account" with ${email}.`, userId }, { status: 502 });
  return Response.json({ ok: true, code, userId, login: mobile, username: pr.username ?? null });
}
