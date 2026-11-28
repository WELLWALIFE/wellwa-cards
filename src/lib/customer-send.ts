// Messages to the owner's CUSTOMERS (phase 2, owner's call 8 Oct 2026): the review ask after a sale, the festival wish,
// an offer to everyone. They go from the owner's own WhatsApp (the linked bridge number), never from Shubhora's, so a
// customer sees the shop they know. Without a linked number the owner gets the message ready to forward in one tap.
import { restAsService } from "@/lib/poster-server";
import { bridge, ownerPlanExpiry } from "@/lib/crm-server";
import { serviceExpiry } from "@/lib/single-services-server";
import type { ServiceKey } from "@/lib/single-services";
import { notify } from "@/lib/notify";
import { SITE_URL, cardHome } from "@/lib/site-url";
import { tapLink } from "@/lib/bookings";
import type { Card } from "@/lib/types";
import { reviewUrlFor } from "@/lib/google-server";
import { reviewAskText } from "@/lib/review-ask";

export type OwnerCard = { id: string; username: string; company: string | null; name: string | null; data: Card | null };
export type Prefs = { festival_wishes: boolean; review_ask: boolean };

/** The owner's first (primary) card. */
export async function cardOf(ownerId: string): Promise<OwnerCard | null> {
  return (await restAsService<OwnerCard[]>(`cards?owner_id=eq.${ownerId}&order=created_at.asc&limit=1&select=id,username,company,name,data`)).data?.[0] ?? null;
}
export const businessOf = (c: OwnerCard | null) => c?.company || c?.name || "Shubhora";
export const hindiCard = (c: OwnerCard | null) => !c || c.data?.language !== "en";   // Hindi for everyone unless the card is English
export const siteOf = (c: OwnerCard | null) => (c ? cardHome(c.username, c.data?.customDomain) : SITE_URL);
/** The card's Google Maps link (the review goes there), if the owner gave one. */
export function googleLink(c: OwnerCard | null): string {
  const v = c?.data?.links?.find((l) => l.type === "location")?.value ?? "";
  return /google\.|goo\.gl/i.test(v) ? v : "";
}
export async function prefsOf(ownerId: string): Promise<Prefs> {
  const r = (await restAsService<Prefs[]>(`owner_prefs?owner_id=eq.${ownerId}&select=festival_wishes,review_ask`)).data?.[0];
  return { festival_wishes: r?.festival_wishes ?? false, review_ask: r?.review_ask ?? true };
}

const digitsOf = (phone: string) => { const d = String(phone ?? "").replace(/\D/g, ""); return d.length === 10 ? `91${d}` : d.length >= 11 ? d : ""; };

/** Until when this owner may message customers from the CRM: a plan, or one of `services` bought alone (CRM; a review ask also
 *  Google reviews). Broadcasts (blast) stay with the plan only. */
async function sendUntil(ownerId: string, services: ServiceKey[]): Promise<string | null> {
  for (const s of services) { const u = await serviceExpiry(ownerId, s); if (u) return u; }
  return null;
}

/** One message from the owner's linked WhatsApp. False when the number is not linked (or the plan does not allow it). */
export async function sendCustomer(ownerId: string, phone: string, text: string, services: ServiceKey[] = ["crm"]): Promise<boolean> {
  const to = digitsOf(phone);
  if (!to) return false;
  const expiry = await sendUntil(ownerId, services);
  if (!expiry) return false;
  const r = await bridge(ownerId, expiry, "send", { to, text });
  return r.ok;
}

/** Thank-you + review link after a sale. */
/** Where the customer writes the review: Google's own review box of the connected profile, else the card's Maps link. */
export async function googleReviewUrl(ownerId: string, c: OwnerCard | null): Promise<string> {
  return (await reviewUrlFor(ownerId).catch(() => "")) || googleLink(c);
}
/** The review helper page (stars, what they liked, a ready draft, then Google), when there is a Google address to send them on to. */
/** On the owner's own domain when they have one (review.theirshop.com/r), else on ours. */
export const reviewPage = (c: OwnerCard) => {
  const home = cardHome(c.username, c.data?.customDomain);
  return home.startsWith(`${SITE_URL}/`) ? `${SITE_URL}/r/${encodeURIComponent(c.username)}` : `${home}/r`;
};
export async function reviewLinkOf(ownerId: string, c: OwnerCard | null): Promise<string> {
  const g = await googleReviewUrl(ownerId, c);
  return g && c ? reviewPage(c) : g;
}

export function reviewText(c: OwnerCard | null, name: string, hindi: boolean, link?: string): string {
  if (link !== undefined) return reviewAskText({ biz: businessOf(c), name, link, site: siteOf(c), hindi });
  const first = (name || "").split(" ")[0];
  const g = googleLink(c);
  const biz = businessOf(c);
  return hindi
    ? `नमस्ते${first ? ` ${first} जी` : ""} 🙏 *${biz}* को चुनने के लिए धन्यवाद! ${g ? `अगर सेवा अच्छी लगी तो 2 मिनट में Google पर रिव्यू दे दें — इससे हमें बहुत मदद मिलती है:\n${g}` : `अगर सेवा अच्छी लगी तो अपने दोस्तों को हमारा लिंक भेज दें:\n${siteOf(c)}`}\nफिर से मिलते हैं!`
    : `Hi${first ? ` ${first}` : ""} 🙏 Thank you for choosing *${biz}*! ${g ? `If you were happy with us, a 2-minute Google review helps a lot:\n${g}` : `If you were happy with us, do share our link with friends:\n${siteOf(c)}`}\nSee you again!`;
}

