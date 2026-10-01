// Server-to-server link used by the company's associate panel (a separate app).
// Every request is signed with LINK_SECRET (HMAC-SHA256 over the raw body) and carries a timestamp.
//   ensure   → create the Suite account for a new partner ID's email, returns its user id (409 when an account with
//              that email already exists — never taken over). New accounts made for a not-yet-paid associate start
//              on the free plan.
//   grant    → apply one paid month of the Business Suite (idempotent per ref; an admin activation of N months sends
//              partner-<id>, partner-<id>-m2 … partner-<id>-mN)
//   revoke   → take back the month a refunded payment granted
//   credits  → add AI credits once per ref (the Direct Sale Bonus is paid this way)
//   joined   → a new partner ID: welcome email to the partner and a new-registration alert to the company
//   password → keep the Suite password the same as the associate panel password
//   login    → one-time sign-in address that opens the Suite without a password
//   support-link → one-time address that opens Live help (and only Live help) for a named staff member

import { notify } from "@/lib/notify";
import { ALERT_TO, partnerWelcomeMail, realEmail, sendMail, signupAlertMail } from "@/lib/mailer";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { SAAS_PLANS } from "@/lib/billing";
import { SUPA_URL, serviceConfigured, serviceHeaders } from "@/lib/admin-guard";
import { signAdminToken } from "@/lib/admin-token";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://shubhora.com").replace(/\/$/, "");

function signatureOk(raw: string, sig: string) {
  const secret = process.env.LINK_SECRET ?? "";
  if (!secret || !sig) return false;
  const want = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  return want.length === sig.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig));
}

