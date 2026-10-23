// The platform's own web address. Set NEXT_PUBLIC_SITE_URL (at build time and on the server) to move the
// whole site to another domain; nothing else in the code names the domain.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://shubhora.com").replace(/\/$/, "");
export const SITE_HOST = new URL(SITE_URL).host;                         // e.g. shubhora.com
export const PARTNER_URL = `${SITE_URL}/partners`;
/** Hosts that are the platform itself (current and earlier addresses), never a customer domain or brand. */
export const PLATFORM_HOSTS = new Set([SITE_HOST, `www.${SITE_HOST}`, "shubhora.com", "www.shubhora.com", "neuraledge.me", "www.neuraledge.me"]);
/** A card's public address: its own domain (card.customDomain, kept equal to the verified one by lib/own-domain.ts) when it has
 *  one, else the Shubhora link. A domain-looking value only: anything else falls back to the Shubhora link. */
export function cardHome(username: string, customDomain?: string | null): string {
  const d = String(customDomain ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) ? `https://${d}` : `${SITE_URL}/c/${username}`;
}
