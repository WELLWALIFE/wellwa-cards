// The Google score (0–100) and the three things to fix first. Plain rules, no AI — the same business always gets the same score.
import type { Candidate, Place } from "./places";
import type { RankRow } from "./rank";
import type { SiteCheck } from "./pagespeed";

/** `hi`: the same finding in one Hinglish line (the report's Hinglish view). */
export type Fix = { title: string; why: string; plan: "website" | "growth"; hi?: string };
export type Breakdown = { label: string; got: number; max: number };

// Only what was really checked is scored (25 Nov 2026): with no Maps-rank service set up, or a website PageSpeed could not read, the
// report said "Not in the top 20 on Google Maps" and gave 0 — a claim nobody checked. Unchecked parts are left out and the score is
// out of what was checked, scaled to 100.
export function scoreOf(place: Place, ranks: RankRow[], site: SiteCheck, rivals: Candidate[], rankChecked = true): { score: number; breakdown: Breakdown[]; fixes: Fix[]; issues: Fix[] } {
  const b: Breakdown[] = []; const fixes: Fix[] = [];
  const add = (label: string, got: number, max: number) => b.push({ label, got, max });

  add("Google Business Profile", 15, 15);
  const r = place.rating; add("Rating", r >= 4.5 ? 20 : r >= 4 ? 14 : r >= 3.5 ? 8 : r > 0 ? 3 : 0, 20);
  const n = place.reviews; add("Reviews", n >= 100 ? 15 : n >= 30 ? 10 : n >= 10 ? 5 : n > 0 ? 1 : 0, 15);
  add("Photos", place.photos >= 10 ? 5 : place.photos > 0 ? 3 : 0, 5);
  add("Opening hours", place.hoursSet ? 5 : 0, 5);
  add("Phone number", place.phone ? 5 : 0, 5);
  add("Website", place.website ? 5 : 0, 5);
  // No website: these two are lost (0). A website that could not be read: left out.
  if (site.checked || !place.website) {
    add("Website speed (mobile)", site.checked ? (site.performance >= 70 ? 10 : site.performance >= 40 ? 5 : 0) : 0, 10);
    add("Website SEO basics", site.checked ? (site.seo >= 80 ? 5 : site.seo >= 50 ? 2 : 0) : 0, 5);
  }
  const best = ranks.map((x) => x.rank).filter((x): x is number => x !== null).sort((a, c) => a - c)[0] ?? null;
  if (rankChecked) add("Maps rank", best === null ? 0 : best <= 3 ? 15 : best <= 10 ? 8 : 3, 15);

  const got = b.reduce((s, x) => s + x.got, 0), max = b.reduce((s, x) => s + x.max, 0);
  const score = max >= 100 ? got : Math.round((got / Math.max(1, max)) * 100);
  const rivalAvg = rivals.length ? rivals.reduce((s, x) => s + x.rating, 0) / rivals.length : 0;
  const rivalReviews = rivals.length ? Math.round(rivals.reduce((s, x) => s + x.reviews, 0) / rivals.length) : 0;

  if (!rankChecked) { /* not checked: nothing to say about the Maps rank */ }
  else if (best === null) fixes.push({ title: "Not in the top 20 on Google Maps", why: "Customers searching nearby never see you. Weekly Google posts, photos and review replies push you up.", plan: "growth", hi: "Google Maps ke top 20 mein nahi hain - aas-paas search karne wale customers aapko dekh hi nahi paate" });
  else if (best > 3) fixes.push({ title: `#${best} on Maps — not in the top 3`, why: "Most people call one of the first three. Regular posts, photos and fresh reviews move you up.", plan: "growth", hi: `Maps par #${best} - top 3 mein nahi. Zyada log pehle teen mein se kisi ko call karte hain` });
  if (n < rivalReviews) fixes.push({ title: `${n} reviews vs ${rivalReviews} for competitors`, why: "Google trusts businesses people talk about. Ask every happy customer, reply to every review.", plan: "growth", hi: `Sirf ${n} reviews - aas-paas ke competitors ke paas average ${rivalReviews} hain` });
  else if (n < 30) fixes.push({ title: "Fewer than 30 reviews", why: "Google trusts businesses people talk about. Ask every happy customer, reply to every review.", plan: "growth", hi: `Sirf ${n} reviews - Google un businesses par bharosa karta hai jinke 30+ reviews hon` });
  if (r > 0 && r < rivalAvg - 0.2) fixes.push({ title: `Rating ${r.toFixed(1)} is below nearby competitors (${rivalAvg.toFixed(1)})`, why: "Reply to every review, fix the complaints, ask happy customers to rate.", plan: "growth", hi: `Rating ${r.toFixed(1)} - aas-paas ke competitors (${rivalAvg.toFixed(1)}) se kam hai` });
  if (!place.website) fixes.push({ title: "No website on your profile", why: "Google and AI search rank businesses with a real website higher — and people check it before calling.", plan: "website", hi: "Profile par website nahi hai - Google website wale businesses ko upar dikhata hai" });
  else if (site.checked && site.performance < 60) fixes.push({ title: `Website is slow on phones (${site.performance}/100)`, why: "A slow site loses visitors and rank. A light, fast site fixes both.", plan: "website", hi: `Website phone par slow hai (${site.performance}/100) - visitors aur rank dono jaate hain` });
  else if (site.checked && site.seo < 70) fixes.push({ title: "Website is missing SEO basics", why: "Page titles, descriptions and schema tell Google what you sell.", plan: "website", hi: "Website mein SEO basics missing hain - Google ko pata nahi chalta aap kya bechte hain" });
  if (place.photos < 10) fixes.push({ title: `Only ${place.photos} photos`, why: "Profiles with 10+ photos get many more calls and direction requests.", plan: "growth", hi: `Sirf ${place.photos} photos - 10+ photos wali profiles ko kahin zyada calls milte hain` });
  if (!place.hoursSet) fixes.push({ title: "Opening hours not set", why: "Google shows 'hours unknown' — people go elsewhere.", plan: "growth", hi: "Opening hours set nahi hain - Google 'hours unknown' dikhata hai" });

  return { score, breakdown: b, fixes: fixes.slice(0, 3), issues: fixes };
}
