// The three plan pictures of the Shubhora seller card (owner's call, 7 Oct 2026: "package image perfect lagao, abhi
// ajeeb si lagi hai"): designed cards, not AI art — the plan's name, price and what it gives, in the brand's colours
// and fonts, rendered by Chromium at 1000×1000. Output: public/art/vcard/plan-{free,growth,pro}.jpg, served at
// /api/stock/vcard/plan-*.jpg. Run: node scripts/gen-plan-cards.mjs [chrome path]
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const APP = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(APP, "public", "art", "vcard");
fs.mkdirSync(OUT, { recursive: true });
const CHROME = process.argv[2] || process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const font = (f) => `file://${path.join(APP, "public", "fonts", f)}`;

const PLANS = [
  { key: "free", eyebrow: "FREE for 1 year", name: "Website + Digital Card", price: "₹0", per: "worth ₹1,499", tone: "#16a34a", soft: "#dcfce7",
    items: ["Website and card on ONE link — phone or computer", "Built by AI in 5 minutes, your trade's own design", "Daily poster, leads saved in your CRM", "Share on WhatsApp, QR, save-contact"] },
  { key: "growth", eyebrow: "GROWTH · most popular", name: "Everything to run your business online", price: "₹2,999", per: "per month, incl. GST", tone: "#2f5bf5", soft: "#e4e9ff",
    items: ["No Shubhora tag, website on Google", "AI banner, AI pictures, edit by saying it", "Daily poster + status video, auto-posted", "WhatsApp AI answers customers 24×7", "Your own domain"] },
  { key: "pro", eyebrow: "CUSTOM SOLUTIONS", name: "Software built for your business", price: "On request", per: "a quote for your need", tone: "#c42d8f", soft: "#fbe3f3",
    items: ["Dedicated account manager", "Custom software, apps and websites", "Automation of daily work", "AI assistants trained on your business"] },
];

const html = (p) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:"Bricolage";src:url("${font("bricolage-grotesque-600-700.woff2")}") format("woff2");font-weight:600 700}
@font-face{font-family:"Manrope";src:url("${font("manrope-400-600.woff2")}") format("woff2");font-weight:400 600}
*{box-sizing:border-box;margin:0}
html,body{width:1000px;height:1000px;background:#fff;font-family:Manrope,system-ui,sans-serif;color:#0f1233}
.bg{position:absolute;inset:0;background:
 radial-gradient(60% 50% at 85% 10%, ${p.soft} 0%, transparent 70%),
 radial-gradient(50% 45% at 10% 95%, ${p.soft} 0%, transparent 70%), #fff}
.card{position:absolute;left:70px;top:70px;right:70px;bottom:70px;border-radius:48px;background:#fff;border:2px solid #e7e9f3;box-shadow:0 30px 80px rgba(16,18,79,.10);padding:64px 68px;display:flex;flex-direction:column}
.brand{display:flex;align-items:center;gap:14px;font-family:Bricolage;font-weight:700;font-size:30px;letter-spacing:-.01em}
.brand i{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#2f5bf5,#c42d8f 60%,#ff8a3d)}
.eyebrow{margin-top:46px;display:inline-flex;align-self:flex-start;padding:10px 18px;border-radius:999px;background:${p.soft};color:${p.tone};font-weight:600;font-size:22px;letter-spacing:.08em}
h1{margin-top:22px;font-family:Bricolage;font-weight:700;font-size:${p.name.length > 30 ? 54 : 62}px;line-height:1.05;letter-spacing:-.02em;max-width:820px}
.price{margin-top:26px;display:flex;align-items:baseline;gap:16px}
.price b{font-family:Bricolage;font-weight:700;font-size:${p.price.length > 6 ? 56 : 76}px;color:${p.tone};letter-spacing:-.02em}
.price span{font-size:24px;color:#5d6283}
ul{list-style:none;margin-top:34px;display:grid;gap:18px}
li{display:flex;align-items:flex-start;gap:16px;font-size:27px;line-height:1.3;color:#262a4d}
li i{flex:none;width:34px;height:34px;border-radius:50%;background:${p.tone};color:#fff;display:grid;place-items:center;margin-top:2px}
li i svg{width:20px;height:20px}
.foot{margin-top:auto;display:flex;justify-content:space-between;align-items:center;font-size:22px;color:#8a8fae}
.foot b{color:#0f1233;font-weight:600}
</style></head><body><div class="bg"></div><div class="card">
<div class="brand"><i></i> Shubhora</div>
<div class="eyebrow">${p.eyebrow}</div>
<h1>${p.name}</h1>
<div class="price"><b>${p.price}</b><span>${p.per}</span></div>
<ul>${p.items.map((t) => `<li><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg></i><span>${t}</span></li>`).join("")}</ul>
<div class="foot"><span><b>shubhora.com</b> · one link, your whole business</span><span>Made in India</span></div>
</div></body></html>`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--allow-file-access-from-files"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 1000, deviceScaleFactor: 1 });
  const tmp = path.join(APP, ".tmp-plan-cards"); fs.mkdirSync(tmp, { recursive: true });
  for (const p of PLANS) {
    // Loaded from a file:// page (not about:blank), so the file:// fonts are allowed to load.
    const htmlFile = path.join(tmp, `${p.key}.html`);
    fs.writeFileSync(htmlFile, html(p));
    await page.goto(`file://${htmlFile}`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const file = path.join(OUT, `plan-${p.key}.jpg`);
    await page.screenshot({ path: file, type: "jpeg", quality: 90, clip: { x: 0, y: 0, width: 1000, height: 1000 } });
    console.log("✓", path.relative(APP, file));
  }
} finally { await browser.close(); fs.rmSync(path.join(APP, ".tmp-plan-cards"), { recursive: true, force: true }); }
