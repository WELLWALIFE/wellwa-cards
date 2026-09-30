// Server-to-server: the platform's own alarms. The render worker calls this when something needs a human —
// the AI picture service refusing for money (top up Gemini), a video failing, the worker giving up on a job —
// and the platform owners get an email at once, plus WhatsApp/push through their own Shubhora accounts when
// those channels are switched on. Needs the cron key, like /api/notify/internal.
//
// POST { subject, text, key?, path? } — `key` de-duplicates within the hour (the worker also throttles).
import { NextResponse } from "next/server";
import { OWNER_EMAILS } from "@/lib/owner-emails";
import { sendMail } from "@/lib/mailer";
import { notify } from "@/lib/notify";
import { getAdminSupabase } from "@/lib/supabase/admin";

const ok = (r: Request) => !!process.env.CRON_KEY && r.headers.get("x-cron-key") === process.env.CRON_KEY;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
// One alarm per key per hour, however many jobs trip it (a Gemini balance at zero fails every video in the queue).
const recent = new Map<string, number>();

/** The owners' own user ids, for WhatsApp/push — found once by email and remembered for the process. */
let ownerIds: string[] | null = null;
async function ownerUserIds(): Promise<string[]> {
  if (ownerIds) return ownerIds;
  const admin = getAdminSupabase();
  if (!admin) return [];
  try {
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const set = new Set(OWNER_EMAILS.map((e) => e.toLowerCase()));
    ownerIds = (data?.users ?? []).filter((u) => set.has(String(u.email ?? "").toLowerCase())).map((u) => u.id);
  } catch { ownerIds = []; }
  return ownerIds;
}

export async function POST(request: Request) {
  if (!ok(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => ({})) as { subject?: unknown; text?: unknown; key?: unknown; path?: unknown };
  const subject = String(b.subject ?? "").trim().slice(0, 120);
  const text = String(b.text ?? "").trim().slice(0, 4000);
  if (!subject || !text) return NextResponse.json({ error: "subject and text are required" }, { status: 400 });
  const key = String(b.key ?? subject).slice(0, 120);
  const hour = Math.floor(Date.now() / 3600_000);
  const stamp = `${key}:${hour}`;
  if (recent.has(stamp)) return NextResponse.json({ ok: true, skipped: "already sent this hour" });
  recent.set(stamp, Date.now());
  for (const [k, t] of recent) if (Date.now() - t > 2 * 3600_000) recent.delete(k);

  const html = `<p style="white-space:pre-wrap;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6">${esc(text)}</p>`;
  const mail = await Promise.all(OWNER_EMAILS.map((to) => sendMail({ to, subject: `[Shubhora alert] ${subject}`, html, text })));
  // The same words on WhatsApp/push, through each owner's own account (channels as the admin switched them).
  const ids = await ownerUserIds();
  const wa = await Promise.all(ids.map((id) => notify(id, "system_alert", { title: `⚠️ ${subject}`, body: text.slice(0, 600), path: typeof b.path === "string" ? b.path : "/admin", ref: stamp, channels: ["whatsapp", "push"] })));
  return NextResponse.json({ ok: true, mail: mail.map((m) => m.ok || !!m.skipped), owners: ids.length, wa });
}
