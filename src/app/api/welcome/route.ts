// POST (bearer) right after sign-up (form or Google): every new account gets WELCOME_CREDITS once, so the owner can try
// the AI tools (AI card, AI website, AI photos) before paying, plus a welcome email, and the company gets an alert.
// Answers { fresh: true } only that first time, so the caller opens the setup for new accounts. Only in the first days
// after sign-up, and only once (checked in the credit ledger). Accounts start on the free plan; until migration 0049 has run the database still starts a trial,
// so a fresh unpaid trial is switched to the free plan here.
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { WELCOME_CREDITS } from "@/lib/site-pricing";
import { ALERT_TO, realEmail, sendMail, signupAlertMail, welcomeMail } from "@/lib/mailer";
import { SUPA_URL } from "@/lib/admin-guard";

type Prof = { plan: string | null; plan_source: string | null; trial_started_at: string | null; created_at: string | null };

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const prof = (await restAsService<Prof[]>(`profiles?id=eq.${me.id}&select=plan,plan_source,trial_started_at,created_at`)).data?.[0];
  if (!prof) return NextResponse.json({ ok: true, granted: 0 });
  const since = prof.created_at ?? prof.trial_started_at;
  const fresh = !!since && Date.now() - new Date(since).getTime() < 3 * 86400_000;
  if (!fresh) return NextResponse.json({ ok: true, granted: 0 });

  if (prof.plan_source === "trial") {
    const free = { plan: "free", trial_started_at: null, plan_expires_at: null };
    const r = await restAsService(`profiles?id=eq.${me.id}&plan_source=eq.trial`, { method: "PATCH", body: JSON.stringify({ ...free, plan_source: "free" }) });
    // Before 0049 the check constraint has no 'free' source yet.
    if (!r.ok) await restAsService(`profiles?id=eq.${me.id}&plan_source=eq.trial`, { method: "PATCH", body: JSON.stringify({ ...free, plan_source: "paid" }) });
  }

  const already = (await restAsService<{ id: string }[]>(`credit_ledger?user_id=eq.${me.id}&reason=eq.welcome&select=id&limit=1`)).data;
  if (already?.length) return NextResponse.json({ ok: true, granted: 0 });
  // WELCOME_CREDITS may be 0 (free = the card only); the ledger row still marks the welcome as done, so mails go once.
  const g = await restAsService("rpc/grant_credits", { method: "POST", body: JSON.stringify({ p_user: me.id, p_amount: WELCOME_CREDITS, p_reason: "welcome", p_ref: `welcome:${me.id}` }) });

  // Welcome email to the owner (real inboxes only) and a new-registration alert to the company. Never blocks sign-up.
  const who = await fetch(`${SUPA_URL}/auth/v1/user`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", Authorization: `Bearer ${me.token}` }, cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null) as { email?: string; app_metadata?: { provider?: string }; user_metadata?: { full_name?: string; name?: string; phone?: string; contact_email?: string } } | null;
  const meta = who?.user_metadata ?? {};
  const name = (meta as { display_name?: string }).display_name || meta.full_name || meta.name || "";
  const inbox = realEmail(who?.email) ? who!.email! : realEmail(meta.contact_email) ? meta.contact_email! : "";
  const w = welcomeMail(name, g.ok ? WELCOME_CREDITS : 0);
  const al = signupAlertMail({ app: "Business Suite", name, mobile: meta.phone, email: inbox, extra: who?.app_metadata?.provider === "google" ? "Signed up with Google" : undefined });
  await Promise.all([
    inbox ? sendMail({ to: inbox, ...w }) : null,
    sendMail({ to: ALERT_TO(), ...al, ...(inbox ? { replyTo: inbox } : {}) }),
  ]).catch(() => undefined);

  return NextResponse.json({ ok: g.ok, granted: g.ok ? WELCOME_CREDITS : 0, fresh: true });
}
