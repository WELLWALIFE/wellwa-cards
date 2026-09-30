// Finishes the "Digital V-Card Seller" template with real material instead of placeholder art:
//   • 13 pictures (Gemini image, judged): who it is for (4), the product in use (6), the three plans (3)
//     → public/art/vcard/<name>.jpg, served at /api/stock/vcard/<name>.jpg
//   • 3 short explainer videos (those pictures with a slow zoom + a Hinglish AI voice-over + soft music, 16:9)
//     → public/demo/vcard-{what-is-it,ai-assistant,business-plan}.mp4 (+ -poster.jpg), served at /api/stock/demo/…
// Runs on the server (it has GEMINI_API_KEY, ffmpeg and the music beds):
//     ssh … root@148.72.247.91 'cd /opt/neuraledge/app && node scripts/gen-vcard-demo.mjs'
// Re-runs skip what exists; --force redoes everything, --only images|videos limits the work.
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";

const run = promisify(execFile);
const APP = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const env = { ...process.env };
try { for (const l of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !(m[1] in process.env)) env[m[1]] = m[2].replace(/^"|"$/g, ""); } } catch { /* process env */ }
process.env.GEMINI_API_KEY ||= env.GEMINI_API_KEY;
const KEY = env.GEMINI_API_KEY;
if (!KEY) { console.error("GEMINI_API_KEY missing"); process.exit(1); }
const G = "https://generativelanguage.googleapis.com/v1beta/models";
const IMAGE_MODEL = "gemini-2.5-flash-image", JUDGE = "gemini-3.5-flash-lite";
const FFMPEG = env.WA_FFMPEG || (fs.existsSync("/opt/neuraledge/bin/ffmpeg") ? "/opt/neuraledge/bin/ffmpeg" : "ffmpeg");
const ART = path.join(APP, "public", "art", "vcard"), DEMO = path.join(APP, "public", "demo"), TMP = path.join(APP, ".tmp-vcard");
for (const d of [ART, DEMO, TMP]) fs.mkdirSync(d, { recursive: true });
const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const ONLY = args[args.indexOf("--only") + 1] || "";

const BLUE = "#2f5bf5";
const STYLE = `Photorealistic, bright, modern, magazine-quality, natural daylight, shallow depth of field. Indian people and Indian settings. Phone and laptop screens show a colourful, clean, ABSTRACT app interface (soft blue ${BLUE}, magenta and orange accents, rounded cards, a round profile photo, icon buttons) with NO readable words, letters or numbers. Absolutely no text, logos, watermarks or captions anywhere in the picture.`;
const IMAGES = {
  // who it is for (carousel)
  "biz-shop": `A friendly Indian shopkeeper behind the counter of a bright general store, holding up his phone to a customer, the phone screen showing a digital business card app. ${STYLE}`,
  "biz-doctor": `A smiling Indian woman doctor in a white coat in a modern clinic, showing a patient her phone with a digital clinic card on screen. ${STYLE}`,
  "biz-agent": `An Indian real-estate or insurance agent in a smart shirt meeting a young couple at a cafe table, sharing his phone screen that shows a digital business card. ${STYLE}`,
  "biz-network": `A confident Indian woman in a bright home office, presenting on a phone and laptop to two friends, all smiling — direct-selling / network marketing meeting. ${STYLE}`,
  // the product in use (gallery + video scenes)
  "use-card": `Close-up of a hand holding a modern smartphone; on screen a beautiful digital visiting card: a banner photo, a round profile picture, colourful icon buttons and product tiles. Blurred shop interior behind. ${STYLE}`,
  "use-website": `A laptop on a wooden desk with a plant and a cup of chai; the laptop screen shows a clean, modern small-business website with a hero image, product cards and a contact section. ${STYLE}`,
  "use-chat": `A smartphone at night on a bedside table, screen glowing with a chat conversation of rounded message bubbles (no readable text), a small robot avatar, a sleeping person blurred in the background. ${STYLE}`,
  "use-share": `Two Indian friends at a tea stall, one showing the other a phone; the screen shows a messaging app with a card preview being shared, both smiling. ${STYLE}`,
  "use-crm": `A tablet and a phone on a desk showing a clean dashboard with a list of contact cards, avatars, green status dots and a small bar chart; a notebook and pen beside. ${STYLE}`,
  "use-poster": `A smartphone showing a colourful festive poster with diyas and marigolds (no text) next to a small printed QR stand on a shop counter with sweets in the background. ${STYLE}`,
  // plans (square, illustration)
  "plan-free": `Flat vector illustration, single centred object on a plain white background: a smartphone with a colourful digital visiting card on screen and a small gift ribbon, palette blue ${BLUE}, magenta, orange. Clean, minimal, no text.`,
  "plan-growth": `Flat vector illustration, single centred object on a plain white background: a smartphone and a laptop together with a small rising graph arrow and a chat bubble, palette blue ${BLUE}, magenta, orange. Clean, minimal, no text.`,
  "plan-pro": `Flat vector illustration, single centred object on a plain white background: three overlapping storefront cards with a small crown above and a team of three avatar circles, palette blue ${BLUE}, magenta, orange. Clean, minimal, no text.`,
};
const SQUARE = new Set(["plan-free", "plan-growth", "plan-pro"]);

