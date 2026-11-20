import { createRequire } from "node:module"; const { chromium } = createRequire(import.meta.url)("playwright");
const font = `font-family: Inter, 'Segoe UI', Arial, sans-serif;`;
const bg = (a, b, c) => `background:
  radial-gradient(900px 600px at 85% 20%, ${a}, transparent 60%),
  radial-gradient(700px 500px at 100% 90%, ${b}, transparent 60%),
  radial-gradient(800px 700px at 10% 100%, rgba(37,99,235,.40), transparent 60%),
  ${c};`;
const grid = `<div style="position:absolute;inset:0;background:repeating-linear-gradient(90deg, rgba(255,255,255,.035) 0 1px, transparent 1px 80px),repeating-linear-gradient(0deg, rgba(255,255,255,.035) 0 1px, transparent 1px 80px)"></div>`;
const bar = (w, c = "#0f172a", h = 12) => `<div style="width:${w}px;height:${h}px;border-radius:${h / 2}px;background:${c}"></div>`;
const wrap = (inner, style) => `<!doctype html><html><body style="margin:0;width:1600px;height:900px;overflow:hidden;${font}"><div style="position:relative;width:1600px;height:900px;${style}">${grid}${inner}</div></body></html>`;

// ---- banner 2: a website on a laptop, the same business on a phone ----
const site = `
<div style="height:44px;background:#eef2ff;display:flex;align-items:center;gap:8px;padding:0 16px">
  ${["#ef4444", "#f59e0b", "#22c55e"].map((c) => `<span style="width:11px;height:11px;border-radius:50%;background:${c}"></span>`).join("")}
  <div style="margin-left:14px;flex:1;height:24px;border-radius:12px;background:#fff;display:flex;align-items:center;padding:0 12px;font-size:12px;color:#475569;font-weight:600">🔒 yourshop.in</div>
</div>
<div style="height:54px;display:flex;align-items:center;padding:0 26px;gap:22px;border-bottom:1px solid #e2e8f0;background:#fff">
  <div style="width:28px;height:28px;border-radius:9px;background:linear-gradient(135deg,#4f46e5,#ec4899)"></div>${bar(96)}
  <div style="flex:1"></div>${[50, 64, 56, 60].map((w) => bar(w, "#94a3b8", 9)).join("")}
  <div style="height:30px;width:104px;border-radius:15px;background:#16a34a"></div>
</div>
<div style="display:flex;height:236px;background:linear-gradient(120deg,#1e1b4b,#4338ca)">
  <div style="flex:1;padding:44px 0 0 34px">${bar(90, "#fbbf24", 8)}<div style="height:16px"></div>${bar(300, "#fff", 24)}<div style="height:12px"></div>${bar(220, "#fff", 24)}<div style="height:20px"></div>${bar(260, "rgba(255,255,255,.55)", 9)}<div style="height:8px"></div>${bar(200, "rgba(255,255,255,.55)", 9)}
    <div style="margin-top:22px;display:flex;gap:10px"><div style="width:120px;height:36px;border-radius:18px;background:#fbbf24"></div><div style="width:110px;height:36px;border-radius:18px;border:2px solid rgba(255,255,255,.6)"></div></div></div>
  <div style="width:270px;margin:26px 30px 26px 0;border-radius:18px;background:linear-gradient(135deg,#f472b6,#fb923c 60%,#fde047)"></div>
</div>
<div style="padding:22px 34px;background:#fff">
  ${bar(150, "#0f172a", 14)}
  <div style="margin-top:16px;display:grid;grid-template-columns:repeat(4,1fr);gap:14px">
  ${[["#dbeafe", "#3b82f6"], ["#fce7f3", "#ec4899"], ["#dcfce7", "#22c55e"], ["#fef3c7", "#f59e0b"]].map(([a, b]) => `<div style="border-radius:14px;border:1px solid #e2e8f0;overflow:hidden"><div style="height:92px;background:linear-gradient(135deg,${a},${b}66)"></div><div style="padding:10px">${bar(84, "#0f172a", 9)}<div style="height:7px"></div>${bar(50, b, 9)}</div></div>`).join("")}
  </div>
</div>`;
const b2 = wrap(`
  <div style="position:absolute;left:-120px;top:-160px;width:520px;height:520px;border-radius:50%;background:rgba(45,212,191,.18);filter:blur(60px)"></div>
  <div style="position:absolute;right:120px;top:140px;width:760px;height:520px;border-radius:22px;background:#fff;overflow:hidden;box-shadow:0 60px 120px rgba(0,0,0,.45),0 0 0 10px #0f172a">${site}</div>
  <div style="position:absolute;right:70px;top:672px;width:860px;height:22px;border-radius:0 0 26px 26px;background:linear-gradient(#cbd5e1,#64748b)"></div>
  <div style="position:absolute;right:60px;top:330px;width:210px;height:430px;border-radius:34px;background:#0f172a;box-shadow:0 40px 90px rgba(0,0,0,.5)">
    <div style="position:absolute;inset:9px;border-radius:26px;background:#f8fafc;overflow:hidden">
      <div style="height:96px;background:linear-gradient(120deg,#1e1b4b,#4338ca)"></div>
      <div style="margin:-28px 14px 0;width:56px;height:56px;border-radius:16px;background:#fff;display:grid;place-items:center;box-shadow:0 6px 16px rgba(0,0,0,.15)"><div style="width:30px;height:30px;border-radius:9px;background:linear-gradient(135deg,#4f46e5,#ec4899)"></div></div>
      <div style="padding:12px 14px">${bar(110, "#0f172a", 10)}<div style="height:7px"></div>${bar(76, "#94a3b8", 8)}
        <div style="margin-top:12px;display:flex;gap:7px">${["#22c55e", "#2563eb", "#f59e0b", "#ec4899"].map((c) => `<div style="flex:1;height:30px;border-radius:9px;background:${c}22;display:grid;place-items:center"><span style="width:11px;height:11px;border-radius:4px;background:${c}"></span></div>`).join("")}</div>
        <div style="margin-top:10px;height:32px;border-radius:10px;background:#16a34a"></div>
        <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px">${["#dbeafe", "#fce7f3", "#dcfce7", "#fef3c7"].map((c) => `<div style="height:62px;border-radius:10px;background:${c}"></div>`).join("")}</div></div>
    </div>
  </div>
  <div style="position:absolute;right:770px;top:96px;padding:12px 18px;border-radius:16px;background:#fff;box-shadow:0 20px 50px rgba(0,0,0,.3);display:flex;gap:10px;align-items:center;font-weight:700;color:#0f172a;font-size:17px"><span style="width:26px;height:26px;border-radius:50%;background:#22c55e;display:grid;place-items:center;color:#fff;font-size:15px">✓</span>On Google</div>
`, bg("rgba(45,212,191,.35)", "rgba(99,102,241,.45)", "linear-gradient(135deg,#061a3a 0%,#0f3a6b 50%,#1e2a7a 100%)"));