async function findUserByEmail(email: string): Promise<{ id: string } | null> {
  for (let page = 1; page <= 50; page++) {
    const r = await fetch(`${SUPA_URL}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers: serviceHeaders(), cache: "no-store" });
    if (!r.ok) throw new Error("user lookup failed");
    const users = ((await r.json()).users ?? []) as { id: string; email?: string }[];
    const hit = users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (hit) return hit;
    if (users.length < 1000) return null;
  }
  return null;
}

async function userEmail(userId: string): Promise<string> {
  const r = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, { headers: serviceHeaders(), cache: "no-store" });
  if (!r.ok) throw new Error("account not found");
  const u = await r.json();
  if (!u.email) throw new Error("account has no email");
  return u.email as string;
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!signatureOk(raw, request.headers.get("x-link-signature") ?? "")) return NextResponse.json({ error: "bad signature" }, { status: 401 });
  if (!serviceConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const b = JSON.parse(raw) as Record<string, unknown>;
  if (Math.abs(Date.now() - Number(b.ts ?? 0)) > 5 * 60_000) return NextResponse.json({ error: "stale request" }, { status: 401 });

  try {
    if (b.action === "ensure") {
      const email = String(b.email ?? "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "valid email required" }, { status: 400 });
      const code = String(b.code ?? "");
      const password = typeof b.password === "string" && b.password.length >= 8 ? b.password : crypto.randomBytes(24).toString("base64url");
      // One SH ID ↔ one app account, tied by the account id. An account that already exists with this email is
      // never taken over (it may be another ID's person — that is how two IDs got mixed): the panel is told, and the
      // owner links it by hand in Super Admin → Users if it really is the same person.
      const inUse = async (id: string) => {
        const cur = await fetch(`${SUPA_URL}/auth/v1/admin/users/${id}`, { headers: serviceHeaders(), cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
        const linked = typeof cur?.user_metadata?.associate_id === "string" ? cur.user_metadata.associate_id : "";
        return NextResponse.json({
          error: `An app account with ${email} already exists${linked ? ` (${linked})` : ""} — not linked automatically. Link it in Super Admin → Users, or give this ID another email.`,
          code: "email_in_use", linkedTo: linked || null,
        }, { status: 409 });
      };
      let user = await findUserByEmail(email);
      let created = false;
      if (user) return inUse(user.id);
      const c = await fetch(`${SUPA_URL}/auth/v1/admin/users`, {
        method: "POST", headers: serviceHeaders(),
        body: JSON.stringify({
          email, email_confirm: true, password,
          user_metadata: { name: String(b.name ?? ""), full_name: String(b.name ?? ""), phone: String(b.mobile ?? ""), associate_id: code },
        }),
      });
      if (!c.ok) {
        const other = await findUserByEmail(email);     // made meanwhile by a parallel call
        if (other) return inUse(other.id);
        return NextResponse.json({ error: (await c.json().catch(() => ({})))?.msg ?? "could not create account" }, { status: 400 });
      }
      user = await c.json(); created = true;
      if (created && b.basic) {
        // Not paid yet: the free plan until the first payment.
        await fetch(`${SUPA_URL}/rest/v1/profiles?id=eq.${user!.id}`, {
          method: "PATCH", headers: { ...serviceHeaders(), Prefer: "return=minimal" },
          body: JSON.stringify({ plan: "pro", plan_source: "partner", plan_expires_at: new Date().toISOString() }),
        });
      }
      return NextResponse.json({ userId: user!.id, created });
    }

    if (b.action === "password") {
      const userId = String(b.userId ?? ""); const pw = String(b.password ?? "");
      if (!/^[0-9a-f-]{36}$/.test(userId) || pw.length < 8) return NextResponse.json({ error: "bad request" }, { status: 400 });
      const r = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, { method: "PUT", headers: serviceHeaders(), body: JSON.stringify({ password: pw }) });
      if (!r.ok) return NextResponse.json({ error: "could not change password" }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (b.action === "revoke") {
      const userId = String(b.userId ?? ""); const ref = String(b.ref ?? "");
      if (!/^[0-9a-f-]{36}$/.test(userId) || !/^partner-\d+(-m\d{1,2})?$/.test(ref)) return NextResponse.json({ error: "bad revoke" }, { status: 400 });
      const sub = await fetch(`${SUPA_URL}/rest/v1/subscriptions?provider_ref=eq.${ref}&owner_id=eq.${userId}&select=id,status`, { headers: serviceHeaders(), cache: "no-store" }).then((r) => r.json());
      if (!sub?.[0] || sub[0].status === "refunded") return NextResponse.json({ ok: true, nothing: true });
      const prof = await fetch(`${SUPA_URL}/rest/v1/profiles?id=eq.${userId}&select=plan_expires_at,saas_expires_at,poster_plan_expires_at`, { headers: serviceHeaders(), cache: "no-store" }).then((r) => r.json());
      const back = (iso: string | null) => { if (!iso) return iso; const d = new Date(iso); d.setMonth(d.getMonth() - 1); return (d < new Date() ? new Date() : d).toISOString(); };
      const p0 = prof?.[0] ?? {};
      await fetch(`${SUPA_URL}/rest/v1/profiles?id=eq.${userId}`, { method: "PATCH", headers: { ...serviceHeaders(), Prefer: "return=minimal" },
        body: JSON.stringify({ plan_expires_at: back(p0.plan_expires_at), saas_expires_at: back(p0.saas_expires_at), poster_plan_expires_at: back(p0.poster_plan_expires_at) }) });
      await fetch(`${SUPA_URL}/rest/v1/subscriptions?id=eq.${sub[0].id}`, { method: "PATCH", headers: { ...serviceHeaders(), Prefer: "return=minimal" }, body: JSON.stringify({ status: "refunded" }) });
      return NextResponse.json({ ok: true });
    }

    if (b.action === "grant") {
      const userId = String(b.userId ?? ""); const ref = String(b.ref ?? ""); const amount = Math.round(Number(b.amountPaise ?? 0));
      if (!/^[0-9a-f-]{36}$/.test(userId) || !/^partner-\d+(-m\d{1,2})?$/.test(ref) || amount <= 0) return NextResponse.json({ error: "bad grant" }, { status: 400 });
      const r = await fetch(`${SUPA_URL}/rest/v1/rpc/apply_saas_payment`, {
        method: "POST", headers: serviceHeaders(),
        body: JSON.stringify({ p_user: userId, p_tier: "growth", p_ref: ref, p_order_ref: ref, p_amount: amount, p_credits: SAAS_PLANS.growth.credits }),
      });
      if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 400 });
      const result = await r.json();
      await notify(userId, "payment", { title: "Payment received", body: "Your Shubhora Business Suite is active for one more month.", path: "/dashboard", ref }).catch(() => undefined);
      return NextResponse.json({ ok: true, result });
    }

    if (b.action === "credits") {
      const userId = String(b.userId ?? ""); const ref = String(b.ref ?? ""); const credits = Math.round(Number(b.credits ?? 0));
      if (!/^[0-9a-f-]{36}$/.test(userId) || !/^partner-[a-z]+-\d+$/.test(ref) || credits <= 0 || credits > 1000) return NextResponse.json({ error: "bad credits" }, { status: 400 });
      const seen = await fetch(`${SUPA_URL}/rest/v1/credit_ledger?user_id=eq.${userId}&ref=eq.${ref}&select=id&limit=1`, { headers: serviceHeaders(), cache: "no-store" }).then((r) => r.json());
      if (Array.isArray(seen) && seen.length) return NextResponse.json({ ok: true, already: true });
      const r = await fetch(`${SUPA_URL}/rest/v1/rpc/grant_credits`, {
        method: "POST", headers: serviceHeaders(),
        body: JSON.stringify({ p_user: userId, p_amount: credits, p_reason: "partner_bonus", p_ref: ref }),
      });
      if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 400 });
      await notify(userId, "payment", { title: `${credits} AI credits added`, body: `${String(b.reason ?? "Bonus")}: ${credits} AI credits are in your account.`, path: "/poster/plan", ref }).catch(() => undefined);
      return NextResponse.json({ ok: true });
    }

    if (b.action === "joined") {
      const code = String(b.code ?? "").slice(0, 20); const name = String(b.name ?? "").slice(0, 100);
      const email = String(b.email ?? "").trim().toLowerCase(); const mobile = String(b.mobile ?? "").slice(0, 20);
      if (!/^[A-Z]{2}\d{4,}$/.test(code)) return NextResponse.json({ error: "bad code" }, { status: 400 });
      const sponsor = String(b.sponsor ?? "").slice(0, 20);
      await Promise.all([
        realEmail(email) ? sendMail({ to: email, ...partnerWelcomeMail({ name, code }) }) : null,
        sendMail({ to: ALERT_TO(), ...signupAlertMail({ app: "Partner", name, mobile, email: realEmail(email) ? email : "", extra: `ID ${code}${sponsor ? ` · sponsor ${sponsor}` : ""}` }) }),
      ]);
      return NextResponse.json({ ok: true });
    }

    if (b.action === "login") {
      const userId = String(b.userId ?? "");
      if (!/^[0-9a-f-]{36}$/.test(userId)) return NextResponse.json({ error: "bad user" }, { status: 400 });
      const email = await userEmail(userId);
      const g = await fetch(`${SUPA_URL}/auth/v1/admin/generate_link`, {
        method: "POST", headers: serviceHeaders(), body: JSON.stringify({ type: "magiclink", email }),
      });
      if (!g.ok) return NextResponse.json({ error: "could not create sign-in link" }, { status: 400 });
      const j = await g.json();
      const token = (j.hashed_token ?? j.properties?.hashed_token) as string | undefined;
      if (!token) return NextResponse.json({ error: "no token" }, { status: 400 });
      return NextResponse.json({ url: `${SITE}/auth/link?t=${encodeURIComponent(token)}` });
    }

    // The Staff Admin's "Help this customer" button: hand a named staff member into Live help.
    //
    // Returns a one-time address (60 seconds) that opens ONLY /admin/support. It is not the owner handoff:
    // the session key it becomes carries scope "support", which /lib/admin-guard lets through to
    // /api/admin/support and nothing else, and the Super Admin menu shows only that one page.
    //
    // `staff` is the name the card holder sees in their banner while being helped, so help never arrives
    // from "somebody". The panel decides which of its own roles may ask for this (its PERMS) — this side
    // only checks that the call is signed with LINK_SECRET.
    if (b.action === "support-link") {
      const staff = String(b.staff ?? "").trim().slice(0, 60);
      if (staff.length < 2) return NextResponse.json({ error: "staff name needed" }, { status: 400 });
      const t = signAdminToken(staff, "handoff", 60, "support");
      return NextResponse.json({ url: `${SITE}/admin-link?t=${encodeURIComponent(t)}&to=support` });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
