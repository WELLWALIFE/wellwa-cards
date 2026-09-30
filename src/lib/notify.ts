import "server-only";
// Notifications to Shubhora users: browser (web push) and WhatsApp.
// Every send passes through notify(), which respects the Super Admin switches:
//   master switch (all) → channel switch (push / WhatsApp) → per-type switch.
//
// WhatsApp goes out from the company's own connected WhatsApp when NOTIFY_WA_USER is set
// (the Shubhora account whose WhatsApp is linked on the WhatsApp page); otherwise it lands
// in the user's own "message yourself" chat through their own linked WhatsApp, if any.
import webpush from "web-push";
import { SUPA_URL, serviceConfigured, serviceHeaders } from "@/lib/admin-guard";
import { SITE_URL } from "@/lib/site-url";

export const NOTIFICATION_TYPES = {
  new_lead:      { label: "New lead",              hint: "A customer fills the card form or chats with the AI.", push: true,  whatsapp: true },
  followup_due:  { label: "Follow-up reminder",    hint: "A lead's follow-up time in the CRM has come.",         push: true,  whatsapp: true },
  daily_summary: { label: "Morning summary",       hint: "8 am: yesterday's leads and today's follow-ups.",      push: true,  whatsapp: false },
  poster_ready:  { label: "Today's poster ready",  hint: "The daily poster has been made.",                     push: true,  whatsapp: false },
  plan_expiry:   { label: "Plan ending soon",      hint: "3 days and 1 day before the paid plan ends.",     push: true,  whatsapp: true },
  card_renewal:  { label: "V-Card renewal",        hint: "30, 7 and 1 day before the V-Card year ends, on the end day, 2 days before the pause, and at the pause.", push: true, whatsapp: true },
  payment:       { label: "Payment received",      hint: "A payment is confirmed and the plan is active.",      push: true,  whatsapp: true },
  website_live:  { label: "Website is live",       hint: "The owner's own domain is connected and secured.",     push: true,  whatsapp: true },
  announcement:  { label: "News from Shubhora",    hint: "Messages the admin sends to everyone.",               push: true,  whatsapp: false },
  system_alert:  { label: "Platform alarms (owners)", hint: "The render worker or the AI picture service needs a human: balance out, a video failed.", push: true, whatsapp: true },
} as const;
export type NotificationType = keyof typeof NOTIFICATION_TYPES;
export const isNotificationType = (t: string): t is NotificationType => t in NOTIFICATION_TYPES;

export type NotificationSettings = {
  enabled: boolean; push: boolean; whatsapp: boolean;
  types: Record<NotificationType, { push: boolean; whatsapp: boolean }>;
};

const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPA_URL}/rest/v1/${path}`, { ...init, headers: { ...serviceHeaders(), ...(init.headers ?? {}) }, cache: "no-store" });

export function defaultSettings(): NotificationSettings {
  const types = Object.fromEntries(Object.entries(NOTIFICATION_TYPES).map(([k, v]) => [k, { push: v.push, whatsapp: v.whatsapp }]));
  return { enabled: true, push: true, whatsapp: true, types: types as NotificationSettings["types"] };
}

let cache: { at: number; s: NotificationSettings } | null = null;
export async function getNotificationSettings(fresh = false): Promise<NotificationSettings> {
  if (!fresh && cache && Date.now() - cache.at < 30_000) return cache.s;
  const d = defaultSettings();
  if (!serviceConfigured()) return d;
  try {
    const r = await rest("notification_settings?id=eq.1&select=enabled,push,whatsapp,types");
    const row = r.ok ? (await r.json())[0] : null;
    const s: NotificationSettings = row ? {
      enabled: row.enabled, push: row.push, whatsapp: row.whatsapp,
      types: Object.fromEntries(Object.keys(d.types).map((k) => [k, { ...d.types[k as NotificationType], ...(row.types?.[k] ?? {}) }])) as NotificationSettings["types"],
    } : d;
    cache = { at: Date.now(), s };
    return s;
  } catch { return d; }
}

export async function saveNotificationSettings(s: NotificationSettings): Promise<boolean> {
  const r = await rest("notification_settings?id=eq.1", {
    method: "PATCH", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ enabled: s.enabled, push: s.push, whatsapp: s.whatsapp, types: s.types, updated_at: new Date().toISOString() }),
  });
  cache = null;
  return r.ok;
}

/** For senders that deliver WhatsApp themselves (the hot-lead alert): is WhatsApp on for this type? */
export async function whatsappAllowed(type: NotificationType): Promise<boolean> {
  const s = await getNotificationSettings();
  return s.enabled && s.whatsapp && !!s.types[type]?.whatsapp;
}

// ---------------- web push ----------------
let vapidReady: boolean | null = null;
export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY ?? "";
function vapid(): boolean {
  if (vapidReady !== null) return vapidReady;
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  vapidReady = !!(pub && priv);
  if (vapidReady) webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:support@shubhora.com", pub!, priv!);
  return vapidReady;
}

async function sendPush(userId: string, msg: { title: string; body: string; url: string; tag: string }): Promise<{ ok: boolean; error?: string }> {
  if (!vapid()) return { ok: false, error: "push keys missing" };
  const r = await rest(`push_subscriptions?user_id=eq.${userId}&select=endpoint,p256dh,auth`);
  const subs = r.ok ? ((await r.json()) as { endpoint: string; p256dh: string; auth: string }[]) : [];
  if (!subs.length) return { ok: false, error: "no browser subscribed" };
  let delivered = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ ...msg, icon: "/icon.png", badge: "/icon.png" }), { TTL: 60 * 60 * 12 });
      delivered++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {                 // browser unsubscribed: forget it
        await rest(`push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: "DELETE" }).catch(() => undefined);
      }
    }
  }));
  return delivered ? { ok: true } : { ok: false, error: "push failed" };
}

