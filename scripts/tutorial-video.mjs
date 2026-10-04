// Tutorial videos, made from the real app (owner's call, 4 Oct 2026: "website kaise banaye? Hindi me").
//
// A phone-sized Chrome walks through the app on the demo account while every tap, scroll and keystroke is recorded;
// a Hindi narrator (the same Gemini voice the ads use) speaks over it and the same words run as captions. One run
// gives two files: a phone video (9:16, for WhatsApp status / reels / Shorts) and a wide one (16:9, for YouTube).
// When the app changes, run it again and the video is new.
//
// Run on the VPS, from the app folder (reads .env.local there: Supabase, Gemini, CHROME_PATH, the site):
//   cd /opt/neuraledge/app && node scripts/tutorial-video.mjs website --user <demo account email>
//   … --out /opt/neuraledge/app/public/tutorials      where the mp4s go (default) → https://shubhora.com/tutorials/…
//   … --voice Charon                                    any Gemini prebuilt voice
//   … --no-reset                                        do not wipe the demo account first
//   … --compose <work dir>                              only put the video together again from an earlier recording
// The demo account is wiped (its own Reset) before the recording, so the video starts from a fresh account.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { setupFonts } from "../bridge/fonts-setup.mjs";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...process.env };
try {
  for (const l of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
} catch { /* env from the process */ }
const require = createRequire(path.join(APP, "package.json"));
const puppeteer = require("puppeteer-core");
const sharp = require("sharp");
setupFonts();

const args = process.argv.slice(2);
const flag = (k) => args.includes(k);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const WITH_VALUE = new Set(["--user", "--site", "--out", "--voice", "--compose"]);
const TUTORIAL = args.find((a, i) => !a.startsWith("--") && !WITH_VALUE.has(args[i - 1])) || "website";
const USER = opt("--user", "");
const SITE = (opt("--site", env.NEXT_PUBLIC_SITE_URL || "https://shubhora.com")).replace(/\/$/, "");
const OUT = opt("--out", path.join(APP, "public", "tutorials"));
const VOICE = opt("--voice", "Charon");
const COMPOSE_ONLY = opt("--compose", "");
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY, GEMINI = env.GEMINI_API_KEY;
const CHROME = env.CHROME_PATH || "/usr/bin/chromium-browser";
const TTS_MODEL = env.TTS_MODEL || "gemini-2.5-flash-preview-tts";
const FFMPEG = [env.WA_FFMPEG, "/opt/neuraledge/bin/ffmpeg", (() => { try { return require("ffmpeg-static"); } catch { return ""; } })(), "/usr/bin/ffmpeg"].find((f) => f && fs.existsSync(f)) || "ffmpeg";
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const CACHE = path.join(os.tmpdir(), "shubhora-tutorial", "tts-cache");
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/* ============================== the tutorials ============================== */
// Every scene: what the narrator says (Hindi, Devanagari — the TTS reads it as a native speaker) and what the
// phone does meanwhile. The clip lasts as long as the words, or longer when the screen needs it.
const TUTORIALS = {
  website: {
    title: "Website कैसे बनाएँ",
    subtitle: "Free website + digital card · 5 मिनट में",
    scenes: (u) => [
      { id: "intro", say: "नमस्ते! आज देखते हैं Shubhora पर अपनी free website और digital visiting card कैसे बनाएँ — सिर्फ़ पाँच मिनट में, बिना किसी designer के।",
        act: async () => { await u.goto(`${SITE}/`); await u.scrollBy(500, 2500); } },
      { id: "signup", say: "सबसे पहले shubhora.com खोलिए और Start free दबाइए। अपना नाम, mobile number, email और password भरिए, और Create my account दबाइए।",
        act: async () => {
          await u.tapThen("Start free", "Create", { timeout: 25000 }); await pause(600);
          await u.type('[placeholder="Ram Kumar"]', "Rajesh Sharma"); await u.type('[placeholder="9876543210"]', "9811122233");
          await u.type('[placeholder="you@example.com"]', "rajesh.sharma@gmail.com"); await u.type('[placeholder="At least 6 characters"]', "sharma@123");
          await pause(800);
        } },
      { id: "welcome", say: "Account बनते ही ये screen आती है — पाँच छोटे steps, और आपकी website तैयार। Start दबाइए।",
        between: async () => { await u.login(); await u.goto(`${SITE}/poster/welcome`); await u.waitText("Congratulations", 20000); },
        act: async () => { await pause(1800); await u.tapThen("Start (5 min)", "About you", { timeout: 25000 }); } },
      { id: "you", say: "पहला step — आपके बारे में। नाम और mobile पहले से भरे हैं। अपनी photo लगाइए, अपना शहर और घर का पता लिखिए, और Next दबाइए।",
        act: async () => {
          await pause(800); await u.type(u.afterLabel(/^Your city/), "Delhi"); await u.type(u.afterLabel(/^Residential address/), "12, Main Market, Lajpat Nagar");
          await pause(500); await u.tapThen("Next", "What is your card for?", { exact: true, timeout: 25000 });
        } },
      { id: "promote", say: "आपका card किस काम के लिए है? अपनी दुकान या काम के लिए 'Only my own business' चुनिए। Shubhora partner भी बनना हो तो 'Both' रहने दीजिए। फिर Continue।",
        act: async () => { await pause(1500); await u.tapText("Only my own business"); await pause(700); await u.tapThen("Continue", "Does your business have a website?", { timeout: 25000 }); } },
      { id: "site", say: "क्या आपकी पहले से कोई website है? है तो link डालिए — नाम, logo, products सब उसी से आ जाएँगे। नहीं है तो 'No website' चुनिए और Next दबाइए।",
        act: async () => { await pause(1500); await u.tapText("No website"); await pause(900); await u.tapThen("Next →", "Just three things", { timeout: 25000 }); } },
      { id: "business", say: "अब आपका business। नाम लिखिए — जैसे Sharma Medical Store; काम अपने आप पहचान लेता है, नहीं तो list से चुन लीजिए। शहर लिखिए। About में दो-चार शब्द लिखकर 'Write with AI' दबाइए — पूरा परिचय AI लिख देगा। फिर Save and continue।",
        act: async () => {
          await pause(600); await u.type(u.afterLabel(/name\b/i), "Sharma Medical Store"); await pause(900);
          if (!(await u.page.$eval('input[role="combobox"]', (el) => el.value))) { await u.tap('input[role="combobox"]'); await u.page.keyboard.type("medical", { delay: 70 }); await pause(900); await u.tap('[role="option"]'); }
          await u.type(u.afterLabel(/city/i), "Delhi");
          await u.type("#about", "दवाइयाँ, surgical सामान, 24 घंटे खुला"); await pause(300);
          await u.tapText("with AI"); await u.page.waitForFunction(() => (document.getElementById("about")?.value.length ?? 0) > 80, { timeout: 60000 });
          await pause(1500); await u.tapThen("Save and continue", "Skip —", { timeout: 45000 });
        } },
      { id: "products", say: "तीसरा step — products या services। हर product का नाम, दाम और photo डालिए; website इन्हीं से लिखी जाती है। अभी नहीं डालने हैं तो Skip दबाइए — बाद में कभी भी जोड़ सकते हैं।",
        act: async () => { await pause(1200); await u.scrollBy(300, 1500); await pause(400); await u.tapThen("Skip —", "Make my free website", { timeout: 35000 }); } },
      { id: "make", say: "और अब आख़िरी step — 'Make my free website' दबाइए। AI आपकी website और card लिखता है, photos चुनता है। इसमें एक से तीन मिनट लगते हैं।",
        act: async () => {
          await pause(1500);
          // pressed again if the first tap missed: the button is gone once the build has started
          for (let i = 0; i < 2; i++) {
            await u.tapText("Make my free website");
            try { await u.page.waitForFunction(() => !document.body.innerText.includes("Make my free website"), { timeout: 9000 }); break; } catch { if (i) throw new Error("the build did not start"); }
          }
          await pause(5000);
        },
        after: async () => { await u.waitText("Your website is ready", 360000); await pause(1500); } },
      { id: "preview", say: "लीजिए — आपकी website तैयार! ऊपर पाँच looks हैं — Designer, Classic, Bold, Elegant और Fresh। जो पसंद आए वो चुनिए; बाद में कभी भी बदल सकते हैं।",
        act: async () => { await pause(1500); await u.tapText("Classic"); await pause(2500); await u.tapText("Bold"); await pause(2500); await u.tapText("Designer"); await pause(1500); await u.scrollBy(500, 2000); await u.scrollBy(-500, 1500); } },
      { id: "save", say: "सब ठीक लगे तो Save दबाइए। बस — आपकी website और digital card live हैं, एक ही link पर।",
        act: async () => { await pause(800); await u.tapThen("Save", "Your website and card are live", { exact: true, timeout: 150000 }); await pause(2000); } },
      { id: "live", say: "ये रहा आपका link — shubhora.com और आगे आपका नाम। इसे WhatsApp पर भेजिए, status पर लगाइए, या QR code print करवाइए — customer को आपका पूरा business एक नज़र में दिखेगा।",
        act: async () => { const slug = await u.cardSlug(); await u.goto(`${SITE}/c/${slug}`); await pause(1500); await u.scrollBy(1400, 7000); await u.scrollBy(-1400, 2500); } },
      { id: "outro", say: "तो देर किस बात की — आज ही shubhora.com पर अपनी free website बनाइए। मिलते हैं अगले video में।",
        act: async () => { await u.goto(`${SITE}/`); await pause(1000); } },
    ],
  },
};

/* ============================== helpers: account ============================== */
async function findUser(handle) {
  const want = handle.trim().toLowerCase();
  const byId = async (id) => { const r = await fetch(`${SUPA}/auth/v1/admin/users/${id}`, { headers: H }); return r.ok ? r.json() : null; };
  // the account id, or the app username (Haryana, Next_Level …)
  if (/^[0-9a-f-]{36}$/.test(want)) { const u = await byId(want); if (u) return u; }
  if (!want.includes("@")) {
    const like = want.replace(/[\\%_]/g, (m) => `\\${m}`);
    const r = await fetch(`${SUPA}/rest/v1/profiles?username=ilike.${encodeURIComponent(like)}&select=id&limit=1`, { headers: H });
    const id = (await r.json().catch(() => []))?.[0]?.id;
    if (id) { const u = await byId(id); if (u) return u; }
  }
  for (let page = 1; page < 50; page++) {
    const r = await fetch(`${SUPA}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers: H });
    const j = await r.json();
    const list = j.users ?? [];
    // the login email, or (a mobile sign-up, whose login email is a placeholder) the contact email saved in the profile
    const u = list.find((x) => (x.email ?? "").toLowerCase() === want) ?? list.find((x) => String(x.user_metadata?.contact_email ?? "").toLowerCase() === want);
    if (u) return u;
    if (list.length < 1000) break;
  }
  throw new Error(`No account with the email, contact email or username "${handle}"`);
}
async function magicToken(email) {
  const r = await fetch(`${SUPA}/auth/v1/admin/generate_link`, { method: "POST", headers: H, body: JSON.stringify({ type: "magiclink", email }) });
  const j = await r.json();
  const t = j.hashed_token ?? j.properties?.hashed_token;
  if (!t) throw new Error(`could not make a login link: ${j.msg || j.error_description || r.status}`);
  return t;
}
async function bearerFor(email) {
  // straight to Supabase's verify endpoint: its JS client needs a WebSocket, which Node 20 (the server's) lacks
  const r = await fetch(`${SUPA}/auth/v1/verify`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ type: "magiclink", token_hash: await magicToken(email) }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`login failed: ${j.msg || j.error_description || r.status}`);
  return j.access_token;
}

/* ============================== helpers: voice ============================== */
const wavHeader = (n) => { const b = Buffer.alloc(44); b.write("RIFF", 0); b.writeUInt32LE(36 + n, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(24000, 24); b.writeUInt32LE(48000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n, 40); return b; };
async function tts(text) {
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, crypto.createHash("sha1").update(`${TTS_MODEL}|${VOICE}|${text}`).digest("hex") + ".wav");
  if (!fs.existsSync(file)) {
    if (!GEMINI) throw new Error("GEMINI_API_KEY missing");
    let b64 = "", why = "";
    for (let i = 0; i < 4 && !b64; i++) {
      if (i) await pause(1500);
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent`, {
        method: "POST", headers: { "x-goog-api-key": GEMINI, "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } } }),
        signal: AbortSignal.timeout(90000),
      }).catch((e) => ({ json: async () => ({ error: { message: e.message } }) }));
      const d = await r.json();
      b64 = d?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ?? "";
      why = d?.error ? JSON.stringify(d.error).slice(0, 160) : d?.candidates?.[0]?.finishReason || "no audio";
    }
    if (!b64) throw new Error(`TTS failed: ${why}`);
    const pcm = Buffer.from(b64, "base64");
    fs.writeFileSync(file, Buffer.concat([wavHeader(pcm.length), pcm]));
  }
  return { file, seconds: (fs.statSync(file).size - 44) / 48000 };
}

/* ============================== helpers: ffmpeg ============================== */
function ff(args, what) {
  const r = spawnSync(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", ...args], { encoding: "utf8", maxBuffer: 64 << 20 });
  if (r.status !== 0) throw new Error(`ffmpeg ${what} failed: ${(r.stderr || "").slice(-600)}`);
  return r;
}
/** Seconds and frame size of a clip (decoded through: puppeteer's webm carries no duration in its header). */
function probe(file) {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-i", file, "-f", "null", "-"], { encoding: "utf8", maxBuffer: 64 << 20 });
  const err = r.stderr || "";
  const t = [...err.matchAll(/time=(\d+):(\d+):(\d+\.?\d*)/g)].pop();
  const s = err.match(/Video:.*?(\d{2,5})x(\d{2,5})/);
  if (!t || !s) throw new Error(`could not read ${file}: ${err.slice(-300)}`);
  return { seconds: Number(t[1]) * 3600 + Number(t[2]) * 60 + Number(t[3]), w: Number(s[1]), h: Number(s[2]) };
}

/* ============================== helpers: pictures ============================== */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const FONT = "Mukta, Poppins, Noto Sans Devanagari, sans-serif";
function wrap(text, perLine) {
  const out = []; let line = "";
  for (const w of String(text).split(/\s+/).filter(Boolean)) {
    if (line && (line + " " + w).length > perLine) { out.push(line); line = w; } else line = line ? `${line} ${w}` : w;
  }
  if (line) out.push(line);
  return out;
}
/** A caption box: white words on a dark rounded panel, wrapped to the width. */
async function captionPng(file, text, { width, size }) {
  const perLine = Math.max(12, Math.floor((width - 72) / (size * 0.56)));
  const lines = wrap(text, perLine).slice(0, 5);
  const lh = Math.round(size * 1.42), padY = 26, padX = 36;
  const h = lines.length * lh + padY * 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}">
    <rect x="0" y="0" width="${width}" height="${h}" rx="26" fill="#0b1018" fill-opacity="0.84"/>
    ${lines.map((l, i) => `<text x="${width / 2}" y="${padY + lh * i + Math.round(size * 1.02)}" text-anchor="middle" font-family="${FONT}" font-size="${size}" font-weight="600" fill="#ffffff">${esc(l)}</text>`).join("")}
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(file);
  return { w: width, h };
}
/** The frame around the phone's screen: a dark rounded ring; its inner half hides the recording's square corners. */
async function framePng(file, W, H, box) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="40" fill="none" stroke="#0b0f14" stroke-width="30"/>
    <rect x="${box.x - 7}" y="${box.y - 7}" width="${box.w + 14}" height="${box.h + 14}" rx="46" fill="none" stroke="#2a3442" stroke-width="3"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(file);
}
/** The background: deep gradient, a brand glow, the logo, the title. */
async function backgroundPng(file, W, H, { title, subtitle, logo, titleAt, size }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#0f141c"/><stop offset="1" stop-color="#1b2533"/></linearGradient>
      <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#6d5dfc" stop-opacity="0.45"/><stop offset="1" stop-color="#6d5dfc" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <ellipse cx="${W * 0.5}" cy="${H * 0.5}" rx="${W * 0.7}" ry="${H * 0.5}" fill="url(#glow)"/>
    <text x="${titleAt.x}" y="${titleAt.y}" text-anchor="${titleAt.anchor}" font-family="${FONT}" font-size="${size}" font-weight="700" fill="#ffffff">${esc(title)}</text>
    <text x="${titleAt.x}" y="${titleAt.y + Math.round(size * 0.95)}" text-anchor="${titleAt.anchor}" font-family="${FONT}" font-size="${Math.round(size * 0.46)}" font-weight="500" fill="#ffffff" opacity="0.72">${esc(subtitle)}</text>
  </svg>`;
  const layers = [];
  const logoFile = path.join(APP, "public", "art", "brand", "shubhora-logo.png");
  if (fs.existsSync(logoFile)) {
    const lg = await sharp(logoFile).resize(logo.size, logo.size, { fit: "inside" }).png().toBuffer();
    layers.push({ input: lg, left: logo.x, top: logo.y });
  }
  await sharp(Buffer.from(svg)).composite(layers).png().toFile(file);
}

/* ============================== helpers: the phone ============================== */
export function ui(page, { work, email, uid }) {
  const u = { page };
  u.goto = async (url) => { await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 }); await pause(600); };
  u.waitText = (text, timeout = 15000) => page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text);
  /** The first visible element whose text has `text` (whole text when exact). */
  u.findText = async (text, { exact = false, sel = "button, a, [role='option'], label, summary" } = {}) => {
    const h = await page.evaluateHandle((t, ex, s) => {
      const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden"; };
      const all = [...document.querySelectorAll(s)].filter(vis);
      return all.find((el) => { const x = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim(); return ex ? x === t : x.includes(t); }) ?? null;
    }, text, exact, sel);
    const el = h.asElement();
    if (!el) throw new Error(`"${text}" not on screen`);
    return el;
  };
  u.afterLabel = (re) => async () => {
    const h = await page.evaluateHandle((src, flags) => {
      const r = new RegExp(src, flags);
      for (const l of document.querySelectorAll("label")) {
        const own = [...l.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" ").trim() || l.innerText.split("\n")[0];
        if (r.test(own.trim())) { const i = l.querySelector("input, textarea"); if (i) return i; }
      }
      return null;
    }, re.source, re.flags);
    const el = h.asElement();
    if (!el) throw new Error(`no field after label ${re}`);
    return el;
  };
  /** Waits until an element stops moving (a smooth scroll in progress), and returns its final box. A tap at a spot
   *  read while the page was still scrolling lands on whatever slid under it — on a long form the Save button was
   *  "pressed" on a label above it and the scene never moved on. */
  u.settle = async (el) => {
    let last = null, still = 0;
    for (let i = 0; i < 50; i++) {
      const b = await el.boundingBox();
      if (b && last && Math.abs(b.y - last.y) < 0.5 && Math.abs(b.x - last.x) < 0.5) { if (++still >= 3) return b; } else still = 0;
      last = b; await pause(100);
    }
    return last;
  };
  /** A tap the viewer can see: a ripple at the spot, then the touch. */
  u.tap = async (target, o) => {
    const el = typeof target === "function" ? await target() : typeof target === "string" ? await page.waitForSelector(target, { visible: true, timeout: 15000 }) : target;
    let b = null, x = 0, y = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      await el.evaluate((e, smooth) => e.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "instant" }), attempt === 0);
      b = await u.settle(el); if (!b) throw new Error("tap: element has no box");
      x = b.x + b.width / 2; y = b.y + Math.min(b.height / 2, 28);
      // is the element itself (or something inside it) at that spot, not a bar or label sitting over it?
      const hit = await el.evaluate((e, x, y) => { const t = document.elementFromPoint(x, y); return !!t && (e === t || e.contains(t) || t.contains(e)); }, x, y);
      if (hit) break;
    }
    await page.evaluate((x, y) => window.__ripple?.(x, y), x, y); await pause(180);
    await page.touchscreen.tap(x, y); await pause(o?.settle ?? 500);
  };
  u.tapText = async (text, o = {}) => u.tap(await u.findText(text, o), o);
  /** Taps a button and waits for what it should bring up; taps once more when nothing came (a tap that missed). */
  u.tapThen = async (text, expect, { timeout = 20000, tries = 2, ...o } = {}) => {
    for (let i = 0; i < tries; i++) {
      if (i && await page.evaluate((t) => document.body.innerText.includes(t), expect)) return;
      await u.tapText(text, o);
      try { await u.waitText(expect, i === tries - 1 ? timeout : Math.min(9000, timeout)); return; }
      catch (e) { if (i === tries - 1) throw e; }
    }
  };
  /** Taps a field and types into it, replacing whatever was in it (the city, for one, is filled from the home city). */
  u.type = async (target, text) => {
    await u.tap(target, { settle: 250 });
    await page.evaluate(() => { const a = document.activeElement; if (a && typeof a.select === "function") a.select(); });
    await page.keyboard.type(text, { delay: 55 }); await pause(350);
  };
  u.scrollBy = async (dy, ms) => { const steps = Math.max(4, Math.round(ms / 120)); for (let i = 0; i < steps; i++) { await page.evaluate((d) => window.scrollBy({ top: d, behavior: "auto" }), dy / steps); await pause(ms / steps); } };
  /** Signs the phone into the account through the app's own "Login as" page, then opens the app. */
  u.login = async () => {
    const t = await magicToken(email);
    await page.goto(`${SITE}/auth/as?t=${encodeURIComponent(t)}&n=${encodeURIComponent("Rajesh")}`, { waitUntil: "networkidle2", timeout: 60000 });
    await page.waitForFunction(() => !location.pathname.startsWith("/auth/"), { timeout: 30000 });
    await page.evaluate(() => { localStorage.removeItem("shubhora.admin.return"); }); // no "Back to admin" bar in the video
    await pause(500);
  };
  u.cardSlug = async () => {
    const r = await fetch(`${SUPA}/rest/v1/cards?owner_id=eq.${uid}&select=username&order=created_at.desc&limit=1`, { headers: H });
    const j = await r.json(); const slug = j?.[0]?.username; if (!slug) throw new Error("no card found after save"); return slug;
  };
  u.shot = async (name) => { try { await page.screenshot({ path: path.join(work, `${name}.png`) }); fs.writeFileSync(path.join(work, `${name}.txt`), await page.evaluate(() => document.body.innerText)); } catch { /* ignore */ } };
  return u;
}

/* ============================== record ============================== */
async function record(t, work) {
  if (!USER) throw new Error("--user <demo account: login email, contact email or username> is needed");
  for (const [k, v] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: SUPA, SUPABASE_SERVICE_ROLE_KEY: KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON, GEMINI_API_KEY: GEMINI })) if (!v) throw new Error(`${k} missing in .env.local`);
  if (!fs.existsSync(CHROME)) throw new Error(`Chrome not found at ${CHROME} (CHROME_PATH)`);
  const user = await findUser(USER);
  const LOGIN = user.email;   // what the account really signs in with (may differ from --user)
  log(`account ${LOGIN} (${user.id})`);
  if (!flag("--no-reset")) {
    const r = await fetch(`${SITE}/api/demo/reset`, { method: "POST", headers: { Authorization: `Bearer ${await bearerFor(LOGIN)}`, "Content-Type": "application/json" }, body: "{}" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok && r.status !== 207) throw new Error(`could not reset the demo account (${r.status}): ${j.error || ""} — mark it as the demo account in Super Admin → Users, or pass --no-reset`);
    log("demo account reset:", JSON.stringify(j.cleared ?? {}));
  }
  // The narration first, all at once: the clips are only as long as the words need.
  const scenes = t.scenes(null);
  const voices = await Promise.all(scenes.map((s) => tts(s.say)));
  log(`voice: ${scenes.length} lines, ${voices.reduce((a, v) => a + v.seconds, 0).toFixed(1)} s`);

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars", "--lang=en-IN", "--font-render-hinting=none", "--disable-gpu"] });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1");
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(() => {
    // the tap ripple, and nothing in the picture that a real owner would not see (the demo account's Reset pill)
    const css = document.createElement("style");
    css.textContent = `button[title^="Demo account"]{display:none!important} html{scroll-behavior:auto!important} *{caret-color:#6d5dfc}
      .__rp{position:fixed;z-index:2147483647;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;background:rgba(109,93,252,.45);border:2px solid rgba(109,93,252,.9);pointer-events:none;animation:__rp .55s ease-out forwards}
      @keyframes __rp{0%{transform:scale(.35);opacity:1}100%{transform:scale(1.4);opacity:0}}`;
    document.documentElement.appendChild(css);
    window.__ripple = (x, y) => { const d = document.createElement("div"); d.className = "__rp"; d.style.left = `${x}px`; d.style.top = `${y}px`; document.body.appendChild(d); setTimeout(() => d.remove(), 600); };
  });
  const u = ui(page, { work, email: LOGIN, uid: user.id });
  const done = [];
  try {
    for (const [i, s] of t.scenes(u).entries()) {
      if (s.between) { log(`${s.id}: preparing…`); await s.between(); }
      const clip = path.join(work, `${String(i + 1).padStart(2, "0")}-${s.id}.webm`);
      log(`${s.id}: recording (${voices[i].seconds.toFixed(1)} s of words)`);
      const rec = await page.screencast({ path: clip, ffmpegPath: FFMPEG });
      const t0 = Date.now();
      try { await s.act(); }
      catch (e) {
        await rec.stop().catch(() => undefined); await u.shot(`fail-${s.id}`);
        // what the screen said at that moment, in the error itself (first lines only)
        const seen = await page.evaluate(() => document.body.innerText.replace(/\s*\n\s*/g, " | ").slice(0, 420)).catch(() => "");
        const errs = await page.evaluate(() => [...document.querySelectorAll(".text-danger")].map((x) => x.innerText.trim()).filter(Boolean).join(" / ").slice(0, 300)).catch(() => "");
        throw new Error(`scene "${s.id}": ${e.message}\n  screen said: ${seen}${errs ? `\n  errors on screen: ${errs}` : ""}\n  (picture: ${work}/fail-${s.id}.png)`);
      }
      const left = voices[i].seconds * 1000 + 800 - (Date.now() - t0);
      if (left > 0) await pause(left);
      await rec.stop();
      done.push({ id: s.id, say: s.say, clip, wav: voices[i].file, saySec: voices[i].seconds });
      if (s.after) { log(`${s.id}: waiting…`); await s.after(); }
    }
  } finally { await browser.close().catch(() => undefined); }
  fs.writeFileSync(path.join(work, "scenes.json"), JSON.stringify({ tutorial: TUTORIAL, title: t.title, subtitle: t.subtitle, scenes: done }, null, 1));
  return done;
}

/* ============================== compose ============================== */
const LAYOUTS = {
  phone: { W: 1080, H: 1920, screen: { x: 212, y: 190, w: 656, h: 1420 }, cap: { width: 960, size: 42, x: 60, y: 1660 }, title: { x: 540, y: 112, anchor: "middle", size: 54 }, logo: { x: 40, y: 40, size: 72 } },
  wide: { W: 1920, H: 1080, screen: { x: 150, y: 70, w: 434, h: 940 }, cap: { width: 1100, size: 46, x: 700, y: 560 }, title: { x: 700, y: 300, anchor: "start", size: 76 }, logo: { x: 700, y: 120, size: 110 } },
};
async function compose(work, outDir) {
  const meta = JSON.parse(fs.readFileSync(path.join(work, "scenes.json"), "utf8"));
  const scenes = meta.scenes;
  // The clips' real lengths (the recorder's, not the stopwatch's), the captions' timing, one audio track.
  let at = 0; const pcm = [];
  for (const s of scenes) {
    const p = probe(s.clip); s.dur = p.seconds; s.start = at; at += p.seconds;
    const wav = fs.readFileSync(s.wav).subarray(44);
    const want = Math.round(p.seconds * 24000) * 2;
    pcm.push(wav.length >= want ? wav.subarray(0, want) : Buffer.concat([wav, Buffer.alloc(want - wav.length)]));
    // one caption per sentence, each on screen for its share of the spoken time; the last stays till the clip ends
    const parts = s.say.split(/(?<=[।!?.])\s+/).filter(Boolean);
    const chars = parts.reduce((a, x) => a + x.length, 0);
    let c = s.start; s.caps = parts.map((text, i) => { const d = (text.length / chars) * s.saySec; const cap = { text, from: c, to: i === parts.length - 1 ? s.start + s.dur : c + d }; c += d; return cap; });
  }
  const total = at;
  const audio = path.join(work, "voice.wav"); const body = Buffer.concat(pcm); fs.writeFileSync(audio, Buffer.concat([wavHeader(body.length), body]));
  const slug = meta.tutorial;
  fs.mkdirSync(outDir, { recursive: true });
  const outs = [];
  for (const [name, L] of Object.entries(LAYOUTS)) {
    const bg = path.join(work, `bg-${name}.png`), frame = path.join(work, `frame-${name}.png`);
    await backgroundPng(bg, L.W, L.H, { title: meta.title, subtitle: meta.subtitle, logo: L.logo, titleAt: L.title, size: L.title.size });
    await framePng(frame, L.W, L.H, L.screen);
    const caps = [];
    for (const [i, s] of scenes.entries()) for (const [j, c] of s.caps.entries()) {
      const file = path.join(work, `cap-${name}-${i}-${j}.png`);
      const size = await captionPng(file, c.text, L.cap);
      caps.push({ file, from: c.from, to: c.to, x: L.cap.x, y: L.cap.y, h: size.h });
    }
    const inputs = ["-i", bg, ...scenes.flatMap((s) => ["-i", s.clip]), "-i", frame, ...caps.flatMap((c) => ["-i", c.file]), "-i", audio];
    const n = scenes.length;
    let f = scenes.map((_, i) => `[${i + 1}:v]scale=${L.screen.w}:${L.screen.h}:flags=lanczos,fps=30,format=yuv420p,setsar=1[c${i}]`).join(";") + ";";
    f += scenes.map((_, i) => `[c${i}]`).join("") + `concat=n=${n}:v=1:a=0[scr];`;
    f += `[0:v][scr]overlay=${L.screen.x}:${L.screen.y}[v0];[v0][${n + 1}:v]overlay=0:0[v1]`;
    let last = "v1";
    caps.forEach((c, k) => { const idx = n + 2 + k; f += `;[${last}][${idx}:v]overlay=${c.x}:${c.y}:enable='between(t,${c.from.toFixed(2)},${c.to.toFixed(2)})'[v${k + 2}]`; last = `v${k + 2}`; });
    const out = path.join(outDir, `${slug}-${name}.mp4`);
    log(`${name}: ${L.W}x${L.H}, ${total.toFixed(1)} s, ${caps.length} captions → ${out}`);
    ff([...inputs, "-filter_complex", f, "-map", `[${last}]`, "-map", `${n + 2 + caps.length}:a`, "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", out], name);
    outs.push(out);
  }
  fs.writeFileSync(path.join(outDir, `${slug}.json`), JSON.stringify({ title: meta.title, seconds: Math.round(total), made: new Date().toISOString(), scenes: scenes.map((s) => ({ id: s.id, start: Math.round(s.start), say: s.say })) }, null, 1));
  return outs;
}

/* ============================== main ============================== */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) try {
  const t = TUTORIALS[TUTORIAL];
  if (!t) throw new Error(`unknown tutorial "${TUTORIAL}" — one of: ${Object.keys(TUTORIALS).join(", ")}`);
  let work = COMPOSE_ONLY;
  if (!work) {
    work = path.join(os.tmpdir(), "shubhora-tutorial", `${TUTORIAL}-${new Date().toISOString().replace(/[:.]/g, "-")}`);
    fs.mkdirSync(work, { recursive: true });
    log(`work: ${work}`);
    await record(t, work);
  }
  const outs = await compose(work, OUT);
  console.log("\ndone:");
  for (const o of outs) console.log(`  ${o}  →  ${SITE}/tutorials/${path.basename(o)}`);
  console.log(`\nTo change only the layout or captions: node scripts/tutorial-video.mjs ${TUTORIAL} --compose ${work}`);
} catch (e) {
  console.error("\nERROR:", e.message);
  process.exitCode = 1;
}
