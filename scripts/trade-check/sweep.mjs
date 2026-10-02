// Visual sweep of every trade's website, without an account:
//   1. DUMP_DIR=/tmp/cards npm run check:trades      → one JSON card per trade and language (seeds + sample photos)
//   2. npm run dev                                     → the preview renderer at /preview/site
//   3. node scripts/trade-check/sweep.mjs /tmp/cards /tmp/sweep http://localhost:3000 [kirana-en,doctor-hi]
// Loads each card into /preview/site, runs DOM checks at desktop and phone width (broken pictures, sideways
// overflow, "undefined" in the text, empty or clipped sections), screenshots every page, and tiles the desktop
// shots six to a sheet (sheet-01.jpg …) so 78 trades can be eyeballed in 13 pictures. CHROME_PATH points at a
// Chrome/Chromium binary (default: the one Playwright installs on the build box).
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
const CARDS = process.argv[2], OUT = process.argv[3], BASE = process.argv[4] || "http://localhost:3103";
const only = (process.argv[5] || "").split(",").filter(Boolean);
fs.mkdirSync(OUT, { recursive: true });
const files = fs.readdirSync(CARDS).filter((f) => f.endsWith(".json") && (!only.length || only.some((o) => f.startsWith(o)))).sort();
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] });
const report = [];
const CHECK = () => {
  const imgs = [...document.querySelectorAll("img")];
  const broken = imgs.filter((i) => i.complete && i.naturalWidth === 0 && !i.src.startsWith("data:")).map((i) => i.getAttribute("src")?.slice(0, 80));
  const se = document.scrollingElement;
  const overflow = se.scrollWidth > se.clientWidth + 2 ? se.scrollWidth - se.clientWidth : 0;
  const text = document.body.innerText;
  const junk = (text.match(/\bundefined\b|\bnull\b|\bNaN\b|\[object Object\]/g) || []).slice(0, 5);
  const sections = [...document.querySelectorAll("main section")].map((s) => ({ h: s.querySelector("h2,h3")?.textContent?.trim().slice(0, 40) || "(no heading)", height: Math.round(s.getBoundingClientRect().height), text: s.innerText.trim().length, imgs: s.querySelectorAll("img").length }));
  const empty = sections.filter((s) => s.text < 30 && s.imgs === 0).map((s) => s.h);
  const short = sections.filter((s) => s.height < 120).map((s) => `${s.h}:${s.height}px`);
  // text wider than its box (a long word or a stuck line)
  const clipped = [...document.querySelectorAll("h1,h2,h3,p,li,a,span")].filter((e) => e.scrollWidth > e.clientWidth + 4 && getComputedStyle(e).overflow !== "hidden" && e.clientWidth > 0).length;
  return { broken, overflow, junk, sections: sections.length, empty, short, clipped, height: se.scrollHeight, h1: document.querySelector("h1")?.textContent?.trim().slice(0, 50) };
};
for (const f of files) {
  const key = f.replace(".json", "");
  const card = JSON.parse(fs.readFileSync(path.join(CARDS, f), "utf8"));
  const page = await browser.newPage();
  const row = { key };
  try {
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(`${BASE}/preview/site?k=${key}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.evaluate((k, c) => localStorage.setItem(k, JSON.stringify(c)), key, card);
    await page.goto(`${BASE}/preview/site?k=${key}`, { waitUntil: "networkidle0", timeout: 120000 });
    await page.evaluate(() => { document.querySelectorAll("[data-reveal]").forEach((e) => e.classList.add("in")); });
    await new Promise((r) => setTimeout(r, 500));
    row.desktop = await page.evaluate(CHECK);
    await page.screenshot({ path: `${OUT}/${key}.png`, fullPage: true });
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await new Promise((r) => setTimeout(r, 600));
    await page.evaluate(() => { document.querySelectorAll("[data-reveal]").forEach((e) => e.classList.add("in")); });
    row.mobile = await page.evaluate(CHECK);
    await page.screenshot({ path: `${OUT}/${key}-m.png`, fullPage: true });
  } catch (e) { row.error = String(e).slice(0, 200); }
  await page.close();
  report.push(row);
  const d = row.desktop, m = row.mobile;
  console.log(key.padEnd(20), row.error ? "ERROR " + row.error : `sections ${d.sections} h ${d.height} | broken ${d.broken.length} junk ${d.junk.length} empty ${d.empty.length} short ${d.short.length} clipped ${d.clipped} | mobile overflow ${m.overflow} clipped ${m.clipped} broken ${m.broken.length}`);
}
await browser.close();
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
// contact sheets: 6 desktop shots per sheet, each 400px wide, top 2600px of the page
const shots = files.map((f) => f.replace(".json", ""));
for (let i = 0; i < shots.length; i += 6) {
  const group = shots.slice(i, i + 6);
  const tiles = [];
  for (const k of group) {
    const p = `${OUT}/${k}.png`; if (!fs.existsSync(p)) continue;
    const meta = await sharp(p).metadata();
    const img = sharp(p).extract({ left: 0, top: 0, width: meta.width, height: Math.min(meta.height, 2600) }).resize({ width: 400 });
    const buf = await img.png().toBuffer();
    const m = await sharp(buf).metadata();
    const labelled = await sharp({ create: { width: 400, height: 830, channels: 3, background: "#ffffff" } })
      .composite([{ input: buf, top: 24, left: 0 }, { input: Buffer.from(`<svg width="400" height="24"><rect width="400" height="24" fill="#111"/><text x="8" y="17" font-size="14" fill="#fff" font-family="sans-serif">${k}</text></svg>`), top: 0, left: 0 }])
      .png().toBuffer();
    void m; tiles.push(labelled);
  }
  const comps = tiles.map((t, j) => ({ input: t, left: (j % 3) * 410, top: Math.floor(j / 3) * 840 }));
  await sharp({ create: { width: 1230, height: 1680, channels: 3, background: "#e5e7eb" } }).composite(comps).jpeg({ quality: 80 }).toFile(`${OUT}/sheet-${String(i / 6 + 1).padStart(2, "0")}.jpg`);
}
console.log("sheets done");
