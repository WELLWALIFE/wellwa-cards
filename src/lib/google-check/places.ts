import "server-only";
// Google Places API (New) for the Google Health Check (owner, 4 Nov 2026): public data only — rating, reviews count, photos,
// hours, phone, website — of ANY business, no login. Key: GOOGLE_PLACES_KEY (Google Cloud → Places API (New) enabled).
// Field masks keep every call on the cheapest SKU that still answers the question.
const KEY = () => (process.env.GOOGLE_PLACES_KEY ?? "").trim();
export const placesConfigured = () => !!KEY();
const BASE = "https://places.googleapis.com/v1";

export type Candidate = { id: string; name: string; address: string; rating: number; reviews: number; lat: number; lng: number };
export type Place = Candidate & {
  category: string; website: string; phone: string; photos: number; hoursSet: boolean; open: boolean; mapsUrl: string; status: string;
  /** Google's own type keys of the place besides the catch-alls ("jewelry_store", "store"): more than one = additional categories. */
  types?: string[];
  /** Any service option / attribute is filled in on the profile (delivery, takeaway, payment options, parking, accessibility…). */
  options?: boolean;
  /** The newest of the reviews Google shows for the place (it shows up to five), as an ISO date; "" = none shown. */
  lastReview?: string;
};

type RawPlace = {
  id?: string; displayName?: { text?: string }; formattedAddress?: string; rating?: number; userRatingCount?: number;
  location?: { latitude?: number; longitude?: number }; primaryTypeDisplayName?: { text?: string }; primaryType?: string;
  websiteUri?: string; nationalPhoneNumber?: string; photos?: unknown[]; regularOpeningHours?: { periods?: unknown[] };
  googleMapsUri?: string; businessStatus?: string; types?: string[]; reviews?: { publishTime?: string }[];
  delivery?: boolean; takeout?: boolean; dineIn?: boolean; curbsidePickup?: boolean; reservable?: boolean;
  paymentOptions?: Record<string, unknown>; parkingOptions?: Record<string, unknown>; accessibilityOptions?: Record<string, unknown>;
};
const CATCH_ALL = new Set(["point_of_interest", "establishment", "premise", "subpremise", "political", "geocode"]);
const toCandidate = (p: RawPlace): Candidate => ({
  id: p.id ?? "", name: p.displayName?.text ?? "", address: p.formattedAddress ?? "", rating: Number(p.rating ?? 0),
  reviews: Number(p.userRatingCount ?? 0), lat: Number(p.location?.latitude ?? 0), lng: Number(p.location?.longitude ?? 0),
});

