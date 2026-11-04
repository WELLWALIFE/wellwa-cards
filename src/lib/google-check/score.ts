// The Google score (0–100) and the three things to fix first. Plain rules, no AI — the same business always gets the same score.
import type { Candidate, Place } from "./places";
import type { RankRow } from "./rank";
import type { SiteCheck } from "./pagespeed";

export type Fix = { title: string; why: string; plan: "website" | "growth" };
export type Breakdown = { label: string; got: number; max: number };

export function scoreOf(place: Place, ranks: RankRow[], site: SiteCheck, rivals: Candidate[]): { score: number; breakdown: Breakdown[]; fixes: Fix[] } {
  const b: Breakdown[] = []; const fixes: Fix[] = [];
  const add = (label: string, got: number, max: number) => b.push({ label, got, max });

  add("Google Business Profile", 15, 15);
  const r = place.rating; add("Rating", r >= 4.5 ? 20 : r >= 4 ? 14 : r >= 3.5 ? 8 : r > 0 ? 3 : 0, 20);
  const n = place.reviews; add("Reviews", n >= 100 ? 15 : n >= 30 ? 10 : n >= 10 ? 5 : n > 0 ? 1 : 0, 15);
  add("Photos", place.photos >= 10 ? 5 : place.photos > 0 ? 3 : 0, 5);
  add("Opening hours", place.hoursSet ? 5 : 0, 5);
  add("Phone number", place.phone ? 5 : 0, 5);
  add("Website", place.website ? 5 : 0, 5);
  add("Website speed (mobile)", site.checked ? (site.performance >= 70 ? 10 : site.performance >= 40 ? 5 : 0) : 0, 10);
  add("Website SEO basics", site.checked ? (site.seo >= 80 ? 5 : site.seo >= 50 ? 2 : 0) : 0, 5);
  const best = ranks.map((x) => x.rank).filter((x): x is number => x !== null).sort((a, c) => a - c)[0] ?? null;
  add("Maps rank", best === null ? 0 : best <= 3 ? 15 : best <= 10 ? 8 : 3, 15);

  const score = b.reduce((s, x) => s + x.got, 0);
  const rivalAvg = rivals.length ? rivals.reduce((s, x) => s + x.rating, 0) / rivals.length : 0;
  const rivalReviews = rivals.length ? Math.round(rivals.reduce((s, x) => s + x.reviews, 0) / rivals.length) : 0;

  if (best === null) fixes.push({ title: "Not in the top 20 on Google Maps", why: "Customers searching nearby never see you. Weekly Google posts, photos and review replies push you up.", plan: "growth" });
  else if (best > 3) fixes.push({ title: `#${best} on Maps — not in the top 3`, why: "Most people call one of the first three. Regular posts, photos and fresh reviews move you up.", plan: "growth" });
  if (n < rivalReviews) fixes.push({ title: `${n} reviews vs ${rivalReviews} for competitors`, why: "Google trusts businesses people talk about. Ask every happy customer, reply to every review.", plan: "growth" });
  else if (n < 30) fixes.push({ title: "Fewer than 30 reviews", why: "Google trusts businesses people talk about. Ask every happy customer, reply to every review.", plan: "growth" });
  if (r > 0 && r < rivalAvg - 0.2) fixes.push({ title: `Rating ${r.toFixed(1)} is below nearby competitors (${rivalAvg.toFixed(1)})`, why: "Reply to every review, fix the complaints, ask happy customers to rate.", plan: "growth" });
  if (!place.website) fixes.push({ title: "No website on your profile", why: "Google and AI search rank businesses with a real website higher — and people check it before calling.", plan: "website" });
  else if (site.checked && site.performance < 50) fixes.push({ title: `Website is slow on phones (${site.performance}/100)`, why: "A slow site loses visitors and rank. A light, fast site fixes both.", plan: "website" });
  else if (site.checked && site.seo < 70) fixes.push({ title: "Website is missing SEO basics", why: "Page titles, descriptions and schema tell Google what you sell.", plan: "website" });
  if (place.photos < 10) fixes.push({ title: `Only ${place.photos} photos`, why: "Profiles with 10+ photos get many more calls and direction requests.", plan: "growth" });
  if (!place.hoursSet) fixes.push({ title: "Opening hours not set", why: "Google shows 'hours unknown' — people go elsewhere.", plan: "growth" });

  return { score, breakdown: b, fixes: fixes.slice(0, 3) };
}
