// Screenshots of a card's website for a look audit: the first screen (hero) and the whole page, phone and desktop.
//   node scripts/trade-check/look-shots.mjs <outdir> <card.json> [<card.json> ...]      (dev server on :3103)
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
const [OUT, ...cards] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:3103";
const browser = await puppeteer.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox", "--disable-gpu", "--ignore-certificate-errors"] });
for (const card of cards) {
  const name = path.basename(card, ".json");
  const json = fs.readFileSync(card, "utf8");
  // English cards are also shot in Hindi (the visitor's language switch), the Hindi card as it is.
  const langs = /-hi\.json$/.test(card) ? ["hi"] : ["en", "hi"];
  for (const lang of langs) for (const [dev, w, h, mobile] of [["phone", 390, 844, true], ["desk", 1440, 900, false]]) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    await page.goto(`${BASE}/preview/site?k=shot`, { waitUntil: "domcontentloaded" });
    await page.evaluate((j) => localStorage.setItem("shot", j), json);
    await page.goto(`${BASE}/preview/site?k=shot&shot=1&lang=${lang}`, { waitUntil: "networkidle2", timeout: 90000 });
    await page.evaluate(() => document.querySelector("nextjs-portal")?.remove());
    await page.evaluate(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, 4000));
    const tag = `${name}${lang === "hi" && !/-hi$/.test(name) ? "-hi" : ""}-${dev}`;
    await page.screenshot({ path: `${OUT}/${tag}-hero.png`, fullPage: false });
    await page.screenshot({ path: `${OUT}/${tag}-full.png`, fullPage: true });
    const fonts = await page.evaluate(() => [...new Set([...document.querySelectorAll("h1,h2,p,a")].slice(0, 60).map((e) => getComputedStyle(e).fontFamily.split(",")[0]))].join(" | "));
    console.log(tag, "fonts:", fonts);
    await page.close();
  }
}
await browser.close();