async function image(prompt, aspect) {
  const r = await fetch(`${G}/${IMAGE_MODEL}:generateContent`, { method: "POST", headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: aspect } } }), signal: AbortSignal.timeout(120_000) });
  const d = await r.json().catch(() => null);
  if (d?.error) throw new Error(`${d.error.code} ${String(d.error.message).slice(0, 100)}`);
  const part = (d?.candidates?.[0]?.content?.parts ?? []).find((x) => x.inlineData?.data);
  return part ? Buffer.from(part.inlineData.data, "base64") : null;
}
async function ok(buf) {
  const small = await sharp(buf).resize(640).jpeg({ quality: 80 }).toBuffer();
  const r = await fetch(`${G}/${JUDGE}:generateContent`, { method: "POST", headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ inlineData: { mimeType: "image/jpeg", data: small.toString("base64") } }, { text: 'Marketing picture for an Indian digital-visiting-card product. Answer JSON {"ok":true|false,"why":"<6 words>"}: ok is false if there are readable words/letters/numbers (a few tiny unreadable UI squiggles are fine), visible brand logos, deformed hands or faces, or if it looks cheap.' }] }], generationConfig: { responseMimeType: "application/json", temperature: 0, maxOutputTokens: 60 } }), signal: AbortSignal.timeout(40_000) });
  const j = await r.json().catch(() => ({}));
  try { const v = JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}"); return { ok: v.ok !== false, why: v.why || "" }; } catch { return { ok: true, why: "" }; }
}

async function makeImages() {
  for (const [name, prompt] of Object.entries(IMAGES)) {
    const file = path.join(ART, `${name}.jpg`);
    if (fs.existsSync(file) && !FORCE) continue;
    let done = false;
    for (let a = 1; a <= 3 && !done; a++) {
      try {
        const buf = await image(prompt, SQUARE.has(name) ? "1:1" : "16:9");
        if (!buf) throw new Error("no image");
        const j = await ok(buf);
        if (!j.ok && a < 3) { console.log(`  ${name}: redo (${j.why})`); continue; }
        const s = sharp(buf);
        await (SQUARE.has(name) ? s.resize(1000, 1000, { fit: "cover" }) : s.resize(1600, 900, { fit: "cover", position: "attention" })).jpeg({ quality: 84, mozjpeg: true }).toFile(file);
        console.log(`✓ ${name}${j.ok ? "" : " (kept: " + j.why + ")"}`); done = true;
      } catch (e) { console.log(`  ${name}: ${e.message}`); if (/402|429|depleted/i.test(e.message)) await new Promise((r) => setTimeout(r, 10_000)); }
    }
  }
}

