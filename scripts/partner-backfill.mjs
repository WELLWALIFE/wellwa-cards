// One-time (safe to re-run): give every existing Shubhora account its partner ID in the partner panel.
// Every account is a partner account from 22 Sep 2026; accounts made before that day never went through the
// sign-up that registers one. Run on the VPS from the app folder:
//     cd /opt/neuraledge/app && node scripts/partner-backfill.mjs            (dry run: lists what it would do)
//     cd /opt/neuraledge/app && node scripts/partner-backfill.mjs --apply    (registers them)
// Sponsor: the account's referred_by when known (accounts introduced through a card / link), else the company's
// top ID. Placement is the panel's usual rule: the sponsor's side with fewer IDs. Accounts without a username are
// skipped (run sql/2026-09-23-one-login.sql first — it gives everyone one).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const APP = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const env = { ...process.env };
try {
  for (const l of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
} catch { /* env from the process */ }

const SUPA = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY, SECRET = env.LINK_SECRET;
const LINK_IN = env.PARTNER_LINK_IN_URL || "http://127.0.0.1:3002/partners/api/link-in";
const APPLY = process.argv.includes("--apply");
if (!SUPA || !KEY || !SECRET) { console.error("need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LINK_SECRET in .env.local"); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function rest(q) { const r = await fetch(`${SUPA}/rest/v1/${q}`, { headers: H }); return r.ok ? r.json() : null; }
async function panel(action, body) {
  const raw = JSON.stringify({ action, ...body, ts: Date.now() });
  const sig = crypto.createHmac("sha256", SECRET).update(raw).digest("hex");
  const r = await fetch(LINK_IN, { method: "POST", headers: { "content-type": "application/json", "x-link-signature": sig }, body: raw, signal: AbortSignal.timeout(15000) });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
}
async function authUser(id) { const r = await fetch(`${SUPA}/auth/v1/admin/users/${id}`, { headers: H }); return r.ok ? r.json() : null; }

async function main() {
  const profiles = await rest("profiles?select=id,username,referred_by&order=created_at.asc&limit=5000");
  if (!Array.isArray(profiles)) { console.error("could not read profiles"); process.exit(1); }
  let made = 0, had = 0, skipped = 0, failed = 0;
  for (const p of profiles) {
    if (!p.username) { skipped++; continue; }
    const s = await panel("summary", { suiteUserId: p.id });
    if (s.ok) { had++; continue; }
    if (s.status !== 404) { failed++; console.log("  ?", p.username, s.status, s.data.error); continue; }
    if (!APPLY) { made++; console.log("  would register", p.username, p.referred_by ? "under introducer" : "under the company"); continue; }
    const u = await authUser(p.id);
    const md = u?.user_metadata ?? {};
    const email = String(u?.email ?? "");
    const mobile = String(md.phone ?? u?.phone ?? (/@phone\./.test(email) ? email.split("@")[0] : "")).replace(/\D/g, "").slice(-10);
    let name = String(md.display_name ?? md.full_name ?? md.name ?? "").trim();
    if (!name) name = String(((await rest(`poster_profiles?user_id=eq.${p.id}&is_default=eq.true&select=name&limit=1`)) ?? [])[0]?.name ?? "").trim();
    const r = await panel("register", {
      suiteUserId: p.id, username: p.username, name: name || "Shubhora member",
      mobile: mobile.length === 10 ? mobile : undefined, email: /@phone\./.test(email) ? undefined : email || undefined,
      introducerSuiteUserId: p.referred_by || undefined,
    });
    if (!r.ok) { failed++; console.log("  x", p.username, r.status, r.data.error); continue; }
    made++;
    console.log("  +", p.username, "→", r.data.code, r.data.leg ? `(${r.data.leg === "L" ? "left" : "right"})` : "");
    if (r.data.code && md.associate_id !== r.data.code) {
      await fetch(`${SUPA}/auth/v1/admin/users/${p.id}`, { method: "PUT", headers: H, body: JSON.stringify({ user_metadata: { ...md, associate_id: r.data.code } }) }).catch(() => undefined);
    }
  }
  console.log(`\n${APPLY ? "registered" : "would register"}: ${made} · already had an ID: ${had} · no username (skipped): ${skipped} · failed: ${failed} · total accounts: ${profiles.length}`);
  if (!APPLY && made) console.log("run again with --apply to do it");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
