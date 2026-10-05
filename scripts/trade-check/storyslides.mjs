import puppeteer from "puppeteer-core";
import fs from "node:fs";
const [card, out] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await page.goto("http://localhost:3103/preview/site?k=shot", { waitUntil: "domcontentloaded" });
await page.evaluate((j) => localStorage.setItem("shot", j), fs.readFileSync(card, "utf8"));
await page.goto("http://localhost:3103/preview/site?k=shot", { waitUntil: "networkidle2", timeout: 90000 });
await new Promise((r) => setTimeout(r, 2500));
const n = await page.evaluate(() => document.querySelectorAll(".story-slide").length);
for (let i = 0; i < n; i++) {
  await page.evaluate((i) => { const t = document.querySelector(".story-track"); t.scrollTo({ top: i * t.clientHeight }); }, i);
  await new Promise((r) => setTimeout(r, 700));
  await page.screenshot({ path: `${out}-${i}.png` });
}
console.log("slides", n);
await browser.close();
