import "server-only";
// Who has which advanced feature (see src/lib/addons.ts). The switch lives in the account's auth APP metadata
// `addons` — set only by Super Admin with the service key; a user cannot write app_metadata, so it cannot be faked.
import { NextResponse } from "next/server";
import { SUPA_URL, serviceHeaders } from "@/lib/admin-guard";
import { restAsService } from "@/lib/poster-server";
import { advancedWithinYear, readAdvancedMeta, standardRunning } from "@/lib/advanced-access";
import { ADDONS, type Addon, type AddonKey } from "@/lib/addons";

export type AddonFlags = Partial<Record<AddonKey, { on: boolean; at?: string }>>;

async function authUser(userId: string): Promise<{ app_metadata?: Record<string, unknown> } | null> {
  try {
    const r = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, { headers: serviceHeaders(), cache: "no-store" });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

export async function readAddons(userId: string): Promise<AddonFlags> {
  const u = await authUser(userId);
  const a = u?.app_metadata?.addons;
  return a && typeof a === "object" ? (a as AddonFlags) : {};
}

export async function addonOn(ownerId: string, key: AddonKey): Promise<boolean> {
  return (await readAddons(ownerId))[key]?.on === true;
}

/** Super Admin switches one advanced feature on / off. The admin PUT replaces the whole `addons` key, so the rest is sent back. */
export async function setAddon(userId: string, key: AddonKey, on: boolean): Promise<boolean> {
  const addons: AddonFlags = { ...(await readAddons(userId)), [key]: { on, at: new Date().toISOString() } };
  try {
    const r = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, { method: "PUT", headers: serviceHeaders(), body: JSON.stringify({ app_metadata: { addons } }) });
    return r.ok;
  } catch { return false; }
}

/** Premium = the Premium website is paid and still running (the same rule as the Premium website itself). */
export async function premiumActive(userId: string): Promise<boolean> {
  const m = await readAdvancedMeta(userId).catch(() => null);
  return m?.paid === true && (advancedWithinYear(m) || (await standardRunning(userId)));
}

/** Does this advanced feature suit the account's business? Its poster profiles' category, or the words of its business / card. */
export async function fitsBusiness(userId: string, addon: Addon): Promise<boolean> {
  const [pp, cards] = await Promise.all([
    restAsService<{ category: string | null; name: string | null; tagline: string | null }[]>(`poster_profiles?user_id=eq.${userId}&select=category,name,tagline`),
    restAsService<{ name: string | null; company: string | null; job_title: string | null }[]>(`cards?owner_id=eq.${userId}&select=name,company,job_title&limit=20`),
  ]);
  const ps = pp.data ?? [];
  if (ps.some((p) => p.category && addon.categories.includes(p.category))) return true;
  const words = [...ps.flatMap((p) => [p.name, p.tagline]), ...(cards.data ?? []).flatMap((c) => [c.company, c.job_title])].filter(Boolean).join(" · ");
  return addon.words.test(words);
}

/** The answer for the API routes of an advanced feature: null when the shop (the workspace's owner) has it on. */
export async function addonGate(ownerId: string, key: AddonKey): Promise<NextResponse | null> {
  if (await addonOn(ownerId, key)) return null;
  const a = ADDONS.find((x) => x.key === key);
  return NextResponse.json({
    error: `"${a?.en ?? key}" is an advanced feature. It is customised for your business and switched on by Shubhora — see More → Advanced features.`,
    code: "addon_off",
  }, { status: 403 });
}
