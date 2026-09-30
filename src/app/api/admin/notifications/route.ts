// Super Admin → Notifications: the on/off switches, delivery counts, a test send and a broadcast.
import { NextResponse } from "next/server";
import { adminAllowed, serviceConfigured, serviceHeaders, SUPA_URL } from "@/lib/admin-guard";
import {
  defaultSettings, getNotificationSettings, isNotificationType, notify, NOTIFICATION_TYPES, saveNotificationSettings, vapidPublicKey,
  type NotificationSettings,
} from "@/lib/notify";

const rest = (path: string) => fetch(`${SUPA_URL}/rest/v1/${path}`, { headers: { ...serviceHeaders(), Prefer: "count=exact" }, cache: "no-store" });
const count = async (path: string) => {
  const r = await rest(`${path}${path.includes("?") ? "&" : "?"}select=*&limit=1`);
  return Number((r.headers.get("content-range") ?? "*/0").split("/")[1]) || 0;
};

export async function GET(request: Request) {
  if (!(await adminAllowed(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return NextResponse.json({ error: "service key missing" }, { status: 503 });
  const since = new Date(Date.now() - 86400_000).toISOString();
  const tableReady = (await rest("notification_settings?id=eq.1&select=id")).ok;
  const [settings, browsers, pushOk, waOk, failed] = await Promise.all([
    getNotificationSettings(true),
    tableReady ? count("push_subscriptions") : 0,
    tableReady ? count(`notification_log?channel=eq.push&ok=is.true&created_at=gte.${since}`) : 0,
    tableReady ? count(`notification_log?channel=eq.whatsapp&ok=is.true&created_at=gte.${since}`) : 0,
    tableReady ? count(`notification_log?ok=is.false&created_at=gte.${since}`) : 0,
  ]);
  return NextResponse.json({
    settings, types: NOTIFICATION_TYPES, tableReady, pushReady: !!vapidPublicKey(),
    whatsappSender: process.env.NOTIFY_WA_USER ? "company" : "own",
    stats: { browsers, pushOk, waOk, failed },
  });
}

export async function PUT(request: Request) {
  if (!(await adminAllowed(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as Partial<NotificationSettings>;
  const d = defaultSettings();
  const s: NotificationSettings = {
    enabled: !!b.enabled, push: !!b.push, whatsapp: !!b.whatsapp,
    types: Object.fromEntries(Object.keys(d.types).map((k) => {
      const t = (b.types as Record<string, { push?: boolean; whatsapp?: boolean }> | undefined)?.[k];
      return [k, { push: !!t?.push, whatsapp: !!t?.whatsapp }];
    })) as NotificationSettings["types"],
  };
  if (!(await saveNotificationSettings(s))) return NextResponse.json({ error: "Could not save. Has the notifications SQL been run in Supabase?" }, { status: 500 });
  return NextResponse.json({ ok: true, settings: s });
}

async function userIdByEmail(email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const r = await fetch(`${SUPA_URL}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers: serviceHeaders(), cache: "no-store" });
    if (!r.ok) return null;
    const users = ((await r.json()).users ?? []) as { id: string; email?: string }[];
    const hit = users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (hit) return hit.id;
    if (users.length < 1000) return null;
  }
  return null;
}

export async function POST(request: Request) {
  if (!(await adminAllowed(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => ({}));

  if (b.action === "test") {
    const email = String(b.email ?? "").trim().toLowerCase();
    const type = String(b.type ?? "announcement");
    if (!isNotificationType(type)) return NextResponse.json({ error: "unknown type" }, { status: 400 });
    const userId = await userIdByEmail(email);
    if (!userId) return NextResponse.json({ error: "No Shubhora account with that email." }, { status: 404 });
    const result = await notify(userId, type, { title: `Test: ${NOTIFICATION_TYPES[type].label}`, body: "This is a test notification from Shubhora.", path: "/dashboard" });
    return NextResponse.json({ ok: true, result });
  }

  if (b.action === "announce") {
    const title = String(b.title ?? "").trim().slice(0, 80); const body = String(b.body ?? "").trim().slice(0, 240);
    if (title.length < 3 || body.length < 3) return NextResponse.json({ error: "Write a title and a message." }, { status: 400 });
    const r = await fetch(`${SUPA_URL}/rest/v1/push_subscriptions?select=user_id`, { headers: serviceHeaders(), cache: "no-store" });
    const ids = [...new Set(((r.ok ? await r.json() : []) as { user_id: string }[]).map((x) => x.user_id))];
    const ref = `announce:${Buffer.from(title + body).toString("base64url").slice(0, 40)}`;
    let sent = 0;
    for (const id of ids) {
      const res = await notify(id, "announcement", { title, body, path: String(b.path || "/dashboard"), ref, channels: ["push"] });
      if (res.push?.ok) sent++;
    }
    return NextResponse.json({ ok: true, users: ids.length, sent });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
