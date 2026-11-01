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

/* ---------------- Ads v2 (owner, 1 Nov 2026: "perfect aur professional") ---------------- */

/** Meta's own pages for an ad account: where the money comes from, and the account itself. */
export const billingUrl = (acct: string) => `https://business.facebook.com/billing_hub/payment_settings/?asset_id=${acct.replace(/^act_/, "")}`;
export const managerUrl = (acct: string, campaignId?: string) => `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${acct.replace(/^act_/, "")}${campaignId ? `&selected_campaign_ids=${campaignId}` : ""}`;
export const NEW_AD_ACCOUNT_URL = "https://business.facebook.com/settings/ad-accounts";

/** The one word for where an ad stands, from what Meta last said and our own record. */
export type AdState = "running" | "scheduled" | "review" | "rejected" | "paused" | "ended" | "issue";
export function adStateOf(o: { effective_status?: string | null; status?: string | null; start_time?: string | null; end_time?: string | null; ended_at?: string | null }, now = Date.now()): AdState {
  const eff = String(o.effective_status ?? "").toUpperCase();
  const set = String(o.status ?? "").toUpperCase();
  const end = o.end_time ? Date.parse(o.end_time) : NaN;
  if (o.ended_at || eff === "COMPLETED" || eff === "ARCHIVED" || eff === "DELETED" || (Number.isFinite(end) && end < now)) return "ended";
  if (eff === "DISAPPROVED" || eff === "WITH_ISSUES") return eff === "DISAPPROVED" ? "rejected" : "issue";
  if (eff === "PENDING_REVIEW" || eff === "IN_PROCESS" || eff === "PREAPPROVED") return "review";
  if (eff === "PAUSED" || /_PAUSED$/.test(eff) || (!eff && set === "PAUSED")) return "paused";
  const start = o.start_time ? Date.parse(o.start_time) : NaN;
  if (set === "ACTIVE" && Number.isFinite(start) && start > now + 60_000) return "scheduled";
  if (eff === "ACTIVE" || set === "ACTIVE") return "running";
  return "paused";
}
export const AD_STATE_TEXT: Record<AdState, { en: string; hi: string; cls: string }> = {
  running:   { en: "Running",       hi: "चल रही है",        cls: "bg-good/15 text-good" },
  scheduled: { en: "Starts later",  hi: "बाद में शुरू होगी",  cls: "bg-blue-100 text-blue-800" },
  review:    { en: "In review",     hi: "Facebook जाँच रहा है", cls: "bg-amber-100 text-amber-800" },
  rejected:  { en: "Not approved",  hi: "मंज़ूर नहीं हुई",     cls: "bg-danger/10 text-danger" },
  issue:     { en: "Needs a fix",   hi: "ठीक करना है",       cls: "bg-amber-100 text-amber-800" },
  paused:    { en: "Paused",        hi: "रुकी हुई",          cls: "bg-surface2 text-muted" },
  ended:     { en: "Ended",         hi: "ख़त्म",             cls: "bg-surface2 text-muted" },
};

/** Meta's error lines, in the owner's words. The raw line stays in the API answer for support. */
export function friendlyAdError(raw: string, hi: boolean): string {
  const m = raw || "";
  const t = (en: string, h: string) => (hi ? h : en);
  if (/funding|payment method|no payment|billing|unsettled|account_status|account (is )?(disabled|closed)|spend cap|payment.*(fail|declin)|insufficient/i.test(m) && !/permission/i.test(m))
    return t("Facebook could not take money from this ad account: add or fix the payment method (UPI / card) in Payment settings, then try again.", "Facebook इस ad account से पैसा नहीं ले पाया — Payment settings में UPI / card जोड़ें या ठीक करें, फिर दोबारा कोशिश करें।");
  if (/permission|ads_management|ads_read|\(#200\)|\(#10\)|not authorized|does not have the capability/i.test(m))
    return t("Facebook has not allowed ads for this login yet. Connections → remove Facebook → connect again and say yes to 'Manage ads'.", "Facebook ने इस login को अभी ads की इजाज़त नहीं दी। Connections → Facebook हटाएँ → फिर जोड़ें और 'Manage ads' को हाँ कहें।");
  if (/session has expired|token|OAuthException.*expired|\(#190\)/i.test(m))
    return t("Your Facebook connection has expired. Connections → connect Facebook again.", "आपका Facebook connection expire हो गया। Connections → Facebook फिर से जोड़ें।");
  if (/image.*(small|size|dimension)|minimum.*(width|height)|too small/i.test(m))
    return t("The picture is too small for an ad. Use at least 1080 × 1080 pixels.", "Photo ad के लिए छोटी है — कम से कम 1080 × 1080 pixel की लगाएँ।");
  if (/video/i.test(m) && /(process|format|codec|could not)/i.test(m))
    return t("Facebook could not use this video. Try an MP4 under 60 MB, 9:16 or 1:1.", "Facebook यह video नहीं ले पाया — 60 MB से छोटी MP4, 9:16 या 1:1 आज़माएँ।");
  if (/WA_NOT_LINKED|WA_NUMBER_MISMATCH/.test(m)) return m;
  if (/text.*(too long|exceed)|character limit/i.test(m))
    return t("The ad text is too long. Shorten the text or the heading.", "Ad का text लंबा है — text या हेडिंग छोटी करें।");
  if (/rate limit|too many calls|\(#17\)|\(#4\)|\(#32\)|\(#613\)/i.test(m))
    return t("Facebook is busy right now. Wait a minute and try again.", "Facebook अभी व्यस्त है — एक मिनट रुककर फिर कोशिश करें।");
  if (/policy|disapprov|prohibited|not approved/i.test(m))
    return t("Facebook did not approve this ad (its rules). Change the words or the picture and try again.", "Facebook ने यह ad मंज़ूर नहीं की (उसके नियम)। शब्द या photo बदलकर फिर कोशिश करें।");
  if (/timeout|aborted|network|fetch failed|ECONN/i.test(m))
    return t("Facebook did not answer in time. Try again in a moment.", "Facebook ने समय पर जवाब नहीं दिया — थोड़ी देर में फिर कोशिश करें।");
  if (/Invalid parameter/i.test(m) && /target|geo|location|age/i.test(m))
    return t("Facebook did not accept the audience (town / age). Change it a little and try again.", "Facebook ने यह audience (शहर / उम्र) नहीं मानी — थोड़ा बदलकर फिर कोशिश करें।");
  return m.length > 220 ? `${m.slice(0, 220)}…` : m;
}

/** "₹12 per chat" — null when nothing came in yet. */
export const costPer = (spend: number, results: number) => (results > 0 && spend > 0 ? Math.round(spend / results) : null);

/** Today / tomorrow / a chosen day, 10:00 IST, as ISO (an ad set start time). */
export function startAtFor(day: string | null | undefined): string | null {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const todayIst = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  if (day <= todayIst) return null;                                   // today or earlier → "now"
  return new Date(`${day}T10:00:00+05:30`).toISOString();
}
