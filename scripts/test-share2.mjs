// End-to-end test of Share Screen v2 (15-minute link, same-link reconnect with a pop-up, Help panel Admin/Franchise, admin console). Run on the VPS.
import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const APP = "/opt/neuraledge/app"; const env = {};
for (const l of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const SITE = "https://shubhora.com", EMAIL = "p919000001212@phone.neuraledge.me", UID = "2e4475d3-89e9-470e-b48b-3c197dc094ed";
const require = createRequire(path.join(APP, "package.json")); const puppeteer = require("puppeteer-core");
const { ui } = await import(path.join(APP, "scripts/tutorial-video.mjs"));
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const out = (k, v) => console.log(k.padEnd(48), v);
const waitFor = async (fn, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return Date.now() - t; await pause(150); } return -1; };
const browser = await puppeteer.launch({ executablePath: env.CHROME_PATH || "/usr/bin/chromium-browser", headless: true, protocolTimeout: 120000, args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"] });
const sharer = await browser.newPage(); await sharer.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const u = ui(sharer, { work: "/tmp", email: EMAIL, uid: UID });
let created = null;
sharer.on("response", async (r) => { try { if (r.url() === `${SITE}/api/share` && r.request().method() === "POST") created = await r.json(); } catch {} });
sharer.on("pageerror", (e) => console.log("SHARER pageerror", String(e.message).slice(0, 300)));
await u.login(); await u.goto(`${SITE}/poster/onboard?step=you`); await u.waitText("About you", 25000);
const dlg = async () => sharer.evaluate(() => (document.querySelector('[role="dialog"]')?.innerText || "").replace(/\n+/g, " | "));
const body = async () => sharer.evaluate(() => document.body.innerText.replace(/\n+/g, " | "));
const vtext = async (p) => p.evaluate(() => document.querySelector("iframe")?.contentDocument?.body?.innerText || "").catch(() => "");
const ptext = async (p) => p.evaluate(() => document.body.innerText.replace(/\n+/g, " | ")).catch(() => "");
const tap = async (re) => sharer.evaluate((src) => { const r = new RegExp(src); const b = [...document.querySelectorAll("button,a")].find((x) => r.test(x.innerText.trim())); if (!b) return false; b.click(); return true; }, re.source);

// 1. Help panel
await u.tap('button[aria-label="Help"], button[aria-label="मदद"]'); await pause(700);
out("help panel text", JSON.stringify((await sharer.evaluate(() => document.querySelector(".rounded-t-2xl")?.innerText || "")).replace(/\n+/g, " | ").slice(0, 700)));
await sharer.screenshot({ path: "/tmp/help2.png" });
// 2. Franchise → link
out("tap Franchise", await tap(/Franchise/));
await pause(600); out("consent dialog", JSON.stringify((await dlg()).slice(0, 520)));
await sharer.screenshot({ path: "/tmp/consent2.png" });
out("tap Make link", await tap(/^Make link/));
for (let i = 0; i < 40 && !created?.token; i++) await pause(250);
await pause(1500);
out("created", JSON.stringify({ t: created?.token?.slice(0, 6), exp: created ? Math.round((created.expiresAt - Date.now()) / 60000) + " min" : null }));
out("ready view", JSON.stringify((await dlg()).slice(0, 220)));
await tap(/^Done/); await pause(400);
// 3. viewer opens
const ctx = await browser.createBrowserContext(); const viewer = await ctx.newPage(); await viewer.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await viewer.goto(created.url, { waitUntil: "domcontentloaded" });
out("viewer sees sender's page (ms)", await waitFor(async () => /About you/.test(await vtext(viewer)), 15000));
out("sender banner", JSON.stringify((await body()).match(/(\d+ watching[^|]*|Screen sharing is on[^|]*)\|?\s*\d* ?min left/)?.[0] ?? (await body()).slice(0, 160)));
// 4. End on the sender: viewer pauses, link stays
out("tap End on banner", await tap(/^End$/));

out("viewer shows 'stopped sharing' (ms)", await waitFor(async () => /stopped sharing/.test(await ptext(viewer)), 15000));
out("viewer page (paused)", JSON.stringify((await ptext(viewer)).slice(0, 330)));
{ const w = await (await fetch(`${SITE}/api/share/watch?token=${created.token}&after=0&epoch=0&v=chk`)).json(); out("watch API after End", JSON.stringify({ status: w.status, why: w.why, events: w.events.length })); }
out("sender notice after End", JSON.stringify((await body()).slice(0, 260)));
// 5. a NEW viewer opens the same link: the sender gets the pop-up, says yes, the first viewer continues
const v2 = await (await browser.createBrowserContext()).newPage(); await v2.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await v2.goto(created.url, { waitUntil: "domcontentloaded" });
out("pop-up 'Share your screen?' appears (ms)", await waitFor(async () => /Share your screen\?/.test(await dlg()), 20000));
out("pop-up text", JSON.stringify((await dlg()).slice(0, 300)));
await sharer.screenshot({ path: "/tmp/knock2.png" });
out("tap Share screen", await tap(/^Share screen$/));
out("first viewer live again, same link (ms)", await waitFor(async () => /About you/.test(await vtext(viewer)) && /Live/.test(await ptext(viewer)), 20000));
out("second viewer live too (ms)", await waitFor(async () => /About you/.test(await vtext(v2)), 20000));
// next page follows
await u.tapText("Next →");
out("viewer follows Next (ms)", await waitFor(async () => /Who is this website for\?|Do you have a website\?/.test(await vtext(viewer)), 15000));
// 6. old push secret is dead after resume? (the first secret)
out("old secret after resume", await fetch(`${SITE}/api/share/push`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: created.token, secret: created.secret, events: [{ type: 3 }] }) }).then((r) => r.status));
// 7. "Not now" on a knock does not start sharing
await tap(/^End$/); await pause(1500);
await viewer.reload({ waitUntil: "domcontentloaded" });
await waitFor(async () => /Share your screen\?/.test(await dlg()), 20000);
out("tap Not now", await tap(/^Not now$/)); await pause(1500);
out("viewer still paused after Not now", /stopped sharing/.test(await ptext(viewer)));
// viewer asks again with the button
await pause(21000);
out("viewer taps 'Ask them to share again'", await viewer.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /Ask them to share again/.test(x.innerText)); if (b) b.click(); return !!b; }));
out("pop-up again (ms)", await waitFor(async () => /Share your screen\?/.test(await dlg()), 20000));
await tap(/^Not now$/);
// 8. Admin request
await u.tap('button[aria-label="Help"], button[aria-label="मदद"]'); await pause(600);
created = null; out("tap Admin", await tap(/^1\s*Admin/));
await pause(600); out("admin consent", JSON.stringify((await dlg()).slice(0, 200)));
out("tap Send request", await tap(/^Send request/));
for (let i = 0; i < 40 && !created?.token; i++) await pause(250);
await pause(1500);
out("admin request created", JSON.stringify({ t: created?.token?.slice(0, 6) }));
out("admin ready view", JSON.stringify((await dlg()).slice(0, 220)));
const adm = { headers: { "x-admin-key": env.SUPER_ADMIN_PASSWORD } };
{ const t = Date.now(); let l = null; while (Date.now() - t < 8000) { l = await (await fetch(`${SITE}/api/admin/share`, adm)).json(); if (l.requests?.length) break; await pause(300); } out("admin list", JSON.stringify(l.requests?.map((r) => ({ name: r.name, phone: r.phone ? r.phone.slice(0, 4) + "…" : "", state: r.state, mins: Math.round((r.expiresAt - Date.now()) / 60000) })))); }
out("admin list without key", await fetch(`${SITE}/api/admin/share`).then((r) => r.status));
out("admin watch without key", await fetch(`${SITE}/api/admin/share/watch?token=${created.token}`).then((r) => r.status));
// admin console in a browser
const ad = await (await browser.createBrowserContext()).newPage(); await ad.setViewport({ width: 1200, height: 900 });
await ad.evaluateOnNewDocument((k) => { try { sessionStorage.setItem("ne-admin-key", k); sessionStorage.setItem("ne-admin-ok", "1"); } catch {} }, env.SUPER_ADMIN_PASSWORD);
await ad.goto(`${SITE}/admin/support`, { waitUntil: "domcontentloaded" });
out("admin console lists the request (ms)", await waitFor(async () => /Hariom/.test(await ptext(ad)), 20000));
out("admin buttons", JSON.stringify(await ad.evaluate(() => [...document.querySelectorAll("button")].map((x) => x.innerText.replace(/\n+/g, " ").slice(0, 70)).filter((x) => /Hariom|min|left/.test(x)))));
out("admin open request", await ad.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /Live/.test(x.innerText) && /m left/.test(x.innerText)); if (b) b.click(); return !!b; }));
out("admin sees the sender's screen (ms)", await waitFor(async () => /About you|Who is this|Do you have/.test(await ad.evaluate(() => [...document.querySelectorAll("iframe")].map((f) => f.contentDocument?.body?.innerText || "").join(" ")).catch(() => "")), 20000));
await ad.screenshot({ path: "/tmp/admin2.png" });
out("sender sees admin watching", JSON.stringify((await body()).match(/Shubhora admin is watching[^|]*/)?.[0] ?? (await body()).slice(0, 120)));
// the sender's page change reaches the admin
await tap(/^Done/);
out("sender banner buttons", JSON.stringify(await sharer.evaluate(() => [...document.querySelectorAll("button")].filter((b) => /^(End|बंद करें)$/.test(b.innerText.trim())).map((b) => b.innerText))));
await browser.close(); process.exit(0);