// ---------------- WhatsApp ----------------
const BRIDGE = process.env.WA_BRIDGE_URL ?? "http://127.0.0.1:8787";

async function userPhone(userId: string): Promise<string | null> {
  try {
    const u = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, { headers: serviceHeaders(), cache: "no-store" }).then((r) => r.json());
    const fromMeta = String(u?.user_metadata?.phone ?? u?.phone ?? "").replace(/\D/g, "");
    if (fromMeta.length >= 10) return fromMeta.length === 10 ? `91${fromMeta}` : fromMeta;
    const p = await rest(`poster_profiles?user_id=eq.${userId}&phone=neq.&select=phone&limit=1`).then((r) => r.json()).catch(() => []);
    const ph = String(p?.[0]?.phone ?? "").replace(/\D/g, "");
    if (ph.length >= 10) return ph.length === 10 ? `91${ph}` : ph;
    const c = await rest(`cards?owner_id=eq.${userId}&select=data&limit=1`).then((r) => r.json()).catch(() => []);
    const wa = ((c?.[0]?.data?.links ?? []) as { type: string; value: string }[]).find((l) => l.type === "whatsapp")?.value?.replace(/\D/g, "") ?? "";
    if (wa.length >= 10) return wa.length === 10 ? `91${wa}` : wa;
  } catch { /* no phone */ }
  return null;
}

async function planExpiry(userId: string): Promise<string> {
  const p = await rest(`profiles?id=eq.${userId}&select=plan_expires_at`).then((r) => r.json()).catch(() => []);
  return p?.[0]?.plan_expires_at || "2999-12-31T23:59:59.000Z";
}

async function sendWhatsApp(userId: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const to = await userPhone(userId);
  if (!to) return { ok: false, error: "no WhatsApp number" };
  const sender = process.env.NOTIFY_WA_USER || userId;          // company WhatsApp, else the user's own
  try {
    const r = await fetch(`${BRIDGE}/send`, {
      method: "POST", signal: AbortSignal.timeout(15_000),
      headers: { "content-type": "application/json", "x-neuraledge-user": sender, "x-neuraledge-plan-expires": await planExpiry(sender) },
      body: JSON.stringify({ to, text }),
    });
    return r.ok ? { ok: true } : { ok: false, error: `bridge ${r.status}` };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "bridge down" }; }
}

// ---------------- the one entry point ----------------
export type NotifyInput = {
  title: string;                // short, e.g. "New lead: Priya"
  body: string;                 // one or two lines
  path?: string;                // where a tap opens, e.g. "/leads"
  ref?: string;                 // de-duplication key (lead id, date…): the same ref is sent once per channel
  whatsappText?: string;        // longer WhatsApp text; defaults to title + body + link
  channels?: ("push" | "whatsapp")[];
};

async function alreadySent(userId: string, type: string, channel: string, ref?: string) {
  if (!ref) return false;
  const r = await rest(`notification_log?user_id=eq.${userId}&type=eq.${type}&channel=eq.${channel}&ref=eq.${encodeURIComponent(ref)}&ok=is.true&select=id&limit=1`);
  return r.ok && (await r.json()).length > 0;
}

async function log(userId: string, type: string, channel: string, ref: string | undefined, res: { ok: boolean; error?: string }) {
  await rest("notification_log", { method: "POST", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ user_id: userId, type, channel, ref: ref ?? null, ok: res.ok, error: res.error ?? null }) }).catch(() => undefined);
}

/** Send one notification to one user on the channels the admin has switched on. Never throws. */
export async function notify(userId: string, type: NotificationType, n: NotifyInput) {
  const out: Record<string, { ok: boolean; error?: string; skipped?: string }> = {};
  if (!serviceConfigured()) return out;
  const s = await getNotificationSettings();
  const want = n.channels ?? ["push", "whatsapp"];
  const url = `${SITE_URL}${n.path ?? "/dashboard"}`;
  for (const ch of want) {
    if (!s.enabled) { out[ch] = { ok: false, skipped: "all notifications off" }; continue; }
    if (!s[ch]) { out[ch] = { ok: false, skipped: `${ch} off` }; continue; }
    if (!s.types[type]?.[ch]) { out[ch] = { ok: false, skipped: "type off" }; continue; }
    if (await alreadySent(userId, type, ch, n.ref)) { out[ch] = { ok: true, skipped: "already sent" }; continue; }
    const res = ch === "push"
      ? await sendPush(userId, { title: n.title, body: n.body, url, tag: `${type}:${n.ref ?? Date.now()}` })
      : await sendWhatsApp(userId, n.whatsappText ?? `*${n.title}*\n${n.body}\n\n${url}`);
    out[ch] = res;
    await log(userId, type, ch, n.ref, res);
  }
  return out;
}
