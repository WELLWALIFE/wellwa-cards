// Realistic ad video: Gemini product-scene images (real product + logo as
// references) → Kling 2.5 Turbo Pro image-to-video on fal.ai (start frame =
// our image, so the product stays exact) → captions/CTA cards → ffmpeg.
//   ₹ ≈ 4/scene image + ≈45/5-sec clip → 3 scenes ≈ ₹150 per 30-sec ad.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { FORMATS } from "./ad-engine.mjs";
import { FPS, SAFE, INTERMEDIATE, DELIVERY_V, DELIVERY_A, MASTER_AF, DUCK, MUSIC_VOL, MUSIC_SOLO } from "./caption-engine.mjs";

const FAL = "https://queue.fal.run";
// Gemini's aspect-ratio string per format — Kling image-to-video has no
// separate ratio param, it inherits the input image's aspect automatically.
const GEMINI_RATIO = { reel: "9:16", square: "1:1", wide: "16:9" };
const KLING = "fal-ai/kling-video/v2.5-turbo/pro/image-to-video";
const IMG_MODEL = process.env.IMG_MODEL || "gemini-3.1-flash-lite-image"; // the lite image model everywhere (owner, 4 Oct 2026)

// NOTE: there used to be a SHOTS table of six hardcoded water-ionizer briefs
// picked by hashing the product name whenever a scene had no `visual`. A tailor
// or a coaching class got water footage described to the video model. Every
// scene must now carry its own `visual` from the planner — no fallback.

const b64 = (buf, mime = "image/png") => `data:${mime};base64,${buf.toString("base64")}`;

