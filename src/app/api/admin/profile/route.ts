// Super Admin → a user's full profile, editable (owner's call, 24 Sep 2026: "admin me member ka name, username, full
// details / profile edit"). One save updates every place the person's details live:
//   • the login (Supabase auth: email, and user_metadata — name, mobile, photo, date of birth, gender, business)
//   • profiles (full_name, username)            • the default poster profile (name, number on the posters)
//   • the partner ID (name, username, mobile, email, DOB, gender) — so User Panel / Staff Admin / tree show the same.
//   • the V-Card(s): the old name / number on the card and its Call / WhatsApp buttons (26 Sep 2026)
//   GET  ?id=<uuid>  → { meta, username, email, partner }
//   PATCH { id, name?, username?, phone?, email?, photoUrl?, dob?, gender?, business?, posterProfile?, card?, partner? }
import { adminAllowed, serviceConfigured, serviceHeaders, SUPA_URL } from "@/lib/admin-guard";
import { partnerCall } from "@/lib/partner-link";
import { currentMobile, syncCardsIdentity } from "@/lib/member-sync";
import { USERNAME_RE } from "@/lib/username";

const UUID = /^[0-9a-f-]{36}$/i;
const S = (v: unknown, n = 200) => String(v ?? "").trim().slice(0, n);

