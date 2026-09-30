import "server-only";
// Company designs are only for that company's people. A template with `brand` (e.g. the Wellwa Life distributor card,
// full of Wellwa's products, photos and plan) is shown and applied only to accounts linked to that brand
// (profiles.brand_id). Everyone else gets the general designs. Admins see everything.
import { restAsService, userFromRequest } from "@/lib/poster-server";
import type { CardTemplateDef } from "@/lib/templates";

/** The brand slug of the signed-in caller, or null (not signed in, or not linked to a company). */
export async function callerBrandSlug(request: Request): Promise<string | null> {
  const me = await userFromRequest(request).catch(() => null);
  return me ? brandSlugOf(me.id) : null;
}

export async function brandSlugOf(userId: string): Promise<string | null> {
  const p = (await restAsService<{ brand_id: string | null }[]>(`profiles?id=eq.${userId}&select=brand_id`)).data?.[0];
  if (!p?.brand_id) return null;
  const b = (await restAsService<{ slug: string; active: boolean }[]>(`brands?id=eq.${p.brand_id}&select=slug,active`)).data?.[0];
  return b?.active ? b.slug : null;
}

/** Brand of a template key, from the built-in list (a custom row reusing that key inherits it). */
export function templateBrand(key: string, builtIns: CardTemplateDef[]): string | null {
  return builtIns.find((t) => t.key === key)?.brand ?? null;
}

export function canUseTemplate(brand: string | null | undefined, callerBrand: string | null, admin = false): boolean {
  return admin || !brand || brand === callerBrand;
}