export async function sceneImage({ gemini, photo, photos = [], logo, brief, ratio = "9:16" }) {
  const img = (buf, mime) => ({ inlineData: { mimeType: mime, data: buf.toString("base64") } });
  const refs = [photo, ...photos.filter((p) => p !== photo)].filter(Boolean).slice(0, 3);
  const parts = refs.map((b) => img(b, "image/png")); if (logo) parts.push(img(logo, "image/png"));
  const prompt = `Photorealistic advertising still (${ratio}) featuring the product shown in the first ${refs.length} reference image${refs.length > 1 ? "s (same product, different angles)" : ""}${logo ? " and the brand logo from the LAST reference image small in a corner" : ""}. STRICT: the product must look EXACTLY like the reference — same shape, colours, panel, buttons, hose; one unit only. Scene: ${brief}. ALL PEOPLE ARE INDIAN (South Asian features, Indian clothing/home). Natural skin, realistic lighting, 35mm photo look. ABSOLUTELY NO TEXT, letters, numbers, captions or watermarks anywhere.`;
  for (let t = 0; t < 2; t++) {
    const j = await gemini(IMG_MODEL, { contents: [{ parts: [...parts, { text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: ratio } } });
    const p = (j.candidates?.[0]?.content?.parts ?? []).find((x) => x.inlineData?.data);
    if (p) return Buffer.from(p.inlineData.data, "base64");
  }
  throw new Error("scene image failed");
}

/** Kling I2V via fal queue. Returns the mp4 URL. duration "5" | "10". */
export async function klingClip({ falKey, imageBuf, prompt, duration = "5", log = () => {} }) {
  const headers = { Authorization: `Key ${falKey}`, "Content-Type": "application/json" };
  const sub = await fetch(`${FAL}/${KLING}`, { method: "POST", headers, body: JSON.stringify({ image_url: b64(imageBuf), prompt, duration, negative_prompt: "blur, distort, low quality, text, watermark, extra product, deformed hands", cfg_scale: 0.5 }) });
  const sj = await sub.json().catch(() => ({}));
  if (!sub.ok || !sj.request_id) throw new Error("fal submit: " + JSON.stringify(sj).slice(0, 200));
  const statusUrl = sj.status_url || `${FAL}/${KLING}/requests/${sj.request_id}/status`;
  const resultUrl = sj.response_url || `${FAL}/${KLING}/requests/${sj.request_id}`;
  const t0 = Date.now();
  while (Date.now() - t0 < 12 * 60_000) {
    await new Promise((r) => setTimeout(r, 6000));
    const st = await fetch(statusUrl, { headers }).then((r) => r.json()).catch(() => ({}));
    log(`kling ${sj.request_id.slice(0, 8)} ${st.status}${st.queue_position != null ? " q" + st.queue_position : ""}`);
    if (st.status === "COMPLETED") { const res = await fetch(resultUrl, { headers }).then((r) => r.json()); const url = res.video?.url; if (!url) throw new Error("fal: no video"); return url; }
    if (st.status === "FAILED" || st.status === "ERROR") throw new Error("fal failed: " + JSON.stringify(st).slice(0, 200));
  }
  throw new Error("fal timeout");
}

/**
 * Caption overlay PNG (transparent) for one clip: line at bottom + brand chip.
 * Both sit inside the platform safe area: the chip clears the WhatsApp Status
 * progress bar and sender name, the caption clears the Reels username strip.
 */
export async function captionOverlay(file, { W, H, text, brand, card = "", bottom }) {
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const DEV = "Noto Sans Devanagari, Noto Sans Gujarati, Noto Sans Gurmukhi, Noto Sans Bengali, Noto Sans Tamil, Noto Sans Telugu, Noto Sans Kannada, Noto Sans Malayalam, Noto Sans Oriya, Liberation Sans, DejaVu Sans, sans-serif";
  const words = String(text).split(/\s+/); const lines = []; let cur = "";
  for (const w of words) { if ((cur + " " + w).trim().length > 28 && cur) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim(); } if (cur) lines.push(cur);
  const hasText = String(text ?? "").trim().length > 0;
  // 22% of a vertical frame is Reels chrome; on square/wide only the Status reply box matters.
  const inset = bottom ?? (H > W ? SAFE.bottomReel(H) : SAFE.bottomStatus(H));
  const chipY = SAFE.top(H);
  const chipX = SAFE.side(W);
  const fs_ = Math.round(W * 0.052), lh = fs_ * 1.3, boxH = lines.length * lh + 36, y0 = H - boxH - inset;
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  ${brand ? `<rect x="${chipX}" y="${chipY}" rx="18" width="${Math.min(W * 0.6, brand.length * fs_ * 0.62 + 40)}" height="${fs_ + 22}" fill="#000" fill-opacity="0.35"/><text x="${chipX + 20}" y="${chipY + fs_ + 2}" font-family="${DEV}" font-size="${fs_ * 0.8}" font-weight="700" fill="#fff">${esc(brand)}</text>` : ""}
  ${hasText ? `<rect x="${W * 0.06}" y="${y0}" rx="22" width="${W * 0.88}" height="${boxH}" fill="#000" fill-opacity="0.45"/>` : ""}
  ${!hasText ? "" : lines.map((l, i) => `<text x="${W / 2}" y="${y0 + 18 + (i + 1) * lh - lh * 0.3}" text-anchor="middle" font-family="${DEV}" font-size="${fs_}" font-weight="700" fill="#fff">${esc(l)}</text>`).join("")}
  ${card ? (() => { const c = String(card).trim(); const cf = Math.round(W * 0.06); const cw = Math.min(W * 0.9, c.length * cf * 0.6 + 56); const cy = Math.round(H * 0.2); return `<rect x="${(W - cw) / 2}" y="${cy - cf}" rx="${cf * 0.4}" width="${cw}" height="${cf * 1.7}" fill="#ffffff" fill-opacity="0.92"/><text x="${W / 2}" y="${cy + cf * 0.22}" text-anchor="middle" font-family="${DEV}" font-size="${cf}" font-weight="800" fill="#0f172a">${esc(c)}</text>`; })() : ""}
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(file);
}

/**
 * Full realistic ad (any of reel 9:16 / square 1:1 / wide 16:9): scenes →
 * Kling clips (generated natively in that ratio) → captions → CTA card →
 * voice + music. helpers: { ffmpeg, gemini, falKey, renderScene }.
 * voLines: [{text, sec}] one per scene (+1 for CTA). Returns mp4 path.
 */
export async function renderRealisticAd(dir, inp, assets, helpers, voLines, log = () => {}, fmt = "reel") {
  const { w: W, h: H } = FORMATS[fmt] ?? FORMATS.reel;
  const ratio = GEMINI_RATIO[fmt] ?? "9:16";
  const v2 = inp.__v2 ?? null; // pipeline 2: stills + raw clips are already in `dir`; scene lengths follow the voice
  const withVisual = voLines.filter((l) => l?.visual).length;
  if (!v2 && !withVisual) throw new Error("no storyboard: every scene needs its own visual");
  const nClips = v2 ? v2.slots.length : Math.min(6, withVisual);
  // Each scene describes ITSELF. A scene with no `visual` used to fall back to a
  // hardcoded water-ionizer brief, so any business could get water footage.
  const shots = Array.from({ length: nClips }, (_, i) => {
    const vis = voLines[i]?.visual;
    if (vis) return { img: vis, motion: voLines[i].motion || "slow cinematic push-in, natural motion, product stays sharp" };
    if (v2) return { img: "", motion: "" }; // pipeline 2 already has the clip on disk — nothing is generated from this
    throw new Error(`no storyboard: scene ${i + 1} has no visual`);
  });
  // Scene images + Kling clips run in parallel (3 at a time) — each Kling clip
  // takes 3-5 min on the fal queue, so running them one by one made a 5-scene
  // ad take 20-25 min. Overlays are quick and stay sequential.
  const all = assets.photos?.length ? assets.photos : [assets.photo];
  const rawOf = (i) => path.join(dir, `clip-${i}-${fmt}-raw.mp4`);
  async function makeRaw(i) {
    if (v2) { if (!fs.existsSync(rawOf(i))) throw new Error(`clip ${i} missing`); return; }
    const imgFile = path.join(dir, `scene-${i}-${fmt}.png`);
    // cached across variations of the same job (same scenes, different words/music)
    let img;
    if (fs.existsSync(imgFile)) { img = fs.readFileSync(imgFile); log(`scene ${i} image cached`); }
    else { img = await sceneImage({ gemini: helpers.gemini, photo: all[i % all.length], photos: all, logo: assets.logo, brief: shots[i].img, ratio }); fs.writeFileSync(imgFile, img); log(`scene ${i} image ok`); }
    if (fs.existsSync(rawOf(i))) { log(`clip ${i} cached`); return; }
    const url = await klingClip({ falKey: helpers.falKey, imageBuf: await sharp(img).resize({ width: 1080 }).jpeg({ quality: 92 }).toBuffer(), prompt: shots[i].motion, duration: "5", log: (m) => log(`[${i + 1}/${shots.length}] ${m}`) });
    fs.writeFileSync(rawOf(i), Buffer.from(await (await fetch(url)).arrayBuffer()));
    log(`clip ${i} downloaded`);
  }
  const queue = shots.map((_, i) => i);
  await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => { while (queue.length) await makeRaw(queue.shift()); }));
  const clips = [];
  for (let i = 0; i < shots.length; i++) {
    const raw = rawOf(i);
    const ov = path.join(dir, `cap-${i}-${fmt}-${inp.template || "t"}${v2 ? "-k" : ""}.png`);
    await captionOverlay(ov, { W, H, text: inp.captions === "off" && !v2 ? (voLines[i]?.caption || voLines[i]?.text || "") : "", brand: inp.brandName || "", card: v2 ? voLines[i]?.caption || "" : "" }); // pipeline 2: keyword card on top + word captions below
    const out = path.join(dir, `clip-${i}.mp4`);
    await helpers.ffmpeg(["-y", "-loglevel", "error", ...(v2 ? ["-ss", "0.4", "-t", (v2.slots[i] + 0.4).toFixed(2)] : []), "-i", raw, "-i", ov, "-filter_complex", `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS}[v];[v][1:v]overlay=0:0,format=yuv420p[o]`, "-map", "[o]", "-an", ...INTERMEDIATE, out]);
    clips.push(out); log(`clip ${i} ready`);
  }
  // CTA end card (template engine's cta scene) held for the last voice line
  const cta = path.join(dir, "cta.png");
  await helpers.renderScene(cta, { kind: "cta", fmt, tpl: inp.template || "bold", inp: { ...inp, ctaText: voLines[nClips]?.text || voLines[voLines.length - 1]?.text || "" }, photo: null, logo: assets.logo, caption: "" });
  const ctaSec = v2 ? v2.ctaSlot : Math.max(3, (voLines[nClips]?.sec ?? 0) + 0.6);
  const durs = [...clips.map((_, i) => (v2 ? v2.slots[i] + 0.4 : 5)), ctaSec];
  const N = clips.length;
  const args = ["-y", "-loglevel", "error"];
  clips.forEach((c) => args.push("-i", c));
  args.push("-loop", "1", "-t", ctaSec.toFixed(2), "-i", cta);
  const CTA_IDX = N;
  if (assets.voWav) args.push("-i", assets.voWav);
  if (assets.music) args.push("-stream_loop", "-1", "-i", assets.music);
  let fc = clips.map((_, i) => `[${i}:v]fps=${FPS},format=yuv420p[v${i}];`).join("") + `[${CTA_IDX}:v]scale=${W}:${H},zoompan=z='min(zoom+0.0008,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${Math.round(ctaSec * FPS)}:s=${W}x${H}:fps=${FPS},format=yuv420p[v${CTA_IDX}];`;
  let last = "v0", off = 0, total = durs.reduce((a, b) => a + b, 0) - 0.4 * N;
  for (let i = 1; i <= N; i++) { off += durs[i - 1] - 0.4; fc += `[${last}][v${i}]xfade=transition=fade:duration=0.4:offset=${off.toFixed(2)}[x${i}];`; last = `x${i}`; }
  fc += `[${last}]fade=t=out:st=${(total - 0.6).toFixed(2)}:d=0.6[vout];`;
  // Audio is FINISHED here: the caption burn that follows copies it untouched,
  // so the duck and the -14 LUFS master have to happen on this pass.
  const vi = N + 1, mi = N + 1 + (assets.voWav ? 1 : 0);
  const S = "aresample=48000,aformat=channel_layouts=stereo";
  const fadeOut = `afade=t=out:st=${Math.max(0, total - 1.5).toFixed(2)}:d=1.5`;
  if (assets.voWav && assets.music) fc += `[${vi}:a]${S},apad=whole_dur=${total.toFixed(2)},asplit=2[vo1][vo2];[${mi}:a]${S},volume=${MUSIC_VOL},${fadeOut}[bg];[bg][vo1]${DUCK}[bgd];[vo2][bgd]amix=inputs=2:duration=first:normalize=0,${MASTER_AF}[aout]`;
  else if (assets.voWav) fc += `[${vi}:a]${S},apad=whole_dur=${total.toFixed(2)},${MASTER_AF}[aout]`;
  else if (assets.music) fc += `[${mi}:a]${S},volume=${MUSIC_SOLO},${fadeOut},${MASTER_AF}[aout]`;
  else fc += `anullsrc=r=48000:cl=stereo[aout]`; // digital silence: loudnorm would try to lift it by +70 dB
  const fcFile = path.join(dir, "real-filter.txt"); fs.writeFileSync(fcFile, fc);
  const out = path.join(dir, `ad-${fmt}.mp4`);
  // One delivery encode per file: if captions are burnt in afterwards THAT pass
  // is the final one, so this concat stays intermediate and near-lossless.
  const deliver = inp.__deliver ?? (inp.captions === "off" || !voLines.some((l) => l?.sec > 0));
  await helpers.ffmpeg([...args, "-filter_complex_script", fcFile, "-map", "[vout]", "-map", "[aout]", "-t", total.toFixed(2), "-r", String(FPS), ...(deliver ? DELIVERY_V : INTERMEDIATE), ...DELIVERY_A, out]);
  return out;
}
