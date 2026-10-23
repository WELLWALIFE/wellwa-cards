// Opening a customer's chat in the WhatsApp app (CRM buttons).
const onlyDigits = (p: string) => (p || "").replace(/[^0-9]/g, "");
/** A 10-digit Indian number gets its 91. */
export const waNum = (p: string) => { const d = onlyDigits(p); return d.length === 10 ? `91${d}` : d; };
/** Open a customer's chat in WhatsApp BUSINESS first, the personal WhatsApp only when Business is not installed (owner,
 *  23 Oct 2026). On Android a Chrome intent names the Business app and falls back to wa.me (which opens personal
 *  WhatsApp); elsewhere (iPhone, computer) wa.me is the only way and opens whichever WhatsApp the device has. */
export function waOpenHref(p: string, text?: string): string {
  const n = waNum(p), q = text ? `?text=${encodeURIComponent(text)}` : "";
  const web = `https://wa.me/${n}${q}`;
  if (typeof navigator === "undefined" || !/Android/i.test(navigator.userAgent)) return web;
  return `intent://send/?phone=${n}${text ? `&text=${encodeURIComponent(text)}` : ""}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;S.browser_fallback_url=${encodeURIComponent(web)};end`;
}
export function openWhatsAppChat(p: string, text?: string) {
  const href = waOpenHref(p, text);
  if (href.startsWith("intent:")) window.location.href = href; else window.open(href, "_blank", "noopener");
}
/** onClick for an <a href={waLink(...)}>: on Android it goes through WhatsApp Business first. */
export const waClick = (p: string, text?: string) => (e: { preventDefault: () => void }) => {
  if (typeof navigator === "undefined" || !/Android/i.test(navigator.userAgent)) return;
  e.preventDefault(); openWhatsAppChat(p, text);
};
