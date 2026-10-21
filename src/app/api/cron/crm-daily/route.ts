// CRM Pro automations that run on the clock (docs/crm-pro.md 3.13). deploy.sh writes two cron lines → scripts/crm-daily.sh:
//   ?job=morning  (09:00 IST)  birthday / anniversary wishes to customers (owner_prefs.crm.birthday_wish), and the
//                              "going cold" nudge to the owner (stale_days with no activity, open stages)
//   ?job=evening  (20:00 IST)  the owner's daily summary (owner_prefs.crm.daily_summary): calls made / connected,
//                              leads added, won, and tomorrow's due list
//   curl -H "x-cron-key: $CRON_KEY" "http://127.0.0.1:3001/api/cron/crm-daily?job=evening"
// Everything goes once per owner per day (notification_log ref) and only from the owner's own linked WhatsApp.
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { serviceConfigured } from "@/lib/admin-guard";
import { notify } from "@/lib/notify";
import { businessOf, cardOf, hindiCard, sendCustomer } from "@/lib/customer-send";
import { istToday } from "@/lib/bookings";
import { DEFAULT_PREFS, type CrmPrefs } from "@/lib/crm-pro";

export const maxDuration = 285;
const list = <T,>(r: { data: T[] | null }): T[] => (Array.isArray(r.data) ? r.data : []);
const enc = encodeURIComponent;