/* ---------------- videos ---------------- */
const VIDEOS = [
  { key: "vcard-what-is-it", scenes: ["use-card", "use-share", "use-website", "biz-shop", "use-poster"], music: "calm",
    text: "Namaste! Ye hai Shubhora Digital V-Card — aapka poora business, ek link par. Aapka naam, photo, products, daam, reviews, timing aur location — sab ek hi link me, jo kisi bhi phone par turant khulta hai, bina koi app ke. WhatsApp par ek tap me share karein, ya QR se scan karwayein. Number ya daam badla? Seconds me update. Aur haan — shuru karna bilkul free hai." },
  { key: "vcard-ai-assistant", scenes: ["use-chat", "use-crm", "biz-doctor", "use-card"], music: "soft",
    text: "Raat ke gyarah baje customer ne poocha — kya aap Sunday ko khule hain? Aap so rahe the, par aapke card ka AI assistant jaag raha tha. Usne aapke bataye details se jawab diya, customer ki apni bhasha me, aur poori baat-cheet aapke CRM me lead ban kar save ho gayi. Na koi banaya hua daam, na koi jhoothi baat — sirf wahi jo aapne bataya hai. Ye hai Growth plan ka AI assistant." },
  { key: "vcard-business-plan", scenes: ["biz-network", "biz-agent", "biz-shop", "use-share"], music: "upbeat",
    text: "Shubhora partner banne ka matlab — aap wahi card bechte hain jo aap abhi dekh rahe hain. Na stock, na delivery, na godaam — product ek link hai. Aapke aas-paas ki har dukaan, clinic aur agent ko iski zaroorat hai. Joining, pair value, capping aur har shart official plan document me likhi hai — pehle use padhein, phir faisla karein. Kamai ka koi vaada nahi — sirf likha hua plan, aapke saamne." },
];

async function makeVideos() {
  const { ttsVoice, MUSIC_DIR } = await import(`file://${path.join(APP, "bridge", "poster-video.mjs")}`);
  for (const v of VIDEOS) {
    const out = path.join(DEMO, `${v.key}.mp4`);
    if (fs.existsSync(out) && fs.statSync(out).size > 500_000 && !FORCE) continue;
    const scenes = v.scenes.map((s) => path.join(ART, `${s}.jpg`)).filter((f) => fs.existsSync(f));
    if (scenes.length < 2) { console.log(`  ${v.key}: pictures missing, skipped`); continue; }
    const wav = path.join(TMP, `${v.key}.wav`);
    let secs;
    try { secs = await ttsVoice(v.text, wav, "female", "hinglish"); } catch (e) { console.log(`  ${v.key}: voice failed — ${e.message}`); continue; }
    const total = secs + 1.6, per = total / scenes.length;
    // one clip per scene: slow zoom (zoompan), 1280×720, fade in/out
    const parts = [];
    for (const [i, img] of scenes.entries()) {
      const clip = path.join(TMP, `${v.key}-${i}.mp4`);
      const frames = Math.round(per * 30);
      const zoom = i % 2 ? `zoom='if(eq(on,1),1.12,zoom-0.0006)'` : `zoom='min(zoom+0.0006,1.12)'`;
      await run(FFMPEG, ["-y", "-loglevel", "error", "-loop", "1", "-i", img, "-vf", `scale=1920:1080,zoompan=${zoom}:d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1280x720:fps=30,fade=t=in:st=0:d=0.5,fade=t=out:st=${(per - 0.5).toFixed(2)}:d=0.5`, "-t", per.toFixed(2), "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p", clip], { timeout: 180_000 });
      parts.push(clip);
    }
    const list = path.join(TMP, `${v.key}.txt`);
    fs.writeFileSync(list, parts.map((p) => `file '${p}'`).join("\n"));
    const silent = path.join(TMP, `${v.key}-v.mp4`);
    await run(FFMPEG, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", silent], { timeout: 120_000 });
    const music = [v.music, "soft", "calm"].map((k) => path.join(MUSIC_DIR, `${k}.mp3`)).find((f) => fs.existsSync(f));
    const a = ["-y", "-loglevel", "error", "-i", silent, "-i", wav];
    if (music) a.push("-stream_loop", "-1", "-i", music);
    const filter = music
      ? `[1:a]adelay=600|600,volume=1.0[v];[2:a]volume=0.16,afade=t=out:st=${(total - 2).toFixed(2)}:d=2[m];[v][m]amix=inputs=2:duration=first:dropout_transition=2,atrim=0:${total.toFixed(2)}[a]`
      : `[1:a]adelay=600|600[a]`;
    await run(FFMPEG, [...a, "-filter_complex", filter, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", out], { timeout: 180_000 });
    await run(FFMPEG, ["-y", "-loglevel", "error", "-ss", "1", "-i", out, "-frames:v", "1", "-q:v", "3", path.join(DEMO, `${v.key}-poster.jpg`)], { timeout: 60_000 }).catch(() => {});
    console.log(`✓ ${v.key} (${total.toFixed(0)} s)`);
  }
}

if (ONLY !== "videos") await makeImages();
if (ONLY !== "images") await makeVideos();
fs.rmSync(TMP, { recursive: true, force: true });
console.log("done");
