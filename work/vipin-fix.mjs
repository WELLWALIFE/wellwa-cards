// One-off fix for Vipin Thakkar's card (vipin-thakkar, Chitraka EV dealer, Rewari), 28 Nov 2026.
// Run on the server from /opt/neuraledge/app:  DRY=1 node --input-type=module - < work/vipin-fix.mjs   (then without DRY)
// Backs up the card and products to /root/vipin-backup-<time>/ first. Never prints keys.
import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { createRequire } from "module";
const sharp = createRequire(`${process.cwd()}/package.json`)("sharp");

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']\r?$/g, "").trim()]));
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json" };
const DRY = !!process.env.DRY;
const CARD = "35414dfa-feb5-4468-9521-0adfa3ad7f4d", UID = "17f07ec1-1809-479e-b94e-00abb04e58a0", BRAND = "Chitraka Ev Motors";
const IMG = "https://chitrakaev.com/assets/images";
const MODELS = [
  { id: "afe0a588-3974-4056-abef-0784643bcb71", old: "₹1,11,000", name: "Chitraka Active Star", src: `${IMG}/products/product-2.jpeg`, specs: ["Range: 120 KM", "Battery capacity: (2.52 KW) Lithium-ion", "Loading capacity: 203 + KG"] },
  { id: null, old: null, name: "Chitraka Active Pro", src: `${IMG}/products/chitraka-active-pro/product-1.png`, specs: ["Range: 120 KM", "Battery capacity: (2.52 KW) Lithium-ion", "Loading capacity: 203 + KG"] },
  { id: "b536c2eb-6444-431d-b08b-fddf47652164", old: "Chitraka Single Light", name: "Chitraka Single Light", src: `${IMG}/products/chitraka-single-light/product-1.png` },
  { id: "15bd2c20-1655-4a65-8cb0-1e598dbc61c3", old: "Chitraka Double Light", name: "Chitraka Double Light", src: `${IMG}/products/chitraka-double-light/product-1.png` },
  { id: "a63b3265-cdad-4995-b64b-abda822dfe3c", old: "Chitraka Active Go", name: "Chitraka Active Go", src: `${IMG}/products/chitraka-double-light/product-active-go.png` },
];
const SHOWROOM_SRC = `${IMG}/dealers/product-5.png`;
const LINEUP_FOCUS = "51% 50%";   // photo-focus.ts (new line-up rule) on wide-1795792796126.jpg

async function get(path) { const r = await fetch(`${U}/rest/v1/${path}`, { headers: H }); if (!r.ok) throw new Error(`GET ${path.split("?")[0]} ${r.status}`); return r.json(); }
async function write(path, method, body) {
  if (DRY) { console.log(`DRY ${method} ${path.split("?")[0]}`); return; }
  const r = await fetch(`${U}/rest/v1/${path}`, { method, headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${method} ${path.split("?")[0]} ${r.status} ${await r.text()}`);
}
async function copy(src, kind, n) {
  const r = await fetch(src, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error(`fetch ${src} ${r.status}`);
  const img = sharp(Buffer.from(await r.arrayBuffer()), { failOn: "none" }).rotate();
  const m = await img.metadata();
  const out = await img.resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
  const key = `poster/${UID}/site-${kind}-${Date.now()}-fix${n}.jpg`;
  const url = `${U}/storage/v1/object/public/media/${key}`;
  console.log(`${DRY ? "DRY " : ""}copy ${src.split("/images/")[1]} ${m.width}x${m.height} -> ${key.split("/").pop()}`);
  if (DRY) return url;
  const up = await fetch(`${U}/storage/v1/object/media/${key}`, { method: "POST", headers: { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "image/jpeg", "x-upsert": "true" }, body: out });
  if (!up.ok) throw new Error(`upload ${key} ${up.status}`);
  return url;
}

const [card] = await get(`cards?id=eq.${CARD}&select=id,owner_id,username,data`);
if (!card || card.owner_id !== UID || card.username !== "vipin-thakkar") throw new Error("card not found / owner mismatch");
const prods = await get(`poster_products?user_id=eq.${UID}&select=*`);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dir = `/root/vipin-backup-${stamp}`;
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/card.json`, JSON.stringify(card));
writeFileSync(`${dir}/poster_products.json`, JSON.stringify(prods));
console.log(`backup: ${dir} (card + ${prods.length} products)`);
if (prods.some((p) => p.name === "Chitraka Active Pro")) throw new Error("Active Pro already there — stop and look");

// 1. pictures
let n = 0;
for (const m of MODELS) m.url = await copy(m.src, "product", n++);
const showroom = await copy(SHOWROOM_SRC, "wide", n++);

// 2. product rows
for (const [i, m] of MODELS.entries()) {
  const photos = [{ url: m.url, view: "front", role: "identity" }];
  if (m.id) {
    const row = prods.find((p) => p.id === m.id);
    if (!row || row.name !== m.old) throw new Error(`row ${m.id} changed (${row?.name}) — stop`);
    m.specs = m.specs ?? row.benefits;
    await write(`poster_products?id=eq.${m.id}&user_id=eq.${UID}`, "PATCH", { name: m.name, photo_url: m.url, photos, sort: 200 + i });
  } else {
    await write("poster_products", "POST", { user_id: UID, name: m.name, brand: BRAND, price: "", mrp: "", photo_url: m.url, photos, benefits: m.specs, offer: "", category: "", active: true, sort: 200 + i });
  }
  console.log(`  ${200 + i} ${m.name}`);
}

// 3. the card: products block, Showroom gallery, hero focus
const data = structuredClone(card.data);
let pb = 0, gb = 0;
for (const pg of data.pages) for (const b of pg.blocks) {
  if (b.id === "zpmimxgo" && b.kind === "product") {
    const byOld = new Map(b.items.map((it) => [it.name, it]));
    b.items = MODELS.map((m) => { const it = (m.old && byOld.get(m.old)) || { specs: [], features: m.specs }; return { ...it, name: m.name, images: [m.url], imageUrl: m.url }; });
    pb++;
  }
  if (b.id === "3twjg8d6" && b.kind === "image") { b.images = [{ url: showroom }]; gb++; }
}
if (pb !== 1 || gb !== 1) throw new Error(`blocks not found (products ${pb}, gallery ${gb})`);
const lineup = "wide-1795792796126.jpg";
if (data.site?.hero?.imageUrl?.endsWith(lineup)) { data.site.hero.focus = LINEUP_FOCUS; data.site.hero.textSide = "center"; }
for (const s of data.site?.hero?.slides ?? []) if (s.imageUrl?.endsWith(lineup) && !s.focusOwn) s.focus = LINEUP_FOCUS;
await write(`cards?id=eq.${CARD}`, "PATCH", { data });
console.log(DRY ? "DRY run done — nothing written" : "done");
