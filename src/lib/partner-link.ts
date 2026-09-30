// Server-to-server calls into the partner panel (a separate app on the same VPS). Signed with LINK_SECRET —
// the same secret the panel uses for its calls into us (/api/link). Never imported by client code.
import crypto from "node:crypto";
import { SUPA_URL, serviceHeaders } from "@/lib/admin-guard";

const URL_ = () => process.env.PARTNER_LINK_IN_URL || "http://127.0.0.1:3002/partners/api/link-in";
export const partnerLinked = () => !!process.env.LINK_SECRET;

export type PartnerSummary = { code: string; username: string | null; status: "red" | "green"; subValidUntil: string | null; team: number; teamGreen: number; teamToday?: number; directs: number; walletPaise: number; renewalsDue: number };

export async function partnerCall<T = Record<string, unknown>>(action: string, body: Record<string, unknown>, timeoutMs = 8000): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const secret = process.env.LINK_SECRET ?? "";
  if (!secret) return { ok: false, status: 503, data: { error: "partner panel not linked" } as T & { error?: string } };
  const raw = JSON.stringify({ action, ...body, ts: Date.now() });
  const sig = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  try {
    const r = await fetch(URL_(), { method: "POST", headers: { "content-type": "application/json", "x-link-signature": sig }, body: raw, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    const data = (await r.json().catch(() => ({}))) as T & { error?: string };
    return { ok: r.ok, status: r.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: { error: String((e as Error).message ?? e).slice(0, 120) } as T & { error?: string } };
  }
}

/* ---------- the account ↔ partner record ---------- */

/** Name, mobile and email as the account knows them — for the partner record. */
export async function accountIdentity(userId: string): Promise<{ name: string; mobile: string; email: string; meta: Record<string, unknown> }> {
  const r = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, { headers: serviceHeaders(), cache: "no-store" });
  const u = r.ok ? await r.json() : {};
  const md = (u.user_metadata ?? {}) as Record<string, unknown>;
  const email = String(u.email ?? "");
  const phoneEmail = /@phone\./.test(email) ? email.split("@")[0] : "";
  const mobile = String(md.phone ?? u.phone ?? phoneEmail ?? "").replace(/\D/g, "").slice(-10);
  let name = String(md.display_name ?? md.full_name ?? md.name ?? "").trim();
  if (!name) {
    const pr = await fetch(`${SUPA_URL}/rest/v1/poster_profiles?user_id=eq.${userId}&is_default=eq.true&select=name&limit=1`, { headers: serviceHeaders(), cache: "no-store" });
    name = String(((pr.ok ? await pr.json() : [])[0] ?? {}).name ?? "").trim();
  }
  return { name: name || "Shubhora member", mobile: mobile.length === 10 ? mobile : "", email: /@phone\./.test(email) ? "" : email, meta: md };
}

/** Register (or re-find) the account's partner ID and remember its code on the account, so the app's partner
 *  buttons (Me page, "Pay in partner panel") know this person is a partner. Never throws. */
export async function registerPartner(userId: string, username: string | null, referredBy: string | null, introducerHandle?: string | null, leg?: "L" | "R"): Promise<{ ok: boolean; code?: string; status?: string; error?: string }> {
  if (!partnerLinked()) return { ok: false, error: "not linked" };
  const me = await accountIdentity(userId);
  // `introducerHandle`: an older partner's SH code (no account username yet) — the panel resolves it itself.
  const r = await partnerCall<{ code?: string; username?: string | null; status?: string }>("register", {
    suiteUserId: userId, username, name: me.name, mobile: me.mobile || undefined, email: me.email || undefined,
    dob: typeof me.meta.dob === "string" ? me.meta.dob : undefined, gender: typeof me.meta.gender === "string" ? me.meta.gender : undefined,
    introducerSuiteUserId: referredBy ?? undefined, introducer: introducerHandle || undefined,
    // the side the link asked for (partner panel's left / right links); a retry without it reads the sign-up's choice
    leg: leg ?? (me.meta.introduced_leg === "L" || me.meta.introduced_leg === "R" ? me.meta.introduced_leg : undefined),
  });
  if (!r.ok) { console.error("[partner] register failed", r.status, r.data.error); return { ok: false, error: r.data.error }; }
  if (r.data.code && me.meta.associate_id !== r.data.code) {
    await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, { method: "PUT", headers: serviceHeaders(), body: JSON.stringify({ user_metadata: { ...me.meta, associate_id: r.data.code } }) }).catch(() => undefined);
  }
  return { ok: true, code: r.data.code, status: r.data.status };
}

/** A subscription paid inside the app: tell the partner panel so the ID turns green and the team earns.
 *  An account without a partner record yet is registered first (under the company when no introducer is known). */
export async function reportPaidToPartner(userId: string, p: { totalPaise: number; tier: string; ref: string }): Promise<{ ok: boolean; error?: string }> {
  if (!partnerLinked()) return { ok: false, error: "not linked" };
  let r = await partnerCall<{ ok?: boolean }>("paid", { suiteUserId: userId, totalPaise: p.totalPaise, tier: p.tier, ref: p.ref });
  if (r.status === 404) {
    const pr = await fetch(`${SUPA_URL}/rest/v1/profiles?id=eq.${userId}&select=username,referred_by&limit=1`, { headers: serviceHeaders(), cache: "no-store" });
    const prof = ((pr.ok ? await pr.json() : [])[0] ?? {}) as { username?: string | null; referred_by?: string | null };
    const reg = await registerPartner(userId, prof.username ?? null, prof.referred_by ?? null);
    if (reg.ok) r = await partnerCall<{ ok?: boolean }>("paid", { suiteUserId: userId, totalPaise: p.totalPaise, tier: p.tier, ref: p.ref });
  }
  if (!r.ok) console.error("[partner] paid not recorded", userId, p.ref, r.status, r.data.error);
  return { ok: r.ok, error: r.ok ? undefined : r.data.error };
}
