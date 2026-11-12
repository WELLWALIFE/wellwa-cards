// Shubhora seller cards made before 31 Oct 2026 still carry the OLD Shubhora pictures: the plan cards with their own words
// (shubhora-plan-free-v3, shubhora-plan-growth-v2 — "Growth", a name no longer sold — and the custom one) and the old
// Growth-plan screenshot as a hero banner. On a phone these are cut at the sides ("REE PLAN", "₹2,999" half gone).
// The template has drawn pictures since 31 Oct (scripts/shubhora-art.mjs → public/art/shubhora/): this puts them on the
// cards that still show the old ones. Only Shubhora's own stock pictures are swapped — a partner's own uploads are never touched.
//
// Run on the VPS:
//   node /opt/neuraledge/app/scripts/seller-art-refresh.mjs --user jai-dev-rajwal          (report only)
//   node /opt/neuraledge/app/scripts/seller-art-refresh.mjs --user jai-dev-rajwal --apply  (backup, then change)
//   node /opt/neuraledge/app/scripts/seller-art-refresh.mjs --all [--apply]                (every card that has an old picture)
//   … --cover    also put the drawn hero on the CARD's cover when it is a wide poster with its own words (the old Shubhora banner a
//                partner uploaded): on the phone card the logo and the photo sit on it and its words are cut. The website banners stay.
//   node /opt/neuraledge/app/scripts/seller-art-refresh.mjs --undo /var/backups/shubhora-cards/seller-art-<time>.json --apply
import fs from "node:fs";
import path from "node:path";

