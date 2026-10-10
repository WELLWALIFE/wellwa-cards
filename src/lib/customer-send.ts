// Messages to the owner's CUSTOMERS (phase 2, owner's call 8 Oct 2026): the review ask after a sale, the festival wish,
// an offer to everyone. They go from the owner's own WhatsApp (the linked bridge number), never from Shubhora's, so a
// customer sees the shop they know. Without a linked number the owner gets the message ready to forward in one tap.
import { restAsService } from "@/lib/poster-server";
import { bridge, ownerPlanExpiry } from "@/lib/crm-server";
import { notify } from "@/lib/notify";
import { SITE_URL } from "@/lib/site-url";
import { tapLink } from "@/lib/bookings";
import type { Card } from "@/lib/types";

export type OwnerCard = { id: string; username: string; company: string | null; name: string | null; data: Card | null };
export type Prefs = { festival_wishes: boolean; review_ask: boolean };

/** The owner's first (primary) card. */
export async function cardOf(ownerId: string): Promise<OwnerCard | null> {
  return (await restAsService<OwnerCard[]>(`cards?owner_id=eq.${ownerId}&order=created_at.asc&limit=1&select=id,username,company,name,data`)).data?.[0] ?? null;
}
export const businessOf = (c: OwnerCard | null) => c?.company || c?.name || "Shubhora";
export const hindiCard = (c: OwnerCard | null) => !c || c.data?.language !== "en";   // Hindi for everyone unless the card is English
export const siteOf = (c: OwnerCard | null) => (c ? `${SITE_URL}/c/${c.username}` : SITE_URL);
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

/** One message from the owner's linked WhatsApp. False when the number is not linked (or the plan does not allow it). */
export async function sendCustomer(ownerId: string, phone: string, text: string): Promise<boolean> {
  const to = digitsOf(phone);
  if (!to) return false;
  const expiry = await ownerPlanExpiry(ownerId);
  if (!expiry) return false;
  const r = await bridge(ownerId, expiry, "send", { to, text });
  return r.ok;
}

/** Thank-you + review link after a sale. */
export function reviewText(c: OwnerCard | null, name: string, hindi: boolean): string {
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
    const text = reviewText(c, who.name, hindi);
    if (await sendCustomer(ownerId, who.phone, text)) return;
    const link = tapLink(who.phone, text);
    await notify(ownerId, "review_ask", {
      title: hindi ? `⭐ ${who.name || "ग्राहक"} से रिव्यू माँगें` : `⭐ Ask ${who.name || "the customer"} for a review`,
      body: hindi ? "धन्यवाद + Google रिव्यू लिंक तैयार है — एक टैप में भेजें।" : "Thank-you + Google review link is ready — send in one tap.",
      path: "/poster/leads", ref: `review:${ref}`,
      whatsappText: hindi ? `⭐ *रिव्यू माँगें*\n${who.name || who.phone} को धन्यवाद और रिव्यू लिंक एक टैप में भेजें:\n${link}` : `⭐ *Ask for a review*\nSend ${who.name || who.phone} the thank-you and review link in one tap:\n${link}`,
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
 *  becomes the customer's first name. Returns how many went. */
export async function blast(ownerId: string, text: string, opts: { max?: number; gapMs?: number } = {}): Promise<{ sent: number; total: number; linked: boolean }> {
  const expiry = await ownerPlanExpiry(ownerId);
  const list = await customersOf(ownerId);
  if (!expiry) return { sent: 0, total: list.length, linked: false };
  const max = Math.min(opts.max ?? 100, list.length);
  let sent = 0;
  for (const c of list.slice(0, max)) {
    const body = text.replace(/\{name\}/g, (c.name || "").split(" ")[0] || (/[ऀ-ॿ]/.test(text) ? "जी" : "there"));
    const r = await bridge(ownerId, expiry, "send", { to: digitsOf(c.phone), text: body });
    if (r.ok) sent++;
    else if (r.status === 503) break; // bridge gone: stop, do not hammer
    await sleep(opts.gapMs ?? 2500 + Math.floor(Math.random() * 1500));
  }
  return { sent, total: list.length, linked: true };
}
