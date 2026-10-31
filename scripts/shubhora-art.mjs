// Draws the Shubhora partner website's own pictures (public/art/shubhora/*.jpg) so every partner's site is complete without
// uploading anything (owner, 31 Oct 2026: "jab bhi koi Shubhora ki website banaye to automatically complete bane"):
//   hero.jpg          1600×900  a clean brand gradient with a phone showing a card — no words, so the headline sits on it
//   plan-free.jpg, plan-standard.jpg, plan-premium.jpg, plan-custom.jpg   1000×1000 one card each, edge to edge, the price large
// Run: node scripts/shubhora-art.mjs   (Playwright + Chromium; writes the files, then commit them).
import { chromium } from "playwright"; // on the Mac / server: npm i -D playwright, or run with NODE_PATH pointing at a Playwright install
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "public", "art", "shubhora");
fs.mkdirSync(OUT, { recursive: true });

const font = `font-family: Inter, 'Segoe UI', Roboto, Arial, sans-serif;`;

const hero = `<!doctype html><html><body style="margin:0;width:1600px;height:900px;overflow:hidden;${font}">
<div style="position:relative;width:1600px;height:900px;background:
  radial-gradient(900px 600px at 85% 20%, rgba(168,85,247,.55), transparent 60%),
  radial-gradient(700px 500px at 100% 90%, rgba(236,72,153,.35), transparent 60%),
  radial-gradient(800px 700px at 10% 100%, rgba(37,99,235,.45), transparent 60%),
  linear-gradient(135deg,#0b1340 0%,#1e2a7a 45%,#3b2a8f 100%);">
  <div style="position:absolute;inset:0;background:
    repeating-linear-gradient(90deg, rgba(255,255,255,.035) 0 1px, transparent 1px 80px),
    repeating-linear-gradient(0deg, rgba(255,255,255,.035) 0 1px, transparent 1px 80px);mask-image:linear-gradient(180deg,transparent,black 30%,black 70%,transparent)"></div>
  <div style="position:absolute;left:-120px;top:-160px;width:520px;height:520px;border-radius:50%;background:rgba(99,102,241,.25);filter:blur(60px)"></div>
  <div style="position:absolute;right:140px;bottom:-240px;width:620px;height:620px;border-radius:50%;background:rgba(236,72,153,.22);filter:blur(70px)"></div>
  <!-- phone -->
  <div style="position:absolute;right:230px;top:120px;width:330px;height:680px;border-radius:48px;background:#0f172a;box-shadow:0 60px 120px rgba(0,0,0,.45),0 0 0 10px rgba(255,255,255,.08);transform:rotate(-8deg)">
    <div style="position:absolute;inset:12px;border-radius:38px;background:#f8fafc;overflow:hidden">
      <div style="height:150px;background:linear-gradient(135deg,#4f46e5,#a855f7)"></div>
      <div style="margin:-44px 24px 0;display:flex;gap:14px;align-items:flex-end">
        <div style="width:84px;height:84px;border-radius:24px;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.15);display:grid;place-items:center">
          <div style="width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,#4f46e5,#ec4899)"></div></div>
        <div style="padding-bottom:6px"><div style="width:140px;height:14px;border-radius:7px;background:#0f172a"></div><div style="margin-top:8px;width:100px;height:10px;border-radius:5px;background:#94a3b8"></div></div>
      </div>
      <div style="margin:22px 24px 0;display:flex;gap:10px">${["#22c55e","#2563eb","#f59e0b","#ec4899"].map((c) => `<div style="flex:1;height:46px;border-radius:14px;background:${c}1a;border:1px solid ${c}55;display:grid;place-items:center"><div style="width:18px;height:18px;border-radius:6px;background:${c}"></div></div>`).join("")}</div>
      <div style="margin:18px 24px 0;height:48px;border-radius:14px;background:#4f46e5"></div>
      <div style="margin:22px 24px 0;display:grid;grid-template-columns:1fr 1fr;gap:12px">${[0,1,2,3].map((i) => `<div style="height:120px;border-radius:16px;background:#fff;box-shadow:0 4px 14px rgba(0,0,0,.06);overflow:hidden"><div style="height:70px;background:linear-gradient(135deg,${["#c7d2fe","#fbcfe8","#bbf7d0","#fde68a"][i]},#fff)"></div><div style="margin:10px;width:60%;height:9px;border-radius:5px;background:#cbd5e1"></div></div>`).join("")}</div>
    </div>
  </div>
  <!-- floating chips -->
  <div style="position:absolute;right:560px;top:200px;padding:14px 20px;border-radius:18px;background:rgba(255,255,255,.92);box-shadow:0 20px 50px rgba(0,0,0,.3);display:flex;gap:12px;align-items:center;transform:rotate(-6deg)"><div style="width:34px;height:34px;border-radius:12px;background:#22c55e"></div><div><div style="width:110px;height:10px;border-radius:5px;background:#0f172a"></div><div style="margin-top:7px;width:70px;height:8px;border-radius:4px;background:#94a3b8"></div></div></div>
  <div style="position:absolute;right:170px;top:620px;padding:14px 20px;border-radius:18px;background:rgba(255,255,255,.92);box-shadow:0 20px 50px rgba(0,0,0,.3);display:flex;gap:12px;align-items:center;transform:rotate(5deg)"><div style="width:34px;height:34px;border-radius:12px;background:#a855f7"></div><div><div style="width:120px;height:10px;border-radius:5px;background:#0f172a"></div><div style="margin-top:7px;width:60px;height:8px;border-radius:4px;background:#94a3b8"></div></div></div>
  <!-- left dark scrim so a headline reads over it -->
  <div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(6,10,40,.55) 0%,rgba(6,10,40,.25) 45%,transparent 70%)"></div>
