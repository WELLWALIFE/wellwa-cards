import "server-only";
// Where a business stands in Google Maps for a few searches, via DataForSEO (owner's choice, 4 Nov 2026 — about ₹0.2 a search).
// Login: DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD. The search is made from the business's own spot, so "near me" means its area.
// Google's own results page is never scraped (Google's terms).
const creds = () => ({ login: (process.env.DATAFORSEO_LOGIN ?? "").trim(), password: (process.env.DATAFORSEO_PASSWORD ?? "").trim() });
export const rankConfigured = () => { const c = creds(); return !!(c.login && c.password); };

export type RankRow = { keyword: string; rank: number | null; top: { name: string; rating: number; reviews: number }[] };

type Item = { type?: string; rank_absolute?: number; title?: string; place_id?: string; cid?: string; rating?: { value?: number; votes_count?: number } };
type Task = { status_code?: number; status_message?: string; result?: { items?: Item[] }[] };

/** Keywords a customer would really type for this kind of business. */
export function keywordsFor(category: string, city: string): string[] {
  const c = category.toLowerCase().replace(/\s+(shop|store)$/, "").trim() || "shop";
  return [`${c} near me`, `${c} in ${city}`, `best ${c} in ${city}`];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export async function mapsRanks(place: { id: string; name: string; lat: number; lng: number }, keywords: string[]): Promise<RankRow[]> {
  const { login, password } = creds();
  const tasks = keywords.map((keyword) => ({ keyword, location_coordinate: `${place.lat},${place.lng},14z`, language_code: "en", depth: 20, device: "mobile" }));
  const r = await fetch("https://api.dataforseo.com/v3/serp/google/maps/live/advanced", {
    method: "POST", headers: { "content-type": "application/json", authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}` },
    body: JSON.stringify(tasks), cache: "no-store", signal: AbortSignal.timeout(45_000),
  });
  if (!r.ok) throw new Error(`dataforseo ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = (await r.json()) as { tasks?: Task[] };
  const me = norm(place.name);
  return keywords.map((keyword, i) => {
    const items = (j.tasks?.[i]?.result?.[0]?.items ?? []).filter((it) => it.type === "maps_search");
    const hit = items.find((it) => it.place_id === place.id) ?? items.find((it) => norm(it.title ?? "") === me);
    return {
      keyword, rank: hit?.rank_absolute ?? null,
      top: items.slice(0, 3).map((it) => ({ name: it.title ?? "", rating: Number(it.rating?.value ?? 0), reviews: Number(it.rating?.votes_count ?? 0) })),
    };
  });
}
