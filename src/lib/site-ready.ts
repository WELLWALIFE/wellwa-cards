// The website's waiting time (owner, 31 Oct 2026: "user ko lagna chahiye ki jo kaam ho raha hai usme time lagta hai — 24 se 48 hr,
// customised mein 1 week, aur 24 hr baad auto ho jaaye"). A website made for the first time, Standard or Premium, is promised within
// 24–48 hours and goes live by itself 24 hours after the build: until then visitors get the card; the owner keeps editing meanwhile
// (everything added in the wait goes into the website). `site.readyAt` = when the basic website shows; `site.advancedReadyAt` = when the
// first Premium design shows (the basic one, if live, shows until then). The hourly cron /api/cron/site-live sends the "it is live" message
// and clears the field. Pure module: the public route, the app and the API share it.
import type { Card } from "@/lib/types";

/** Hours from the build to the website going live. The promise shown is 24–48 so an early morning build still reads true. */
export const READY_HOURS = 24;
/** Advanced features (add-on modules) are set up by hand: the promise shown. */
export const CUSTOM_DAYS = 7;

export const readyIn = (hours = READY_HOURS, from = Date.now()) => new Date(from + hours * 3600_000).toISOString();

type SiteLike = { enabled?: boolean; readyAt?: string; advanced?: unknown; advancedOn?: boolean; advancedReadyAt?: string } & Record<string, unknown>;

const future = (iso: unknown, now: number): Date | null => {
  if (typeof iso !== "string" || !iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) && t > now ? new Date(t) : null;
};

/** When the basic website goes live, if that is still ahead; null = it shows (or there is none). Read from `readyAt` alone, so it
 *  holds on the visitor's copy too (publicCard switches `enabled` off during the wait). */
export const sitePending = (site: unknown, now = Date.now()): Date | null => {
  const s = site && typeof site === "object" ? site as SiteLike : null;
  return s ? future(s.readyAt, now) : null;
};
/** When the Premium design goes live, if that is still ahead. */
export const advancedPending = (site: unknown, now = Date.now()): Date | null => {
  const s = site && typeof site === "object" ? site as SiteLike : null;
  return s && s.advanced && s.advancedOn !== false ? future(s.advancedReadyAt, now) : null;
};

/** The card as VISITORS see it: during the website's wait the card shows everywhere; during the Premium wait the basic website shows. */
export function publicCard<T extends Card>(card: T, now = Date.now()): T {
  if (!card.site) return card;
  const s = card.site as SiteLike;
  const waitSite = !!sitePending(s, now), waitAdv = !!advancedPending(s, now);
  if (!waitSite && !waitAdv) return card;
  return { ...card, site: { ...card.site, ...(waitSite ? { enabled: false } : {}), ...(waitAdv ? { advancedOn: false } : {}) } };
}

/** "within 24–48 hours" and the moment it goes live, for the screens. */
export const readyText = (at: Date, hi: boolean) => {
  const when = at.toLocaleString(hi ? "hi-IN" : "en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
  return hi ? `${when} तक live हो जाएगी` : `live by ${when}`;
};
