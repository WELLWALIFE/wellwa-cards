// Single services (owner, 28 Nov 2026): a part of the Growth Plan bought alone, by the month. A running Growth / Pro plan covers all
// of them. Pure module, shared by the app, the admin panel and the server (src/lib/single-services-server.ts; migration 0101). The
// same prices are in the assistant's facts (bridge/shubhora-kb.mjs) and its menu (bridge/shubhora-menu.mjs) — change all three together.
// (Not to be confused with src/lib/services.ts, the /solutions landing-page catalogue.)

export type ServiceKey = "wa_ai" | "crm" | "posters" | "google";

export const SINGLE_SERVICES: Record<ServiceKey, { paise: number; en: string; hi: string; what: [string, string] }> = {
  wa_ai: { paise: 149900, en: "WhatsApp AI 24×7", hi: "WhatsApp AI 24×7", what: ["Replies to your customers on your own WhatsApp number, day and night.", "आपके अपने WhatsApp नंबर से ग्राहकों को दिन-रात जवाब।"] },
  crm: { paise: 99900, en: "CRM", hi: "CRM", what: ["Every lead, follow-up and customer in one place; message them from the app.", "हर लीड, फॉलो-अप और ग्राहक एक जगह; ऐप से ही मैसेज।"] },
  posters: { paise: 149900, en: "Daily posters + auto-post", hi: "रोज़ पोस्टर + ऑटो-पोस्ट", what: ["A new poster every day, posted to Facebook, Instagram and WhatsApp Status.", "रोज़ नया पोस्टर, Facebook, Instagram और WhatsApp Status पर अपने-आप।"] },
  google: { paise: 69900, en: "Google reviews", hi: "Google रिव्यू", what: ["Replies to your Google reviews and posts on your Google profile.", "Google रिव्यू के जवाब और Google प्रोफाइल पर पोस्ट।"] },
};
export const SERVICE_KEYS = Object.keys(SINGLE_SERVICES) as ServiceKey[];
export const isServiceKey = (v: unknown): v is ServiceKey => typeof v === "string" && v in SINGLE_SERVICES;

/** Days a service keeps working after its paid end — the same 7 days the Growth Plan has. */
export const SERVICE_GRACE_DAYS = 7;
/** The profile column that holds a service's paid end. */
export const serviceColumn = (k: ServiceKey) => `svc_${k}_until` as const;

/** All four together, a month — what the Growth Plan (₹2,999) is compared with. */
export const SERVICES_TOTAL_PAISE = SERVICE_KEYS.reduce((s, k) => s + SINGLE_SERVICES[k].paise, 0);