export async function GET(request: Request) {
  if (!process.env.CRON_KEY || request.headers.get("x-cron-key") !== process.env.CRON_KEY) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return NextResponse.json({ error: "service key missing" }, { status: 503 });
  const u = new URL(request.url);
  const job = u.searchParams.get("job") === "morning" ? "morning" : "evening";
  const date = u.searchParams.get("date") ?? istToday();
  const owners = list(await restAsService<{ owner_id: string; crm: Partial<CrmPrefs> | null }[]>("owner_prefs?select=owner_id,crm&limit=5000")).map((o) => ({ id: o.owner_id, p: { ...DEFAULT_PREFS, ...(o.crm ?? {}) } }));
  const out: Record<string, number> = { owners: owners.length, wishes: 0, nudges: 0, summaries: 0 };
  const dayStart = new Date(`${date}T00:00:00+05:30`), dayEnd = new Date(dayStart.getTime() + 86400000), nextEnd = new Date(dayStart.getTime() + 2 * 86400000);
  const [, mm, dd] = date.split("-").map(Number);

  for (const { id: owner, p } of owners) {
    try {
      if (job === "morning") {
        if (p.birthday_wish) {
          const card = await cardOf(owner); const biz = businessOf(card); const hi = hindiCard(card);
          const rows = list(await restAsService<{ id: string; name: string; phone: string; birthday: string | null; anniversary: string | null; opted_out: boolean }[]>(`leads?owner_id=eq.${owner}&opted_out=is.false&or=(and(birthday.not.is.null,birthday.gte.1900-01-01),and(anniversary.not.is.null,anniversary.gte.1900-01-01))&select=id,name,phone,birthday,anniversary,opted_out&limit=2000`))
            .filter((l) => [l.birthday, l.anniversary].some((d) => d && Number(d.slice(5, 7)) === mm && Number(d.slice(8, 10)) === dd));
          for (const l of rows) {
            const first = (l.name || "").split(/\s+/)[0] || "";
            const bday = l.birthday && Number(l.birthday.slice(5, 7)) === mm && Number(l.birthday.slice(8, 10)) === dd;
            const text = hi
              ? (bday ? `🎂 ${first ? `${first} जी, ` : ""}जन्मदिन की हार्दिक शुभकामनाएँ! आपका दिन खुशियों से भरा हो। — ${biz}` : `💐 ${first ? `${first} जी, ` : ""}सालगिरह की ढेर सारी शुभकामनाएँ! — ${biz}`)
              : (bday ? `🎂 Happy birthday${first ? `, ${first}` : ""}! Wishing you a wonderful day. — ${biz}` : `💐 Happy anniversary${first ? `, ${first}` : ""}! — ${biz}`);
            const ref = `wish:${l.id}:${date}`;
            const dup = list(await restAsService<{ id: string }[]>(`notification_log?user_id=eq.${owner}&type=eq.festival_wishes&ref=eq.${enc(ref)}&ok=is.true&select=id&limit=1`)).length > 0;
            if (dup) continue;
            const ok = await sendCustomer(owner, l.phone, text);
            await restAsService("notification_log", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ user_id: owner, type: "festival_wishes", channel: "whatsapp", ref, ok }) }).catch(() => null);
            if (ok) { out.wishes += 1; await restAsService("lead_events", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ owner_id: owner, lead_id: l.id, kind: "sent", text: `📤 ${bday ? "Birthday" : "Anniversary"} wish` }) }).catch(() => null); }
          }
        }
        if (p.stale_days > 0) {
          const since = new Date(Date.now() - p.stale_days * 86400000).toISOString();
          const cold = list(await restAsService<{ id: string; name: string; phone: string }[]>(`leads?owner_id=eq.${owner}&status=in.(interested,follow_up,contacted)&last_activity_at=lt.${enc(since)}&next_follow_up=is.null&select=id,name,phone&order=last_activity_at&limit=20`));
          if (cold.length) {
            const names = cold.slice(0, 5).map((l) => l.name || l.phone).join(", ");
            await notify(owner, "followup_due", { title: `🧊 ${cold.length} customer${cold.length > 1 ? "s" : ""} going cold`, body: `${p.stale_days}+ days without a word: ${names}${cold.length > 5 ? "…" : ""}`, path: "/poster/crm?s=today", ref: `cold:${date}`, whatsappText: `🧊 *${cold.length} customers going cold* (${p.stale_days}+ days, no follow-up set)\n${cold.slice(0, 10).map((l) => `• ${l.name || l.phone}`).join("\n")}\n\nOpen Shubhora → Customers → Today.` });
            out.nudges += 1;
          }
        }
      } else if (p.daily_summary) {
        const [calls, newLeads, won, due] = await Promise.all([
          restAsService<{ outcome: string }[]>(`crm_calls?owner_id=eq.${owner}&status=eq.done&started_at=gte.${enc(dayStart.toISOString())}&started_at=lt.${enc(dayEnd.toISOString())}&select=outcome&limit=2000`),
          restAsService<{ id: string }[]>(`leads?owner_id=eq.${owner}&created_at=gte.${enc(dayStart.toISOString())}&created_at=lt.${enc(dayEnd.toISOString())}&select=id&limit=2000`),
          restAsService<{ id: string; value_paise: number }[]>(`leads?owner_id=eq.${owner}&status=in.(converted,won)&updated_at=gte.${enc(dayStart.toISOString())}&updated_at=lt.${enc(dayEnd.toISOString())}&select=id,value_paise&limit=500`),
          restAsService<{ title: string; due_at: string; leads: { name: string; phone: string } | null }[]>(`crm_tasks?owner_id=eq.${owner}&done_at=is.null&due_at=lt.${enc(nextEnd.toISOString())}&select=title,due_at,leads(name,phone)&order=due_at&limit=30`),
        ]);
        const C = list(calls), conn = C.filter((c) => c.outcome === "connected").length, D = list(due);
        const overdue = D.filter((t) => new Date(t.due_at) < dayEnd).length, tomorrow = D.length - overdue;
        const value = list(won).reduce((n, w) => n + (w.value_paise || 0), 0);
        const body = `📞 ${C.length} calls (${conn} connected) · ✨ ${list(newLeads).length} new · 🏆 ${list(won).length} won${value ? ` ₹${(value / 100).toLocaleString("en-IN")}` : ""} · ⏰ ${tomorrow} due tomorrow${overdue ? `, ${overdue} overdue` : ""}`;
        const lines = D.slice(0, 10).map((t) => `• ${t.leads?.name || t.leads?.phone || ""} — ${t.title}`).join("\n");
        await notify(owner, "daily_summary", { title: "📊 Aaj ka CRM", body, path: "/poster/crm?s=today", ref: `crm-day:${date}`, channels: ["push", "whatsapp"], whatsappText: `📊 *Aaj ka CRM — ${date}*\n${body}\n\n*Kal / baaki:*\n${lines || "—"}\n\nShubhora → Customers → Today` });
        out.summaries += 1;
      }
    } catch (e) { console.error("[crm-daily]", owner.slice(0, 8), (e as Error).message); }
  }
  return NextResponse.json({ ok: true, job, date, ...out });
}
