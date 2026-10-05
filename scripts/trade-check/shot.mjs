// node shot.mjs <card.json> <outprefix> [phone|desk|both] [tap-product]
import puppeteer from "puppeteer-core";
import fs from "node:fs";
const [card, out, mode = "both", tap, scrollY] = process.argv.slice(2);
const BASE = "http://localhost:3103";
const browser = await puppeteer.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox", "--disable-gpu"] });
const json = fs.readFileSync(card, "utf8");
for (const [name, w, h] of mode === "phone" ? [["phone", 390, 844]] : mode === "desk" ? [["desk", 1280, 900]] : [["desk", 1280, 900], ["phone", 390, 844]]) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: name === "phone", hasTouch: name === "phone" });
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 200)); });
  await page.goto(`${BASE}/preview/site?k=shot`, { waitUntil: "domcontentloaded" });
  await page.evaluate((j) => { localStorage.setItem("shot", j); }, json);
  await page.goto(`${BASE}/preview/site?k=shot`, { waitUntil: "networkidle2", timeout: 90000 });
  await new Promise((r) => setTimeout(r, 4600));
  if (scrollY) { await page.evaluate((y) => window.scrollTo(0, Number(y)), scrollY); await new Promise((r) => setTimeout(r, 1500)); }
  if (tap) {
    const el = await page.$(tap);
    if (el) { await el.click(); await new Promise((r) => setTimeout(r, 900)); console.log("tapped", tap); } else console.log("no element for", tap);
  }
  const text = await page.evaluate(() => document.body.innerText.slice(0, 400).replace(/\n+/g, " | "));
  console.log(name, "text:", text);
  await page.screenshot({ path: `${out}-${name}.png`, fullPage: !tap && !scrollY });
  await page.close();
}
await browser.close();
