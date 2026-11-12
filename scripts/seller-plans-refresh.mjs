// Puts the CURRENT packages on Shubhora cards that were made earlier (owner, 12 Nov 2026: "package jo hamne new banaye hain wo update
// karo, sabhi Shubhora cards me aur demo card me bhi"). A Shubhora seller card holds a COPY of the template's blocks (plans and prices,
// "what you get", the comparisons, the FAQ), so a card made before a price change keeps the old words for ever.
//
// The packages since 4 Nov 2026: Website Standard ₹2,999 a year · Website Premium ₹5,999 a year (dynamic & progressive, installs like
// an app) · Growth Plan ₹2,999 a month (needs a website plan, 1st month free) · Free V-Card · Custom Solutions.
//
// What it changes — Shubhora's own blocks only, found by the template's own block ids:
//   · a seller card's blocks that changed in the template (scripts/data/seller-template.json → changedIds), and any other template
//     block still saying the old plan words ("(Standard)", "Add Standard", "first month only" …);
//   · the hidden Shubhora page of a "both" card (its blocks are the template's, in order);
//   · the old "Five tools, one link" picture wherever it is shown.
// It never touches the partner's own name, photo, number, about, links, design, own products or own pages.
//
// Run on the VPS:
//   node /opt/neuraledge/app/scripts/seller-plans-refresh.mjs --user jai-dev-rajwal            (report only)
//   node /opt/neuraledge/app/scripts/seller-plans-refresh.mjs --all                            (report: every card it would change)
//   … --products                                                                               (also the partner's Shubhora PRODUCT rows, used on daily posters)
//   … --apply                                                                                  (backup, then change)
//   node /opt/neuraledge/app/scripts/seller-plans-refresh.mjs --undo /var/backups/shubhora-cards/seller-plans-<time>.json --apply
import fs from "node:fs";
import path from "node:path";

