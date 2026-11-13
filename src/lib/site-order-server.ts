import "server-only";
// The website order, server side (lib/site-order.ts has the flow).
//   applyPackage()  a verified package payment: the package for a year, one month of the Growth features when none runs, Premium → the
//                   Premium website is opened. Called once per payment by settleRequest (lib/payments-server.ts).
//   orderState()    where an account's order stands.
//   finishOrder()   the build of a paid order has ended on the server: the website is saved and held for 24 hours (lib/site-ready.ts)
//                   without the phone — and a Premium order's design is started, so Premium is what goes live.
import { randomUUID } from "node:crypto";
import { restAsService } from "@/lib/poster-server";
import { myCard } from "@/lib/site-server";
import { claim, currentJob, type CardJob } from "@/lib/card-jobs";
import { grantAdvanced, readAdvancedMeta } from "@/lib/advanced-access";
import { isDemoAccount, readyIn, sitePending } from "@/lib/site-ready-server";
import { mergeBuiltCard } from "@/lib/card-facts";
import { applyLook, openingLook, threeLooks } from "@/lib/site-looks";
import { safeColor } from "@/lib/looks";
import { isShubhoraSellerCard } from "@/lib/shubhora-page";
import { SITE_PKG, isSitePkg, pkgNote, pkgOfNote, type OrderState, type SitePkg } from "@/lib/site-order";
import type { Card } from "@/lib/types";
import type { PaymentRequest } from "@/lib/payments";

type Prof = { package?: string | null; package_until?: string | null; plan?: string | null; plan_expires_at?: string | null; username?: string | null };
const profileOf = async (uid: string): Promise<Prof | null> =>
  (await restAsService<Prof[]>(`profiles?id=eq.${uid}&select=package,package_until,plan,plan_expires_at,username&limit=1`)).data?.[0] ?? null;
const runs = (iso: string | null | undefined) => !!iso && Date.parse(iso) > Date.now();

/** The package for one year from today — or from the end of the year already running. One month of the Growth features (posters,
 *  WhatsApp AI, CRM) comes with it when the account has no running plan, the same as a package set by Super Admin. */
export async function applyPackage(uid: string, pkg: SitePkg, paymentId: string): Promise<boolean> {
  const cur = await profileOf(uid);
  const from = cur && isSitePkg(cur.package) && runs(cur.package_until) ? new Date(cur.package_until!) : new Date();
  const until = new Date(from); until.setMonth(until.getMonth() + 12);
  // A Standard payment never takes a running Premium away.
  const keep = cur?.package === "site_premium" && runs(cur.package_until) ? "site_premium" : pkg;
  const w = await restAsService(`profiles?id=eq.${uid}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ package: keep, package_until: until.toISOString(), package_note: `Paid online · ${paymentId}` }) });
  if (!w.ok) { console.log("[site-order] package not set", uid, w.status, w.text.slice(0, 200)); return false; }
  const planRuns = !!cur?.plan && cur.plan !== "free" && runs(cur.plan_expires_at);
  if (!planRuns) {
    const free = new Date(); free.setMonth(free.getMonth() + 1);
    await restAsService(`profiles?id=eq.${uid}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ plan: "pro", plan_expires_at: free.toISOString(), plan_source: "admin" }) });
  }
  if (pkg === "site_premium") await grantAdvanced(uid, paymentId).catch(() => false);
  return true;
}

/** The account's open (unpaid) package request, newest first, and its last paid one. */
async function packageRequests(uid: string): Promise<{ open: PaymentRequest | null; paid: PaymentRequest | null }> {
  const rows = (await restAsService<PaymentRequest[]>(`payment_requests?owner_id=eq.${uid}&kind=eq.custom&note=like.${encodeURIComponent("[pkg:")}*&order=created_at.desc&limit=20&select=*`)).data;
  const all = (Array.isArray(rows) ? rows : []).filter((r) => pkgOfNote(r.note));
  return { open: all.find((r) => r.status === "open") ?? null, paid: all.find((r) => r.status === "paid") ?? null };
}
export async function openPackageRequest(uid: string, pkg: SitePkg): Promise<PaymentRequest | null> {
  const rows = (await restAsService<PaymentRequest[]>(`payment_requests?owner_id=eq.${uid}&kind=eq.custom&status=eq.open&amount_paise=eq.${SITE_PKG[pkg].amount}&order=created_at.desc&limit=10&select=*`)).data;
  return (Array.isArray(rows) ? rows : []).find((r) => r.note.trim().startsWith(pkgNote(pkg)) && r.created_role === "self") ?? null;
}

