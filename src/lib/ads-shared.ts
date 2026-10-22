// Ads — the small pure pieces both the wizard (browser) and the API (server) need: budget limits, targeting cleanup,
// the goals, and the ₹ estimate lines. No server imports here.
import type { AdGoal, AdTargeting } from "@/lib/ads-server";

export const AD_BUDGET = { minDaily: 100, maxDaily: 10000, defaultDaily: 200, maxDays: 30 } as const;

export const GOALS: { key: AdGoal; en: string; hi: string; sub: string; subHi: string }[] = [
  { key: "whatsapp", en: "WhatsApp messages", hi: "WhatsApp message", sub: "The button opens a WhatsApp chat with you — best for shops, services, agents", subHi: "बटन दबाने पर सीधे आपका WhatsApp खुलेगा — दुकान, service, agent के लिए सबसे अच्छा" },
  { key: "calls", en: "Phone calls", hi: "Phone call", sub: "The button calls your number — for urgent services (doctor, repair, taxi)", subHi: "बटन दबाने पर आपके नंबर पर call लगेगी — जल्दी वाली services के लिए (doctor, repair, taxi)" },
  { key: "website", en: "Website / card visits", hi: "Website / card visit", sub: "The button opens your card or website — products, prices, photos", subHi: "बटन दबाने पर आपका card या website खुलेगा — products, दाम, photos" },
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

/** The ad asked for one WhatsApp number but the Facebook Page has another linked (Meta always opens the Page's number). */
export function waMismatchText(msg: string): string | null {
  if (msg.startsWith("WA_NOT_LINKED")) return "Your Facebook Page has no WhatsApp number linked, so a WhatsApp ad cannot open a chat. Link it first: Facebook Page → Settings → Linked accounts → WhatsApp. / आपके Facebook Page से कोई WhatsApp नंबर जुड़ा नहीं है। पहले Page की Settings → Linked accounts → WhatsApp में नंबर जोड़ें, फिर ad बनाएँ।";
  const m = /^WA_NUMBER_MISMATCH:(\d{10})/.exec(msg);
  if (!m) return null;
  return `WhatsApp ads open the WhatsApp number linked to your Facebook Page (+91 ${m[1]}), not the number typed here. Use +91 ${m[1]} for this ad, or link the other number to the Page first (Facebook Page → Settings → Linked accounts → WhatsApp). / WhatsApp ad हमेशा Facebook Page से जुड़े नंबर (+91 ${m[1]}) पर खुलता है। इसी नंबर से ad बनाएँ, या पहले Page की Settings → Linked accounts → WhatsApp में दूसरा नंबर जोड़ें।`;
}
