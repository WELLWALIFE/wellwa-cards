// Server only. A member's name and mobile live in several places — the login, the account row, the posters' default
// profile, the V-Card (its call / WhatsApp buttons) and the partner ID in the partner panel. Owner's call (26 Sep 2026):
// a change made in one place reaches all of them. Used by the member's own edit (/api/account/details) and by the
// Super Admin edit (/api/admin/profile).
import { SUPA_URL, serviceHeaders } from "@/lib/admin-guard";
import { partnerCall, partnerLinked } from "@/lib/partner-link";
import { restAsService } from "@/lib/poster-server";

/** The last 10 digits of anything that holds an Indian mobile number ("+91 98765 43210", "919876543210", …). */
export const last10 = (v: unknown) => String(v ?? "").replace(/\D/g, "").slice(-10);
const norm = (s: unknown) => String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

/** The mobile an account uses today: the one it saved, else the one it signed up with (the internal sign-in address). */
export function currentMobile(u: { email?: string | null; phone?: string | null; user_metadata?: Record<string, unknown> | null }): string {
  const md = u.user_metadata ?? {};
  const internal = /@phone\./i.test(u.email ?? "") ? String(u.email).split("@")[0] : "";
  return last10(md.phone || u.phone || internal);
}

/** Does another account already sign in with this mobile? (Login by mobile would then open THAT account.) */
export async function mobileUsedByOther(email: string | null | undefined, mobile: string): Promise<boolean> {
  const r = await restAsService<string>("rpc/auth_email_for", { method: "POST", body: JSON.stringify({ p: mobile }) });
  const found = r.ok && typeof r.data === "string" ? r.data.toLowerCase() : "";
  return !!found && found !== String(email ?? "").toLowerCase();
}

type CardRow = { id: string; name: string | null; data: Record<string, unknown> | null };

/**
 * The member's V-Cards: the old name → the new name, the old mobile → the new one on the Call and WhatsApp buttons.
 * Only what still shows the OLD details is replaced, so a card that deliberately carries another name or another
 * number (a shop's landline, a partner's number) is left as it is. Returns how many cards changed.
 */
export async function syncCardsIdentity(userId: string, c: { name?: string | null; oldName?: string | null; phone?: string | null; oldPhone?: string | null }): Promise<number> {
  const newName = String(c.name ?? "").trim().replace(/\s+/g, " ");
  const oldName = norm(c.oldName);
  const newPhone = last10(c.phone), oldPhone = last10(c.oldPhone);
  const nameChange = newName.length >= 2 && !!oldName && norm(newName) !== oldName;
  const phoneChange = newPhone.length === 10 && oldPhone.length === 10 && newPhone !== oldPhone;
  if (!nameChange && !phoneChange) return 0;
  const r = await fetch(`${SUPA_URL}/rest/v1/cards?owner_id=eq.${userId}&select=id,name,data`, { headers: serviceHeaders(), cache: "no-store" });
  const rows = (r.ok ? await r.json() : []) as CardRow[];
  let n = 0;
  for (const row of rows) {
    const data = { ...(row.data ?? {}) } as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    let changed = false;
    if (nameChange && norm(data.name ?? row.name) === oldName) { data.name = newName; patch.name = newName; changed = true; }
    if (phoneChange && Array.isArray(data.links)) {
      const before = JSON.stringify(data.links);
      const links = (data.links as { type?: string; value?: string }[]).map((l) =>
        l && (l.type === "phone" || l.type === "whatsapp") && last10(l.value) === oldPhone ? { ...l, value: `+91${newPhone}` } : l);
      if (JSON.stringify(links) !== before) { data.links = links; changed = true; }
    }
    if (!changed) continue;
    const u = await fetch(`${SUPA_URL}/rest/v1/cards?id=eq.${row.id}`, {
      method: "PATCH", headers: { ...serviceHeaders(), Prefer: "return=minimal" }, body: JSON.stringify({ ...patch, data }),
    });
    if (u.ok) n++;
  }
  return n;
}

/** The partner ID in the partner panel: same name and mobile as the app. Returns a note when the panel refused. */
export async function syncPartnerIdentity(userId: string, f: { name?: string | null; mobile?: string | null; by: string }): Promise<{ updated: boolean; note: string | null }> {
  if (!partnerLinked()) return { updated: false, note: null };
  const pb: Record<string, unknown> = { suiteUserId: userId, by: f.by };
  if (f.name) pb.name = f.name;
  if (f.mobile) pb.mobile = f.mobile;
  if (Object.keys(pb).length <= 2) return { updated: false, note: null };
  const r = await partnerCall("member_update", pb, 10000);
  if (r.ok) return { updated: true, note: null };
  if (r.status === 404) return { updated: false, note: null };   // not a partner yet — nothing to update
  return { updated: false, note: `Partner ID not updated: ${r.data.error ?? r.status}` };
}
