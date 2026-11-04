import "server-only";
// Google Health Check (owner, 4 Nov 2026): "Apni dukaan ka Google score dekho". Public data only. One report costs real money
// (Places + DataForSEO), so a finished report is kept 7 days in google_checks and served again for free.
import { getAdminSupabase } from "@/lib/supabase/admin";
import { competitors, findPlaces, placeDetails, placesConfigured, type Candidate, type Place } from "./places";
import { keywordsFor, mapsRanks, rankConfigured, type RankRow } from "./rank";
import { NO_SITE, siteCheck, type SiteCheck } from "./pagespeed";
import { scoreOf, type Breakdown, type Fix } from "./score";

export { findPlaces, placesConfigured };
export const CACHE_DAYS = 7;

export type Report = {
  place: Place; city: string; ranks: RankRow[]; rankChecked: boolean; site: SiteCheck; rivals: Candidate[];
  score: number; breakdown: Breakdown[]; fixes: Fix[]; at: string;
};

export function cityOf(address: string): string {
  // "12, MG Road, Jaipur, Rajasthan 302001, India" → "Jaipur"
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  const idx = parts.findIndex((p) => /\b\d{6}\b/.test(p));
  const pick = idx > 1 ? parts[idx - 2] : parts[Math.max(0, parts.length - 3)];
  return (pick ?? "").replace(/\b\d{6}\b/, "").trim() || "your city";
}

export async function cachedReport(placeId: string): Promise<Report | null> {
  const admin = getAdminSupabase(); if (!admin) return null;
  const since = new Date(Date.now() - CACHE_DAYS * 86_400_000).toISOString();
  const { data } = await admin.from("google_checks").select("report").eq("place_id", placeId).gte("created_at", since).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data?.report as Report | undefined) ?? null;
}

export async function buildReport(placeId: string): Promise<Report> {
  const place = await placeDetails(placeId);
  const city = cityOf(place.address);
  const [rivals, ranks, site] = await Promise.all([
    competitors(place, city).catch(() => [] as Candidate[]),
    rankConfigured() ? mapsRanks(place, keywordsFor(place.category, city)).catch(() => null) : Promise.resolve(null),
    place.website ? siteCheck(place.website).catch(() => NO_SITE) : Promise.resolve(NO_SITE),
  ]);
  const rankRows = ranks ?? keywordsFor(place.category, city).map((keyword) => ({ keyword, rank: null, top: [] }));
  const s = scoreOf(place, rankRows, site, rivals);
  return { place, city, ranks: rankRows, rankChecked: ranks !== null, site, rivals, ...s, at: new Date().toISOString() };
}

export async function saveReport(r: Report, meta: { ip: string; userId?: string; phone?: string; query: string }) {
  const admin = getAdminSupabase(); if (!admin) return;
  await admin.from("google_checks").insert({ place_id: r.place.id, name: r.place.name, city: r.city, query: meta.query, score: r.score, report: r, ip: meta.ip, user_id: meta.userId ?? null, phone: meta.phone ?? null });
}
