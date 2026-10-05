// Speed of a card's website on a slow phone (docs/website-looks-v2.md §8): Chromium at 390 px with the CPU slowed
// 4× and a slow-4G network, first contentful paint and largest contentful paint in ms, transferred bytes, and any
// sideways overflow. node scripts/trade-check/speed.mjs <card.json> [more cards…]  (the dev server on :3103)
import puppeteer from "puppeteer-core";
import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:3103";
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox", "--disable-gpu"] });
for (const card of process.argv.slice(2)) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(`${BASE}/preview/site?k=speed`, { waitUntil: "domcontentloaded" });
  await page.evaluate((j) => localStorage.setItem("speed", j), fs.readFileSync(card, "utf8"));
  const cdp = await page.createCDPSession();
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1.5 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  let bytes = 0; cdp.on("Network.loadingFinished", (e) => { bytes += e.encodedDataLength || 0; });
  const t0 = Date.now();
  await page.goto(`${BASE}/preview/site?k=speed`, { waitUntil: "load", timeout: 120000 });
  await new Promise((r) => setTimeout(r, 2500));
  const m = await page.evaluate(() => new Promise((res) => {
    const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null;
    let lcp = null;
    try { const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) lcp = e.startTime; }); po.observe({ type: "largest-contentful-paint", buffered: true }); } catch {}
    setTimeout(() => res({ fcp, lcp, overflow: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth, h1: !!document.querySelector("h1") }), 300);
  }));
  console.log(`${card.split("/").pop()}: fcp ${m.fcp ? Math.round(m.fcp) : "?"} ms · lcp ${m.lcp ? Math.round(m.lcp) : "?"} ms · load ${Date.now() - t0} ms · ${(bytes / 1024).toFixed(0)} KB · overflow ${m.overflow}px${m.h1 ? "" : " · NO H1"}`);
  await page.close();
}
await browser.close();
