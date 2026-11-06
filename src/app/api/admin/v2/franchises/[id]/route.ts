// One franchise (Admin v2): its users, account (ledger), payouts and logins.
//   GET → { franchise, balance, users, ledger, payouts, logins, settings, signupLink }
//   PATCH { …fields } → { franchise }                                     ("franchises.manage")
//   POST { op: "assign_user", user_id } | { op: "remove_user", user_id }   ("franchises.manage")
//        { op: "payout_request", amount, note? }                           (the franchise itself, or "franchises.payouts")
//        { op: "payout_decide", payout_id, status: approved|rejected|paid, utr?, note? }   ("franchises.payouts")
//        { op: "adjustment", amount (+/−), note }                            ("franchises.payouts")
//   A franchise login also sees and manages its own SUB-FRANCHISES here (migration 0088): GET their page; PATCH name / contact / area /
//   percents (≤ its own) / may-activate (only if it may) / status (ended → their users move up to the parent); POST { op: "reset_login",
//   admin_id, password } → sets the password the parent typed on the sub's login (no generated passwords — owner, 1 Nov 2026). GET of a top-level franchise lists its sub-franchises (subs).
//   DELETE → the franchise, its ledger and payouts are removed for good; its users stay (franchise_id → null); its logins are switched off
//            ("franchises.manage", sensitive; owner, 1 Nov 2026 "delete ka option, confirmation ke saath")
import { requireAdmin, audit, getSettings, userInScope, createOrResetAuthUser, type Identity } from "@/lib/admin-v2";
import { svc, svcCount } from "@/lib/service";
import { franchiseBalance, franchisePatch, notifyFranchise, FR_COLS, type FranchiseRow } from "@/lib/franchise-server";
import { SITE_URL } from "@/lib/site-url";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);
const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const paise = (v: unknown) => { const n = Math.round(Number(String(v ?? "").replace(/[^\d.-]/g, "")) * 100); return Number.isFinite(n) ? n : 0; };

async function load(id: string): Promise<FranchiseRow | null> {
  return isUuid(id) ? list(await svc<FranchiseRow[]>(`franchises?id=eq.${id}&select=${FR_COLS}&limit=1`))[0] ?? null : null;
}
/** Track record of a franchise: its login history (ok + failed tries) and every action by its logins or on it (audit log).
 *  IP / device only for Shubhora staff. */
