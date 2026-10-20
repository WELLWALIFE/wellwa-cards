// Demo partner: open the Products page (its once-per-visit sync runs), then check the plan photos on the live Shubhora site changed to the partner's own.
import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const APP = "/opt/neuraledge/app"; const env = {};
for (const l of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const SITE = "https://shubhora.com", EMAIL = "p919000001212@phone.neuraledge.me", UID = "2e4475d3-89e9-470e-b48b-3c197dc094ed";
const require = createRequire(path.join(APP, "package.json")); const puppeteer = require("puppeteer-core");
const { ui } = await import(path.join(APP, "scripts/tutorial-video.mjs"));
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const out = (k, v) => console.log(k.padEnd(40), v);
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };
const planImgs = async () => { const cs = await (await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/cards?owner_id=eq.${UID}&select=data`, { headers: H })).json(); const items = []; for (const pg of cs[0]?.data?.pages ?? []) for (const b of pg.blocks) if (b.kind === "product") for (const it of b.items) items.push([it.name.slice(0, 22), (it.images?.[0] ?? "").replace(/^https?:\/\/[^/]+/, "").slice(0, 60)]); return items; };
out("before", JSON.stringify(await planImgs()));
const browser = await puppeteer.launch({ executablePath: env.CHROME_PATH || "/usr/bin/chromium-browser", headless: true, protocolTimeout: 120000, args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"] });
const page = await browser.newPage(); await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
const u = ui(page, { work: "/tmp", email: EMAIL, uid: UID });
await u.login(); await u.goto(`${SITE}/poster/products`); await pause(9000);
out("after", JSON.stringify(await planImgs()));
const html = await (await fetch(`${SITE}/c/hariom?view=site`, { headers: { "cache-control": "no-cache" } })).text();
out("live site has supabase photos", String((html.match(/supabase\.co%2Fstorage/g) || []).length) + " refs");
await browser.close(); process.exit(0);
