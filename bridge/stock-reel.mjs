// Reel Maker (separate from ads): royalty-free stock clips (Pexels) + the owner's own images + API voice + captions + music.
// No AI video, no AI images → ≈ ₹1 per reel. H = { sb, SUPA_URL, SUPA_KEY, PEXELS, ttsLine, ffArr, renderScene, fetchPhoto, musicFile, log }
import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import sharp from "sharp";
import { captionOverlay } from "./realistic-engine.mjs";
import { wordCues, renderCuePngs, burnCaptions, FPS, INTERMEDIATE, DELIVERY_V, DELIVERY_A, MASTER_AF, DUCK, MUSIC_VOL, MUSIC_SOLO } from "./caption-engine.mjs";

const W = 1080, Hh = 1920, XF = 0.4;
// One shared grade on every scene so clips from different shoots, different
// cameras and AI stills read as one film instead of a folder of downloads.
const GRADE = "eq=contrast=1.04:saturation=1.06,vignette=PI/5";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export async function pexelsList(H, query) {
  const r = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&size=medium&per_page=15`, { headers: { Authorization: H.PEXELS }, signal: AbortSignal.timeout(20000) }).then((x) => x.json()).catch(() => ({}));
  // Closest to our 1080x1920 master, never a 4K download: the old sort took the
  // LOWEST file above 1280 (usually 720x1280) and then upscaled it 1.5x.
  return (r.videos ?? []).filter((v) => (v.duration ?? 0) >= 4).map((v) => { const f = (v.video_files ?? []).filter((x) => x.height >= 1280 && x.height <= 2160 && x.width < x.height && /mp4/.test(x.file_type ?? "mp4")).sort((a, b) => Math.abs(a.height - 1920) - Math.abs(b.height - 1920))[0]; return f ? { id: v.id, url: f.link, thumb: v.image, credit: v.user?.name || "", dur: Number(v.duration) || 0 } : null; }).filter(Boolean);
}
/** A vision model LOOKS at the candidate thumbnails and picks the clip — a text search alone returns off-topic or culturally wrong footage. */
async function pickByEye(H, cands, line, query) {
  const parts = [];
  for (const [k, c] of cands.entries()) { try { const buf = Buffer.from(await (await fetch(c.thumb, { signal: AbortSignal.timeout(15000) })).arrayBuffer()); const small = await sharp(buf).resize({ width: 360 }).jpeg({ quality: 78 }).toBuffer(); parts.push({ text: `Clip ${k}:` }, { inlineData: { mimeType: "image/jpeg", data: small.toString("base64") } }); } catch { /* skip */ } }
  if (!parts.length) return -1;
  const prompt = `You are choosing ONE stock video clip for a short vertical reel made for an audience in INDIA. The frames above are the candidates.
The narrator says: "${line}". Wanted visual: "${query}".
HARD RULES — a clip that breaks any of them is NOT acceptable, however well it matches:
 A. If a face or a recognisable person is visible, that person must clearly look South Asian / Indian AND the clothing and home must feel at home in India (no nightwear, no bedroom scenes, no revealing clothes). If you are not sure the person looks Indian, reject the clip.
 B. No text, logos, watermarks or screens with writing.
 C. Nothing a family business would avoid: alcohol, smoking, meat close-ups.
Clips with NO recognisable people (hands only, objects, food, nature, a room) always pass rule A.
Among the acceptable clips choose the one that best matches the wanted visual and the mood of the line, bright and clean. If none is acceptable answer -1 — a fallback search without people will be used, which is better than a wrong-looking person.
For each clip first note who is visible.
Return ONLY JSON {"clips":[{"n":0,"people":"none|indian|not_indian|unsure","ok":true}],"best": <clip number, or -1 if none is acceptable>, "why": "<max 12 words>"}`;
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent", { method: "POST", headers: { "x-goog-api-key": H.GEMINI, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [...parts, { text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0, maxOutputTokens: 4096 } }), signal: AbortSignal.timeout(45000) }).then((x) => x.json());
    const t = String(r.candidates?.[0]?.content?.parts?.[0]?.text ?? ""); const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
    H.log(`[reel] pick "${query}" → ${j.best} (${j.why ?? ""})`);
    const verdict = (j.clips ?? []).find((c) => Number(c.n) === Number(j.best));
    if (verdict && (verdict.ok === false || ["not_indian", "unsure"].includes(String(verdict.people)))) return -1; // the model's own notes overrule its pick
    return Number.isInteger(j.best) && j.best >= 0 && j.best < cands.length ? j.best : -1;
  } catch { return -2; } // judge unavailable
}
/** Candidates from "indian <query>" + the plain query → chosen by eye. No fit → the no-people alternative → a calm generic. */
export async function findClip(H, scene, line, used, strict = false) {
  const clean = (q) => String(q || "").replace(/[^a-z0-9 ]/gi, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  const tries = (strict ? [clean(scene.search), clean(scene.search_alt)] : [clean(scene.search), clean(scene.search_alt), "glass of water sunlight", "morning sunlight home"]).filter(Boolean);
  for (const [ti, q] of tries.entries()) {
    const seen = new Set(); const cands = [];
    for (const qq of ti === 0 && !/indian|india/i.test(q) ? [`indian ${q}`, q] : [q]) for (const c of await pexelsList(H, qq)) if (!used.has(c.id) && !seen.has(c.id) && cands.length < 10) { seen.add(c.id); cands.push(c); }
    if (!cands.length) continue;
    const k = await pickByEye(H, cands, line, q);
    const hit = k >= 0 ? cands[k] : k === -2 && !strict ? cands[0] : null; // judge down → first result (old behaviour), never in strict mode
    if (hit) { used.add(hit.id); return hit; }
  }
  return null;
}

/** Cheap eye-check of an AI picture: one single photo (no stacked / repeated panels), no lettering, no obvious defects. */
async function looksClean(H, buf) {
  try {
    const small = await sharp(buf).resize({ width: 512 }).jpeg({ quality: 80 }).toBuffer();
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent", { method: "POST", headers: { "x-goog-api-key": H.GEMINI, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ inlineData: { mimeType: "image/jpeg", data: small.toString("base64") } }, { text: 'Inspect this picture. Return ONLY JSON {"single_photo":true,"has_text":false,"defects":false}. single_photo is false for a collage, split or stacked panels, a repeated strip or band, or borders. has_text is true for any readable lettering or logo. defects is true for extra fingers, warped faces or melted objects.' }] }], generationConfig: { responseMimeType: "application/json", temperature: 0, maxOutputTokens: 2048 } }), signal: AbortSignal.timeout(30000) }).then((x) => x.json());
    const t = String(r.candidates?.[0]?.content?.parts?.[0]?.text ?? ""); const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
    return j.single_photo !== false && j.has_text !== true && j.defects !== true;
  } catch { return true; }
}
export async function aiStill(H, sc, inp) {
  const what = String(sc.ai_prompt || sc.text_en || sc.search || "").slice(0, 300); if (!what) return null;
  // The picture has to be born in the shape of the video. A 9:16 picture cropped into a 16:9 frame loses the top
  // and bottom of whatever it was showing, which is most of the subject.
  const wide = String(sc.aspect || "") === "16:9";
  const ratio = wide ? "16:9" : "9:16";
  const frame = wide
    ? "The main subject sits slightly left of centre with clean space to the right; the top sixth is calm background."
    : "The main subject sits in the middle of the frame; the top fifth and the bottom third are calm background.";
  const prompt = `Photorealistic ${wide ? "widescreen 16:9" : "vertical 9:16"} lifestyle photograph for an Indian small-business video: ${what}. All people are Indian (South Asian features, everyday Indian clothing, an Indian home, shop or street). Natural light, candid and warm, shallow depth of field, shot on a 35mm lens. ${frame} The picture contains no lettering, no logos, no branded products and no screens with writing.`;
  for (let t = 0; t < 3; t++) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.IMG_MODEL || "gemini-3.1-flash-lite-image"}:generateContent`, { method: "POST", headers: { "x-goog-api-key": H.GEMINI, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: ratio } } }), signal: AbortSignal.timeout(90000) }).then((x) => x.json()).catch(() => ({}));
    const p = (r.candidates?.[0]?.content?.parts ?? []).find((x) => x.inlineData?.data); if (!p) continue;
    const buf = Buffer.from(p.inlineData.data, "base64"); const m = await sharp(buf).metadata();
    const ar = m.width && m.height ? m.width / m.height : 0;
    if (!(wide ? ar > 1.4 : ar > 0 && ar < 0.62)) continue;   // the model sometimes ignores the ratio
    // Checked on EVERY attempt, not just the first. A picture with a repeated strip along the bottom went out in
    // a finished video because the second try was never looked at.
    if (!(await looksClean(H, buf))) { H.log(`[reel] AI picture rejected (collage / text / defect) → attempt ${t + 2}`); continue; }
    return buf;
  }
  return null;
}

