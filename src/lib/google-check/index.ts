import "server-only";
// Google Health Check (owner, 4 Nov 2026): "Apni dukaan ka Google score dekho". Public data only. One report costs real money
// (Places + DataForSEO), so a finished report is kept 7 days in google_checks and served again for free.
import { getAdminSupabase } from "@/lib/supabase/admin";
import { findPlaces, localList, placeDetails, placesConfigured, type Candidate, type Place } from "./places";
import { keywordsFor, mapsRanks, rankConfigured, type RankRow } from "./rank";
import { NO_SITE, siteCheck, type SiteCheck } from "./pagespeed";
import { scoreOf, type Breakdown, type Fix } from "./score";

export { findPlaces, placesConfigured };
export const CACHE_DAYS = 7;

export type Report = {
  place: Place; city: string; ranks: RankRow[]; rankChecked: boolean; site: SiteCheck; rivals: Candidate[];
  score: number; breakdown: Breakdown[]; fixes: Fix[]; at: string;
  /** The report as redrawn on 25 Nov 2026 (owner: "competitor kis tarah present kar rahe hain, aur hum tukka maar rahe hain"). */
  v?: 2;
  /** Where the place comes among the same-trade businesses Google lists around it: `rank` (null = not in the first `total`), and the
   *  ones ahead of it in Google's order. Absent for a place Google files under no trade. An estimate from one search. */
  local?: { rank: number | null; total: number; ahead: Candidate[] };
  /** The parts of the Google profile we can see from outside, each filled in or not. */
  profile?: { label: string; ok: boolean }[];
  /** What the local list was searched by: Google's own category, or — when Google files the place under no trade — what the visitor
   *  said they sell ("water purifier"). */
  trade?: string;
  /** Everything found, not only the first three. */
  issues?: Fix[];
};

const GENERIC = /^(business|point of interest|establishment|premise|corporate office|company|)$/i;

export function cityOf(address: string): string {
  // "12, MG Road, Jaipur, Rajasthan 302001, India" → "Jaipur"
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  const idx = parts.findIndex((p) => /\b\d{6}\b/.test(p));
  // The PIN shares its part with the state ("Rajasthan 302001"): the city is the part before it. A PIN on its own ("…, Jaipur, Rajasthan,
  // 302001"): two before. (The old rule always took two before and gave "MG Road" or "Sector 24" — 25 Nov 2026, Wellwa Life's report.)
  const pinAlone = idx >= 0 && /^\d{6}$/.test(parts[idx].replace(/\s+/g, ""));
  let at = idx < 0 ? Math.max(0, parts.length - 3) : pinAlone ? idx - 2 : idx - 1;
  // Google sometimes puts the civic body after the city ("Jaipur, Jaipur Nagar Nigam Area, Rajasthan 302003"): step back past it.
  while (at > 0 && /nagar nigam|municipal|corporation|\barea\b|district|tehsil/i.test(parts[at] ?? "")) at--;
  const pick = parts[at];
  return (pick ?? "").replace(/\b\d{6}\b/, "").trim() || "your city";
}

export async function cachedReport(placeId: string): Promise<Report | null> {
  const admin = getAdminSupabase(); if (!admin) return null;
  const since = new Date(Date.now() - CACHE_DAYS * 86_400_000).toISOString();
  const { data } = await admin.from("google_checks").select("report").eq("place_id", placeId).gte("created_at", since).order("created_at", { ascending: false }).limit(1).maybeSingle();
  // A report kept from before the redraw has no local list or profile: it is made again.
  const r = data?.report as Report | undefined;
  return r && r.v === 2 ? r : null;
}

