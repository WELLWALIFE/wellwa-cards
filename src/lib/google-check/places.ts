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
};

type RawPlace = {
  id?: string; displayName?: { text?: string }; formattedAddress?: string; rating?: number; userRatingCount?: number;
  location?: { latitude?: number; longitude?: number }; primaryTypeDisplayName?: { text?: string }; primaryType?: string;
  websiteUri?: string; nationalPhoneNumber?: string; photos?: unknown[]; regularOpeningHours?: { periods?: unknown[] };
  googleMapsUri?: string; businessStatus?: string;
};
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
    "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.location");
  return (j.places ?? []).map(toCandidate).filter((c) => c.id && c.name);
}

/** The full public profile of one place. */
export async function placeDetails(id: string): Promise<Place> {
  const p = await call<RawPlace>(`/places/${encodeURIComponent(id)}?regionCode=IN&languageCode=en`, undefined,
    "id,displayName,formattedAddress,rating,userRatingCount,location,primaryType,primaryTypeDisplayName,websiteUri,nationalPhoneNumber,photos,regularOpeningHours,googleMapsUri,businessStatus", "GET");
  const c = toCandidate(p);
  return {
    ...c, category: p.primaryTypeDisplayName?.text || (p.primaryType ?? "").replace(/_/g, " ") || "business",
    website: p.websiteUri ?? "", phone: p.nationalPhoneNumber ?? "", photos: Array.isArray(p.photos) ? p.photos.length : 0,
    hoursSet: !!p.regularOpeningHours?.periods?.length, open: (p.businessStatus ?? "OPERATIONAL") === "OPERATIONAL",
    mapsUrl: p.googleMapsUri ?? "", status: p.businessStatus ?? "",
  };
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
