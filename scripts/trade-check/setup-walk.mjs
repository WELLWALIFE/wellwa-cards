// Walks the set-up (welcome → 8 onboarding screens → products → make → preview) in a headless phone with a FAKE
// login and a FAKE server: the Supabase session is a cookie this script forges, and every /api/* and Supabase
// request is answered from an in-memory mock, so the real screens run with no keys and no network.
//
//   node scripts/trade-check/setup-walk.mjs <outdir> [upto]     (dev server on :3103, see shot.mjs)
//
// It prints what each screen shows (text, inputs, buttons), every write the screens make (so data loss shows up
// as "never written"), and saves a screenshot per screen.
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import { createRequire } from "node:module";
import Module from "node:module";
// The app's own facts shape (normalizeFacts) from the compiled library (npm run check:trades compiles it); "@/lib/x" → out/src/lib/x.
const OUT_LIB = new URL("./out/src/lib/", import.meta.url).pathname;
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) { return origResolve.call(this, req.startsWith("@/lib/") ? OUT_LIB + req.slice(6) : req, ...rest); };
const require = createRequire(import.meta.url);
const { normalizeFacts } = require(OUT_LIB + "card-facts.js");

const [OUT = "/tmp/setup-walk", UPTO = "all"] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:3103";
const SUPA = "https://fake.supabase.co";
const UID = "11111111-1111-4111-8111-111111111111";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();