export async function buildReport(placeId: string, sells = ""): Promise<Report> {
  const place = await placeDetails(placeId);
  const city = cityOf(place.address);
  const generic = GENERIC.test(place.category.trim());
  // Google has no trade for the place (many small shops: "Zinda pani" is just a "business"): the visitor's own words are searched
  // instead, so the report can still show who is ahead of them (owner, 25 Nov 2026).
  const said = sells.replace(/[^\p{L}\p{N} &'-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 40);
  const trade = generic ? said : place.category;
  const [near, ranks, site] = await Promise.all([
    // A place Google files under no trade ("business") has no real rivals: "business in Gurugram" brought malls and office parks,
    // and the report compared a company's 17 reviews with a mall's 28,000. No trade, no comparison.
    trade ? localList(place, city, trade).catch(() => null) : Promise.resolve(null),
    rankConfigured() ? mapsRanks(place, keywordsFor(place.category, city)).catch(() => null) : Promise.resolve(null),
    place.website ? siteCheck(place.website).catch(() => NO_SITE) : Promise.resolve(NO_SITE),
  ]);
  const others = (near?.list ?? []).filter((c) => c.id !== place.id);
  const weight = (c: Candidate) => c.rating * Math.log10(c.reviews + 1);
  const rivals = [...others].sort((a, b) => weight(b) - weight(a)).slice(0, 3);
  const local = near && near.list.length >= 3
    ? { rank: near.rank, total: near.list.length, ahead: near.rank === null ? others : near.list.slice(0, near.rank - 1) }
    : undefined;
  const rankRows = ranks ?? keywordsFor(place.category, city).map((keyword) => ({ keyword, rank: null, top: [] }));
  const s = scoreOf(place, rankRows, site, rivals, ranks !== null);

  const profile = [
    { label: "Title", ok: !!place.name },
    { label: "Address", ok: !!place.address },
    { label: "Primary category", ok: !generic },
    { label: "Additional categories", ok: (place.types ?? []).length >= 2 },
    { label: "Phone", ok: !!place.phone },
    { label: "Website", ok: !!place.website },
    { label: "Business hours", ok: place.hoursSet },
    { label: "Photos (10+)", ok: place.photos >= 10 },
    { label: "Reviews", ok: place.reviews > 0 },
    { label: "Service options", ok: !!place.options },
  ];
  const issues: Fix[] = [];
  if (local && local.ahead.length > 0) issues.push(local.rank === null
    ? { title: `Not in the first ${local.total} for "${trade} in ${city}"`, why: `${local.total} businesses of your kind show before you when people search nearby.`, plan: "growth", hi: `"${trade} in ${city}" search mein pehle ${local.total} mein nahi - ${local.total} businesses aapse pehle dikhte hain` }
    : { title: `#${local.rank} for "${trade} in ${city}"`, why: `${local.ahead.length} ${local.ahead.length === 1 ? "business shows" : "businesses show"} before you. Most people call one of the first three.`, plan: "growth", hi: `"${trade} in ${city}" search mein #${local.rank} - ${local.ahead.length} businesses aapse pehle dikhte hain` });
  issues.push(...s.issues);
  if (generic) issues.push({ title: "No clear business category on Google", why: "Google does not know what you sell, so it cannot show you for any search of your trade. Pick the exact category.", plan: "growth", hi: "Google par business category saaf nahi hai - Google ko pata nahi aap kya bechte hain" });
  else if ((place.types ?? []).length < 2) issues.push({ title: "Additional categories are not set", why: "Google uses them to show you for nearby searches of related things.", plan: "growth", hi: "Additional categories set nahi hain - nearby searches mein rank karne ke liye Google inhe use karta hai" });
  if (!place.phone) issues.push({ title: "No phone number on the profile", why: "People cannot call you from Google.", plan: "growth", hi: "Profile par phone number nahi hai - customers Google se call nahi kar sakte" });
  if (!place.options) issues.push({ title: "Service options are not filled in", why: "Delivery, payment and other options help Google match you to what people ask for.", plan: "growth", hi: "Service options bhare nahi hain - delivery, payment jaise options se Google aapko sahi search se jodta hai" });
  if (place.reviews === 0) issues.push({ title: "No reviews yet", why: "A profile with no reviews is rarely chosen. Ask your first ten happy customers.", plan: "growth", hi: "Abhi ek bhi review nahi hai - bina reviews wali profile ko log kam chunte hain" });
  const seen = new Set<string>();
  // No reviews at all: said once ("No reviews yet"), not also as "Fewer than 30 reviews".
  const all = issues.filter((f) => !(place.reviews === 0 && f.title === "Fewer than 30 reviews")).filter((f) => !seen.has(f.title) && !!seen.add(f.title));
  return { place, city, ranks: rankRows, rankChecked: ranks !== null, site, rivals, score: s.score, breakdown: s.breakdown, fixes: all.slice(0, 3), issues: all, local, profile, ...(trade ? { trade } : {}), v: 2, at: new Date().toISOString() };
}

export async function saveReport(r: Report, meta: { ip: string; userId?: string; phone?: string; query: string }) {
  const admin = getAdminSupabase(); if (!admin) return;
  await admin.from("google_checks").insert({ place_id: r.place.id, name: r.place.name, city: r.city, query: meta.query, score: r.score, report: r, ip: meta.ip, user_id: meta.userId ?? null, phone: meta.phone ?? null });
}