/** Ask a customer for a review (after a booking is done or a lead converts). Sends from the owner's WhatsApp; without
 *  one, hands the owner the message. Never throws. */
export async function askForReview(ownerId: string, who: { name: string; phone: string }, ref: string): Promise<void> {
  try {
    if (!who.phone || !digitsOf(who.phone)) return;
    const [c, prefs] = await Promise.all([cardOf(ownerId), prefsOf(ownerId)]);
    if (!prefs.review_ask) return;
    const hindi = hindiCard(c);
    const link = await reviewLinkOf(ownerId, c);
    // "Rating first" (AI Training → More settings): a number is asked; the WhatsApp worker sends the review link only to 4–5 and
    // alerts the owner on 1–3 (bridge/shop-desk.mjs). Needs the linked number; without it the usual message goes as before.
    if (c?.data?.botRules?.rateFirst) {
      const first = (who.name || "").split(" ")[0];
      const ask = hindi
        ? `नमस्ते${first ? ` ${first} जी` : ""} 🙏 *${businessOf(c)}* को चुनने के लिए धन्यवाद!\nहमारी सेवा आपको कैसी लगी? 1 से 5 में एक नंबर भेज दीजिए ⭐\n(5 = बहुत अच्छी, 1 = ख़राब)`
        : `Hi${first ? ` ${first}` : ""} 🙏 Thank you for choosing *${businessOf(c)}*!\nHow was our service? Please reply with a number from 1 to 5 ⭐\n(5 = very good, 1 = poor)`;
      const to = digitsOf(who.phone), expiry = await sendUntil(ownerId, ["crm", "google"]);
      if (to && expiry && (await bridge(ownerId, expiry, "send", { to, text: ask, expect: "rating", reviewLink: link })).ok) return;
    }
    const text = reviewText(c, who.name, hindi, link);
    if (await sendCustomer(ownerId, who.phone, text, ["crm", "google"])) return;
    const tap = tapLink(who.phone, text);
    await notify(ownerId, "review_ask", {
      title: hindi ? `⭐ ${who.name || "ग्राहक"} से रिव्यू माँगें` : `⭐ Ask ${who.name || "the customer"} for a review`,
      body: hindi ? "धन्यवाद + Google रिव्यू लिंक तैयार है — एक टैप में भेजें।" : "Thank-you + Google review link is ready — send in one tap.",
      path: "/poster/leads", ref: `review:${ref}`,
      whatsappText: hindi ? `⭐ *रिव्यू माँगें*\n${who.name || who.phone} को धन्यवाद और रिव्यू लिंक एक टैप में भेजें:\n${tap}` : `⭐ *Ask for a review*\nSend ${who.name || who.phone} the thank-you and review link in one tap:\n${tap}`,
    });
  } catch (e) { console.error("[review-ask]", e instanceof Error ? e.message : e); }
}

/** Every customer the owner may message: distinct numbers from the CRM, opted-out ones left out. */
export async function customersOf(ownerId: string): Promise<{ name: string; phone: string }[]> {
  const rows = (await restAsService<{ name: string; phone: string; opted_out: boolean | null }[]>(`leads?owner_id=eq.${ownerId}&phone=neq.&select=name,phone,opted_out&order=created_at.desc&limit=3000`)).data ?? [];
  const seen = new Set<string>(); const out: { name: string; phone: string }[] = [];
  for (const r of rows) { const d = digitsOf(r.phone); if (!d || seen.has(d) || r.opted_out) continue; seen.add(d); out.push({ name: r.name ?? "", phone: r.phone }); }
  return out;
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
/** The same message to every customer, paced (a human's speed, well under WhatsApp's patience). `{name}` in the text
 *  becomes the customer's first name. Returns how many went. Optional: `until` (a Date.now() deadline: no new send is
 *  started after it) and `claim` / `release` (claim a number before sending, false = already sent, skip it; release it
 *  again when the send failed) — the festival cron uses them to resume a big list over several runs without sending
 *  anyone the same wish twice. `complete` is false when the deadline or a gone bridge stopped the list early. */
export async function blast(ownerId: string, text: string, opts: { max?: number; gapMs?: number; until?: number; claim?: (to: string) => Promise<boolean>; release?: (to: string) => Promise<void> } = {}): Promise<{ sent: number; total: number; linked: boolean; complete: boolean }> {
  const expiry = await ownerPlanExpiry(ownerId);
  const list = await customersOf(ownerId);
  if (!expiry) return { sent: 0, total: list.length, linked: false, complete: true };
  const max = Math.min(opts.max ?? 100, list.length);
  let sent = 0, complete = true;
  for (const c of list.slice(0, max)) {
    if (opts.until && Date.now() > opts.until) { complete = false; break; }
    const to = digitsOf(c.phone);
    if (opts.claim && !(await opts.claim(to))) continue;
    const body = text.replace(/\{name\}/g, (c.name || "").split(" ")[0] || (/[ऀ-ॿ]/.test(text) ? "जी" : "there"));
    const r = await bridge(ownerId, expiry, "send", { to, text: body });
    if (r.ok) sent++;
    else await opts.release?.(to).catch(() => undefined);
    if (!r.ok && r.status === 503) { complete = false; break; } // bridge gone: stop, do not hammer
    await sleep(opts.gapMs ?? 2500 + Math.floor(Math.random() * 1500));
  }
  return { sent, total: list.length, linked: true, complete };
}