// ---------- the fake account ----------
const state = {
  user: { id: UID, aud: "authenticated", role: "authenticated", email: "p919812345678@phone.neuraledge.me", phone: "", app_metadata: { provider: "phone", providers: ["phone"] }, user_metadata: {}, identities: [], created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" },
  username: "haryana", profiles: [], facts: normalizeFacts({}), products: [], cards: [], job: null, writes: [],
};
const log = (...a) => { const line = a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "); state.writes.push(line); console.log("  WRITE", line.slice(0, 300)); };

const b64u = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 365 * 86400;
const jwt = `${b64u({ alg: "HS256", typ: "JWT" })}.${b64u({ iss: `${SUPA}/auth/v1`, sub: UID, aud: "authenticated", exp, iat: exp - 365 * 86400, email: state.user.email, phone: "", app_metadata: state.user.app_metadata, user_metadata: {}, role: "authenticated", aal: "aal1", amr: [{ method: "otp", timestamp: exp - 365 * 86400 }], session_id: "22222222-2222-4222-8222-222222222222", is_anonymous: false })}.${b64u("signature")}`;
const session = () => ({ access_token: jwt, token_type: "bearer", expires_in: 365 * 86400, expires_at: exp, refresh_token: "fake-refresh-token", user: state.user });
const cookieValue = "base64-" + Buffer.from(JSON.stringify(session())).toString("base64url");

function setupInfo() {
  const b = state.user.user_metadata.business ?? {};
  const p = state.profiles[0];
  return { kind: "business", role: b.role ?? "business", reach: b.reach ?? "local", business: b.name ?? "", person: state.user.user_metadata.display_name ?? "", category: b.category ?? "", categoryLabel: b.trade || b.category || "", persona: p?.persona ?? "business", city: b.city ?? "", address: b.address ?? "", website: b.website ?? "", gstin: b.gstin ?? "", phone: p?.phone ?? (state.user.user_metadata.phone ?? "").replace(/^\+91/, ""), map: b.map ?? "", about: b.about ?? "", logo: p?.logo_url ?? null, photo: p?.photo_url ?? null };
}

// The website the "build" hands back: a checked sample card, renamed for this account.
function sampleCard() {
  const src = ["/tmp/cards/computer-en.json", "/tmp/cards/cafe-bento.json"].find((f) => fs.existsSync(f));
  if (!src) return null;
  let txt = fs.readFileSync(src, "utf8");
  txt = txt.replace(/computers/g, "drones").replace(/Computers/g, "Drones").replace(/computer/g, "drone").replace(/Computer/g, "Drone").replace(/laptops/gi, "drone cameras").replace(/laptop/gi, "drone camera");
  const c = JSON.parse(txt);
  const b = state.user.user_metadata.business ?? {};
  const { id: _i, username: _u, plan: _p, active: _a, views: _v, createdAt: _c, ...tpl } = c; void _i; void _u; void _p; void _a; void _v; void _c;
  tpl.name = state.user.user_metadata.display_name || tpl.name;
  tpl.company = b.name || tpl.company;
  if (b.city) tpl.tagline = `${b.trade || "Drone repair"} · ${b.city}`;
  tpl.site = { ...(tpl.site ?? { enabled: true }), enabled: true };
  return tpl;
}
const STAGES = ["details", "words", "design", "pictures", "review"];
function buildView() {
  const j = state.job; if (!j) return { job: null };
  const elapsed = Math.round((Date.now() - j.startedAt) / 1000);
  if (elapsed < 7) return { job: j.id, state: "running", stage: STAGES[Math.min(STAGES.length - 1, Math.floor(elapsed / 1.5))], fresh: j.fresh, elapsed, claimed: false };
  return { job: j.id, state: "done", stage: "done", fresh: j.fresh, elapsed, claimed: j.claimed, status: 200, result: { ok: true, card: sampleCard(), checks: [], missing: [{ key: "hours", label: "Your timings" }, { key: "upi", label: "UPI for payments" }] } };
}

const bodyOf = (req) => { try { return JSON.parse(req.postData() || "{}"); } catch { return {}; } };
const routes = [
  ["GET", /^\/api\/account$/, () => ({ username: state.username, referredBy: null, referralCode: "HR7X2K", cardSlug: state.cards[0]?.username ?? null, partner: null })],
  ["POST", /^\/api\/account$/, (b) => { log("account POST", b); return { ok: true, username: state.username }; }],
  ["POST", /^\/api\/account\/details$/, (b) => { log("account/details POST", b); return { ok: true }; }],
  ["GET", /^\/api\/poster\/profiles$/, () => ({ profiles: state.profiles })],
  ["POST", /^\/api\/poster\/profiles$/, (b) => {
    const cur = b.id ? state.profiles.find((p) => p.id === b.id) : null;
    const row = { ...(cur ?? { id: `p-${state.profiles.length + 1}`, is_default: state.profiles.length === 0, lang: "hi", kids_mode: false }), ...b };
    if (cur) Object.assign(cur, row); else state.profiles.push(row);
    log("profiles POST", { id: row.id, name: b.name, tagline: b.tagline, category: b.category, logo_url: b.logo_url, phone: b.phone, city: b.city, style: b.style });
    return { profile: row };
  }],
  ["GET", /^\/api\/card\/facts$/, () => ({ facts: state.facts, setup: setupInfo(), products: state.products, brandProducts: false, reviews: 0 })],
  ["PATCH", /^\/api\/card\/facts$/, (b) => {
    if (!state.profiles.length) { log("facts PATCH refused (no profile)", Object.keys(b.facts ?? {})); return [{ error: "Please finish About you first." }, 409]; }
    const f = b.facts ?? {};
    const changed = Object.keys(f).filter((k) => JSON.stringify(f[k]) !== JSON.stringify(state.facts[k]));
    state.facts = normalizeFacts({ ...state.facts, ...f });
    log("facts PATCH", changed.map((k) => `${k}=${JSON.stringify(f[k]).slice(0, 60)}`).join(" "));
    return { facts: state.facts };
  }],
  ["GET", /^\/api\/poster\/products$/, () => ({ products: state.products, brand_admin_of: null })],
  ["POST", /^\/api\/poster\/products$/, (b) => {
    const cur = b.id ? state.products.find((p) => p.id === b.id) : null;
    const row = { ...(cur ?? { id: `prod-${state.products.length + 1}`, owner_id: UID, photo: "", brand: "", price: "", desc: "" }), ...b };
    if (cur) Object.assign(cur, row); else state.products.push(row);
    log("products POST", { id: row.id, name: row.name, price: row.price });
    return { product: row };
  }],
  ["DELETE", /^\/api\/poster\/products/, (_b, url) => { const id = url.searchParams.get("id"); state.products = state.products.filter((p) => p.id !== id); log("products DELETE", id); return { ok: true }; }],
  ["POST", /^\/api\/poster\/products\/ai$/, () => ({ products: [] })],
  ["POST", /^\/api\/ai\/write$/, (b) => { log("ai/write", { task: b.task, role: b.role, company: b.company }); return { text: `${b.company || "We"} fix drones, gimbals and camera batteries for DJI and every other brand — same-day service, genuine parts and a six-month warranty. Doorstep pickup across ${/City: (.*)/.exec(b.input || "")?.[1] || "the city"}.` }; }],
  ["POST", /^\/api\/poster\/upload$/, (_b, url) => { log("upload POST", url.pathname); return { url: "/api/stock/banners/cafe.jpg" }; }],
  ["GET", /^\/api\/wa\/status$/, () => ({ state: "none" })],
  ["GET", /^\/api\/social\/accounts$/, () => ({ accounts: [] })],
  ["GET", /^\/api\/google\/status$/, () => ({ connected: false })],
  ["GET", /^\/api\/card\/build$/, () => buildView()],
  ["POST", /^\/api\/card\/build$/, (b) => {
    if (b.claim) { if (state.job) state.job.claimed = true; log("build claim", b.claim); return { ok: true }; }
    state.job = { id: `job-${Date.now()}`, startedAt: Date.now(), fresh: !!b.fresh, claimed: false };
    log("build POST", { facts: Object.keys(b.facts ?? {}).length + " fact keys", products: (b.products ?? []).map((p) => p.name), siteChanged: b.siteChanged, fresh: b.fresh });
    return [buildView(), 202];
  }],
  ["GET", /^\/api\/card\/banner$/, () => ({ job: null })],
  ["POST", /^\/api\/card\/banner$/, () => [{ error: "No banner in the mock." }, 400]],
];

async function intercept(page) {
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = new URL(req.url()); const m = req.method(); const p = url.pathname;
    const json = (body, status = 200) => req.respond({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" }, body: status === 204 ? "" : JSON.stringify(body) });
    try {
      if (url.hostname === "fake.supabase.co") {
        if (m === "OPTIONS") return json({}, 204);
        if (p === "/auth/v1/user") {
          if (m === "PUT") { const b = bodyOf(req); if (b.data) state.user.user_metadata = { ...state.user.user_metadata, ...b.data }; if (b.email) state.user.email = b.email; state.user.updated_at = now(); log("updateUser", b.data ?? b); }
          return json(state.user);
        }
        if (p.startsWith("/auth/v1/token")) return json(session());
        if (p.startsWith("/auth/v1/logout")) return json({}, 204);
        const single = /vnd\.pgrst\.object/.test(req.headers().accept ?? "");
        if (p.startsWith("/rest/v1/rpc/username_available")) return json(true);
        if (p.startsWith("/rest/v1/rpc/")) return json([]);
        if (p.startsWith("/rest/v1/cards")) {
          if (m === "POST") { const rows = [].concat(bodyOf(req)); for (const r of rows) { const row = { id: `card-${state.cards.length + 1}`, created_at: now(), ...r, active: r.active ?? true }; state.cards.push(row); log("cards INSERT", { id: row.id, username: row.username, name: row.data?.name, blueprint: row.data?.site?.style?.blueprint }); } return json(single ? state.cards.at(-1) : state.cards.slice(-rows.length), 201); }
          if (m === "PATCH") { const b = bodyOf(req); const id = /id=eq\.([^&]+)/.exec(url.search)?.[1]; const row = state.cards.find((c) => c.id === id) ?? state.cards[0]; if (row) Object.assign(row, b); log("cards UPDATE", { id, keys: Object.keys(b), blueprint: b.data?.site?.style?.blueprint }); return json(single ? row : [row]); }
          if (m === "DELETE") { state.cards = []; return json([]); }
          const rows = state.cards.map((c) => ({ id: c.id, data: c.data, active: c.active, username: c.username, owner_id: c.owner_id }));
          return json(single ? rows[0] ?? null : rows);
        }
        if (p.startsWith("/rest/v1/")) return json(single ? null : []);
        if (p.startsWith("/storage/")) return req.respond({ status: 404, body: "" });
        return json({});
      }
      if (url.host === "localhost:3103" && p.startsWith("/api/") && (req.resourceType() === "fetch" || req.resourceType() === "xhr")) {
        const hit = routes.find(([mm, re]) => mm === m && re.test(p));
        if (!hit) { console.log("  (unmocked api →", m, p + url.search, ")"); return json({}); }
        const out = hit[2](bodyOf(req), url);
        return Array.isArray(out) ? json(out[0], out[1]) : json(out);
      }
      return req.continue();
    } catch (e) { console.log("INTERCEPT ERR", p, e.message); try { req.continue(); } catch { /* ignore */ } }
  });
}

// ---------- the walk ----------
const browser = await puppeteer.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 300)));
page.on("console", (msg) => { if (msg.type() === "error" && !/favicon|manifest|404|Failed to load resource/.test(msg.text())) console.log("CONSOLE", msg.text().slice(0, 200)); });
await intercept(page);
await page.setCookie({ name: "sb-fake-auth-token", value: cookieValue, domain: "localhost", path: "/", httpOnly: false, secure: false, sameSite: "Lax" });