async function call<T>(path: string, body: unknown, mask: string, method: "POST" | "GET" = "POST"): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method, headers: { "content-type": "application/json", "X-Goog-Api-Key": KEY(), "X-Goog-FieldMask": mask },
    body: method === "POST" ? JSON.stringify(body) : undefined, cache: "no-store", signal: AbortSignal.timeout(12_000),
  });
  if (!r.ok) throw new Error(`places ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()) as T;
}

/** Up to 5 businesses matching "<name> <city>" — the visitor picks theirs. */
export async function findPlaces(query: string): Promise<Candidate[]> {
  const j = await call<{ places?: RawPlace[] }>("/places:searchText", { textQuery: query, regionCode: "IN", languageCode: "en", maxResultCount: 5 },
    // No rating / review count here (25 Nov 2026): those two fields make the search an Enterprise call (1,000 free a month); without
    // them it is Pro (5,000). The report reads them from the place itself.
    "places.id,places.displayName,places.formattedAddress,places.location");
  return (j.places ?? []).map(toCandidate).filter((c) => c.id && c.name);
}

/** The full public profile of one place. */
/** Many shops put a WhatsApp or Facebook link in Google's "website" box. That is not a website of their own: nothing to speed-test,
 *  and the report must say a website is missing (Jagdish Misthan Bhandar, Udaipur, 25 Nov 2026 — its wa link got a site score). */
const NOT_A_SITE = /(^|\.)(wa\.me|whatsapp\.com|facebook\.com|fb\.com|fb\.me|instagram\.com|youtube\.com|youtu\.be|x\.com|twitter\.com|t\.me|linkedin\.com|g\.page)$/i;
export function ownSite(u?: string): string {
  if (!u) return "";
  try { return NOT_A_SITE.test(new URL(u).hostname) ? "" : u; } catch { return ""; }
}

export async function placeDetails(id: string): Promise<Place> {
  const p = await call<RawPlace>(`/places/${encodeURIComponent(id)}?regionCode=IN&languageCode=en`, undefined,
    "id,displayName,formattedAddress,rating,userRatingCount,location,primaryType,primaryTypeDisplayName,websiteUri,nationalPhoneNumber,photos,regularOpeningHours,googleMapsUri,businessStatus,types,delivery,takeout,dineIn,curbsidePickup,reservable,paymentOptions,parkingOptions,accessibilityOptions,reviews.publishTime", "GET");
  const c = toCandidate(p);
  return {
    ...c, category: p.primaryTypeDisplayName?.text || (p.primaryType ?? "").replace(/_/g, " ") || "business",
    website: ownSite(p.websiteUri), phone: p.nationalPhoneNumber ?? "", photos: Array.isArray(p.photos) ? p.photos.length : 0,
    hoursSet: !!p.regularOpeningHours?.periods?.length, open: (p.businessStatus ?? "OPERATIONAL") === "OPERATIONAL",
    mapsUrl: p.googleMapsUri ?? "", status: p.businessStatus ?? "",
    types: (p.types ?? []).filter((t) => !CATCH_ALL.has(t)),
    lastReview: (p.reviews ?? []).map((r) => r.publishTime ?? "").filter(Boolean).sort().pop() ?? "",
    options: [p.delivery, p.takeout, p.dineIn, p.curbsidePickup, p.reservable].some((v) => typeof v === "boolean")
      || [p.paymentOptions, p.parkingOptions, p.accessibilityOptions].some((o) => !!o && Object.keys(o).length > 0),
  };
}

/** The same-trade businesses Google lists for "<category> in <city>" around the place, in GOOGLE'S OWN ORDER (up to 20), and where
 *  the place itself comes in that list (1 = first; null = not in the first 20). One text search: the place's local standing without a
 *  paid rank service. An estimate — the order moves a little with the searcher's exact spot — and the report says so. */
export async function localList(place: Place, city: string, trade = place.category): Promise<{ list: Candidate[]; rank: number | null }> {
  const j = await call<{ places?: RawPlace[] }>("/places:searchText", {
    textQuery: `${trade} in ${city}`, regionCode: "IN", languageCode: "en", maxResultCount: 20,
    locationBias: { circle: { center: { latitude: place.lat, longitude: place.lng }, radius: 5000 } },
  }, "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.location");
  const list = (j.places ?? []).map(toCandidate).filter((c) => c.id && c.name);
  const at = list.findIndex((c) => c.id === place.id);
  return { list, rank: at < 0 ? null : at + 1 };
}

/** Nearby businesses of the same kind, best first (rating weighted by how many people rated), the place itself left out. */
export async function competitors(place: Place, city: string, n = 3): Promise<Candidate[]> {
  const j = await call<{ places?: RawPlace[] }>("/places:searchText", {
    textQuery: `${place.category} in ${city}`, regionCode: "IN", languageCode: "en", maxResultCount: 10,
    locationBias: { circle: { center: { latitude: place.lat, longitude: place.lng }, radius: 5000 } },
  }, "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.location");
  const score = (c: Candidate) => c.rating * Math.log10(c.reviews + 1);
  return (j.places ?? []).map(toCandidate).filter((c) => c.id && c.id !== place.id).sort((a, b) => score(b) - score(a)).slice(0, n);
}
