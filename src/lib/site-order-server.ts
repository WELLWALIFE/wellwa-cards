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
import { ORDER_HOURS, SITE_PKG, isCustomNote, isSitePkg, pkgNote, pkgOfNote, type OrderState, type SitePkg } from "@/lib/site-order";
import { tellSiteLive } from "@/lib/site-live-server";
import type { Card } from "@/lib/types";
import type { PaymentRequest } from "@/lib/payments";

type Prof = { package?: string | null; package_until?: string | null; plan?: string | null; plan_expires_at?: string | null; username?: string | null };
const profileOf = async (uid: string): Promise<Prof | null> =>
  (await restAsService<Prof[]>(`profiles?id=eq.${uid}&select=package,package_until,plan,plan_expires_at,username&limit=1`)).data?.[0] ?? null;
const runs = (iso: string | null | undefined) => !!iso && Date.parse(iso) > Date.now();

/** The package for one year from today — or from the end of the year already running. One month of the Growth features (posters,
 *  WhatsApp AI, CRM) comes with it when the account has no running plan, the same as a package set by Super Admin. */
export async function applyPackage(uid: string, pkg: SitePkg, paymentId: string, custom = false): Promise<boolean> {
  const cur = await profileOf(uid);
  const from = cur && isSitePkg(cur.package) && runs(cur.package_until) ? new Date(cur.package_until!) : new Date();
  const until = new Date(from); until.setMonth(until.getMonth() + 12);
  // A Standard payment never takes a running Premium away.
  const keep = cur?.package === "site_premium" && runs(cur.package_until) ? "site_premium" : pkg;
  const w = await restAsService(`profiles?id=eq.${uid}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ package: keep, package_until: until.toISOString(), package_note: `Paid online · ${paymentId}${custom ? " · Premium + Customise: customising to be quoted as per the work" : ""}` }) });
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
/** The account's open orders (its own requests at the list price), newest first. */
export async function openPackageRequests(uid: string): Promise<PaymentRequest[]> {
  const rows = (await restAsService<PaymentRequest[]>(`payment_requests?owner_id=eq.${uid}&kind=eq.custom&status=eq.open&order=created_at.desc&limit=20&select=*`)).data;
  return (Array.isArray(rows) ? rows : []).filter((r) => { const k = pkgOfNote(r.note); return !!k && r.created_role === "self" && r.amount_paise === SITE_PKG[k].amount; });
}
export const sameOrder = (r: PaymentRequest, pkg: SitePkg, custom: boolean) => r.note.trim().startsWith(pkgNote(pkg)) && isCustomNote(r.note) === custom;

export async function orderState(uid: string): Promise<OrderState> {
  const [prof, row, job, reqs] = await Promise.all([profileOf(uid), myCard(uid).catch(() => null), currentJob(uid).catch(() => null), packageRequests(uid).catch(() => ({ open: null, paid: null }))]);
  const pkg = prof?.package === "site_standard" || prof?.package === "site_premium" || prof?.package === "custom" ? prof.package : "";
  const paid = !!pkg && runs(prof?.package_until);
  const site = row?.data?.site as (Card["site"] & { readyAt?: string }) | undefined;
  // A Shubhora seller card (a partner's card that sells Shubhora) is never rebuilt by an order: it counts as made.
  const siteOn = !!site?.enabled || (!!row && isShubhoraSellerCard(row.data));
  const pending = siteOn ? sitePending(site) : null;
  // Paused by Super Admin (cards.site_paused, migration 0085; a database without the column answers "not paused").
  const paused = !!row && siteOn && (await restAsService<{ site_paused?: boolean }[]>(`cards?id=eq.${row.id}&select=site_paused`).catch(() => null))?.data?.[0]?.site_paused === true;
  const wanted = reqs.open ? pkgOfNote(reqs.open.note) : null;
  // The order whose clock counts: the one waiting for its payment, else the one that was paid.
  const ord = !paid ? reqs.open : reqs.paid;
  const stage: OrderState["stage"] = !paid ? (siteOn ? "live" : wanted ? "pay" : "none")
    : !siteOn ? (job?.state === "running" ? "building" : "queued")
    : pending || paused ? "waiting" : "live";
  const p = reqs.paid;
  return {
    premiumPending: paid && (pkg === "site_premium" || pkg === "custom") && !!site?.enabled && !(site as { advanced?: unknown }).advanced && !(!!row && isShubhoraSellerCard(row.data)),
    chooseDesign: !!site?.enabled && (site as { ordered?: boolean }).ordered === true && !(site as { designChosenAt?: string }).designChosenAt,
    stage, pkg: paid ? pkg : "", wanted, pay: !paid && reqs.open && wanted ? { code: reqs.open.code, amount: reqs.open.amount_paise } : null,
    custom: !!ord && isCustomNote(ord.note), orderedAt: ord?.created_at ?? null, until: paid ? prof?.package_until ?? null : null, readyAt: pending && !paused ? pending.toISOString() : null, paused, hasCard: !!row,
    receipt: paid && p && p.payment_id && p.paid_at ? { amount: p.amount_paise, paymentId: p.payment_id, paidAt: p.paid_at, label: SITE_PKG[pkgOfNote(p.note)!].label } : null,
  };
}

/* ---------------- the build has ended ---------------- */

const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
// Asked of the table itself: the username_available() function is granted to the app's users only, not to the service role — through it
// every name came back "taken" and a paid website got a random card-xxxxxx link (live check, 14 Nov 2026). The same kept words as that function.
const KEPT = new Set(["admin", "api", "app", "auth", "billing", "c", "card", "cards", "dashboard", "editor", "help", "home", "leads", "login", "logout", "me", "neural", "neuraledge", "new", "preview", "pricing", "privacy", "settings", "signup", "sitemap", "static", "support", "templates", "terms", "tools", "user", "users", "www"]);
const linkFree = async (u: string) => {
  if (KEPT.has(u)) return false;
  const r = await restAsService<{ id: string }[]>(`cards?username=ilike.${encodeURIComponent(u.replace(/[%_*\\]/g, (c) => `\\${c}`))}&select=id&limit=1`);
  return r.ok && Array.isArray(r.data) && r.data.length === 0;
};
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
    // Delivery is 24 hours from the ORDER (owner, 14 Nov 2026): paid inside them, the website is held until they end; paid after them,
    // it is live the moment it is made. A package set by hand has no order: 24 hours from now, as before.
    const wasOn = !!(existing?.data as Card | undefined)?.site?.enabled;
    const ordered = (await packageRequests(uid).catch(() => ({ open: null, paid: null }))).paid?.created_at;
    const due = ordered ? Date.parse(ordered) + ORDER_HOURS * 3600_000 : NaN;
    const hold = Number.isFinite(due) ? (due > Date.now() + 5 * 60_000 ? new Date(due).toISOString() : "") : readyIn();
    // `ordered`: made by an order — the app then opens on "select any one from 6" until a design is chosen (site.designChosenAt).
    if (out.site) out = { ...out, site: { ...out.site, enabled: true, ...({ ordered: true } as object), ...(!wasOn && !demo && hold ? { readyAt: hold } : {}), ...(demo ? { noindex: true } : {}) } };
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
    console.log("[site-order] website saved", uid, username, prof?.package, hold ? `held till ${hold}` : "live now");
    // Live at once (paid after the 24 hours): the owner is told now — the hourly job only tells about websites that were held.
    if (!hold && !wasOn && !demo) await tellSiteLive({ id: existing?.id ?? out.id, owner_id: uid, username, data: out as { customDomain?: string } }, false).catch(() => false);
    if (prof?.package === "site_premium" || prof?.package === "custom") {
      // A package set by hand (Super Admin) has no payment behind the Premium website yet: opened here, once.
      if (!(await readAdvancedMeta(uid))?.paid) await grantAdvanced(uid, "package").catch(() => false);
      await advanced().catch((e) => console.log("[site-order] premium design not started", uid, e instanceof Error ? e.message : e));
    }
  } catch (e) {
    console.log("[site-order] finish failed", uid, e instanceof Error ? e.stack ?? e.message : e);
  }
}