let n = 0;
async function shot(name, full = true) { n++; const f = `${OUT}/${String(n).padStart(2, "0")}-${name}.png`; await page.screenshot({ path: f, fullPage: full }); console.log("  shot", f); }
async function dump(tag) {
  const t = await page.evaluate(() => ({
    text: document.body.innerText.replace(/\n{2,}/g, "\n").slice(0, 1100),
    inputs: [...document.querySelectorAll("input,textarea")].filter((i) => i.offsetParent !== null).map((i) => `[${i.placeholder || i.getAttribute("aria-label") || i.type}]=${JSON.stringify((i.value || "").slice(0, 40))}`),
    buttons: [...document.querySelectorAll("button,a[href]")].filter((b) => b.offsetParent !== null).map((b) => (b.innerText || b.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 48)).filter(Boolean),
  }));
  console.log(`\n=== ${tag}\n${t.text}\nINPUTS: ${t.inputs.join(" | ")}\nBUTTONS: ${t.buttons.join(" | ")}`);
  return t;
}
async function waitText(re, ms = 30000) {
  try { await page.waitForFunction((src, flags) => new RegExp(src, flags).test(document.body.innerText), { timeout: ms }, re.source, re.flags); return true; }
  catch { console.log("!! timed out waiting for", re); return false; }
}
async function clickText(re, tag = "button,a[href]") {
  const ok = await page.evaluate((src, flags, tag) => {
    const re = new RegExp(src, flags);
    const el = [...document.querySelectorAll(tag)].filter((b) => b.offsetParent !== null).find((b) => re.test((b.innerText || b.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim()));
    if (!el) return false; el.scrollIntoView({ block: "center" }); el.click(); return true;
  }, re.source, re.flags, tag);
  if (!ok) console.log("!! no element for", re); else console.log("  click", re);
  return ok;
}
async function input(re, text, { clear = true, enter = false } = {}) {
  const h = await page.evaluateHandle((src) => { const re = new RegExp(src, "i"); return [...document.querySelectorAll("input,textarea")].find((i) => i.offsetParent !== null && re.test(i.placeholder || i.getAttribute("aria-label") || "")) || null; }, re.source);
  const el = h.asElement(); if (!el) { console.log("!! no input", re); return null; }
  await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await el.click(); if (clear) { await page.keyboard.down("Control"); await page.keyboard.press("a"); await page.keyboard.up("Control"); await page.keyboard.press("Backspace"); }
  await el.type(text, { delay: 12 }); if (enter) await page.keyboard.press("Enter");
  return el;
}
const tapOutside = async () => { await page.evaluate(() => document.querySelector("h1")?.click()); await page.mouse.click(300, 60); await sleep(400); };
const stop = (k) => UPTO !== "all" && UPTO === k;

// 1 — welcome
await page.goto(`${BASE}/poster/welcome`, { waitUntil: "networkidle2", timeout: 120000 });
await waitText(/Start|शुरू/); await sleep(800);
await dump("welcome"); await shot("welcome");
if (stop("welcome")) process.exit(0);

// 2 — about you
await page.goto(`${BASE}/poster/onboard?step=you&flow=1`, { waitUntil: "networkidle2", timeout: 120000 });
if (!(await waitText(/Your name|आपका नाम/))) { await dump("you?"); await shot("you-missing"); }
await sleep(500);
await input(/Rajesh Sharma/, "Sunil Yadav");
await input(/10-digit mobile/, "9812345678");
await input(/sharma@gmail\.com/, "sunil.yadav@gmail.com");
await input(/e\.g\. Rewari/, "Rewari");
await input(/House no\./, "H.No. 12, Sector 4");
await dump("you"); await shot("you");
await clickText(/^(Next|आगे|Continue)/); await sleep(1200);

// 3 — card for
if (await waitText(/What is your card for\?/)) { await dump("promote"); await shot("promote"); await clickText(/^Continue|आगे बढ़ें/); await sleep(1500); } else { await dump("after-you"); await shot("after-you"); }
if (stop("promote")) process.exit(0);

// 4 — website
if (await waitText(/have a website\?/)) {
  await dump("site"); await shot("site");
  await clickText(/No website|नहीं है/); await sleep(400);
  await shot("site-none");
  await clickText(/^(Next|Continue|आगे)/); await sleep(1200);
}

// 5 — your business (name + trade; typed "Other" trade must survive a tap outside)
if (await waitText(/Your business|What do you do\?/)) {
  await dump("trade-empty"); await shot("trade-empty");
  await input(/^e\.g\. .*/, "Yadav Drone Care");
  await sleep(400); await dump("after-name");
  const combo = await page.$("input[role=combobox]");
  if (combo) { await combo.click(); await combo.type("Drone repair", { delay: 40 }); await sleep(700); await shot("trade-typing", false); }
  await tapOutside();
  const kept = await page.evaluate(() => ({ combo: document.querySelector("input[role=combobox]")?.value, own: [...document.querySelectorAll("input")].find((i) => /drone repair, tiffin/.test(i.placeholder))?.value ?? "(no own-words field)" }));
  console.log("  after tap outside:", kept);
  await dump("trade-kept"); await shot("trade-kept");
  await clickText(/^(Next|आगे)/); await sleep(1500);
}
if (stop("trade")) process.exit(0);

// 6 — about your trade (chips; "+ Write your own" must keep what is typed)
if (await waitText(/About your|आपके .* के बारे में/)) {
  await dump("details"); await shot("details");
  if (await clickText(/\+ Write your own|\+ अपना लिखें/)) {
    await sleep(300);
    const el = await input(/press Enter|Write it here|Enter दबाएँ|यहाँ लिखें/, "Drone camera repair", { enter: true });
    if (el) { await sleep(300); await el.type("Battery replacement", { delay: 12 }); }
    await tapOutside();
    const keptTyped = await page.evaluate(() => [...document.querySelectorAll("input")].filter((i) => /press Enter|Write it here|Enter दबाएँ|यहाँ लिखें/.test(i.placeholder)).map((i) => i.value));
    console.log("  typed-but-not-added after tap outside:", keptTyped, "chips:", await page.evaluate(() => [...document.querySelectorAll("span")].filter((s) => /^✎ /.test(s.textContent || "")).map((s) => s.textContent.trim())));
    await dump("details-typed"); await shot("details-typed");
  }
  // tick a few options
  await page.evaluate(() => { const bs = [...document.querySelectorAll("button")].filter((b) => b.offsetParent !== null && /^[^+]/.test(b.innerText) && b.closest("section") && b.getAttribute("aria-pressed") !== null); bs.slice(0, 3).forEach((b) => b.click()); });
  await sleep(300);
  await clickText(/^(Next|आगे)/); await sleep(1500);
}
if (stop("details")) process.exit(0);

// 6b — highlights (moved off the Products page)
if (await waitText(/What makes you special\?/)) {
  await dump("highlights"); await shot("highlights");
  await page.evaluate(() => { [...document.querySelectorAll("section button")].filter((b) => b.offsetParent !== null && !/Next|Write|Skip/.test(b.innerText)).slice(0, 3).forEach((b) => b.click()); });
  await input(/Free delivery/, "10% off this week", { clear: true });
  await clickText(/^(Next|आगे)/); await sleep(1500);
}

// 7 — where & when
if (await waitText(/Where & when|कहाँ और कब/)) {
  await dump("where"); await shot("where");
  await input(/e\.g\. Delhi/, "Rewari");
  await input(/Shop no\./, "Shop 4, Model Town Market");
  await clickText(/^(Next|आगे)/); await sleep(1500);
}

// 8 — about & logo
if (await waitText(/About & logo|परिचय और logo/)) {
  await dump("about"); await shot("about");
  if (await clickText(/Write with AI|Improve with AI|AI से/)) await sleep(1500);
  await dump("about-ai"); await shot("about-ai");
  await clickText(/^(Next|आगे)/); await sleep(1500);
}

// 9 — photos & more → Save
if (await waitText(/Photos & more|Photos और बाकी/)) {
  await dump("extras"); await shot("extras");
  // A photo straight from the camera (4000×3000, 10 MB, EXIF-rotated) must open the crop window and upload
  // (owner, 6 Oct 2026: "camera se upload nahi ho rahi").
  const camera = process.env.CAMERA_JPG || "";
  if (camera && fs.existsSync(camera)) {
    const inputs = await page.$$("input[type=file]");
    if (inputs[0]) {
      await inputs[0].uploadFile(camera); await sleep(4000);
      const cropOpen = await page.evaluate(() => !!document.querySelector("canvas") && [...document.querySelectorAll("button")].some((b) => /Use|Apply|Done|लगाएँ|ठीक/.test(b.innerText)));
      console.log("  camera photo → crop window open:", cropOpen);
      await shot("banner-crop", false);
      await clickText(/^(Use|Apply|Done|OK)|लगाएँ|ठीक/); await sleep(2500);
      const banner = await page.evaluate(() => !!document.querySelector("img[src*='/api/stock/banners/cafe.jpg']"));
      console.log("  banner uploaded and shown:", banner, "| error on screen:", await page.evaluate(() => [...document.querySelectorAll("p")].map((p) => p.innerText).find((t) => /Could not|नहीं/.test(t)) || "none"));
      await shot("banner-done");
    }
  }
  await clickText(/Save and continue|Save करके/); await sleep(2500);
}
await dump("after-save"); await shot("after-save");
console.log("\n--- account after set-up:", JSON.stringify({ meta: state.user.user_metadata, profile: state.profiles[0], factKeys: Object.keys(state.facts), facts: { services: state.facts.services, special: state.facts.special, customers: state.facts.customers, tradeAnswers: state.facts.tradeAnswers, about: state.facts.about, hours: state.facts.hours } }, null, 1).slice(0, 3000));
if (stop("save")) { await browser.close(); process.exit(0); }

// 10 — products
if (!/\/poster\/products/.test(page.url())) await page.goto(`${BASE}/poster/products?setup=1`, { waitUntil: "networkidle2", timeout: 120000 });
await sleep(1200); await dump("products"); await shot("products");
if (await clickText(/Add|जोड़ें/)) { await sleep(500); await dump("products-add"); }
const named = await input(/name|नाम/, "Drone gimbal repair");
if (named) { await input(/1,100|price|₹|कीमत/, "1499"); await sleep(800); await clickText(/^Save$|^Save /); await sleep(2000); await dump("products-filled"); await shot("products-filled"); }
if (stop("products")) { await browser.close(); process.exit(0); }

// 11 — make
await page.goto(`${BASE}/poster/card/build?make=1`, { waitUntil: "networkidle2", timeout: 120000 });
await waitText(/Make my|बनाएँ/); await sleep(800);
await dump("make"); await shot("make");
if (await clickText(/Make my free website|free website बनाओ|Make my website|Make my V-Card/)) {
  await sleep(2500); await dump("building"); await shot("building");
  await waitText(/Bento|Cinematic|Story/, 60000); await sleep(2500);
  await dump("preview"); await shot("preview");
  if (await clickText(/Cinematic/)) { await sleep(2500); await shot("preview-cinematic"); }
  if (await clickText(/Poster|Story/)) { await sleep(2500); await shot("preview-poster"); }
  if (await clickText(/^Card$|^Card ·/)) { await sleep(1200); await shot("preview-card-tab"); await clickText(/^Website/); await sleep(600); }
  if (await clickText(/Change…|Change\.\.\.|बदलें/)) { await sleep(800); await dump("change-sheet"); await shot("change-sheet", false); await page.keyboard.press("Escape"); await sleep(400); }
  if (await clickText(/Desktop|computer|कंप्यूटर/i)) { await sleep(1500); await shot("preview-desk"); }
}
console.log("\n--- cards on the server:", state.cards.map((c) => ({ id: c.id, username: c.username, blueprint: c.data?.site?.style?.blueprint })));
console.log("--- all writes:\n" + state.writes.map((w) => "  " + w.slice(0, 160)).join("\n"));
await browser.close();
