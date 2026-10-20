// A 9:16 ad video for a given voice-over (owner, 20 Oct 2026: the ElevenLabs "Kanika" read of the ₹2,999 website ad). Every word
// of the script appears on screen the moment it is spoken, a real Shubhora website scrolls inside a frame while the voice talks
// about it, the card scrolls on a phone, feature chips pop in as they are named — a moving page, not slides (owner: "aise lage
// jaise chalti-firti website ho"). Frames are drawn by Chromium from one HTML page whose state is a pure function of time
// (render(t)), then ffmpeg joins them under the voice. Run on the VPS:  node scripts/ad-video.mjs /tmp/kanika.mp3 /tmp/ad.mp4
import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module"; import { execFileSync } from "node:child_process";
const APP = "/opt/neuraledge/app"; const env = {};
for (const l of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const require = createRequire(path.join(APP, "package.json")); const puppeteer = require("puppeteer-core");
const [AUDIO, OUT] = [process.argv[2] || "/tmp/kanika.mp3", process.argv[3] || "/tmp/ad.mp4"];
const FFMPEG = env.FFMPEG_PATH || "/opt/neuraledge/bin/ffmpeg";
const WORK = "/tmp/ad-work"; fs.rmSync(WORK, { recursive: true, force: true }); fs.mkdirSync(WORK, { recursive: true });
const SITE = "https://shubhora.com";
const FONTS = path.join(APP, "bridge", "fonts");
const pool = JSON.parse(fs.readFileSync(path.join(APP, "public/poster/base/stock/card/kirana-v4.json"), "utf8")).photos.map((p) => path.join(APP, "public/poster/base/stock/card", path.basename(p.url)));
const logo = path.join(APP, "public/art/brand/shubhora-logo.png");
const b64 = (f, mime) => `data:${mime};base64,${fs.readFileSync(f).toString("base64")}`;
const FPS = 25, LEN = 35.0, HOLD = 1.2; // the cover is held HOLD s at the start, the voice begins after it

// The voice, phrase by phrase: [start, end, text] from the pauses ffmpeg found in the recording (silencedetect −32 dB);
// the words of a phrase are spread over it by their length.
const SEG = [
  [0.00, 1.71, "20 से 25,000 नहीं,"], [2.07, 3.63, "10 से 15,000 नहीं,"], [3.96, 5.58, "5 से 10,000 भी नहीं,"],
  [5.94, 8.68, "अब सिर्फ़ ₹2,999 में"], [8.87, 11.93, "पूरे साल भर के लिए बनवाएं अपनी Professional Website,"], [12.17, 13.74, "वो भी सिर्फ़ 5 मिनट में।"],
  [14.07, 16.39, "साथ में Digital Card भी बिल्कुल FREE!"], [16.80, 17.48, "इतना ही नहीं,"], [17.87, 21.08, "पहले महीने ये सभी Advanced Features बिल्कुल FREE पाएं।"],
  [21.47, 24.88, "WhatsApp AI Assistant, रोज़ नए Social Media Posters,"], [25.08, 27.17, "Meta Ads और AI Ad Studio,"], [27.43, 29.41, "12 भारतीय भाषाओं का Support!"],
  [29.79, 32.33, "आज ही अपनी दुकान या Business को Online लाएं।"], [32.70, 33.47, "अभी शुरू करें,"], [33.72, 34.80, "Shubhora.com"],
];
const timed = SEG.map(([s, e, text]) => { const ws = text.split(" "); const tot = ws.reduce((a, w) => a + w.length + 1, 0); let t = s; return ws.map((w) => { const d = (e - s) * (w.length + 1) / tot; const o = { w, s: t }; t += d; return o; }); });
const CLS = { "₹2,999": "big", "FREE!": "free", "FREE": "free", "Shubhora.com": "url" };
const words = (i, from = 0, to = 99) => timed[i].slice(from, to).map(({ w, s }) => `<span class="w ${/^[A-Za-z0-9₹,.!]+$/.test(w) ? "lat" : ""} ${CLS[w] ?? ""}" data-s="${s.toFixed(2)}">${w}</span>`).join(" ");

const browser = await puppeteer.launch({ executablePath: env.CHROME_PATH || "/usr/bin/chromium-browser", headless: true, protocolTimeout: 180000, args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--font-render-hinting=none"] });
// 1. Real pages, full length, so they can scroll: the released kirana template's website and its card (preview header taken off).
const TPL = "kirana-quick-order"; const shots = {};
const tryShot = async (name, url, vp, maxH, prep) => {
  const p = await browser.newPage(); await p.setViewport(vp);
  try { const r = await p.goto(url, { waitUntil: "networkidle2", timeout: 60000 }); if (!r || r.status() >= 400) throw new Error(String(r?.status()));
    if (prep) await p.evaluate(prep); await p.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); }); await new Promise((x) => setTimeout(x, 2500));
    const h = Math.min(maxH, await p.evaluate(() => document.documentElement.scrollHeight));
    const f = path.join(WORK, `${name}.png`); await p.screenshot({ path: f, clip: { x: 0, y: 0, width: vp.width, height: h }, captureBeyondViewport: true }); shots[name] = { f, h }; console.log("shot", name, h); }
  catch (e) { console.log("no shot", name, url, String(e).slice(0, 80)); } finally { await p.close(); }
};
await tryShot("site", `${SITE}/templates/${TPL}/site`, { width: 1280, height: 800, deviceScaleFactor: 1 }, 3400);
await tryShot("card", `${SITE}/templates/${TPL}`, { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 2200,
  () => { document.querySelector("h1")?.closest(".mb-5")?.remove(); window.scrollTo(0, 0); });
if (!shots.site || !shots.card) { await browser.close(); throw new Error("page shots missing"); }

// 2. One page; render(t) sets everything for the time t.
const css = `
@font-face{font-family:M;src:url(${b64(path.join(FONTS, "mukta-devanagari-800-normal.ttf"), "font/ttf")});font-weight:800}
@font-face{font-family:M;src:url(${b64(path.join(FONTS, "mukta-devanagari-500-normal.ttf"), "font/ttf")});font-weight:500}
@font-face{font-family:B;src:url(${b64(path.join(FONTS, "baloo-2-latin-800-normal.ttf"), "font/ttf")});font-weight:800}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden;font-family:M,B,sans-serif;color:#fff;background:#0b0e33}
.bg{position:absolute;inset:0;background-size:cover;background-position:center;filter:brightness(.5) saturate(1.1)}
.shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,14,51,.4) 0%,rgba(11,14,51,.8) 55%,rgba(11,14,51,.96) 100%)}
.brand{position:absolute;top:84px;left:84px;display:flex;align-items:center;gap:18px;font-family:B;font-weight:800;font-size:44px}
.brand img{height:64px}
.scene{position:absolute;inset:0;padding:120px 84px;display:flex;flex-direction:column;justify-content:center;gap:34px;opacity:0}
.w{display:inline-block;opacity:0;transform:translateY(22px)}
.lat{font-family:B}
h1,h2{font-weight:800;font-size:82px;line-height:1.18}
h2{font-size:66px}
.no{font-family:B;font-weight:800;font-size:100px;line-height:1.2;position:relative;display:inline-block;align-self:flex-start;color:rgba(255,255,255,.92)}
.no i{position:absolute;left:-4%;right:-4%;top:50%;height:12px;background:#ff5a5a;border-radius:6px;transform:scaleX(0);transform-origin:left}
.big{font-family:B;font-size:170px;line-height:1;color:#ffd54a;display:inline-block;margin:6px 16px 10px 0;vertical-align:-8px}
.free{font-family:B;font-size:130px;line-height:1;color:#ffd54a;display:inline-block;margin:8px 14px 0 0;vertical-align:-6px}
.pill{display:inline-block;align-self:flex-start;background:#ffd54a;color:#12144a;font-weight:800;font-size:44px;padding:14px 34px;border-radius:999px;opacity:0}
.pill .w{opacity:1;transform:none}
.sub{font-weight:500;font-size:46px;line-height:1.35;color:rgba(255,255,255,.9)}
.frame{position:absolute;left:84px;width:912px;height:590px;border-radius:26px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.55);border:6px solid rgba(255,255,255,.14);background:#fff;opacity:0}
.frame img{display:block;width:900px}
.phone{position:absolute;right:84px;top:470px;width:400px;height:820px;border-radius:44px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.6);border:10px solid #1b1d3a;background:#fff;opacity:0}
.phone img{display:block;width:380px}
.chips{display:flex;flex-direction:column;gap:22px;margin-top:14px}
.chip{display:flex;align-items:center;gap:22px;font-weight:600;font-size:50px;background:rgba(255,255,255,.1);border:2px solid rgba(255,255,255,.18);border-radius:28px;padding:22px 30px;opacity:0;transform:translateX(-30px)}
.chip i{flex:none;width:56px;height:56px;border-radius:50%;background:#25d366;display:grid;place-items:center;font-style:normal;font-size:34px}
.url{font-family:B;font-weight:800;font-size:96px;color:#ffd54a;letter-spacing:1px}
.url .w{display:inline}
.foot{position:absolute;bottom:90px;left:84px;right:84px;text-align:center;font-weight:500;font-size:34px;color:rgba(255,255,255,.7)}
`;
const brand = `<div class="brand"><img src="${b64(logo, "image/png")}"> Shubhora</div>`;
const bgs = [0, 1, 2, 3, 4].map((i) => b64(pool[i % pool.length], "image/jpeg"));
const scenes = [
  // A 0–5.94: the prices one does not need
  { s: 0, e: 5.94, html: `<div class="no">${words(0)}<i data-s="1.3"></i></div><div class="no">${words(1)}<i data-s="3.3"></i></div><div class="no">${words(2)}<i data-s="5.2"></i></div>` },
  // B 5.94–14.07: ₹2,999, the website scrolling
  { s: 5.94, e: 14.07, style: "justify-content:flex-start;padding-top:230px", html: `<span class="pill" data-s="5.94">${words(3, 0, 2)}</span><h1>${words(3, 2)}</h1><h2 style="margin-top:-6px">${words(4)}</h2><div style="height:640px"></div><p class="sub">${words(5)}</p>`,
    extra: `<div class="frame" id="site" data-s="8.6" data-e="14.07" style="top:775px"><img src="${b64(shots.site.f, "image/png")}"></div>` },
  // C 14.07–16.8: digital card free, the card scrolling on a phone
  { s: 14.07, e: 16.8, html: `<div style="width:520px"><h1>${words(6, 0, 5)}</h1><h1 style="margin-top:6px">${words(6, 5)}</h1></div>`,
    extra: `<div class="phone" id="card" data-s="14.07" data-e="16.8"><img src="${b64(shots.card.f, "image/png")}"></div>` },
  // D 16.8–29.79: first month free, the features named one by one
  { s: 16.8, e: 29.79, html: `<p class="sub" style="font-weight:800">${words(7)}</p><h2>${words(8)}</h2><div class="chips">
      <div class="chip" data-s="21.47"><i>✓</i><span>${words(9, 0, 3)}</span></div><div class="chip" data-s="23.1"><i>✓</i><span>${words(9, 3)}</span></div>
      <div class="chip" data-s="25.08"><i>✓</i><span>${words(10)}</span></div><div class="chip" data-s="27.43"><i>✓</i><span>${words(11)}</span></div></div>` },
  // E 29.79–35: the call
  { s: 29.79, e: 35.5, html: `<div style="text-align:center"><h1>${words(12)}</h1><p class="sub" style="margin-top:30px">${words(13)}</p><div class="url" style="margin-top:20px">${words(14)}</div></div>`,
    extra: `<p class="foot w" data-s="33.9" data-e="35.5" style="display:block">Website · Digital Card · WhatsApp AI · Daily Posters</p>` },
];
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
<div class="bg" id="bgA"></div><div class="bg" id="bgB"></div><div class="shade"></div>
${scenes.map((sc, i) => `<div class="scene" id="sc${i}" style="${sc.style ?? ""}">${sc.html}</div>${sc.extra ?? ""}`).join("")}${brand}
<script>
const BGS=${JSON.stringify(bgs)}, SC=${JSON.stringify(scenes.map((s) => [s.s, s.e]))}, SITE_H=${shots.site.h * 900 / 1280}, CARD_H=${shots.card.h * 380 / 390};
const cl=(x)=>Math.max(0,Math.min(1,x)), ease=(x)=>1-Math.pow(1-cl(x),3);
window.render=(t)=>{
  let cur=SC.findIndex(([s,e])=>t>=s&&t<e); if(cur<0) cur=SC.length-1;
  // background: the scene's photo, cross-faded over the first 0.6 s of the scene
  const f=ease((t-SC[cur][0])/0.6);
  bgA.style.backgroundImage='url('+BGS[Math.max(0,cur-1)]+')'; bgB.style.backgroundImage='url('+BGS[cur]+')'; bgB.style.opacity=cur===0?1:f;
  SC.forEach(([s,e],i)=>{ const el=document.getElementById('sc'+i); const a=ease((t-s)/0.35), b=1-ease((t-(e-0.3))/0.3); el.style.opacity=t>=s&&t<e+0.3?Math.min(a,b):0; el.style.transform='translateY('+((1-a)*30)+'px)'; });
  document.querySelectorAll('.w').forEach((w)=>{ const p=ease((t-+w.dataset.s)/0.26); w.style.opacity=p; w.style.transform='translateY('+((1-p)*22)+'px) scale('+(0.92+0.08*p)+')'; });
  document.querySelectorAll('.pill,.frame,.phone').forEach((el)=>{ const p=ease((t-+el.dataset.s)/0.45), b=el.dataset.e?1-ease((t-(+el.dataset.e-0.3))/0.3):1; el.style.opacity=Math.min(p,b); el.style.transform='translateY('+((1-p)*60)+'px)'; });
  document.querySelectorAll('.no i').forEach((i)=>{ i.style.transform='scaleX('+ease((t-+i.dataset.s)/0.3)+')'; });
  document.querySelectorAll('.chip').forEach((c)=>{ const p=ease((t-+c.dataset.s)/0.35); c.style.opacity=p; c.style.transform='translateX('+((1-p)*-30)+'px)'; });
  // the website scrolls while the voice talks about it (9.2 → 14 s), the card scrolls on the phone (14.5 → 16.8 s)
  site.firstElementChild.style.transform='translateY(-'+Math.min(SITE_H-590, 1300, Math.max(0,t-9.2)*200)+'px)';
  card.firstElementChild.style.transform='translateY(-'+Math.min(CARD_H-800, Math.max(0,t-14.5)*260)+'px)';
};
</script></body></html>`;
fs.writeFileSync(path.join(WORK, "ad.html"), html);
const page = await browser.newPage(); await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "load" }); await page.evaluate(() => document.fonts.ready);
const N = Math.round(LEN * FPS);
for (let i = 0; i < N; i++) {
  await page.evaluate((t) => window.render(t), i / FPS);
  await page.screenshot({ path: path.join(WORK, `f${String(i + Math.round(HOLD * FPS)).padStart(4, "0")}.jpg`), type: "jpeg", quality: 92 });
  if (i % 100 === 0) console.log("frame", i, "/", N);
}
// The thumbnail (cover): the ₹2,999 scene with the website at its top, plus the FREE card line — also embedded in the mp4 as cover art.
await page.evaluate(() => { window.render(13.7); site.firstElementChild.style.transform = "translateY(0)"; });
const THUMB = path.join(WORK, "thumb.jpg"); await page.screenshot({ path: THUMB, type: "jpeg", quality: 94 });
for (let i = 0; i < Math.round(HOLD * FPS); i++) fs.copyFileSync(THUMB, path.join(WORK, `f${String(i).padStart(4, "0")}.jpg`));
await browser.close();

// 3. ffmpeg: the frames at 25 fps under the voice, H.264.
execFileSync("nice", ["-n", "10", FFMPEG, "-y", "-framerate", String(FPS), "-i", path.join(WORK, "f%04d.jpg"), "-i", AUDIO, "-i", THUMB, "-map", "0:v", "-map", "1:a", "-map", "2:v", "-c:v:0", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt:v:0", "yuv420p", "-c:v:1", "mjpeg", "-disposition:v:1", "attached_pic", "-af", `adelay=${Math.round(HOLD * 1000)}:all=1`, "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", OUT], { stdio: ["ignore", "ignore", "inherit"] });
fs.copyFileSync(THUMB, OUT.replace(/\.mp4$/, "-thumb.jpg"));
console.log("done", OUT, fs.statSync(OUT).size, "bytes;", N, "frames; thumb", OUT.replace(/\.mp4$/, "-thumb.jpg"));