export async function processStockReel(job, H) {
  const inp = job.input || {}; const log = (m) => H.log(`[reel] ${job.id.slice(0, 8)} ${m}`);
  const dir = path.join(os.tmpdir(), `reel2-${job.id}`); fs.mkdirSync(dir, { recursive: true });
  const patch = (b) => H.sb(`/rest/v1/media_jobs?id=eq.${job.id}&status=eq.running`, { method: "PATCH", body: JSON.stringify({ ...b, updated_at: new Date().toISOString() }) });
  /** Same guarded PATCH, but it tells us whether a row actually moved. */
  const patchOwned = async (b) => {
    const r = await H.sb(`/rest/v1/media_jobs?id=eq.${job.id}&status=eq.running`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...b, updated_at: new Date().toISOString() }) }).catch(() => null);
    if (!r || !r.ok) return { ok: false, rows: 0 };
    const rows = ((await r.json().catch(() => [])) || []).length;
    return { ok: true, rows };
  };
  // A generated picture is bought from Gemini, so record the spend BEFORE the money
  // moves: /api/media/jobs DELETE refunds cost - spent_credits, and without this
  // "make a reel with AI scenes → wait for the pictures → Stop" returned every
  // credit for images we had already paid for. The same PATCH is the cancellation
  // check: no row moved means the owner has already stopped this reel, so we stop
  // too instead of buying the next picture.
  let spendMarked = false;
  const markSpent = async () => {
    if (spendMarked || !(Number(job.cost) > 0)) return;
    spendMarked = true;
    const { ok, rows } = await patchOwned({ spent_credits: Number(job.cost) });
    if (ok && rows === 0) throw new Error("Cancelled by user");
    if (!ok) H.log(`[reel] ${job.id} spend marker failed — carrying on (run migration 0051?)`);
  };
  try {
    const scenes = (Array.isArray(inp.scenes) ? inp.scenes : []).filter((s) => String(s?.text ?? "").trim()).slice(0, 6);
    if (!scenes.length) throw new Error("No script");
    const lang = inp.lang || "hinglish", vs = inp.voiceStyle || "warm", voice = inp.voice !== false;
    const lines = [...scenes.map((s) => String(s.text).trim()), String(inp.cta || "").trim()].filter(Boolean); const n = scenes.length;
    // 1. voice
    await patch({ stage: "voice", progress: { text: "Recording the voice…" } });
    const secs = [];
    for (let i = 0; i < lines.length; i++) { let sec = 0; if (voice) sec = await H.ttsLine(lines[i], path.join(dir, `vo-${i}.wav`), vs, lang, inp.glossary || null); secs.push(sec); }
    const slots = lines.map((_, i) => (i < n ? clamp((secs[i] || 2.6) + 0.5, 2.6, 6.5) : Math.max(3.5, (secs[i] || 2.6) + 0.8)));
    // 2. pictures: the owner's image if the scene has one, else a stock clip
    await patch({ stage: "clips", progress: { text: "Finding clips…" } });
    const used = new Set(); const credits = []; const clips = [];
    // AUTO: one consistent look. Find a genuinely fitting stock clip for EVERY open scene; if even one scene has none, make all of them AI scenes.
    const open = scenes.map((sc, i) => i).filter((i) => !scenes[i].image && (scenes[i].source ?? "auto") === "auto");
    const picked = new Map(); let aiUsed = 0;
    if (open.length) {
      let allStock = !!H.PEXELS;
      for (const i of open) { if (!allStock) break; const hit = await findClip(H, { search: scenes[i].search || scenes[i].caption_text, search_alt: "" }, scenes[i].text_en || scenes[i].text, used, true); if (hit) picked.set(i, hit); else allStock = false; }
      const canAi = inp.ai_ok === true || (Number(inp.reserved_ai) || 0) >= open.length; // ai_ok = the weekly plan's own reel, paid by the platform
      if (!allStock && canAi) { picked.clear(); used.clear(); for (const i of open) scenes[i].source = "ai"; log(`auto → AI scenes for all ${open.length} (no fitting stock clip for every scene)`); }
      else { for (const i of open) scenes[i].source = "stock"; log(`auto → stock clips${allStock ? "" : " (AI not available: credits)"}`); }
    }
    for (let i = 0; i < n; i++) {
      const out = path.join(dir, `s-${i}.mp4`); const d = slots[i] + XF; const sc = scenes[i];
      const ov = path.join(dir, `ov-${i}.png`); await captionOverlay(ov, { W, H: Hh, text: "", brand: inp.brandName || "", card: String(sc.caption_text || "").trim().split(/\s+/).slice(0, 6).join(" ") });
      let img = sc.image ? await H.fetchPhoto(String(sc.image).split("?")[0]) : null;
      let aiMade = false;
      if (!img && sc.source === "ai") { // AI scene: one generated photo of Indian people / places for this line, then a slow camera move (no AI video)
        await markSpent();              // paid image generation starts here
        img = await aiStill(H, sc, inp); aiMade = !!img; if (aiMade) aiUsed++;
        if (!img) log(`scene ${i} AI picture failed → stock clip instead`);
      }
      if (img && aiMade) { // full-frame AI photo with a gentle push-in
        const still = path.join(dir, `still-${i}.jpg`); await sharp(img).resize(W, Hh, { fit: "cover" }).jpeg({ quality: 92 }).toFile(still);
        await H.ffArr(["-y", "-loglevel", "error", "-loop", "1", "-t", d.toFixed(2), "-i", still, "-i", ov, "-filter_complex", `[0:v]scale=${W * 2}:${Hh * 2},zoompan=z='min(zoom+0.0012,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${Math.ceil(d * FPS)}:s=${W}x${Hh}:fps=${FPS},${GRADE}[v];[v][1:v]overlay=0:0,format=yuv420p[o]`, "-map", "[o]", "-an", "-t", d.toFixed(2), ...INTERMEDIATE, out]);
      } else if (img) { // own image: sharp foreground on a blurred copy, slow push-in
        const bg = await sharp(img).rotate().resize(W, Hh, { fit: "cover" }).blur(36).modulate({ brightness: 0.8 }).toBuffer();
        const fg = await sharp(img).rotate().resize(W - 220, Hh - 760, { fit: "inside" }).toBuffer();
        const still = path.join(dir, `still-${i}.jpg`); await sharp(bg).composite([{ input: fg, gravity: "centre" }]).jpeg({ quality: 92 }).toFile(still);
        await H.ffArr(["-y", "-loglevel", "error", "-loop", "1", "-t", d.toFixed(2), "-i", still, "-i", ov, "-filter_complex", `[0:v]scale=${W * 2}:${Hh * 2},zoompan=z='min(zoom+0.0009,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${Math.ceil(d * FPS)}:s=${W}x${Hh}:fps=${FPS},${GRADE}[v];[v][1:v]overlay=0:0,format=yuv420p[o]`, "-map", "[o]", "-an", "-t", d.toFixed(2), ...INTERMEDIATE, out]);
      } else {
        const hit = picked.get(i) ?? (H.PEXELS ? await findClip(H, { search: sc.search || sc.caption_text || inp.topic, search_alt: sc.search_alt }, sc.text_en || sc.text, used) : null);
        if (!hit) throw new Error("No stock clip found — add your own image to this scene.");
        if (hit.credit) credits.push(hit.credit);
        const raw = path.join(dir, `raw-${i}.mp4`); fs.writeFileSync(raw, Buffer.from(await (await fetch(hit.url)).arrayBuffer()));
        // A clip shorter than its slot used to be repeated with -stream_loop 2,
        // which put a hard jump-cut in the middle of the scene. Ease it out
        // instead (≤1.8x, invisible on b-roll). -stream_loop stays only as the
        // safety net for a clip whose length Pexels did not report.
        const clipSec = Number(hit.dur) || 0;
        const slow = clipSec >= 1 && clipSec < d ? Math.min(1.8, d / clipSec) : 1;
        const needLoop = !clipSec || clipSec * slow < d - 0.05;
        const ease = slow > 1.001 ? `,setpts=${slow.toFixed(3)}*PTS` : "";
        await H.ffArr(["-y", "-loglevel", "error", ...(needLoop ? ["-stream_loop", "2"] : []), "-i", raw, "-i", ov, "-filter_complex", `[0:v]scale=${W}:${Hh}:force_original_aspect_ratio=increase,crop=${W}:${Hh}${ease},fps=${FPS},${GRADE}[v];[v][1:v]overlay=0:0,format=yuv420p[o]`, "-map", "[o]", "-an", "-t", d.toFixed(2), ...INTERMEDIATE, out]);
        fs.rmSync(raw, { force: true });
      }
      clips.push(out); log(`scene ${i} ${aiMade ? "AI picture" : img ? "own image" : "stock clip"} ready`);
      await patch({ progress: { text: `Building the scenes (${i + 1}/${n})…` } });
    }
    // 3. CTA card + voice track + assembly
    const cta = path.join(dir, "cta.png"); const logo = inp.logoUrl ? await H.fetchPhoto(inp.logoUrl) : null;
    await H.renderScene(cta, { kind: "cta", fmt: "reel", tpl: inp.template || "clean", inp: { ...inp, ctaText: lines[n] || "" }, photo: null, logo, caption: "" });
    // The end card has its own slot, whether or not the owner wrote a closing line.
    // `lines` drops an empty CTA (.filter(Boolean)), so slots[n] only exists when
    // there IS a spoken closing line — and `total` must still include the card, or
    // the `-t total` below cuts the phone number, website and logo off the end.
    const ctaSec = (lines.length > n ? slots[n] : null) ?? 3.5; let voWav = null;
    if (voice) {
      const a = ["-y", "-loglevel", "error"]; lines.forEach((_, i) => a.push("-i", path.join(dir, `vo-${i}.wav`)));
      voWav = path.join(dir, "vo.wav");
      await H.ffArr([...a, "-filter_complex", `${lines.map((_, i) => `[${i}:a]apad=whole_dur=${slots[i].toFixed(3)}[a${i}]`).join(";")};${lines.map((_, i) => `[a${i}]`).join("")}concat=n=${lines.length}:v=0:a=1[out]`, "-map", "[out]", voWav]);
    }
    const music = inp.music ? H.musicFile(inp.music) : null;
    const args = ["-y", "-loglevel", "error"]; clips.forEach((c) => args.push("-i", c)); args.push("-loop", "1", "-t", ctaSec.toFixed(2), "-i", cta); if (voWav) args.push("-i", voWav); if (music) args.push("-stream_loop", "-1", "-i", music);
    let fc = clips.map((_, i) => `[${i}:v]fps=${FPS},format=yuv420p,settb=AVTB[v${i}];`).join("") + `[${n}:v]scale=${W}:${Hh},fps=${FPS},format=yuv420p,settb=AVTB[v${n}];`;
    let last = "v0", off = 0; const total = slots.slice(0, n).reduce((x, y) => x + y, 0) + ctaSec;
    for (let i = 1; i <= n; i++) { off += slots[i - 1]; fc += `[${last}][v${i}]xfade=transition=fade:duration=${XF}:offset=${off.toFixed(2)}[x${i}];`; last = `x${i}`; }
    fc += `[${last}]fade=t=out:st=${(total - 0.6).toFixed(2)}:d=0.6[vout];`;
    // Audio is finished on this pass — the caption burn copies it through.
    const vi = n + 1, mi = n + 1 + (voWav ? 1 : 0);
    const S = "aresample=48000,aformat=channel_layouts=stereo";
    const fadeOut = `afade=t=out:st=${Math.max(0, total - 1.5).toFixed(2)}:d=1.5`;
    fc += voWav && music ? `[${vi}:a]${S},apad=whole_dur=${total.toFixed(2)},asplit=2[vo1][vo2];[${mi}:a]${S},volume=${MUSIC_VOL},${fadeOut}[bg];[bg][vo1]${DUCK}[bgd];[vo2][bgd]amix=inputs=2:duration=first:normalize=0,${MASTER_AF}[aout]`
      : voWav ? `[${vi}:a]${S},apad=whole_dur=${total.toFixed(2)},${MASTER_AF}[aout]`
      : music ? `[${mi}:a]${S},volume=${MUSIC_SOLO},${fadeOut},${MASTER_AF}[aout]`
      : `anullsrc=r=48000:cl=stereo[aout]`; // digital silence: loudnorm would try to lift it by +70 dB
    const fcFile = path.join(dir, "f.txt"); fs.writeFileSync(fcFile, fc); let out = path.join(dir, "reel.mp4");
    await patch({ stage: "assemble", progress: { text: "Putting the reel together…" } });
    const capsOn = voice && inp.captions !== "off" && secs.some((x) => x > 0);
    await H.ffArr([...args, "-filter_complex_script", fcFile, "-map", "[vout]", "-map", "[aout]", "-t", total.toFixed(2), "-r", String(FPS), ...(capsOn ? INTERMEDIATE : DELIVERY_V), ...DELIVERY_A, out]);
    if (capsOn) {
      let t = 0; const timed = lines.map((text, i) => { const o = { text, start: t, sec: secs[i] }; t += slots[i]; return o; });
      const cues = await renderCuePngs(path.join(dir, "caps"), wordCues(timed), { W, H: Hh, accent: "#FFD54A" });
      const capped = path.join(dir, "reel-cap.mp4"); await burnCaptions(H.ffArr, out, capped, cues, { W, H: Hh }); out = capped;
    }
    const key = `ai-media/${job.owner_id}/reel-${job.id}.mp4`;
    const up = await fetch(`${H.SUPA_URL}/storage/v1/object/media/${key}`, { method: "POST", headers: { apikey: H.SUPA_KEY, Authorization: `Bearer ${H.SUPA_KEY}`, "Cache-Control": "max-age=31536000", "Content-Type": "video/mp4", "x-upsert": "true" }, body: fs.readFileSync(out) });
    if (!up.ok) throw new Error("upload failed");
    const url = `${H.SUPA_URL}/storage/v1/object/public/media/${key}?v=${Date.now()}`;
    // Return the reserved AI credits we did not use — but ONLY if this PATCH really
    // moved the row. A reel the owner stopped is no longer `running`: the cancel route
    // has already settled it, and paying out "reel-ai-unused" on top of
    // "job-cancel-refund" would mint credits from nothing (the ledger's unique index
    // covers only reasons starting with "ad-", so it cannot catch that pair).
    const done = await patchOwned({ status: "done", stage: "done", output_url: url, progress: { text: "Done" }, input: { ...inp, outputs: { reel: url }, duration_sec: +total.toFixed(1), stock_credits: [...new Set(credits)].slice(0, 6) } });
    // rows === 0 on a PATCH that SUCCEEDED means the row is no longer running: the owner
    // stopped it and the cancel route has already paid them back. A PATCH that errored
    // (network, PostgREST) tells us nothing, so we assume the reel is still ours and pay.
    if (done.ok && done.rows === 0) { log("no longer running (cancelled?) — result not saved, no credits returned"); return; }
    if (!done.ok) H.log(`[reel] ${job.id} done-PATCH failed — returning the unused credits anyway`);
    const unused = Math.max(0, (Number(job.cost) || 0) - aiUsed); // the plan's own reels have cost 0, so nothing to return
    if (unused > 0) { await H.sb(`/rest/v1/rpc/grant_credits`, { method: "POST", body: JSON.stringify({ p_user: job.owner_id, p_amount: unused, p_reason: "reel-ai-unused", p_ref: job.id }) }).catch(() => {}); await H.sb(`/rest/v1/media_jobs?id=eq.${job.id}&status=eq.done`, { method: "PATCH", body: JSON.stringify({ cost: aiUsed }) }).catch(() => {}); }
    log(`done · ${total.toFixed(1)}s · AI scenes ${aiUsed}${unused ? `, ${unused} credit(s) returned` : ""}`);
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 300); H.log(`[reel] ${job.id} FAILED: ${msg}`);
    // Refund ONLY if this PATCH actually moved a row. A job the owner already
    // cancelled is no longer `running` and was refunded by the cancel route —
    // and the ledger's unique index covers only reasons starting with "ad-",
    // so "job-cancel-refund" + "ad-refund" would both be paid out.
    const r = await H.sb(`/rest/v1/media_jobs?id=eq.${job.id}&status=eq.running`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "failed", error: msg, updated_at: new Date().toISOString() }) }).catch(() => null);
    const owned = !!(r && r.ok) && ((await r.json().catch(() => [])) || []).length > 0;
    if (owned && Number(job.cost) > 0) await H.sb(`/rest/v1/rpc/grant_credits`, { method: "POST", body: JSON.stringify({ p_user: job.owner_id, p_amount: job.cost, p_reason: "ad-refund", p_ref: job.id }) }).catch(() => {});
    else if (!owned) H.log(`[reel] ${job.id} no longer running (cancelled?) — no refund from the worker`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
