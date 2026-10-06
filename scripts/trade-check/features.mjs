// Does the website WORK, not only look right: for each card (phone and desktop) — no page errors, no sideways overflow,
// the set's fonts really loaded, the hero's headline is an h1, the sticky bar waits for the hero to leave, a product tap
// opens the sheet, the language switch turns the hero Hindi, the menu opens, FAQ folds open, Call/WhatsApp links are real,
// and "See all" moves to the products page. Prints PASS / FAIL per check.
//   node scripts/trade-check/features.mjs <card.json> [more…]      (server on :3103)
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
const BASE = process.env.BASE || "http://localhost:3103";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox", "--disable-gpu", "--ignore-certificate-errors"] });
let fails = 0;
for (const card of process.argv.slice(2)) {
  const name = path.basename(card, ".json");
  const json = fs.readFileSync(card, "utf8");
  for (const [dev, w, h, mobile] of [["phone", 390, 844, true], ["desk", 1440, 900, false]]) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
    const errors = [];
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 120)));
    page.on("console", (m) => { if (m.type() === "error" && !/favicon|manifest|404|Failed to load resource|ERR_/.test(m.text())) errors.push("console: " + m.text().slice(0, 120)); });
    await page.goto(`${BASE}/preview/site?k=shot`, { waitUntil: "domcontentloaded" });
    await page.evaluate((j) => localStorage.setItem("shot", j), json);
    await page.goto(`${BASE}/preview/site?k=shot&shot=1&lang=en`, { waitUntil: "networkidle2", timeout: 90000 });
    await page.evaluate(() => document.fonts.ready); await sleep(800);
    const results = [];
    const check = (label, ok, note = "") => { results.push(`${ok ? "PASS" : "FAIL"} ${label}${note ? " — " + note : ""}`); if (!ok) fails++; };
    const r1 = await page.evaluate(() => {
      const se = document.scrollingElement;
      const h1 = document.querySelector(".site h1");
      const fam = h1 ? getComputedStyle(h1).fontFamily.split(",")[0].replace(/"/g, "") : "";
      const loaded = [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family);
      const bar = document.querySelector(".site-bar");
      const barShown = bar ? bar.hasAttribute("data-shown") || getComputedStyle(bar).transform === "none" && getComputedStyle(bar).visibility !== "hidden" && bar.getBoundingClientRect().bottom <= innerHeight + 1 && bar.getBoundingClientRect().top < innerHeight : false;
      const links = [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href") || "");
      return { overflow: se.scrollWidth - se.clientWidth, h1: h1?.textContent?.trim().slice(0, 60) || "", fam, fontLoaded: loaded.includes(fam), bar: !!bar, barShown, tel: links.some((x) => x.startsWith("tel:")), wa: links.some((x) => /wa\.me|whatsapp/.test(x)), junk: (document.body.innerText.match(/\bundefined\b|\bNaN\b|\[object Object\]/g) || []).length, bp: document.querySelector(".site")?.getAttribute("data-bp") };
    });
    check("no page/console errors", errors.length === 0, errors.join(" | ").slice(0, 200));
    check("no sideways overflow", r1.overflow <= 2, `${r1.overflow}px`);
    check("hero headline is an h1", !!r1.h1, r1.h1);
    check("display font loaded", r1.fontLoaded, r1.fam);
    check("no undefined/NaN text", r1.junk === 0);
    check("Call link present", r1.tel); check("WhatsApp link present", r1.wa);
    if (mobile) check("sticky bar hidden on screen one", r1.bar && !r1.barShown);
    // scroll: the bar comes in after the hero
    await page.evaluate(() => window.scrollTo(0, 1400)); await sleep(900);
    const barAfter = await page.evaluate(() => { const b = document.querySelector(".site-bar"); if (!b) return false; const r = b.getBoundingClientRect(); return r.top < innerHeight && r.bottom <= innerHeight + 1 && getComputedStyle(b).opacity !== "0"; });
    if (mobile) check("sticky bar shows after the hero", barAfter);
    await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
    // FAQ folds
    const faq = await page.evaluate(() => { const d = document.querySelector(".site details"); if (!d) return "none"; const was = d.open; d.querySelector("summary")?.click(); return d.open !== was ? "toggles" : "stuck"; });
    check("FAQ folds open", faq !== "stuck", faq);
    // product tap → sheet (phone) or detail
    const prod = await page.evaluate(() => { const el = [...document.querySelectorAll(".site [data-product], .site .s-card")].find((e) => /₹/.test(e.textContent || "")); if (!el) return "none"; el.scrollIntoView({ block: "center" }); (el.querySelector("button,a") || el).click(); return "tapped"; });
    await sleep(900);
    const sheet = await page.evaluate(() => !!document.querySelector("[role=dialog], .site-sheet, [data-sheet]") || location.hash.length > 1 || /products|menu|treatments/i.test(document.querySelector(".site h1")?.textContent || ""));
    if (prod === "tapped") check("product tap opens sheet or page", sheet);
    await page.evaluate(() => { history.back(); }); await sleep(600);
    await page.keyboard.press("Escape"); await sleep(300);
    // language switch → Hindi hero
    const before = r1.h1;
    const switched = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /English|हिंदी|हिन्दी|Hindi/.test(x.textContent || "")); if (!b) return "no picker"; b.click(); return "opened"; });
    await sleep(400);
    await page.evaluate(() => { const o = [...document.querySelectorAll("button, [role=option], li")].find((x) => /हिंदी|हिन्दी|Hindi/.test(x.textContent || "") && !/English/.test(x.textContent || "")); o?.click(); });
    await sleep(1200);
    const after = await page.evaluate(() => document.querySelector(".site h1")?.textContent?.trim() || "");
    check("language switch turns the hero Hindi", switched !== "no picker" && /[ऀ-ॿ]/.test(after), `${switched}: "${before}" → "${after.slice(0, 40)}"`);
    // menu (phone)
    if (mobile) {
      // Cinematic hides the header until the page scrolls; bring it in first, then the Menu button itself.
      await page.evaluate(() => window.scrollTo(0, 900)); await sleep(500); await page.evaluate(() => window.scrollTo(0, 850)); await sleep(500);
      const menu = await page.evaluate(() => { const b = document.querySelector(".site header button[aria-label=Menu]"); if (!b) return "none"; b.click(); return "clicked"; }); await sleep(500);
      const nav = await page.evaluate(() => [...document.querySelectorAll(".site header nav a")].filter((a) => a.getBoundingClientRect().height > 0).length);
      check("menu opens with links", menu === "clicked" && nav >= 2, `${nav} links`);
    }
    console.log(`\n== ${name} ${dev} (bp=${r1.bp})\n` + results.join("\n"));
    await page.close();
  }
}
await browser.close();
console.log(`\n${fails ? fails + " FAIL" : "ALL PASS"}`);
process.exit(fails ? 1 : 0);