// ---- banner 3: the AI answering on WhatsApp, a lead saved, today's poster ----
const bubble = (t, me, w) => `<div style="align-self:${me ? "flex-end" : "flex-start"};max-width:${w}px;padding:11px 14px;border-radius:${me ? "16px 4px 16px 16px" : "4px 16px 16px 16px"};background:${me ? "#d9fdd3" : "#fff"};font-size:17px;line-height:1.35;color:#111;box-shadow:0 1px 2px rgba(0,0,0,.12)">${t}</div>`;
const b3 = wrap(`
  <div style="position:absolute;right:350px;top:90px;width:380px;height:720px;border-radius:50px;background:#0f172a;box-shadow:0 60px 120px rgba(0,0,0,.5)">
    <div style="position:absolute;inset:12px;border-radius:40px;overflow:hidden;background:#efe7dd;display:flex;flex-direction:column">
      <div style="height:78px;background:#075e54;display:flex;align-items:center;gap:12px;padding:0 18px"><div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#4f46e5,#ec4899)"></div><div><div style="color:#fff;font-weight:700;font-size:18px">Your Shop</div><div style="color:#b7e4dc;font-size:13px">online · AI assistant</div></div></div>
      <div style="flex:1;display:flex;flex-direction:column;gap:11px;padding:18px 14px">
        ${bubble("Namaste, ye kitne ka hai? 🙏", false, 250)}
        ${bubble("Namaste ji! Ye ₹1,499 ka hai, aaj delivery free. Kaunsa size chahiye?", true, 262)}
        ${bubble("Medium. Kal tak mil jayega?", false, 250)}
        ${bubble("Ji haan, kal shaam tak. Order pakka kar doon? ✅", true, 262)}
        ${bubble("Haan kar do 👍", false, 200)}
        <div style="align-self:flex-end;font-size:12px;color:#667781;margin-top:-4px">11:42 pm · answered by AI</div>
      </div>
    </div>
  </div>
  <div style="position:absolute;right:50px;top:150px;width:240px;padding:18px;border-radius:22px;background:#fff;box-shadow:0 30px 70px rgba(0,0,0,.35)">
    <div style="font-size:13px;font-weight:800;letter-spacing:.08em;color:#16a34a">NEW LEAD SAVED</div>
    <div style="margin-top:12px;display:flex;gap:10px;align-items:center"><div style="width:40px;height:40px;border-radius:50%;background:#dbeafe"></div><div>${bar(110, "#0f172a", 11)}<div style="height:7px"></div>${bar(80, "#94a3b8", 8)}</div></div>
    <div style="margin-top:14px;display:flex;gap:8px"><span style="padding:5px 10px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:12px;font-weight:700">Hot</span><span style="padding:5px 10px;border-radius:999px;background:#dcfce7;color:#166534;font-size:12px;font-weight:700">Order</span></div>
  </div>
  <div style="position:absolute;right:50px;top:400px;width:276px;height:350px;border-radius:24px;overflow:hidden;box-shadow:0 30px 70px rgba(0,0,0,.4);background:linear-gradient(160deg,#fb923c,#ec4899 55%,#7c3aed)">
    <div style="position:absolute;left:18px;top:16px;font-size:12px;font-weight:800;letter-spacing:.1em;color:rgba(255,255,255,.9)">TODAY'S POSTER</div>
    <div style="position:absolute;left:50%;top:92px;transform:translateX(-50%);width:120px;height:120px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff7,#fff1);border:3px solid rgba(255,255,255,.6)"></div>
    <div style="position:absolute;left:0;right:0;bottom:0;height:86px;background:rgba(15,23,42,.82);display:flex;align-items:center;gap:12px;padding:0 16px"><div style="width:44px;height:44px;border-radius:12px;background:#fff"></div><div>${bar(120, "#fff", 11)}<div style="height:8px"></div>${bar(86, "#fbbf24", 9)}</div></div>
  </div>
  <div style="position:absolute;right:700px;top:640px;padding:12px 18px;border-radius:16px;background:#fff;box-shadow:0 20px 50px rgba(0,0,0,.3);font-weight:700;color:#0f172a;font-size:17px">🌙 24×7 · even at night</div>
`, bg("rgba(16,185,129,.40)", "rgba(236,72,153,.30)", "linear-gradient(135deg,#052e2b 0%,#0b3d4f 45%,#27307a 100%)"));