const APP = "/opt/neuraledge/app";
const env = {};
for (const l of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA || !KEY) { console.error("Supabase URL / service key not found in .env.local"); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const APPLY = args.includes("--apply");
const USER = opt("--user");
const ALL = args.includes("--all");
const UNDO = opt("--undo");
const COVER = args.includes("--cover");
const BACKUP_DIR = "/var/backups/shubhora-cards";

async function rest(p, init = {}) {
  const r = await fetch(`${SUPA}/rest/v1/${p}`, { ...init, headers: { ...H, ...(init.headers ?? {}) } });
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

if (UNDO) {
  const saved = JSON.parse(fs.readFileSync(UNDO, "utf8"));
  console.log(`${saved.length} card(s) in ${UNDO}`);
  for (const row of saved) {
    console.log(`  /${row.username}`);
    if (APPLY) await rest(`cards?id=eq.${row.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ data: row.data }) });
  }
  console.log(APPLY ? "Put back." : "Report only — add --apply to put them back.");
  process.exit(0);
}
if (!USER && !ALL) { console.error("Say which card: --user <username>, or --all"); process.exit(1); }

// The old pictures: Shubhora's own stock, wherever it is served from (a relative path or https://shubhora.com/…).
const OLD_PLAN = /\/api\/stock\/(?:demo\/shubhora-plan-(?:free|growth|standard|premium|custom)(?:-v\d+)?|vcard\/plan-(?:free|growth|standard|premium|custom))\.(?:jpe?g|png|webp)(?:\?.*)?$/i;
const OLD_BANNER = /\/art\/brand\/shubhora-banner\.png(?:\?.*)?$/i;
const NEW = { free: "/art/shubhora/plan-free.jpg", standard: "/art/shubhora/plan-standard.jpg", premium: "/art/shubhora/plan-premium.jpg", custom: "/art/shubhora/plan-custom.jpg" };
const HERO = "/art/shubhora/hero.jpg";
const hostOf = (u) => (u.match(/^https?:\/\/[^/]+/) ?? [""])[0];   // keep the address form the card used
const planOf = (name) => (/premium/i.test(name) ? "premium" : /standard|growth/i.test(name) ? "standard" : /custom/i.test(name) ? "custom" : /free/i.test(name) ? "free" : "");
const planOfUrl = (u) => (/premium/i.test(u) ? "premium" : /standard|growth/i.test(u) ? "standard" : /custom/i.test(u) ? "custom" : /free/i.test(u) ? "free" : "");

function refresh(data) {
  const d = structuredClone(data);
  const notes = [];
  const swapPlan = (u, name, where) => {
    if (typeof u !== "string" || !OLD_PLAN.test(u)) return u;
    const k = planOf(name || "") || planOfUrl(u);
    if (!k) return u;
    const next = hostOf(u) + NEW[k];
    notes.push(`${where}: ${u.split("/").pop()} → ${NEW[k].split("/").pop()}`);
    return next;
  };
  const swapHero = (u, where) => {
    if (typeof u !== "string" || !(OLD_PLAN.test(u) || OLD_BANNER.test(u))) return u;
    notes.push(`${where}: ${u.split("/").pop()} → hero.jpg`);
    return hostOf(u) + HERO;
  };
  // Plan cards: every product item, on every page (the hidden Shubhora page included).
  for (const pg of d.pages ?? []) for (const b of pg.blocks ?? []) {
    if (b.kind !== "product" || !Array.isArray(b.items)) continue;
    b.items = b.items.map((it) => {
      const where = `${pg.slug} › ${it.name}`;
      const out = { ...it };
      if (out.imageUrl) out.imageUrl = swapPlan(out.imageUrl, it.name, where);
      if (Array.isArray(out.images)) out.images = out.images.map((u) => (typeof u === "string" ? swapPlan(u, it.name, `${where} (more)`) : u));
      return out;
    });
  }
  // The top of the website: the cover, the hero picture and the sliding banners — a plan card or the old poster there becomes the drawn hero.
  if (d.coverUrl) d.coverUrl = swapHero(d.coverUrl, "cover");
  if (COVER && d.coverUrl && !/\/art\/shubhora\/hero\.jpg$/.test(d.coverUrl)) { notes.push(`cover: ${d.coverUrl.split("/").pop()} → hero.jpg`); d.coverUrl = HERO; }
  if (d.site?.hero?.imageUrl) d.site.hero.imageUrl = swapHero(d.site.hero.imageUrl, "hero");
  if (Array.isArray(d.site?.hero?.slides)) d.site.hero.slides = d.site.hero.slides.map((s, i) => (s?.imageUrl ? { ...s, imageUrl: swapHero(s.imageUrl, `banner ${i + 1} "${s.headline ?? ""}"`) } : s));
  return { data: d, notes };
}

const rows = USER
  ? await rest(`cards?username=eq.${encodeURIComponent(USER)}&select=id,username,data`)
  : await rest(`cards?select=id,username,data&or=(data->>company.ilike.*shubhora*,data->>kb.eq.shubhora,data->>kb.eq.both)`);
if (!rows.length) { console.log("No card found."); process.exit(0); }

const changed = [];
for (const row of rows) {
  const { data, notes } = refresh(row.data);
  if (!notes.length) { if (USER) console.log(`/${row.username}: nothing old to change.`); continue; }
  console.log(`/${row.username}`);
  for (const n of notes) console.log(`   ${n}`);
  changed.push({ row, data });
}
console.log(`\n${changed.length} card(s) to change.`);
if (!APPLY || !changed.length) { if (!APPLY) console.log("Report only — add --apply to change them."); process.exit(0); }

fs.mkdirSync(BACKUP_DIR, { recursive: true });
const backup = path.join(BACKUP_DIR, `seller-art-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(backup, JSON.stringify(changed.map(({ row }) => ({ id: row.id, username: row.username, data: row.data }))));
console.log(`Backup: ${backup}`);
for (const { row, data } of changed) {
  await rest(`cards?id=eq.${row.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ data }) });
  console.log(`   /${row.username} updated`);
}
console.log(`Done. To put them back: node ${APP}/scripts/seller-art-refresh.mjs --undo ${backup} --apply`);
