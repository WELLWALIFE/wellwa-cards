// The account's one name and its partner account.
//   GET  → { username, referredBy, cardSlug, partner }   cardSlug = their card's link name (null before a card exists);
//          partner = the panel's summary (status, team, wallet) or null
//   POST { username, by? } → takes the username once (the database enforces the rules and uniqueness), records the
//          introducer, and registers the partner account in the panel — every Shubhora account is a partner account.
//   POST { action: "register" } → (re)tries the partner registration for an account that already has its username.
//   POST { action: "auto", by?, leg?, agree? } → a Google sign-up: its username is made from its name and its partner
//          ID registered at once (owner's call, 28 Sep 2026 — Google sign-ups were left without an ID when they never
//          picked a username). GET does the same for a Google account that still has none.
// Bearer token, like every /api/poster/* route (the phone app and the web app both send it).
import { NextResponse } from "next/server";
import { userFromRequest, restAsUser } from "@/lib/poster-server";
import { partnerCall, partnerLinked, registerPartner, type PartnerSummary } from "@/lib/partner-link";
import { cleanAccountUsername, usernameOk, DEFAULT_INTRODUCER } from "@/lib/username";
import { SUPA_URL, serviceHeaders } from "@/lib/admin-guard";

async function saveMeta(userId: string, patch: Record<string, unknown>) {
  const r = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, { headers: serviceHeaders(), cache: "no-store" });
  const u = r.ok ? await r.json() : {};
  await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, { method: "PUT", headers: serviceHeaders(), body: JSON.stringify({ user_metadata: { ...(u.user_metadata ?? {}), ...patch } }) }).catch(() => undefined);
}

/** The account as Supabase keeps it (name, how it signed up). */
async function authUser(userId: string): Promise<{ meta: Record<string, unknown>; email: string; providers: string[] }> {
  const r = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, { headers: serviceHeaders(), cache: "no-store" });
  const u = r.ok ? await r.json() : {};
  const am = (u.app_metadata ?? {}) as { provider?: string; providers?: string[] };
  return { meta: (u.user_metadata ?? {}) as Record<string, unknown>, email: String(u.email ?? ""), providers: am.providers ?? (am.provider ? [am.provider] : []) };
}

/** Usernames to try for a name — "Anoop Roy" → AnoopRoy, then AnoopRoy + 2-3 digits (the same rule as the sign-up form). */
function usernameIdeas(name: string, email: string): string[] {
  let words = name.trim().split(/\s+/).map((w) => cleanAccountUsername(w)).filter(Boolean);
  if (!words.length) words = [cleanAccountUsername(email.split("@")[0] ?? "")].filter(Boolean);
  if (!words.length) words = ["Member"];
  const base0 = words.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join("").slice(0, 16);
  const base = base0.length >= 4 ? base0 : `${base0}_in`.slice(0, 16);
  return [base, ...Array.from({ length: 6 }, () => `${base}${Math.floor(10 + Math.random() * 990)}`)].filter(usernameOk);
}

/** Give an account without a username one (from its name) and register its partner ID under the introducer.
 *  Never throws; returns the username it ended up with, or null. */
async function autoAccount(me: { id: string; token: string }, by: string | null, leg?: "L" | "R", agree = false): Promise<string | null> {
  const acct = await authUser(me.id);
  const name = String(acct.meta.display_name ?? acct.meta.full_name ?? acct.meta.name ?? "");
  for (const u of usernameIdeas(name, acct.email)) {
    const r = await restAsUser<{ ok: boolean; error?: string; username?: string; referred_by?: string | null }>(me.token, "rpc/claim_username", {
      method: "POST", body: JSON.stringify({ p_username: u, p_by: by }),
    });
    const res = r.data;
    if (!r.ok || !res) return null;
    // Another request (two pages opening at once) claimed it a moment ago: that one registers the ID — never twice.
    if (!res.ok && res.error === "already set") return res.username ?? null;
    if (!res.ok) continue;                                          // taken → the next idea
    const username = res.username ?? u;
    // "Continue with Google" sits under the Terms / Partner Agreement line: pressing it is the acceptance.
    if (agree && !acct.meta.agreed_at) await saveMeta(me.id, { agreed_at: new Date().toISOString(), agreed_via: "google" });
    const referred = res.referred_by ?? (await profile(me.token, me.id))?.referred_by ?? null;
    await registerPartner(me.id, username, referred, by, leg);
    return username;
  }
  return null;
}

type Prof = { username: string | null; referred_by: string | null; referral_code?: string | null };

async function profile(token: string, id: string): Promise<Prof | null> {
  const r = await restAsUser<Prof[]>(token, `profiles?select=username,referred_by,referral_code&id=eq.${id}&limit=1`);
  return r.data?.[0] ?? null;
}