</div></body></html>`;

// A plan card fills its picture edge to edge (the product frame is square and letterboxes anything else — the first try, a card
// floating on grey, showed up tiny), so 1000×1000 with the card AS the picture.
const plan = ({ kicker, name, price, per, chips, grad, badge }) => `<!doctype html><html><body style="margin:0;width:1000px;height:1000px;overflow:hidden;${font}">
  <div style="width:1000px;height:1000px;background:${grad};color:#fff;position:relative;overflow:hidden">
    <div style="position:absolute;right:-160px;top:-160px;width:520px;height:520px;border-radius:50%;background:rgba(255,255,255,.12)"></div>
    <div style="position:absolute;left:-120px;bottom:-220px;width:520px;height:520px;border-radius:50%;background:rgba(255,255,255,.08)"></div>
    <div style="position:absolute;left:72px;top:80px;font-size:26px;letter-spacing:.22em;font-weight:700;opacity:.85">${kicker}</div>
    ${badge ? `<div style="position:absolute;right:72px;top:72px;padding:12px 22px;border-radius:999px;background:rgba(255,255,255,.95);color:#0f172a;font-weight:800;font-size:26px">${badge}</div>` : ""}
    <div style="position:absolute;left:72px;top:160px;right:72px;font-size:66px;font-weight:800;letter-spacing:-.02em;line-height:1.08">${name}</div>
    <div style="position:absolute;left:72px;top:380px;right:72px"><div style="font-size:150px;font-weight:900;letter-spacing:-.04em;line-height:1">${price}</div><div style="margin-top:14px;font-size:34px;font-weight:600;opacity:.92">${per}</div></div>
    <div style="position:absolute;left:72px;top:640px;right:72px;display:flex;flex-wrap:wrap;gap:14px">${chips.map((c) => `<div style="padding:14px 24px;border-radius:999px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35);font-size:28px;font-weight:600">${c}</div>`).join("")}</div>
    <div style="position:absolute;left:72px;right:72px;bottom:56px;font-size:24px;line-height:1.35;opacity:.92">GST included · No lock-in: your card and website stay live even if you pause</div>
  </div></body></html>`;

const PLANS = {
  "plan-free": { kicker: "FREE PLAN", name: "Digital V-Card", price: "FREE", per: "for 1 year · worth ₹1,499", chips: ["V-Card", "All pages", "Leads saved", "QR + share"], grad: "linear-gradient(135deg,#047857,#10b981)", badge: "No card details" },
  "plan-standard": { kicker: "STANDARD PLAN", name: "Website + AI + Posters", price: "₹2,999", per: "a month", chips: ["Website (5 pages)", "AI assistant 24×7", "Daily poster", "Auto-posting", "Meta Ads"], grad: "linear-gradient(135deg,#1d4ed8,#4f46e5)", badge: "Recommended" },
  "plan-premium": { kicker: "PREMIUM PLAN", name: "Premium website + SEO", price: "₹5,999", per: "first month only · then ₹2,999", chips: ["Everything in Standard", "Premium website", "Page per product", "Google SEO", "3 layouts to pick"], grad: "linear-gradient(135deg,#6d28d9,#c026d3)", badge: "Most popular" },
  "plan-custom": { kicker: "CUSTOM SOLUTIONS", name: "Built for you", price: "Price", per: "on request", chips: ["Any software", "Automation", "Dedicated manager", "Your team's logins"], grad: "linear-gradient(135deg,#111827,#334155)", badge: "" },
};

const browser = await chromium.launch();
const shot = async (html, w, h, file) => {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await page.screenshot({ path: path.join(OUT, file), type: "jpeg", quality: 86 });
  await page.close();
  console.log("wrote", file);
};
await shot(hero, 1600, 900, "hero.jpg");
for (const [k, v] of Object.entries(PLANS)) await shot(plan(v), 1000, 1000, `${k}.jpg`);
await browser.close();