async function authUser(id: string) {
  const r = await fetch(`${SUPA_URL}/auth/v1/admin/users/${id}`, { headers: serviceHeaders(), cache: "no-store" });
  return r.ok ? ((await r.json()) as { id: string; email?: string; phone?: string; user_metadata?: Record<string, unknown> }) : null;
}
async function who(request: Request) {
  const token = request.headers.get("x-owner-token") ?? "";
  if (token) {
    try {
      const r = await fetch(`${SUPA_URL}/auth/v1/user`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (r.ok) return String((await r.json())?.email ?? "owner");
    } catch { /* fall through */ }
  }
  return "Super Admin password";
}

export async function GET(request: Request) {
  if (!(await adminAllowed(request))) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return Response.json({ error: "service key missing" }, { status: 400 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) return Response.json({ error: "bad id" }, { status: 400 });
  const [u, pr, pp, partner] = await Promise.all([
    authUser(id),
    fetch(`${SUPA_URL}/rest/v1/profiles?id=eq.${id}&select=username,full_name`, { headers: serviceHeaders(), cache: "no-store" }).then((r) => (r.ok ? r.json() : [])),
    fetch(`${SUPA_URL}/rest/v1/poster_profiles?user_id=eq.${id}&is_default=eq.true&select=id,name,phone&limit=1`, { headers: serviceHeaders(), cache: "no-store" }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
    partnerCall<Record<string, unknown>>("member", { suiteUserId: id }, 8000),
  ]);
  if (!u) return Response.json({ error: "user not found" }, { status: 404 });
  return Response.json({
    email: u.email ?? "", phone: u.phone ?? "", meta: u.user_metadata ?? {},
    username: (pr as { username?: string | null }[])[0]?.username ?? null,
    fullName: (pr as { full_name?: string | null }[])[0]?.full_name ?? null,
    posterProfile: (pp as { id: string; name: string; phone: string | null }[])[0] ?? null,
    partner: partner.ok ? partner.data : null,
  });
}

export async function PATCH(request: Request) {
  if (!(await adminAllowed(request))) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return Response.json({ error: "service key missing" }, { status: 400 });
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = S(b.id, 36);
  if (!UUID.test(id)) return Response.json({ error: "bad id" }, { status: 400 });
  const u = await authUser(id);
  if (!u) return Response.json({ error: "user not found" }, { status: 404 });
  const h = serviceHeaders();
  const md = { ...(u.user_metadata ?? {}) } as Record<string, unknown>;
  const done: string[] = [];

  // --- check first, write after: a taken username stops the whole save before anything changes
  let username: string | null = null;
  if (b.username !== undefined) {
    username = S(b.username, 20);
    if (!USERNAME_RE.test(username)) return Response.json({ error: "Username: 4 to 20 letters, numbers or _." }, { status: 422 });
    const same = await fetch(`${SUPA_URL}/rest/v1/profiles?username=ilike.${encodeURIComponent(username)}&id=neq.${id}&select=id,username`, { headers: h, cache: "no-store" }).then((r) => (r.ok ? r.json() : []));
    if ((same as { username: string }[]).some((x) => x.username?.toLowerCase() === username!.toLowerCase())) return Response.json({ error: `The username ${username} is already taken.` }, { status: 409 });
  }
  const name = b.name !== undefined ? S(b.name, 80) : null;
  if (name !== null && name.length < 2) return Response.json({ error: "Write the name." }, { status: 422 });
  const phone = b.phone !== undefined ? S(b.phone, 20).replace(/\D/g, "").slice(-10) : null;
  if (phone && phone.length !== 10) return Response.json({ error: "Mobile must be 10 digits." }, { status: 422 });
  const email = b.email !== undefined ? S(b.email, 120).toLowerCase() : null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Email looks wrong." }, { status: 422 });

  // --- 1. login: email + metadata
  if (name !== null) { md.full_name = name; md.display_name = name; md.name = name; }
  if (phone !== null) md.phone = phone ? `+91${phone}` : "";
  if (b.photoUrl !== undefined) md.photo_url = S(b.photoUrl, 500) || null;
  if (b.dob !== undefined) md.dob = S(b.dob, 10) || null;
  if (b.gender !== undefined) md.gender = ["male", "female", "other"].includes(S(b.gender, 10)) ? S(b.gender, 10) : null;
  if (b.business && typeof b.business === "object") {
    const cur = (md.business && typeof md.business === "object" ? md.business : {}) as Record<string, unknown>;
    const nb = b.business as Record<string, unknown>;
    const keep: Record<string, unknown> = { ...cur };
    for (const k of ["name", "role", "reach", "category", "city", "address", "about", "website", "map", "gstin"]) if (nb[k] !== undefined) keep[k] = S(nb[k], k === "about" ? 1000 : 200);
    md.business = keep;
  }
  const authPatch: Record<string, unknown> = { user_metadata: md };
  if (email && email !== (u.email ?? "").toLowerCase()) authPatch.email = email;
  const ar = await fetch(`${SUPA_URL}/auth/v1/admin/users/${id}`, { method: "PUT", headers: h, body: JSON.stringify(authPatch) });
  if (!ar.ok) return Response.json({ error: `Login details: ${(await ar.json().catch(() => ({})))?.msg ?? ar.status}` }, { status: 400 });
  done.push("login");

  // --- 2. profiles row
  const prPatch: Record<string, unknown> = {};
  if (name !== null) prPatch.full_name = name;
  if (username !== null) prPatch.username = username;
  if (Object.keys(prPatch).length) {
    const r = await fetch(`${SUPA_URL}/rest/v1/profiles?id=eq.${id}`, { method: "PATCH", headers: { ...h, Prefer: "return=minimal" }, body: JSON.stringify(prPatch) });
    if (!r.ok) return Response.json({ error: `Profile: ${await r.text()}`, done }, { status: 400 });
    done.push("profile");
  }

  // --- 3. the default poster profile (the name / number printed on posters) — when asked
  if (b.posterProfile !== false && (name !== null || phone !== null)) {
    const pp: Record<string, unknown> = {};
    if (name !== null) pp.name = name;
    if (phone) pp.phone = phone;
    const r = await fetch(`${SUPA_URL}/rest/v1/poster_profiles?user_id=eq.${id}&is_default=eq.true`, { method: "PATCH", headers: { ...h, Prefer: "return=minimal" }, body: JSON.stringify(pp) });
    if (r.ok) done.push("poster profile");
  }

  // --- 3b. the V-Card(s): the old name / number wherever it still shows on the member's cards and their Call /
  //     WhatsApp buttons (owner's call, 26 Sep 2026 — before this, an admin edit left the card with the old details).
  if (b.card !== false && (name !== null || phone)) {
    const was = (u.user_metadata ?? {}) as Record<string, unknown>;
    const n = await syncCardsIdentity(id, {
      name, oldName: String(was.display_name ?? was.full_name ?? was.name ?? ""), phone, oldPhone: currentMobile(u),
    }).catch(() => 0);
    if (n) done.push(n > 1 ? `V-Card (${n})` : "V-Card");
  }

  // --- 4. the partner ID — same person everywhere
  let partnerNote: string | null = null;
  if (b.partner !== false) {
    const pb: Record<string, unknown> = { suiteUserId: id, by: await who(request) };
    if (name !== null) pb.name = name;
    if (username !== null) pb.username = username;
    if (phone !== null) pb.mobile = phone;
    if (email !== null) pb.email = email;
    if (b.dob !== undefined) pb.dob = S(b.dob, 10);
    if (b.gender !== undefined) pb.gender = S(b.gender, 10);
    if (Object.keys(pb).length > 2) {
      const r = await partnerCall("member_update", pb, 10000);
      if (r.ok) done.push("partner ID");
      else if (r.status !== 404) partnerNote = `Partner ID not updated: ${r.data.error ?? r.status}`;
    }
  }
  return Response.json({ ok: true, done, partnerNote });
}