// ---- five tools, one link — wide ----
const rows = [["#2563eb", "Digital V-Card", "Call, WhatsApp, save contact, UPI, map", "WEBSITE PLAN", "#1d4ed8", "#dbeafe"], ["#f59e0b", "Website", "Full website on the same link, on Google", "WEBSITE PLAN", "#1d4ed8", "#dbeafe"], ["#ec4899", "Leads saved", "Every enquiry from your card, in one list", "WEBSITE PLAN", "#1d4ed8", "#dbeafe"], ["#4f46e5", "AI assistant, 24×7", "Answers on your card and on WhatsApp", "GROWTH PLAN", "#7c3aed", "#ede9fe"], ["#db2777", "Daily poster + auto-post", "Made every morning, posted for you", "GROWTH PLAN", "#7c3aed", "#ede9fe"]];
const tools = `<!doctype html><html><body style="margin:0;width:1600px;height:900px;overflow:hidden;${font}"><div style="width:1600px;height:900px;display:flex;background:linear-gradient(135deg,#eef2ff,#e0e7ff)">
<div style="width:600px;padding:90px 0 0 80px;box-sizing:border-box;background:linear-gradient(160deg,#17154a,#2f2a8f);color:#fff">
  <div style="font-size:16px;font-weight:800;letter-spacing:.14em;color:#fbbf24">SHUBHORA</div>
  <div style="margin-top:22px;font-size:62px;line-height:1.05;font-weight:800;letter-spacing:-.02em">Five tools.<br>One link.</div>
  <div style="margin-top:34px;display:inline-block;padding:16px 26px;border-radius:999px;background:#fff;color:#17154a;font-size:23px;font-weight:700">shubhora.com/c/your-name</div>
  <div style="margin-top:150px;font-size:27px;font-weight:700">Website + V-Card from ₹2,999 a year</div>
  <div style="margin-top:10px;font-size:20px;color:#c7d2fe;line-height:1.4">Ready in 24 to 48 hours.<br>Growth Plan: ₹2,999 a month.</div>
</div>
<div style="flex:1;padding:70px 70px 0 60px;display:flex;flex-direction:column;gap:22px">
${rows.map(([c, t, s, b, bc, bb]) => `<div style="display:flex;align-items:center;gap:22px;padding:24px 28px;border-radius:26px;background:#fff;box-shadow:0 10px 30px rgba(30,27,75,.10)"><span style="width:62px;height:62px;border-radius:50%;background:${c};flex:none"></span><div style="flex:1"><div style="font-size:30px;font-weight:800;color:#0f172a">${t}</div><div style="margin-top:4px;font-size:20px;color:#475569">${s}</div></div><span style="padding:9px 16px;border-radius:999px;background:${bb};color:${bc};font-size:15px;font-weight:800;letter-spacing:.08em">${b}</span></div>`).join("")}
</div></div></body></html>`;

