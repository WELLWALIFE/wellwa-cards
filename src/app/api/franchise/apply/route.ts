// "Become a franchise" — the website form (shubhora.com/franchise). Public, same-origin, rate-limited, honeypot.
// Saves the application (migration 0080) and tells the Super Admins; the review happens in Admin → Franchises → Applications.
import { clientKey, rateLimited, sameOrigin } from "@/lib/api-security";
import { svc } from "@/lib/service";
import { cleanPhone } from "@/lib/jobs";
import { notify } from "@/lib/notify";
import { APP_COLS, PASSWORD_MIN, type FranchiseApplication } from "@/lib/franchise-apply";
import { SITE_URL } from "@/lib/site-url";
import { findAuthUser, loginAddress } from "@/lib/admin-v2";
import bcrypt from "bcryptjs";

const clean = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ ok: false }, { status: 403 });
  if (rateLimited(clientKey(request, "franchise-apply"), 4, 10 * 60_000)) return Response.json({ ok: false, error: "Please try again in a few minutes." }, { status: 429 });
  let b: Record<string, unknown>;
  try { b = await request.json(); } catch { return Response.json({ ok: false, error: "Invalid request." }, { status: 400 }); }
  if (b.website) return Response.json({ ok: true });            // honeypot
  const name = clean(b.name, 80);
  const phone = cleanPhone(b.phone);
  const city = clean(b.city, 60);
  if (!name) return Response.json({ ok: false, error: "Please write your name." }, { status: 400 });
  if (!phone) return Response.json({ ok: false, error: "Please write a 10-digit Indian mobile number." }, { status: 400 });
  if (!city) return Response.json({ ok: false, error: "Please write your city." }, { status: 400 });
  const email = clean(b.email, 120).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ ok: false, error: "That e-mail does not look right." }, { status: 400 });
  // The panel password, chosen here (owner, 1 Nov 2026): kept only as a bcrypt hash until approval makes the login from it. A mobile that
  // already has a Shubhora login keeps its own password — nothing is stored.
  const password = String(b.password ?? "");
  const existing = await findAuthUser(loginAddress(phone)).catch(() => null);
  if (!existing) {
    if (password.length < PASSWORD_MIN) return Response.json({ ok: false, error: `Choose a panel password of at least ${PASSWORD_MIN} characters.` }, { status: 400 });
    if (password !== String(b.password2 ?? "")) return Response.json({ ok: false, error: "The two passwords do not match." }, { status: 400 });
  }
  const password_hash = existing ? "" : await bcrypt.hash(password, 10);

  // The same person applying twice in a month: the earlier application is still open — do not make a second one.
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const dup = list(await svc<{ id: string; status: string }[]>(`franchise_applications?phone=eq.${encodeURIComponent(phone)}&created_at=gte.${since}&select=id,status&limit=1`));
  if (dup.length && dup[0].status !== "rejected") return Response.json({ ok: true, again: true });

  const row = {
    name, phone, email, company: clean(b.company, 100), city, state: clean(b.state, 60), area: clean(b.area, 120),
    background: clean(b.background, 1000), reach: clean(b.reach, 500), source: clean(b.source, 40) || "website",
    password_hash, has_account: !!existing,
    ip: (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim().slice(0, 60),
  };
  const r = await svc<FranchiseApplication[]>(`franchise_applications?select=${APP_COLS}`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) });
  const made = list(r)[0];
  if (!made) return Response.json({ ok: false, error: /franchise_applications/.test(r.text) ? "The form is not ready yet — please WhatsApp us." : "Could not save. Please try again or WhatsApp us." }, { status: 502 });

  // Every Super Admin hears about it (push + WhatsApp, like a new lead).
  const admins = list(await svc<{ id: string }[]>("admin_users?role=eq.super_admin&active=is.true&franchise_id=is.null&select=id&limit=10"));
  await Promise.all(admins.map((a) => notify(a.id, "new_lead", {
    title: `Franchise application: ${name}`, body: `${city}${row.state ? `, ${row.state}` : ""} · ${phone.replace(/^\+91/, "")}${row.company ? ` · ${row.company}` : ""}`,
    path: "/admin/franchises?tab=applications", ref: `franchise-app:${made.id}`,
    whatsappText: `*New franchise application* 🏪\n${name} — ${city}${row.state ? `, ${row.state}` : ""}\nMobile: ${phone.replace(/^\+91/, "")}${row.company ? `\nBusiness: ${row.company}` : ""}${row.area ? `\nWants: ${row.area}` : ""}\n\nReview: ${SITE_URL}/admin/franchises?tab=applications`,
  }).catch(() => undefined)));
  return Response.json({ ok: true, id: made.id, hasAccount: !!existing });
}
