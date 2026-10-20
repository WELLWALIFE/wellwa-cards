// The 15-minute end, for real: make a link, watch it, wait, and check it ends by itself for the viewer and for the sender. Run on the VPS (takes ~16 min).
import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const APP = "/opt/neuraledge/app"; const env = {};
for (const l of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const SITE = "https://shubhora.com", EMAIL = "p919000001212@phone.neuraledge.me", UID = "2e4475d3-89e9-470e-b48b-3c197dc094ed";
const require = createRequire(path.join(APP, "package.json")); const puppeteer = require("puppeteer-core");
const { ui } = await import(path.join(APP, "scripts/tutorial-video.mjs"));
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: env.CHROME_PATH || "/usr/bin/chromium-browser", headless: true, protocolTimeout: 120000, args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"] });
const sharer = await browser.newPage(); await sharer.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
const u = ui(sharer, { work: "/tmp", email: EMAIL, uid: UID });
let created = null; sharer.on("response", async (r) => { try { if (r.url() === `${SITE}/api/share` && r.request().method() === "POST") created = await r.json(); } catch {} });
await u.login(); await u.goto(`${SITE}/poster/onboard?step=you`); await u.waitText("About you", 25000);
const tap = async (re) => sharer.evaluate((src) => { const r = new RegExp(src); const b = [...document.querySelectorAll("button,a")].find((x) => r.test(x.innerText.trim())); if (!b) return false; b.click(); return true; }, re.source);
await u.tap('button[aria-label="Help"], button[aria-label="मदद"]'); await pause(600); await tap(/Franchise/); await pause(500); await tap(/^Make link/);
for (let i = 0; i < 40 && !created?.token; i++) await pause(250);
const t0 = Date.now(); console.log("created, expires in", Math.round((created.expiresAt - t0) / 1000), "s"); await tap(/^Done/);
const viewer = await (await browser.createBrowserContext()).newPage(); await viewer.goto(created.url, { waitUntil: "domcontentloaded" });
let vEnded = -1, sEnded = -1;
while (Date.now() - t0 < 17 * 60_000 && (vEnded < 0 || sEnded < 0)) {
  await pause(5000);
  if (vEnded < 0 && /15-minute link is over/.test(await viewer.evaluate(() => document.body.innerText).catch(() => ""))) vEnded = Math.round((Date.now() - t0) / 1000);
  if (sEnded < 0 && /15 minutes are over/.test(await sharer.evaluate(() => document.body.innerText).catch(() => ""))) sEnded = Math.round((Date.now() - t0) / 1000);
}
console.log("viewer saw 'link is over' at (s):", vEnded, "| sender saw 'sharing has ended' at (s):", sEnded);
console.log("watch API after expiry:", JSON.stringify(await (await fetch(`${SITE}/api/share/watch?token=${created.token}&after=0`)).json().then((j) => ({ status: j.status, why: j.why }))));
console.log("push after expiry:", await fetch(`${SITE}/api/share/push`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: created.token, secret: created.secret, events: [{ type: 3 }] }) }).then((r) => r.status));
await browser.close(); process.exit(0);
