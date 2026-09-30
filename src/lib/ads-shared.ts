// Ads — the small pure pieces both the wizard (browser) and the API (server) need: budget limits, targeting cleanup,
// the goals, and the ₹ estimate lines. No server imports here.
import type { AdGoal, AdTargeting } from "@/lib/ads-server";

export const AD_BUDGET = { minDaily: 100, maxDaily: 10000, defaultDaily: 200, maxDays: 30 } as const;

export const GOALS: { key: AdGoal; en: string; hi: string; sub: string; subHi: string }[] = [
  { key: "whatsapp", en: "WhatsApp messages", hi: "WhatsApp message", sub: "The button opens a WhatsApp chat with you — best for shops, services, agents", subHi: "Button se seedha aapka WhatsApp khulega — dukaan, service, agent ke liye sabse achha" },
  { key: "calls", en: "Phone calls", hi: "Phone call", sub: "The button calls your number — for urgent services (doctor, repair, taxi)", subHi: "Button se call lagega — turant wali services ke liye (doctor, repair, taxi)" },
  { key: "website", en: "Website / card visits", hi: "Website / card visit", sub: "The button opens your card or website — products, prices, photos", subHi: "Button se aapka card / website khulega — products, daam, photos" },
];

/** Only known keys, bounded values. */
export function cleanTargeting(x: unknown): AdTargeting {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const cities = (Array.isArray(o.cities) ? o.cities : []).map((c) => (c && typeof c === "object" ? c as Record<string, unknown> : {}))
    .map((c) => ({ key: String(c.key ?? "").slice(0, 20), name: String(c.name ?? "").slice(0, 60), radius: Math.min(80, Math.max(10, Number(c.radius) || 25)), type: c.type === "region" ? "region" as const : "city" as const }))
    .filter((c) => /^[0-9]{1,20}$/.test(c.key)).slice(0, 10);
  const interests = (Array.isArray(o.interests) ? o.interests : []).map((c) => (c && typeof c === "object" ? c as Record<string, unknown> : {}))
    .map((c) => ({ id: String(c.id ?? "").slice(0, 30), name: String(c.name ?? "").slice(0, 60) })).filter((c) => /^\d+$/.test(c.id)).slice(0, 10);
  const ageMin = Math.min(64, Math.max(18, Math.round(Number(o.ageMin) || 21)));
  const ageMax = Math.min(65, Math.max(ageMin + 1, Math.round(Number(o.ageMax) || 60)));
  return { cities, ageMin, ageMax, gender: o.gender === "men" || o.gender === "women" ? o.gender : "all", interests };
}

/** A rough Indian benchmark for what the budget buys (Meta's own estimate replaces it when it answers):
 *  a link click on a local shop's ad usually costs ₹3–8, so ₹200 a day ≈ 25–65 clicks. */
export function roughResults(dailyRupees: number, days: number, goal: AdGoal) {
  const [lo, hi] = goal === "website" ? [3, 8] : goal === "calls" ? [8, 20] : [4, 12];
  return { low: Math.round((dailyRupees * days) / hi), high: Math.round((dailyRupees * days) / lo), unit: goal === "whatsapp" ? "messages" : goal === "calls" ? "calls" : "visits" };
}
