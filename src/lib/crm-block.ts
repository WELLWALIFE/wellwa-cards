import "server-only";
// Personal numbers (owner, 23 Oct 2026: "ek option jisse wo hamesha ke liye CRM se hat jaaye aur AI WhatsApp par reply bhi
// for ever band kar de" — family, friends). A blocked number is matched on its last 10 digits and kept in the owner's CRM
// settings (owner_prefs.crm.blocked, outside the settings form so saving that form never drops it). Blocking:
//   • removes every lead of that number from the CRM, with its chat (wa_messages) — tasks, notes and calls go with the lead;
//   • the WhatsApp bridge reads the list (bridge/index.mjs isNeverReply): no AI reply, no follow-up, nothing logged as a lead;
//   • the WhatsApp Cloud path skips such a message altogether (lib/wa-cloud.ts).
// Unblocking takes the number off the list; the deleted history does not come back.
import { restAsService } from "@/lib/poster-server";

const tail = (phone: string) => String(phone ?? "").replace(/\D/g, "").slice(-10);
const MAX = 2000;
const cache = new Map<string, { at: number; list: string[] }>();

async function rawCrm(ownerId: string): Promise<Record<string, unknown> | null> {
  const r = await restAsService<{ crm: Record<string, unknown> | null }[]>(`owner_prefs?owner_id=eq.${ownerId}&select=crm`);
  if (!r.ok) throw new Error("prefs read failed");
  return Array.isArray(r.data) && r.data[0] ? r.data[0].crm ?? {} : null;
}
async function writeList(ownerId: string, list: string[]) {
  const crm = (await rawCrm(ownerId)) ?? {};
  const r = await restAsService("owner_prefs", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ owner_id: ownerId, crm: { ...crm, blocked: list.slice(0, MAX) }, updated_at: new Date().toISOString() }) });
  if (!r.ok) throw new Error("prefs write failed");
  cache.set(ownerId, { at: Date.now(), list });
}

export async function blockedOf(ownerId: string): Promise<string[]> {
  const hit = cache.get(ownerId);
  if (hit && Date.now() - hit.at < 60_000) return hit.list;
  const crm = await rawCrm(ownerId).catch(() => null);
  const list = Array.isArray(crm?.blocked) ? (crm!.blocked as unknown[]).map((x) => tail(String(x))).filter((x) => x.length === 10) : [];
  cache.set(ownerId, { at: Date.now(), list });
  return list;
}
export async function isBlocked(ownerId: string, phone: string): Promise<boolean> {
  const t = tail(phone);
  return t.length === 10 && (await blockedOf(ownerId)).includes(t);
}

/** Blocks the number and removes it from the CRM. Returns how many leads were removed. */
export async function blockNumber(ownerId: string, phone: string): Promise<{ ok: boolean; removed: number; number: string }> {
  const t = tail(phone);
  if (t.length !== 10) return { ok: false, removed: 0, number: t };
  cache.delete(ownerId);
  const list = await blockedOf(ownerId);
  if (!list.includes(t)) await writeList(ownerId, [t, ...list]);
  const like = encodeURIComponent(`*${t}`);
  const gone = await restAsService<{ id: string }[]>(`leads?owner_id=eq.${ownerId}&phone=like.${like}&select=id`, { method: "DELETE", headers: { Prefer: "return=representation" } });
  await restAsService(`wa_messages?owner_id=eq.${ownerId}&phone=like.${like}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => null);
  return { ok: true, removed: Array.isArray(gone.data) ? gone.data.length : 0, number: t };
}
export async function unblockNumber(ownerId: string, phone: string): Promise<boolean> {
  const t = tail(phone);
  cache.delete(ownerId);
  const list = await blockedOf(ownerId);
  if (!list.includes(t)) return true;
  await writeList(ownerId, list.filter((x) => x !== t));
  return true;
}