async function activity(me: Identity, fr: FranchiseRow) {
  const staff = !me.franchise;
  const ids = list(await svc<{ id: string; name: string; email: string }[]>(`admin_users?franchise_id=eq.${fr.id}&select=id,name,email`));
  const who = new Map(ids.map((a) => [a.id, a.name || a.email]));
  const or = ids.length ? `or=(actor_id.in.(${ids.map((a) => a.id).join(",")}),target_id.eq.${fr.id})` : `target_id=eq.${fr.id}`;
  const [ev, au] = await Promise.all([
    svc<{ id: number; at: string; admin_id: string | null; login: string; ok: boolean; reason: string; ip: string; ua: string }[]>(`admin_login_events?franchise_id=eq.${fr.id}&select=id,at,admin_id,login,ok,reason,ip,ua&order=at.desc&limit=150`),
    svc<{ id: number; at: string; actor_id: string | null; actor_email: string; action: string; target_type: string; target_label: string; note: string; ip: string }[]>(`audit_log?${or}&action=neq.admin.login&select=id,at,actor_id,actor_email,action,target_type,target_label,note,ip&order=at.desc&limit=200`),
  ]);
  const short = (e: string) => (/^p91(\d{10})@phone\./.test(e) ? e.slice(3, 13) : e);
  const device = (ua: string) => `${/android/i.test(ua) ? "Android" : /iphone|ipad/i.test(ua) ? "iPhone" : /mac os/i.test(ua) ? "Mac" : /windows/i.test(ua) ? "Windows" : ua ? "Other" : ""}${/edg\//i.test(ua) ? " · Edge" : /chrome\//i.test(ua) ? " · Chrome" : /safari\//i.test(ua) ? " · Safari" : /firefox\//i.test(ua) ? " · Firefox" : ""}`;
  return Response.json({
    logins: list(ev).map((e) => ({ id: e.id, at: e.at, who: (e.admin_id && who.get(e.admin_id)) || short(e.login), ok: e.ok, reason: e.reason, device: device(e.ua), ip: staff ? e.ip : "" })),
    actions: list(au).map((a) => ({ id: a.id, at: a.at, by: a.actor_id && who.has(a.actor_id) ? who.get(a.actor_id)! : staff ? short(a.actor_email) || "Shubhora" : "Shubhora", mine: !!(a.actor_id && who.has(a.actor_id)), action: a.action, target: a.target_label, note: a.note, ip: staff ? a.ip : "" })),
    missing: !Array.isArray(ev.data) ? "Run migration 0088 in Supabase for the login history." : "",
  });
}
/** A franchise login looking at one of its own sub-franchises (not itself). */
const isMySub = (me: Identity, fr: { id: string; parent_id?: string | null } | null) => !!me.franchise && !!fr && fr.id !== me.franchise.id && fr.parent_id === me.franchise.id;

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin(request, "franchises.view"); if (!g.ok) return g.res;
  const { me } = g;
  const { id } = await ctx.params;
  const fr = await load(id); if (!fr) return Response.json({ error: "Franchise not found." }, { status: 404 });
  if (me.franchise && me.franchise.id !== id && !isMySub(me, fr)) return Response.json({ error: "Not your franchise." }, { status: 403 });
  if (new URL(request.url).searchParams.get("activity") === "1") return activity(me, fr);
  const money = me.rights.includes("billing.view") || me.rights.includes("franchises.payouts") || !!me.franchise;
  const [balance, users, ledger, payouts, logins, s, credits] = await Promise.all([
    franchiseBalance(fr.id),
    svc<{ id: string; full_name: string | null; username: string | null; plan: string; saas_tier: string | null; saas_expires_at: string | null; created_at: string; franchise_joined_at: string | null }[]>(`profiles?franchise_id=eq.${fr.id}&select=id,full_name,username,plan,saas_tier,saas_expires_at,created_at,franchise_joined_at&order=created_at.desc&limit=500`),
    money ? svc<Record<string, unknown>[]>(`franchise_ledger?franchise_id=eq.${fr.id}&select=id,user_id,kind,amount_paise,base_paise,pct,payment_ref,note,payout_id,at&order=at.desc&limit=3000`) : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    svc<Record<string, unknown>[]>(`payouts?franchise_id=eq.${fr.id}&select=id,amount_paise,status,utr,note,requested_at,decided_at,paid_at&order=requested_at.desc&limit=100`),
    svc<{ id: string; email: string; name: string; active: boolean; last_login_at: string | null }[]>(`admin_users?franchise_id=eq.${fr.id}&select=id,email,name,active,last_login_at`),
    getSettings(),
    // Credits this franchise gave its users (api/admin/credits writes ref "by:<admin id>;fr:<franchise id>").
    svc<{ id: string; user_id: string; delta: number; ref: string | null; created_at: string }[]>(`credit_ledger?reason=eq.franchise-grant&ref=like.*fr:${fr.id}*&select=id,user_id,delta,ref,created_at&order=created_at.desc&limit=300`),
  ]);
  const names = new Map(list(users).map((u) => [u.id, u.full_name || u.username || "User"]));
  // A top-level franchise: its sub-franchises with their numbers; a sub-franchise: who its parent is.
  let subs: Record<string, unknown>[] = [];
  let parent: { id: string; code: string; name: string } | null = null;
  if (!fr.parent_id) {
    const rows = list(await svc<FranchiseRow[]>(`franchises?parent_id=eq.${fr.id}&select=${FR_COLS}&order=created_at`));
    if (rows.length) {
      const ids = rows.map((r) => r.id).join(",");
      const [u, led, lo] = await Promise.all([
        svc<{ franchise_id: string }[]>(`profiles?franchise_id=in.(${ids})&select=franchise_id&limit=20000`),
        svc<{ franchise_id: string; kind: string; amount_paise: number }[]>(`franchise_ledger?franchise_id=in.(${ids})&select=franchise_id,kind,amount_paise&limit=50000`),
        svc<{ id: string; franchise_id: string; email: string; name: string; active: boolean; last_login_at: string | null }[]>(`admin_users?franchise_id=in.(${ids})&select=id,franchise_id,email,name,active,last_login_at`),
      ]);
      const over = list(await svc<{ amount_paise: number; note: string }[]>(`franchise_ledger?franchise_id=eq.${fr.id}&kind=eq.earning&note=like.Override*&select=amount_paise,note&limit=20000`));
      subs = rows.map((r) => {
        const l = list(led).filter((x) => x.franchise_id === r.id);
        return {
          id: r.id, code: r.code, name: r.name, phone: r.phone, area: r.area, city: r.city, status: r.status, can_activate: r.can_activate,
          commission_first_pct: r.commission_first_pct, commission_renewal_pct: r.commission_renewal_pct, created_at: r.created_at,
          users: list(u).filter((x) => x.franchise_id === r.id).length,
          earned: l.filter((x) => x.kind === "earning").reduce((a, x) => a + Number(x.amount_paise), 0),
          balance: l.reduce((a, x) => a + Number(x.amount_paise), 0),
          override: over.filter((x) => x.note.startsWith(`Override from ${r.code} `)).reduce((a, x) => a + Number(x.amount_paise), 0),
          logins: list(lo).filter((x) => x.franchise_id === r.id).map((x) => ({ id: x.id, email: /^p91(\d{10})@phone\./.test(x.email) ? x.email.slice(3, 13) : x.email, name: x.name, active: x.active, last_login_at: x.last_login_at })),
        };
      });
    }
  } else {
    const pr = await load(fr.parent_id);
    parent = pr ? { id: pr.id, code: pr.code, name: pr.name } : null;
  }
  const byIds = [...new Set(list(credits).map((c) => (c.ref ?? "").match(/^by:([^;]+)/)?.[1] ?? "").filter(Boolean))];
  const byNames = new Map(byIds.length ? list(await svc<{ id: string; name: string; email: string }[]>(`admin_users?id=in.(${byIds.join(",")})&select=id,name,email`)).map((a) => [a.id, a.name || a.email]) : []);
  return Response.json({
    franchise: me.franchise ? { ...fr, bank: isMySub(me, fr) ? {} : fr.bank, kyc: undefined } : fr, balance, users: list(users),
    ledger: list(ledger).map((l) => ({ ...l, user: l.user_id ? names.get(String(l.user_id)) ?? "" : "" })), payouts: list(payouts), logins: list(logins),
    settings: { payoutMin: s.payout_min_paise }, signupLink: `${SITE_URL}/start?f=${fr.code}`,
    subs, parent,
    credits: list(credits).map((c) => ({ id: c.id, user: names.get(c.user_id) ?? "User", delta: c.delta, by: byNames.get((c.ref ?? "").match(/^by:([^;]+)/)?.[1] ?? "") ?? "", at: c.created_at })),
  });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const { id } = await ctx.params;
  // A franchise login may change its own bank details and contact (and nothing else); everything else needs "franchises.manage".
  const ownOnly = Object.keys(b).every((k) => ["bank", "email", "phone", "pincode", "pan", "gstin"].includes(k));
  // What a parent may change on its sub-franchise (owner, 6 Nov 2026) — not its bank, KYC or parent.
  const subFields = ["name", "company", "phone", "email", "area", "city", "state", "pincode", "commission_first_pct", "commission_renewal_pct", "can_activate", "status", "notes", "target_paise"];
  const g = await requireAdmin(request, ["franchises.manage", "franchises.view"], { sensitive: true }); if (!g.ok) return g.res;
  const { me } = g;
  const was = await load(id); if (!was) return Response.json({ error: "Franchise not found." }, { status: 404 });
  const asParent = isMySub(me, was);
  if (me.franchise ? (me.franchise.id === id ? !ownOnly : !asParent || !Object.keys(b).every((k) => subFields.includes(k))) : !me.rights.includes("franchises.manage")) return Response.json({ error: "You do not have the right to change this." }, { status: 403 });
  const s = await getSettings();
  const p = franchisePatch(b, { first: s.commission_first_pct, renewal: s.commission_renewal_pct });
  // A sub-franchise never earns more than its parent, and may activate plans only if the parent may.
  const parentRow = was.parent_id ? await load(was.parent_id) : null;
  if (parentRow) {
    if ("commission_first_pct" in p && Number(p.commission_first_pct) > Number(parentRow.commission_first_pct)) return Response.json({ error: `First-payment commission can be at most ${parentRow.commission_first_pct}% (${parentRow.code}'s).` }, { status: 400 });
    if ("commission_renewal_pct" in p && Number(p.commission_renewal_pct) > Number(parentRow.commission_renewal_pct)) return Response.json({ error: `Renewal commission can be at most ${parentRow.commission_renewal_pct}% (${parentRow.code}'s).` }, { status: 400 });
    if (p.can_activate === true && !parentRow.can_activate) return Response.json({ error: `${parentRow.code} itself may not activate plans, so its sub-franchise cannot either.` }, { status: 400 });
  }
  if ("name" in p && !p.name) return Response.json({ error: "The name cannot be empty." }, { status: 400 });
  if (!Object.keys(p).length) return Response.json({ franchise: was });
  const r = await svc<FranchiseRow[]>(`franchises?id=eq.${was.id}&select=${FR_COLS}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...p, updated_at: new Date().toISOString() }) });
  const fr = list(r)[0]; if (!fr) return Response.json({ error: "Could not save." }, { status: 502 });
  const before: Record<string, unknown> = {}, after: Record<string, unknown> = {};
  for (const k of Object.keys(p)) { before[k] = (was as Record<string, unknown>)[k]; after[k] = (fr as Record<string, unknown>)[k]; }
  await audit(me, "franchise.update", { type: "franchise", id: fr.id, label: `${fr.code} · ${fr.name}`, before, after }, request);
  // A sub-franchise ended: its users move up to the parent (so nobody is left without a franchise), and its logins are switched off.
  if (p.status === "ended" && was.status !== "ended" && fr.parent_id) {
    const moved = list(await svc<{ id: string }[]>(`profiles?franchise_id=eq.${fr.id}&select=id`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ franchise_id: fr.parent_id }) })).length;
    await svc(`admin_users?franchise_id=eq.${fr.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ active: false, updated_at: new Date().toISOString() }) });
    await audit(me, "franchise.end_sub", { type: "franchise", id: fr.id, label: `${fr.code} · ${fr.name}`, note: `${moved} users moved to the parent; logins switched off` }, request);
  }
  // A franchise paused / ended also stops its sub-franchises' "may activate" (they can never do more than the parent).
  if (p.can_activate === false && !fr.parent_id) await svc(`franchises?parent_id=eq.${fr.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ can_activate: false }) });
  return Response.json({ franchise: fr });
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin(request, ["franchises.manage", "franchises.payouts", "franchises.view"], { sensitive: true }); if (!g.ok) return g.res;
  const { me } = g;
  const { id } = await ctx.params;
  const fr = await load(id); if (!fr) return Response.json({ error: "Franchise not found." }, { status: 404 });
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const asParent = isMySub(me, fr);
  if (me.franchise && me.franchise.id !== id && !(asParent && b.op === "reset_login")) return Response.json({ error: "Not your franchise." }, { status: 403 });
  const label = `${fr.code} · ${fr.name}`;
  const deny = (what: string) => Response.json({ error: `You do not have the right to ${what}.` }, { status: 403 });

  switch (b.op) {
    case "assign_user":
    case "remove_user": {
      if (!me.rights.includes("franchises.manage")) return deny("assign users");
      if (!isUuid(b.user_id)) return Response.json({ error: "Bad user." }, { status: 400 });
      if (!(await userInScope(me, b.user_id))) return Response.json({ error: "That user is outside your scope." }, { status: 403 });
      const was = list(await svc<{ franchise_id: string | null; full_name: string | null }[]>(`profiles?id=eq.${b.user_id}&select=franchise_id,full_name&limit=1`))[0];
      if (!was) return Response.json({ error: "User not found." }, { status: 404 });
      const assign = b.op === "assign_user";
      await svc(`profiles?id=eq.${b.user_id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(assign ? { franchise_id: fr.id, franchise_joined_at: new Date().toISOString() } : { franchise_id: null }) });
      await audit(me, assign ? "franchise.assign_user" : "franchise.remove_user", { type: "user", id: b.user_id, label: was.full_name ?? "", before: { franchise_id: was.franchise_id }, after: { franchise_id: assign ? fr.id : null }, note: label }, request);
      return Response.json({ ok: true });
    }
    case "payout_request": {
      if (!(me.franchise?.id === fr.id || me.rights.includes("franchises.payouts"))) return deny("ask for a payout");
      const amount = paise(b.amount);
      const s = await getSettings();
      const bal = await franchiseBalance(fr.id);
      if (amount <= 0) return Response.json({ error: "Write the amount." }, { status: 400 });
      if (amount < s.payout_min_paise) return Response.json({ error: `The minimum payout is ₹${Math.round(s.payout_min_paise / 100).toLocaleString("en-IN")}.` }, { status: 400 });
      if (amount > bal.balance - bal.pending) return Response.json({ error: `Only ₹${Math.round((bal.balance - bal.pending) / 100).toLocaleString("en-IN")} is available (earned − paid − already requested).` }, { status: 400 });
      if (!fr.bank?.account && !fr.bank?.upi) return Response.json({ error: "Add the bank account or UPI first (Profile → Bank)." }, { status: 400 });
      const r = await svc<{ id: string }[]>("payouts?select=id", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ franchise_id: fr.id, amount_paise: amount, note: String(b.note ?? "").slice(0, 300), requested_by: me.id || null }) });
      const po = list(r)[0]; if (!po) return Response.json({ error: "Could not save." }, { status: 502 });
      await audit(me, "payout.request", { type: "payout", id: po.id, label, after: { amount_paise: amount } }, request);
      return Response.json({ ok: true, id: po.id });
    }
    case "payout_decide": {
      if (!me.rights.includes("franchises.payouts")) return deny("decide payouts");
      if (!isUuid(b.payout_id)) return Response.json({ error: "Bad payout." }, { status: 400 });
      const po = list(await svc<{ id: string; amount_paise: number; status: string }[]>(`payouts?id=eq.${b.payout_id}&franchise_id=eq.${fr.id}&select=id,amount_paise,status&limit=1`))[0];
      if (!po) return Response.json({ error: "Payout not found." }, { status: 404 });
      const status = String(b.status);
      const allowed: Record<string, string[]> = { requested: ["approved", "rejected", "paid"], approved: ["paid", "rejected"] };
      if (!(allowed[po.status] ?? []).includes(status)) return Response.json({ error: `A ${po.status} payout cannot become ${status}.` }, { status: 400 });
      const utr = String(b.utr ?? "").trim().slice(0, 40);
      if (status === "paid" && !utr) return Response.json({ error: "Write the UTR / transaction reference of the bank transfer." }, { status: 400 });
      const now = new Date().toISOString();
      await svc(`payouts?id=eq.${po.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status, utr, note: String(b.note ?? "").slice(0, 300), decided_by: me.id || null, decided_at: now, ...(status === "paid" ? { paid_at: now } : {}) }) });
      if (status === "paid") {
        // The ledger line that takes the money out of the balance (once per payout — the unique index on payment_ref guards a double click).
        await svc("franchise_ledger", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ franchise_id: fr.id, kind: "payout", amount_paise: -Number(po.amount_paise), payment_ref: `payout:${po.id}`, note: `Paid · UTR ${utr}`, payout_id: po.id, created_by: me.id || null }) });
        void notifyFranchise(fr.id, { title: `Payout paid: ₹${Math.round(Number(po.amount_paise) / 100).toLocaleString("en-IN")}`, body: `Sent to your bank account · UTR ${utr}.`, ref: `payout:${po.id}` });
      }
      await audit(me, `payout.${status}`, { type: "payout", id: po.id, label, before: { status: po.status }, after: { status, utr, amount_paise: po.amount_paise } }, request);
      return Response.json({ ok: true });
    }
    case "adjustment": {
      if (!me.rights.includes("franchises.payouts")) return deny("adjust the account");
      const amount = paise(b.amount);
      const note = String(b.note ?? "").trim().slice(0, 300);
      if (!amount) return Response.json({ error: "Write the amount (+ to add, − to take back)." }, { status: 400 });
      if (!note) return Response.json({ error: "Write why." }, { status: 400 });
      await svc("franchise_ledger", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ franchise_id: fr.id, kind: "adjustment", amount_paise: amount, note, created_by: me.id || null }) });
      await audit(me, "franchise.adjustment", { type: "franchise", id: fr.id, label, after: { amount_paise: amount, note } }, request);
      return Response.json({ ok: true });
    }
    case "reset_login": {
      // A new password (typed by the parent, agreed on the phone) for one login of this franchise — by its parent or by whoever manages franchises.
      if (!(asParent || me.rights.includes("franchises.manage"))) return deny("reset this login");
      if (!isUuid(b.admin_id)) return Response.json({ error: "Which login?" }, { status: 400 });
      const newPw = typeof b.password === "string" ? b.password : "";
      if (newPw.length < 8) return Response.json({ error: "Choose a new password of at least 8 characters." }, { status: 400 });
      const row = list(await svc<{ id: string; email: string; name: string; phone: string }[]>(`admin_users?id=eq.${b.admin_id}&franchise_id=eq.${fr.id}&select=id,email,name,phone&limit=1`))[0];
      if (!row) return Response.json({ error: "Login not found on this franchise." }, { status: 404 });
      const r = await createOrResetAuthUser(row.email, row.name, row.phone, newPw);
      if ("error" in r) return Response.json({ error: r.error }, { status: 502 });
      await svc(`admin_users?id=eq.${row.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ must_change_password: true, active: true, updated_at: new Date().toISOString() }) });
      await audit(me, "staff.reset_password", { type: "staff", id: row.id, label: `${row.name} <${row.email}>`, note: label }, request);
      return Response.json({ ok: true, login: /^p91(\d{10})@phone\./.test(row.email) ? row.email.slice(3, 13) : row.email });
    }
    case "stats": {
      return Response.json({ users: await svcCount(`profiles?franchise_id=eq.${fr.id}&select=id`) });
    }
    default:
      return Response.json({ error: "Unknown action." }, { status: 400 });
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin(request, "franchises.manage", { sensitive: true }); if (!g.ok) return g.res;
  const { me } = g;
  const { id } = await ctx.params;
  if (me.franchise) return Response.json({ error: "A franchise cannot delete itself." }, { status: 403 });
  const fr = await load(id); if (!fr) return Response.json({ error: "Franchise not found." }, { status: 404 });
  const bal = await franchiseBalance(fr.id);
  const users = await svcCount(`profiles?franchise_id=eq.${fr.id}&select=id`);
  // Its logins lose the panel (switched off, not deleted: the audit trail keeps who they were).
  await svc(`admin_users?franchise_id=eq.${fr.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ active: false, franchise_id: null, updated_at: new Date().toISOString() }) });
  await svc(`franchise_applications?franchise_id=eq.${fr.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ franchise_id: null, note: `Franchise ${fr.code} deleted on ${new Date().toISOString().slice(0, 10)}` }) }).catch(() => undefined);
  // The row: the ledger and payouts go with it (cascade); users and logins are set to null by the database.
  const r = await svc(`franchises?id=eq.${fr.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  if (!r.ok) return Response.json({ error: "Could not delete. Please try again." }, { status: 502 });
  await audit(me, "franchise.delete", { type: "franchise", id: fr.id, label: `${fr.code} · ${fr.name}`, before: { ...fr, users, balance_paise: bal.balance, earned_paise: bal.earned }, note: `users kept: ${users}; balance at deletion ${bal.balance}` }, request);
  return Response.json({ ok: true, users });
}