// ---- plan tiles: everything in the middle, so a wide or a tall crop both keep it ----
const plan = (g, kicker, price, per, name) => `<!doctype html><html><body style="margin:0;width:1000px;height:1000px;overflow:hidden;${font}"><div style="position:relative;width:1000px;height:1000px;background:${g};display:grid;place-items:center;color:#fff;text-align:center">
<div style="position:absolute;right:-140px;top:-140px;width:520px;height:520px;border-radius:50%;background:rgba(255,255,255,.10)"></div><div style="position:absolute;left:-160px;bottom:-200px;width:560px;height:560px;border-radius:50%;background:rgba(255,255,255,.07)"></div>
<div style="position:relative"><div style="font-size:30px;font-weight:800;letter-spacing:.14em;opacity:.85">${kicker}</div><div style="margin-top:22px;font-size:${price.length > 7 ? 120 : 170}px;font-weight:800;letter-spacing:-.03em;line-height:1">${price}</div><div style="margin-top:14px;font-size:40px;font-weight:600;opacity:.9">${per}</div><div style="margin-top:40px;display:inline-block;padding:14px 30px;border-radius:999px;background:rgba(255,255,255,.18);font-size:32px;font-weight:700">${name}</div></div></div></body></html>`;

const jobs = [
  ["hero-website.jpg", b2, 1600, 900], ["hero-ai.jpg", b3, 1600, 900], ["five-tools.jpg", tools, 1600, 900],
  ["tile-website-standard.jpg", plan("linear-gradient(135deg,#2563eb,#6366f1)", "WEBSITE STANDARD", "₹2,999", "a year", "Website + V-Card"), 1000, 1000],
  ["tile-website-premium.jpg", plan("linear-gradient(135deg,#7c3aed,#db2777)", "WEBSITE PREMIUM", "₹5,999", "a year", "Installs like an app"), 1000, 1000],
  ["tile-growth.jpg", plan("linear-gradient(135deg,#312e81,#6d28d9)", "GROWTH PLAN", "₹2,999", "a month", "Posters + AI + CRM"), 1000, 1000],
  ["tile-custom.jpg", plan("linear-gradient(135deg,#1f2937,#475569)", "CUSTOM SOLUTIONS", "On request", "built for you", "Any software"), 1000, 1000],
];
const br = await chromium.launch();
for (const [name, html, w, h] of jobs) { const p = await br.newPage({ viewport: { width: w, height: h } }); await p.setContent(html); await p.waitForTimeout(300); await p.screenshot({ path: name, type: "jpeg", quality: 88 }); await p.close(); }
await br.close(); console.log("done");