export async function orderState(uid: string): Promise<OrderState> {
  const [prof, row, job, reqs] = await Promise.all([profileOf(uid), myCard(uid).catch(() => null), currentJob(uid).catch(() => null), packageRequests(uid).catch(() => ({ open: null, paid: null }))]);
  const pkg = prof?.package === "site_standard" || prof?.package === "site_premium" || prof?.package === "custom" ? prof.package : "";
  const paid = !!pkg && runs(prof?.package_until);
  const site = row?.data?.site as (Card["site"] & { readyAt?: string }) | undefined;
  // A Shubhora seller card (a partner's card that sells Shubhora) is never rebuilt by an order: it counts as made.
  const siteOn = !!site?.enabled || (!!row && isShubhoraSellerCard(row.data));
  const pending = siteOn ? sitePending(site) : null;
  const wanted = reqs.open ? pkgOfNote(reqs.open.note) : null;
  const stage: OrderState["stage"] = !paid ? (siteOn ? "live" : wanted ? "pay" : "none")
    : !siteOn ? (job?.state === "running" ? "building" : "queued")
    : pending ? "waiting" : "live";
  const p = reqs.paid;
  return {
    stage, pkg: paid ? pkg : "", wanted, until: paid ? prof?.package_until ?? null : null, readyAt: pending ? pending.toISOString() : null, hasCard: !!row,
    receipt: paid && p && p.payment_id && p.paid_at ? { amount: p.amount_paise, paymentId: p.payment_id, paidAt: p.paid_at, label: SITE_PKG[pkgOfNote(p.note)!].label } : null,
  };
}

/* ---------------- the build has ended ---------------- */

const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
const linkFree = async (u: string) => (await restAsService<boolean>("rpc/username_available", { method: "POST", body: JSON.stringify({ p_username: u, p_card_id: null }) })).data === true;
/** The card's link: the person's name, else the business, else the account's username (the same order as the app), else a random one. */
async function pickLink(names: string[], account: string): Promise<string> {
  for (const n of names) {
    const base = slug(n);
    if (base.length < 3) continue;
    for (const c of [base, ...Array.from({ length: 6 }, (_, i) => `${base}${i + 2}`)]) if (await linkFree(c).catch(() => false)) return c;
  }
  const mine = account.toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 32);
  if (mine.length >= 3 && await linkFree(mine).catch(() => false)) return mine;
  return `card-${Math.random().toString(36).slice(2, 8)}`;
}

type Built = { card?: Parameters<typeof mergeBuiltCard>[1]; looks?: Parameters<typeof threeLooks>[2] };

/** Called when a paid order's build job ends (api/card/build, `order: true`). `advanced`: starts the Premium design with the owner's
 *  own session (the route that makes it is theirs). A failed build is left for the thank-you page, which starts it again. */
export async function finishOrder(job: CardJob, advanced: () => Promise<void>): Promise<void> {
  const uid = job.uid;
  const built = (job.result ?? {}) as Built;
  if (job.state !== "done" || !built.card) { console.log("[site-order] build failed", uid, job.id, job.status); return; }
  try {
    const [prof, existing, demo] = await Promise.all([profileOf(uid), myCard(uid), isDemoAccount(uid).catch(() => false)]);
    // Only a paid package is finished here: `order: true` sent by an account without one changes nothing (its build waits for the app as usual).
    if (!prof || !(prof.package === "site_standard" || prof.package === "site_premium" || prof.package === "custom") || !runs(prof.package_until)) return;
    if (existing && isShubhoraSellerCard(existing.data)) return;
    const username = existing?.username || await pickLink([built.card.name || built.card.company || "", built.card.company || ""], prof?.username ?? "");
    let out = mergeBuiltCard((existing?.data as Card | undefined) ?? null, built.card, { id: existing?.id ?? randomUUID(), username });
    // The look a first build opens on (the same choice the app makes on its preview).
    if (out.site && built.card.site) {
      const look = openingLook(threeLooks(built.card as unknown as Card, built.card.site.style, built.looks?.length ? built.looks : undefined), built.card.seo?.categoryKey);
      if (look) out = applyLook(out, look);
    }
    // The package is paid: the website is on, and held 24 hours before visitors see it (the card shows meanwhile).
    const wasOn = !!(existing?.data as Card | undefined)?.site?.enabled;
    if (out.site) out = { ...out, site: { ...out.site, enabled: true, ...(!wasOn && !demo ? { readyAt: readyIn() } : {}), ...(demo ? { noindex: true } : {}) } };
    out = { ...out, themeColor: safeColor(out.themeColor), avatarColor: safeColor(out.avatarColor, safeColor(out.themeColor)) };
    const row = {
      owner_id: uid, username, name: out.name, job_title: out.jobTitle, company: out.company, tagline: out.tagline, about: out.about,
      theme_color: out.themeColor, avatar_url: out.avatarUrl ?? null, cover_url: out.coverUrl ?? null, active: out.active, data: out,
    };
    const w = existing
      ? await restAsService(`cards?id=eq.${existing.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(row) })
      : await restAsService("cards", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ id: out.id, ...row }) });
    if (!w.ok) { console.log("[site-order] website not saved", uid, w.status, w.text.slice(0, 200)); return; }
    await claim(uid, job.id);
    console.log("[site-order] website saved", uid, username, prof?.package);
    if (prof?.package === "site_premium") {
      // A package set by hand (Super Admin) has no payment behind the Premium website yet: opened here, once.
      if (!(await readAdvancedMeta(uid))?.paid) await grantAdvanced(uid, "package").catch(() => false);
      await advanced().catch((e) => console.log("[site-order] premium design not started", uid, e instanceof Error ? e.message : e));
    }
  } catch (e) {
    console.log("[site-order] finish failed", uid, e instanceof Error ? e.stack ?? e.message : e);
  }
}
