// Which websites are Premium (owner, 15 Nov 2026: "koi Standard nahi, koi Premium nahi — sab ek kar do"): every owner may wear any of the
// designs, Standard looks and Premium designs alike. The package decides what the website DOES, not how it looks:
//   Premium (site_premium, or a custom package)  the website works as an app (the visitor installs it from the site), it is on Google, and
//                                                it is open to the AI search engines (ChatGPT, Gemini) — all through being indexed.
//   Standard (site_standard)                     the same designs, kept out of search (noindex) and with no "install the app".
// Read on the server from the owner's profile (never from the card, which the owner's phone writes). An account with no running package
// counts as it did before packages existed: Premium when its Premium design is on.
import { restAsService } from "@/lib/poster-server";
import { activeAdvanced } from "@/lib/site-advanced";

export type OwnerPkg = { package?: string | null; package_until?: string | null };

const runs = (until?: string | null, now = Date.now()) => !!until && Date.parse(until) > now;

/** Premium features (app install, Google, AI search) for this website? */
export function premiumTier(site: unknown, username: string, p: OwnerPkg | null | undefined, now = Date.now()): boolean {
  if (p && runs(p.package_until, now)) {
    if (p.package === "site_premium" || p.package === "custom") return true;
    if (p.package === "site_standard") return false;
  }
  return !!activeAdvanced(site, username);
}

/** The packages of these owners (a failed lookup leaves them out: they fall back to the rule above). */
export async function packagesOf(ownerIds: string[]): Promise<Map<string, OwnerPkg>> {
  const out = new Map<string, OwnerPkg>();
  const ids = [...new Set(ownerIds.filter((x) => /^[0-9a-f-]{36}$/i.test(x)))];
  for (let i = 0; i < ids.length; i += 100) {
    const part = ids.slice(i, i + 100);
    const r = await restAsService<({ id: string } & OwnerPkg)[]>(`profiles?id=in.(${part.join(",")})&select=id,package,package_until`).catch(() => null);
    for (const x of r?.data ?? []) out.set(x.id, { package: x.package, package_until: x.package_until });
  }
  return out;
}

/** One owner's package. */
export async function packageOf(ownerId: string | null | undefined): Promise<OwnerPkg | null> {
  if (!ownerId) return null;
  return (await packagesOf([ownerId])).get(ownerId) ?? null;
}

/** May this account put any of the designs on its website (a running package, any of them)? */
export async function packageRunning(ownerId: string): Promise<boolean> {
  const p = await packageOf(ownerId);
  return !!p && runs(p.package_until) && ["site_standard", "site_premium", "custom"].includes(p.package ?? "");
}