const APP = "/opt/neuraledge/app";
const env = {};
for (const l of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA || !KEY) { console.error("Supabase URL / service key not found in .env.local"); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const TPL = JSON.parse(fs.readFileSync(path.join(APP, "scripts", "data", "seller-template.json"), "utf8"));

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const APPLY = args.includes("--apply");
const USER = opt("--user");
const ALL = args.includes("--all");
const UNDO = opt("--undo");
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

const CHANGED = new Set(TPL.changedIds);
// The old plan words: a template block still carrying them is brought up to date even when the template's block did not change now.
const STALE = /\(Standard\)|Add Standard|Standard adds|Growth adds|first month only|₹2,999 \/ month.{0,400}Standard website|shubhora-one-link-v2|shubhora-plan-(?:free|growth|custom)|\/art\/shubhora\/plan-(?:standard|premium)\.jpg|\/api\/stock\/vcard\/plan-/i;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const OLD_ONE_LINK = /\/api\/stock\/demo\/shubhora-one-link(?:-v\d+)?\.jpg(?:\?.*)?$/i;

function refresh(data) {
  const d = structuredClone(data);
  const notes = [];
  for (const pg of d.pages ?? []) {
    if (!Array.isArray(pg.blocks)) continue;
    const shPage = pg.slug === "shubhora";
    pg.blocks = pg.blocks.map((b, i) => {
      if (!b || typeof b !== "object") return b;
      // The hidden Shubhora page: the template's home + plans + business blocks in order, re-keyed sh-1, sh-2 …
      if (shPage) {
        const t = /^sh-\d+$/.test(String(b.id)) ? TPL.shubhoraPage[Number(String(b.id).slice(3)) - 1] : null;
        if (!t || t.kind !== b.kind) return b;
        const next = { ...t, id: b.id };
        if (same(next, b) || !(CHANGED.has(t.id) || STALE.test(JSON.stringify(b)))) return b;
        notes.push(`shubhora › ${b.kind} "${t.title ?? ""}"`);
        return next;
      }
      const t = TPL.blocks[b.id];
      if (t && t.kind === b.kind && !same(t, b) && (CHANGED.has(b.id) || STALE.test(JSON.stringify(b)))) {
        notes.push(`${pg.slug} › ${b.kind} "${t.title ?? ""}"`);
        return structuredClone(t);
      }
      // Any other picture block showing the old "one link" picture.
      if (Array.isArray(b.images)) {
        let hit = false;
        const images = b.images.map((im) => {
          const u = typeof im === "string" ? im : im?.url;
          if (typeof u !== "string" || !OLD_ONE_LINK.test(u)) return im;
          hit = true;
          const nu = (u.match(/^https?:\/\/[^/]+/) ?? [""])[0] + "/art/shubhora/one-link.jpg";
          return typeof im === "string" ? nu : { ...im, url: nu };
        });
        if (hit) { notes.push(`${pg.slug} › ${b.kind}: one-link picture`); return { ...b, images }; }
      }
      return b;
    });
  }
  return { data: d, notes };
}

async function allCards() {
  const out = [];
  for (let from = 0; ; from += 200) {
    const page = await rest(`cards?select=id,username,data&order=id&offset=${from}&limit=200`);
    out.push(...page);
    if (page.length < 200) return out;
  }
}
// ---- The Shubhora plans a partner keeps as PRODUCTS (they are printed on the daily posters): old "Standard ₹2,999 / month" and
// "Premium ₹5,999 first month only" rows get today's name, price and points. A partner's own or AI-made photo is kept; only
// our old stock picture is swapped. (--products; with --user only that card owner's rows.)
const PRODUCTS = args.includes("--products");
const P_STD = { name: "Shubhora Website Standard — Dynamic website", price: "2,999 / year", offer: "Growth Plan: 1st month free", benefits: ["Dynamic website, up to 5 pages", "SEO + AI-search ready", "Product catalogue + WhatsApp order", "AI Ad Studio and Reel Maker (credits)", "Growth Plan: 1st month free", "₹2,999 a year, GST included"], art: "/api/stock/vcard/plan-website-standard.jpg" };
const P_PRE = { name: "Shubhora Website Premium — Dynamic & Progressive website", price: "5,999 / year", offer: "Installs on the phone like an app", benefits: ["Dynamic & Progressive website", "Installs on phone like an app", "SEO + AI-search ready", "Product catalogue + WhatsApp order", "AI Ad Studio and Reel Maker (credits)", "Growth Plan: 1st month free"], art: "/api/stock/vcard/plan-website-premium.jpg" };
const P_GROWTH = { name: "Shubhora Growth Plan — Posters, WhatsApp AI and CRM", price: "2,999 / month", offer: "1st month free with every website plan", benefits: ["Daily posters", "Facebook & Instagram auto-post", "WhatsApp AI chatbot 24×7", "CRM & lead follow-ups", "Google profile & review replies", "WhatsApp broadcasts", "AI search: ChatGPT & Gemini", "Monthly report"], art: "/api/stock/vcard/plan-growth-monthly.jpg" };
async function refreshProducts(ownerId) {
  const q = `poster_products?select=id,user_id,name,price,offer,benefits,photo_url,photos&name=ilike.*shubhora*${ownerId ? `&user_id=eq.${ownerId}` : ""}&limit=2000`;
  const every = await rest(q);
  // A partner who sells the Shubhora website plans and has no Growth Plan product yet gets one (the fifth package; new partners get it at set-up).
  const sellers = [...new Set(every.filter((r) => /shubhora/i.test(r.name) && /standard|premium/i.test(r.name)).map((r) => r.user_id))];
  const needGrowth = sellers.filter((u) => !every.some((r) => r.user_id === u && /growth plan/i.test(r.name)));
  for (const u of needGrowth) console.log(`   + product "${P_GROWTH.name}" for user ${u.slice(0, 8)}`);
  console.log(`${needGrowth.length} Growth Plan product(s) to add.`);
  if (APPLY) for (const u of needGrowth) {
    await rest("poster_products", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ user_id: u, name: P_GROWTH.name, price: P_GROWTH.price, offer: P_GROWTH.offer, benefits: P_GROWTH.benefits, category: "Shubhora", brand: "Shubhora", brand_id: null, active: true, photo_url: P_GROWTH.art, photos: [{ url: P_GROWTH.art, view: "front", role: "identity" }] }) })
      .then(() => console.log(`   added for ${u.slice(0, 8)}`), (e) => console.log(`   could not add for ${u.slice(0, 8)}: ${e.message}`));
  }
  const list = every.filter((r) => /standard|premium/i.test(r.name) && !/^Shubhora Website (Standard|Premium) — /.test(r.name) && /month/i.test(String(r.price ?? "")));
  const todo = list.map((r) => {
    const t = /premium/i.test(r.name) ? P_PRE : P_STD;
    const stock = (u) => typeof u === "string" && /\/api\/stock\/vcard\/plan-/.test(u);
    const patch = { name: t.name, price: t.price, offer: t.offer, benefits: t.benefits };
    if (stock(r.photo_url)) patch.photo_url = t.art;
    if (Array.isArray(r.photos) && r.photos.some((x) => stock(x?.url))) patch.photos = r.photos.map((x) => (stock(x?.url) ? { ...x, url: t.art } : x));
    return { r, patch };
  });
  for (const { r, patch } of todo) console.log(`   product "${r.name}" (${r.price}) → "${patch.name}" (${patch.price})${patch.photo_url ? " + picture" : ""}`);
  console.log(`${todo.length} product row(s) to change.`);
  if (!APPLY || !todo.length) return;
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, `seller-products-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify(todo.map(({ r }) => r)));
  console.log(`Products backup: ${file}`);
  for (const { r, patch } of todo) await rest(`poster_products?id=eq.${r.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
  console.log("   products updated");
}

const rows = USER ? await rest(`cards?username=eq.${encodeURIComponent(USER)}&select=id,username,data`) : await allCards();
if (!rows.length) { console.log("No card found."); process.exit(0); }

const changed = [];
for (const row of rows) {
  if (!row.data || !Array.isArray(row.data.pages)) continue;
  const { data, notes } = refresh(row.data);
  if (!notes.length) { if (USER) console.log(`/${row.username}: already up to date.`); continue; }
  console.log(`/${row.username}  (${notes.length})`);
  for (const n of notes) console.log(`   ${n}`);
  changed.push({ row, data });
}
console.log(`\n${rows.length} card(s) read, ${changed.length} to change.`);
if (PRODUCTS) {
  const owner = USER ? (await rest(`cards?username=eq.${encodeURIComponent(USER)}&select=owner_id`))[0]?.owner_id : null;
  if (!USER || owner) await refreshProducts(owner);
}
if (!APPLY || !changed.length) { if (!APPLY) console.log("Report only — add --apply to change them."); process.exit(0); }

fs.mkdirSync(BACKUP_DIR, { recursive: true });
const backup = path.join(BACKUP_DIR, `seller-plans-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(backup, JSON.stringify(changed.map(({ row }) => ({ id: row.id, username: row.username, data: row.data }))));
console.log(`Backup: ${backup}`);
for (const { row, data } of changed) {
  await rest(`cards?id=eq.${row.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ data }) });
  console.log(`   /${row.username} updated`);
}
console.log(`Done. To put them back: node ${APP}/scripts/seller-plans-refresh.mjs --undo ${backup} --apply`);