/** The link name of the person's card (their first live one), or null before they build a card. */
async function cardSlug(token: string, id: string): Promise<string | null> {
  // Filtered to this account: live cards are publicly readable, so without it this returned someone else's card.
  const r = await restAsUser<{ username: string; active: boolean | null }[]>(token, `cards?select=username,active&owner_id=eq.${id}&order=created_at.asc&limit=10`);
  const rows = r.data ?? [];
  return (rows.find((c) => c.active !== false) ?? rows[0])?.username ?? null;
}

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const [p0, card] = await Promise.all([profile(me.token, me.id), cardSlug(me.token, me.id)]);
  let p = p0;
  // A Google sign-up that never picked a username (so it has no partner ID either): made now, from its name.
  if (p && !p.username && (await authUser(me.id)).providers.includes("google")) {
    if (await autoAccount(me, null)) p = await profile(me.token, me.id);
  }
  let partner: PartnerSummary | null = null;
  if (partnerLinked()) {
    const r = await partnerCall<PartnerSummary>("summary", { suiteUserId: me.id }, 5000);
    if (r.ok) partner = r.data;
    else if (r.status === 404 && p?.username) {
      // Registered before the partner link existed (or the panel was down at sign-up): register now, quietly.
      const reg = await registerPartner(me.id, p.username, p.referred_by);
      if (reg.ok) { const r2 = await partnerCall<PartnerSummary>("summary", { suiteUserId: me.id }, 5000); if (r2.ok) partner = r2.data; }
    }
  }
  return NextResponse.json({ username: p?.username ?? null, referredBy: p?.referred_by ?? null, referralCode: p?.referral_code ?? null, cardSlug: card, partner });
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as { username?: unknown; by?: unknown; leg?: unknown; action?: unknown; dob?: unknown; gender?: unknown; agree?: unknown };

  if (b.action === "auto") {
    const p = await profile(me.token, me.id);
    if (p?.username) return NextResponse.json({ ok: true, username: p.username, note: "already set" });
    const by = String(b.by ?? "").trim().slice(0, 40) || process.env.DEFAULT_INTRODUCER || DEFAULT_INTRODUCER;
    const username = await autoAccount(me, by, b.leg === "L" || b.leg === "R" ? b.leg : undefined, b.agree === true);
    return NextResponse.json(username ? { ok: true, username } : { error: "Could not make the username." }, { status: username ? 200 : 502 });
  }

  if (b.action === "register") {
    const p = await profile(me.token, me.id);
    const reg = await registerPartner(me.id, p?.username ?? null, p?.referred_by ?? null);
    return NextResponse.json(reg, { status: reg.ok ? 200 : 502 });
  }

  const username = cleanAccountUsername(String(b.username ?? ""));
  if (!usernameOk(username)) return NextResponse.json({ error: "Username: 4 to 20 letters, numbers or _." }, { status: 400 });
  const by = String(b.by ?? "").trim().slice(0, 40) || process.env.DEFAULT_INTRODUCER || DEFAULT_INTRODUCER;
  // The claim runs as the user (auth.uid() inside the function): the database checks availability and reserved names.
  const r = await restAsUser<{ ok: boolean; error?: string; username?: string; referred_by?: string | null }>(me.token, "rpc/claim_username", {
    method: "POST", body: JSON.stringify({ p_username: username, p_by: by }),
  });
  const res = r.data;
  if (!r.ok || !res) return NextResponse.json({ error: "Could not save the username. Please try again." }, { status: 500 });
  if (!res.ok) {
    if (res.error === "already set") return NextResponse.json({ ok: true, username: res.username, note: "already set" });
    return NextResponse.json({ error: res.error === "taken" ? "That username is taken or not allowed — try another." : res.error }, { status: 409 });
  }
  // Details a Google sign-up did not give on the form (date of birth, gender, the agreement) are stored on the account.
  const dob = /^\d{4}-\d{2}-\d{2}$/.test(String(b.dob ?? "")) ? String(b.dob) : null;
  const gender = ["male", "female", "other"].includes(String(b.gender ?? "")) ? String(b.gender) : null;
  if (dob || gender || b.agree === true) await saveMeta(me.id, { ...(dob ? { dob } : {}), ...(gender ? { gender } : {}), ...(b.agree === true ? { agreed_at: new Date().toISOString() } : {}) });
  // The partner account, placed under the introducer. A failure here never blocks the sign-up: GET retries it.
  const leg = b.leg === "L" || b.leg === "R" ? b.leg : undefined;   // the link's side; none → weaker side
  const partner = await registerPartner(me.id, username, res.referred_by ?? null, by, leg);
  return NextResponse.json({ ok: true, username, partner });
}
