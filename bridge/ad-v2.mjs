// Pipeline 2 — "storyboard before money" (docs/ad-video-one-shot-spec.md §4).
//   runStoryboard: voice lines + QC-passed stills → job status "review" (free, no ffmpeg, no Kling)
//   runAnimate:    approved stills → Kling clips (resume-safe) → assembly → captions → upload → "done"
// Helpers (H) are injected by media-worker.mjs: { sb, SUPA_URL, SUPA_KEY, GEMINI, FAL_KEY, ttsLine, ffArr, renderScene, musicFile, fetchPhoto, log }
import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import crypto from "node:crypto"; import sharp from "sharp";
import { buildStillPrompt, buildStillPromptSafe, buildKlingPrompt, buildKlingNegative, pickRefs } from "./prompt-builders.mjs";
import { judgeStill } from "./qc-judge.mjs";
import { nativeScript } from "./tts-script.mjs";
import { submitClip, pollClip } from "./kling.mjs";
import { slotSec, ctaSlotSec, SPEECH_MAX } from "./ad-rules.mjs";
import { renderRealisticAd } from "./realistic-engine.mjs";
import { wordCues, renderCuePngs, burnCaptions, reframe } from "./caption-engine.mjs";
import { FORMATS } from "./ad-engine.mjs";

const imgModel = () => process.env.IMG_MODEL || "gemini-3.1-flash-image"; // read lazily: the worker copies .env.local into process.env after imports
const RATIO = { reel: "9:16", square: "1:1", wide: "16:9" };
const MAX_ATTEMPTS = 3;
const sha = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 16);

/* ---------- storage ---------- */
async function put(H, bucket, key, buf, type) {
  const r = await fetch(`${H.SUPA_URL}/storage/v1/object/${bucket}/${key}`, { method: "POST", headers: { apikey: H.SUPA_KEY, Authorization: `Bearer ${H.SUPA_KEY}`, "Cache-Control": "max-age=31536000", "Content-Type": type, "x-upsert": "true" }, body: buf });
  if (!r.ok) throw new Error(`upload ${bucket}/${key}: ${(await r.text()).slice(0, 120)}`);
}
async function get(H, bucket, key) {
  const r = await fetch(`${H.SUPA_URL}/storage/v1/object/${bucket}/${key}`, { headers: { apikey: H.SUPA_KEY, Authorization: `Bearer ${H.SUPA_KEY}` } });
  return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
}
const pub = (H, key) => `${H.SUPA_URL}/storage/v1/object/public/media/${key}`;
const patchJob = (H, id, body, guard = "") => H.sb(`/rest/v1/media_jobs?id=eq.${id}${guard}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...body, updated_at: new Date().toISOString() }) });
const patchScene = (H, id, i, body) => H.sb(`/rest/v1/media_job_scenes?job_id=eq.${id}&i=eq.${i}`, { method: "PATCH", body: JSON.stringify({ ...body, updated_at: new Date().toISOString() }) });
const scenesOf = async (H, id) => { const r = await H.sb(`/rest/v1/media_job_scenes?job_id=eq.${id}&order=i.asc&select=*`); return r.ok ? await r.json() : []; };
const qcLog = (H, row) => H.sb(`/rest/v1/media_job_qc`, { method: "POST", body: JSON.stringify(row) }).catch(() => {});

/** Record that this job has reached a paid outside call (the fal/Kling clips), BEFORE the
 *  money moves. The cancel route refunds cost - spent_credits, so without this "approve,
 *  wait for the clips, stop, repeat" is unlimited outside spend at zero credit cost.
 *  One flag per job, status-guarded.
 *
 *  It is also the cancellation check for this pipeline: the guard matches no row once the
 *  owner has tapped Stop (the row is `failed` and already refunded in full), so we throw
 *  here instead of buying the clips a second later. A PATCH that errors outright
 *  (migration 0051 not run yet) only logs — a missing column must never fail a render. */
async function markSpent(H, job) {
  const cost = Number(job.cost) || 0;
  if (cost <= 0 || job.__spent) return;
  job.__spent = true;
  let cancelled = false;
  try {
    const r = await patchJob(H, job.id, { spent_credits: cost }, "&status=eq.running");
    if (!r.ok) H.log(`[ad2] spend marker failed ${job.id}: ${(await r.text().catch(() => "")).slice(0, 120)}`);
    else cancelled = ((await r.json().catch(() => [])) || []).length === 0;
  } catch (e) { H.log(`[ad2] spend marker threw ${job.id}: ${e?.message ?? e}`); }
  if (cancelled) throw new Error("Cancelled by user");
}

/* ---------- image model ---------- */
async function genImage(H, parts, ratio) {
  for (let t = 0; t < 2; t++) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${imgModel()}:generateContent`, { method: "POST", headers: { "x-goog-api-key": H.GEMINI, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: ratio } } }), signal: AbortSignal.timeout(90_000) }).then((x) => x.json()).catch(() => ({}));
    const p = (r.candidates?.[0]?.content?.parts ?? []).find((x) => x.inlineData?.data);
    if (p) return Buffer.from(p.inlineData.data, "base64");
  }
  return null;
}
const inline = async (buf, px = 1024) => ({ inlineData: { mimeType: "image/jpeg", data: (await sharp(buf).rotate().resize({ width: px, height: px, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer()).toString("base64") } });
async function preview(buf) { // public, small, watermarked — originals never leave the private bucket
  const w = 720; const img = await sharp(buf).resize({ width: w }).jpeg({ quality: 78 }).toBuffer(); const m = await sharp(img).metadata();
  const svg = `<svg width="${m.width}" height="${m.height}" xmlns="http://www.w3.org/2000/svg"><g transform="rotate(-24 ${m.width / 2} ${m.height / 2})" font-family="DejaVu Sans, Liberation Sans, sans-serif" font-weight="700" font-size="${Math.round(w * 0.085)}" fill="#fff" fill-opacity="0.22" text-anchor="middle">${[0.3, 0.55, 0.8].map((y) => `<text x="${m.width / 2}" y="${m.height * y}">PREVIEW · PREVIEW</text>`).join("")}</g></svg>`;
  return sharp(img).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 78 }).toBuffer();
}

async function shortenLine(H, text, lang) {
  const max = { en: 10, hi: 8, hinglish: 8 }[lang] ?? 7;
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent", { method: "POST", headers: { "x-goog-api-key": H.GEMINI, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: `Shorten this spoken ad line so it can be said in ${SPEECH_MAX} seconds (about ${max} words). Keep the same language and script, the same meaning, the same number(s), and the brand name if present. Output only the line.\nLine: "${text}"` }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 200 } }), signal: AbortSignal.timeout(20000) });
    const j = await r.json(); const out = String(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "").replace(/^["“\s]+|["”\s]+$/g, "").replace(/\s+/g, " ");
    const nums = (x) => (x.match(/\d[\d,]*/g) ?? []).join("|");
    return out && nums(out) === nums(text) ? out : null; // numbers must survive
  } catch { return null; }
}

/* =====================  STORYBOARD  ===================== */
export async function runStoryboard(job, H) {
  const inp = job.input || {}; const facts = inp.facts; const sc = inp.script?.scenes ?? []; const n = sc.length;
  const fmt = (inp.options?.formats ?? ["reel"])[0] in RATIO ? inp.options.formats[0] : "reel";
  const ratio = "9:16"; // realistic is generated once in vertical; square / wide are framed from it
  const base = `${job.owner_id}/${job.id}`;
  const log = (m) => H.log(`[ad2] ${job.id.slice(0, 8)} ${m}`);
  if (!facts?.label || !n) throw new Error("contract: facts or scenes missing");
  let rows = await scenesOf(H, job.id);
  if (rows.length < n) { for (let i = rows.length; i < n; i++) await H.sb(`/rest/v1/media_job_scenes`, { method: "POST", body: JSON.stringify({ job_id: job.id, i }) }); rows = await scenesOf(H, job.id); }
  const prog = (stage, extra = {}) => patchJob(H, job.id, { stage, progress: { n, ...extra } });

  // reference photos (identity only)
  const refBufs = new Map();
  for (const ph of inp.refs ?? []) { if (ph.role === "context") continue; const b = await H.fetchPhoto(ph.url.split("?")[0]); if (b) refBufs.set(ph.url, b); }
  const photos = (inp.refs ?? []).filter((p) => refBufs.has(p.url));

  // 1. voice (cheap, first: a failed voice must stop the job before any picture is drawn)
  const voice = inp.options?.voice !== false; const lang = inp.brief?.lang || "hinglish"; const vs = inp.options?.voiceStyle || "warm";
  const ttsModel = inp.options?.ttsModel || undefined; // per-job override for A/B tests; default comes from TTS_MODEL / the worker
  const glossary = facts.pronunciations?.[lang] ?? null; // the owner's confirmed spellings → the brand sounds identical in every line
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ad2sb-"));
  try {
    const allLines = [...sc.map((s) => s.text), inp.script?.cta?.text].filter(Boolean);
    const assets = { ...(job.assets ?? {}) }; assets.wavs = assets.wavs ?? {};
    if (voice) for (let i = 0; i < allLines.length; i++) {
      const key = sha(`${lang}|${vs}|${ttsModel ?? ""}|${JSON.stringify(glossary ?? {})}|${allLines[i]}`);
      if (assets.wavs[i]?.hash === key) { if (assets.wavs[i].text) allLines[i] = assets.wavs[i].text; continue; }
      await prog("voice", { done: i, of: allLines.length, text: `Recording the voice (${i + 1}/${allLines.length})…` });
      const f = path.join(tmp, `vo-${i}.wav`);
      // voice must be spoken from the language's own script; if that conversion is down, stop BEFORE any picture or clip is paid for
      if (lang !== "en" && /[A-Za-z]{3,}/.test(allLines[i])) { const chk = await nativeScript(allLines[i], lang, H.GEMINI, glossary); if (/[A-Za-z]{3,}/.test(chk) && chk === allLines[i].trim()) throw new Error(`Voice could not be prepared (${nativeScript.lastError || "script conversion failed"}). Nothing was charged — please try again shortly.`); }
      let sec = await H.ttsLine(allLines[i], f, vs, lang, glossary, ttsModel); // throws on hard failure → job fails before any spend
      let shortened_from = null;
      if (i < n && sec / 1.12 > SPEECH_MAX + 0.15) { // T7 — one shortening pass; the CTA is elastic and never shortened
        const shorter = await shortenLine(H, allLines[i], lang);
        if (shorter && shorter.length < allLines[i].length) { const sec2 = await H.ttsLine(shorter, f, vs, lang, glossary, ttsModel).catch(() => 0); if (sec2 && sec2 < sec) { shortened_from = allLines[i]; allLines[i] = shorter; sec = sec2; log(`scene ${i} line shortened to fit (${sec2.toFixed(1)}s)`); } }
      }
      await put(H, "ad-work", `${base}/vo-${i}.wav`, fs.readFileSync(f), "audio/wav");
      assets.wavs[i] = { hash: key, sec: +sec.toFixed(2), key: `${base}/vo-${i}.wav`, text: allLines[i] };
      if (i < n) await patchScene(H, job.id, i, { line: { text_final: allLines[i], shortened_from, sec: +sec.toFixed(2), tempo: +Math.min(1.12, Math.max(1, sec / SPEECH_MAX)).toFixed(3), too_long: sec / 1.12 > SPEECH_MAX + 0.15 } });
    }
    await patchJob(H, job.id, { assets });

    // 2. stills + judge, 3 scenes at a time
    let stills = 0; const cap = 2 * n + 2;
    const work = rows.map((r) => r.i).filter((i) => { const r = rows[i]; return r.redraw_requested || !["pass", "pass_with_notes", "safe_shot"].includes(r.status) || !r.original_key; });
    let done = n - work.length;
    async function doScene(i) {
      const row = rows[i]; const shot = sc[i].shot ?? { product: { visible: false }, people: { faces: 0 } };
      const mode = row.redraw_requested ? (row.redraw_mode || "redraw") : "auto";
      const refs = pickRefs(photos, shot); const refParts = [];
      for (const [k, r] of refs.entries()) refParts.push({ text: `Image ${k + 1}: ${r.view}` }, await inline(refBufs.get(r.url)));
      if (mode === "own_photo" && row.own_photo_url) {
        const src = await H.fetchPhoto(String(row.own_photo_url).split("?")[0]);
        if (src) {
          const bg = await sharp(src).rotate().resize(1080, 1920, { fit: "cover" }).blur(40).modulate({ brightness: 0.85 }).toBuffer();
          const fg = await sharp(src).rotate().resize(1080, 1920, { fit: "inside" }).toBuffer();
          const img = await sharp(bg).composite([{ input: fg, gravity: "centre" }]).jpeg({ quality: 93 }).toBuffer();
          const okey = `${base}/still-${i}-own${Date.now()}.jpg`; await put(H, "ad-work", okey, img, "image/jpeg");
          const pkey = `ai-media/${job.owner_id}/jobs/${job.id}/prev-${i}-${Date.now()}.jpg`; await put(H, "media", pkey, await preview(img), "image/jpeg");
          await patchScene(H, job.id, i, { status: "pass", redraw_requested: false, redraw_mode: null, redraw_note: null, owner_summary: "your own photo", notes: [], tap_visible: false, visible_objects: [], original_key: okey, preview_url: pub(H, pkey), clip: null, clip_pending: null });
          done++; await prog("stills", { done, of: n, text: `Drawing and checking the scenes (${done}/${n})…` }); return;
        }
      }
      let cosmeticTried = false, bestOk = null;
      let last = null, verdict = null, status = "needs_owner", attempt = 0, fix = mode === "change" && row.redraw_note ? String(row.redraw_note).slice(0, 200) : "";
      const judge = async (img, sh) => { const v = await judgeStill({ key: H.GEMINI, image: img, refs: refs.map((r) => refBufs.get(r.url)), facts, shot: sh }); await qcLog(H, { job_id: job.id, scene: i, stage: "still", attempt, model: v.model, verdict: { checks: v.checks, critical_ok: v.critical_ok, tap_visible: v.tap_visible, fix: v.fix_instruction, notes: v.cosmetic_notes, A: v.A, A2: v.A2 }, ms: v.ms }); return v; };
      while (mode !== "safe" && attempt < MAX_ATTEMPTS && stills < cap) {
        attempt++; stills++;
        const prompt = buildStillPrompt(facts, shot, { ratio, refs, fix_instruction: fix || undefined, tone: inp.brief?.tone });
        const parts = [...refParts, ...(last && fix ? [{ text: `Image ${refs.length + 1}: the last image to correct` }, await inline(last, 1280)] : []), { text: prompt }];
        let img = await genImage(H, parts, ratio);
        if (img) { const m = await sharp(img).metadata(); if (m.width && m.height && m.width / m.height > 0.62) { log(`scene ${i} wrong aspect ${m.width}x${m.height} — discarded`); img = null; } } // must be vertical 9:16
        if (!img) { log(`scene ${i} image failed (attempt ${attempt})`); continue; }
        let v = await judge(img, shot); if (v.error) v = await judge(img, shot); // one retry: a transient judge outage must not strand the scene
        if (v.error && !shot?.product?.visible) { last = img; verdict = { critical_ok: true, cosmetic_ok: true, cosmetic_notes: [], owner_summary: "scene without the product (not auto-checked)", visible_objects: [] }; status = "pass"; break; }
        if (v.error) { log(`scene ${i} judge unavailable`); last = img; verdict = null; status = "needs_owner"; break; }
        last = img; verdict = v;
        log(`scene ${i} attempt ${attempt}: critical_ok=${v.critical_ok}${v.tap_visible ? " TAP" : ""}${v.fix_instruction ? " fix=" + v.fix_instruction.slice(0, 60) : ""}`);
        if (v.critical_ok && (v.cosmetic_ok || cosmeticTried)) { status = v.cosmetic_ok ? "pass" : "pass_with_notes"; break; }
        if (v.critical_ok) { cosmeticTried = true; bestOk = { img, v }; fix = v.fix_instruction || `Fix this and change nothing else: ${v.cosmetic_notes[0]}`; continue; } // one retry for a cosmetic flaw, never a safe shot
        fix = v.fix_instruction || "Follow the description exactly";
      }
      if (verdict?.critical_ok && status === "needs_owner") status = verdict.cosmetic_ok ? "pass" : "pass_with_notes"; // passed on the last allowed attempt
      if (!verdict?.critical_ok && bestOk) { last = bestOk.img; verdict = bestOk.v; status = "pass_with_notes"; } // the cosmetic retry made it worse → keep the first, correct picture
      if (!verdict?.critical_ok && shot?.product?.visible && stills < cap + 2) { // safe shot: product alone, idle — never for a paid owner redraw
        if (mode === "auto" || mode === "safe") {
          attempt++; stills++;
          const safeShot = { ...shot, people: { faces: 0 }, product: { ...shot.product, visible: true, in_use: false } };
          const img = await genImage(H, [...refParts, { text: buildStillPromptSafe(facts, i % 2, { ratio, refs }) }], ratio);
          if (img) { const v = await judge(img, safeShot); if (!v.error && v.critical_ok) { last = img; verdict = v; status = "safe_shot"; } }
        }
      }
      const okStatus = ["pass", "pass_with_notes", "safe_shot"].includes(status);
      const patch = { status, redraw_requested: false, redraw_mode: null, redraw_note: null, owner_summary: okStatus ? verdict?.owner_summary || (shot?.product?.visible ? "" : "scene without the product") : "", notes: verdict?.cosmetic_notes ?? [], tap_visible: !!verdict?.tap_visible, visible_objects: verdict?.visible_objects ?? [] };
      if (last) {
        const okey = `${base}/still-${i}-a${Date.now()}.jpg`;
        await put(H, "ad-work", okey, await sharp(last).jpeg({ quality: 93 }).toBuffer(), "image/jpeg");
        const pkey = `ai-media/${job.owner_id}/jobs/${job.id}/prev-${i}-${Date.now()}.jpg`;
        await put(H, "media", pkey, await preview(last), "image/jpeg");
        Object.assign(patch, { original_key: okey, preview_url: pub(H, pkey), clip: null, clip_pending: null });
      }
      await patchScene(H, job.id, i, patch);
      done++; await prog("stills", { done, of: n, text: `Drawing and checking the scenes (${done}/${n})…` });
    }
    await prog("stills", { done, of: n, text: `Drawing and checking the scenes (${done}/${n})…` });
    const q = [...work]; await Promise.all(Array.from({ length: Math.min(3, q.length) }, async () => { while (q.length) await doScene(q.shift()); }));
    if (inp.reassemble === true) { await patchJob(H, job.id, { status: "queued", phase: "animate", stage: "queued", progress: { n, text: "Rebuilding your video…" } }, "&status=eq.running"); log("reassemble → animate"); }
    else { await patchJob(H, job.id, { status: "review", stage: "await", progress: { n, text: "Storyboard ready" } }, "&status=eq.running"); log("storyboard ready → review"); }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

/** Blind clip check (spec T4-clip): hard triggers only — a tap/faucet emitting, a second appliance, or the product changing shape. */
async function clipQc(H, mp4) {
  if (mp4.length > 18 * 1024 * 1024) return null;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.JUDGE_MODEL || "gemini-3.5-flash"}:generateContent`, { method: "POST", headers: { "x-goog-api-key": H.GEMINI, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ inlineData: { mimeType: "video/mp4", data: mp4.toString("base64") } }, { text: `Watch this 5-second clip. Return ONLY JSON {"objects_appearing":[{"what":"","at_sec":0}],"emitters":[{"kind":"tap_or_faucet|hose_or_tube|spout_on_appliance|bottle|jug_or_pitcher|other","attached_to":"main_appliance|wall_or_sink|held_by_person|freestanding","emitting":true}],"stream_origin_constant":true,"appliance_count_max":1,"appliance_changes_shape":false,"text_appears":false,"defects":[""]}\nReport anything that appears, morphs or disappears at ANY moment, even briefly.` }] }], generationConfig: { responseMimeType: "application/json", temperature: 0, maxOutputTokens: 8192 } }), signal: AbortSignal.timeout(90000) });
    const j = await r.json(); const v = JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "");
    const tap = (v.emitters ?? []).some((e) => e?.emitting && (e.kind === "tap_or_faucet" || e.attached_to === "wall_or_sink"));
    const why = tap ? "water from a tap" : Number(v.appliance_count_max) > 1 ? "a second appliance appears" : v.appliance_changes_shape === true ? "the product changes shape" : v.stream_origin_constant === false ? "the stream origin moves" : "";
    return { bad: !!why, why, raw: v };
  } catch { return null; } // QC unavailable never blocks a render
}

/* =====================  ANIMATE  ===================== */
export async function runAnimate(job, H) {
  const inp = job.input || {}; const facts = inp.facts; const sc = inp.script?.scenes ?? []; const n = sc.length;
  const log = (m) => H.log(`[ad2] ${job.id.slice(0, 8)} ${m}`);
  const dir = path.join(os.tmpdir(), `ad-${job.id}`); fs.mkdirSync(dir, { recursive: true });
  const base = `${job.owner_id}/${job.id}`; const fmt0 = "reel";
  const prog = (stage, text, extra = {}) => patchJob(H, job.id, { stage, progress: { n, text, ...extra } });
  let failed = false;
  try {
    const rows = await scenesOf(H, job.id);
    if (rows.length !== n || rows.some((r) => !r.original_key || !["pass", "pass_with_notes", "safe_shot"].includes(r.status))) throw new Error("contract: a scene has no approved still");
    // hydrate: stills + voice
    const wavs = job.assets?.wavs ?? {}; const voice = inp.options?.voice !== false;
    for (const r of rows) { const b = await get(H, "ad-work", r.original_key); if (!b) throw new Error(`still ${r.i} missing`); fs.writeFileSync(path.join(dir, `scene-${r.i}-${fmt0}.png`), await sharp(b).png().toBuffer()); }
    const lines = [...sc.map((s, i) => rows[i]?.line?.text_final || s.text), inp.script?.cta?.text].filter(Boolean);
    const secs = lines.map((_, i) => Number(wavs[i]?.sec) || 0);
    if (voice) for (let i = 0; i < lines.length; i++) { const b = wavs[i]?.key ? await get(H, "ad-work", wavs[i].key) : null; if (!b) throw new Error(`voice line ${i + 1} missing`); fs.writeFileSync(path.join(dir, `vo-${i}.wav`), b); }

    // clips — 3 at a time, resume-safe
    let done = rows.filter((r) => r.clip?.key).length;
    await prog("clips", `Animating the scenes (${done}/${n}) · about ${Math.max(2, Math.ceil((n - done) / 3) * 4)} min`);
    async function doClip(r) {
      const raw = path.join(dir, `clip-${r.i}-${fmt0}-raw.mp4`);
      if (r.clip?.key) { const b = await get(H, "ad-work", r.clip.key); if (b) { fs.writeFileSync(raw, b); return; } }
      const shot = sc[r.i].shot ?? { product: { visible: false } };
      const shotForStill = r.status === "safe_shot" ? { ...shot, people: { faces: 0 }, product: { ...shot.product, in_use: false }, camera: "slow_push_in", hero_motion: "" } : shot;
      let pending = r.clip_pending;
      if (!pending?.status_url) {
        const prompt = buildKlingPrompt(facts, shotForStill, { visible_objects: r.visible_objects ?? [] });
        const negative = buildKlingNegative(facts, shotForStill, prompt);
        const still = await sharp(path.join(dir, `scene-${r.i}-${fmt0}.png`)).resize({ width: 1080 }).jpeg({ quality: 92 }).toBuffer();
        pending = await submitClip({ falKey: H.FAL_KEY, imageBuf: still, prompt, negative });
        await patchScene(H, job.id, r.i, { clip_pending: { ...pending, prompt, negative } }); // write-ahead: a restart polls, never resubmits
        log(`scene ${r.i} kling submitted ${pending.request_id.slice(0, 8)}`);
      } else log(`scene ${r.i} resuming kling ${String(pending.request_id).slice(0, 8)}`);
      let url;
      try { url = await pollClip(pending, { falKey: H.FAL_KEY, log: (m) => log(`[${r.i + 1}/${n}] ${m}`), onTick: H.beat }); }
      catch (e) { await patchScene(H, job.id, r.i, { clip_pending: null }); throw e; }
      let buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      const visible = !!shotForStill?.product?.visible; let qc = visible ? await clipQc(H, buf) : null;
      if (qc?.bad && !r.clip_retry) { // one platform-paid retry: locked camera, stronger adherence, the failed truth restated
        log(`scene ${r.i} clip QC failed (${qc.why}) → retry`);
        const part = String(facts?.output?.part_short ?? "").replace(/^the\s+/i, "");
        const prompt2 = buildKlingPrompt(facts, shotForStill, { visible_objects: r.visible_objects ?? [] }, { retry: true, failed_sentence: part ? `The stream always starts at the end of the ${part}` : "The product never changes shape and nothing new appears" });
        const still2 = await sharp(path.join(dir, `scene-${r.i}-${fmt0}.png`)).resize({ width: 1080 }).jpeg({ quality: 92 }).toBuffer();
        const p2 = await submitClip({ falKey: H.FAL_KEY, imageBuf: still2, prompt: prompt2, negative: buildKlingNegative(facts, shotForStill, prompt2), cfg: 0.7 });
        await patchScene(H, job.id, r.i, { clip_pending: { ...p2, prompt: prompt2, retry: true } });
        try { const u2 = await pollClip(p2, { falKey: H.FAL_KEY, log: (m) => log(`[${r.i + 1}/${n} retry] ${m}`), onTick: H.beat }); const b2 = Buffer.from(await (await fetch(u2)).arrayBuffer()); const q2 = await clipQc(H, b2); if (!q2?.bad) { buf = b2; qc = q2; pending = p2; } else qc = { ...qc, retried: true, still_bad: true }; } catch { qc = { ...qc, retried: true }; }
      }
      await qcLog(H, { job_id: job.id, scene: r.i, stage: "clip", attempt: qc?.retried ? 2 : 1, model: "clip-qc", verdict: qc ?? { skipped: true }, ms: 0 });
      fs.writeFileSync(raw, buf);
      const key = `${base}/clip-${r.i}.mp4`; await put(H, "ad-work", key, buf, "video/mp4");
      await patchScene(H, job.id, r.i, { clip: { key, endpoint: pending.endpoint, request_id: pending.request_id, qc: qc ? { bad: !!qc.still_bad, why: qc.why || "" } : null }, clip_pending: null });
      done++; await prog("clips", `Animating the scenes (${done}/${n})`);
    }
    // Any scene without a cached clip is about to be bought from fal — mark the spend first.
    if (rows.some((r) => !r.clip?.key)) await markSpent(H, job);
    const q = [...rows]; await Promise.all(Array.from({ length: Math.min(3, q.length) }, async () => { while (q.length) await doClip(q.shift()); }));

    // voice track: line i starts when scene i starts
    await prog("assemble", "Putting the video together…");
    const slots = secs.slice(0, n).map((s, i) => slotSec(voice ? s / (rows[i]?.line?.tempo || 1) : 3)); const ctaSlot = ctaSlotSec(voice ? secs[n] : 2.9);
    let voWav = null;
    if (voice) {
      const args = ["-y", "-loglevel", "error"]; lines.forEach((_, i) => args.push("-i", path.join(dir, `vo-${i}.wav`)));
      const fc = lines.map((_, i) => { const tempo = i < n ? rows[i]?.line?.tempo || 1 : 1; const d = i < n ? slots[i] : ctaSlot; return `[${i}:a]${tempo > 1.001 ? `atempo=${tempo},` : ""}apad=whole_dur=${d.toFixed(3)}[a${i}]`; }).join(";");
      voWav = path.join(dir, "vo.wav");
      await H.ffArr([...args, "-filter_complex", `${fc};${lines.map((_, i) => `[a${i}]`).join("")}concat=n=${lines.length}:v=0:a=1[out]`, "-map", "[out]", voWav]);
    }
    const o = inp.options ?? {}; const b = inp.brief ?? {};
    const legacyInp = { ...b, ...o, product: facts.name, template: o.template || "clean", captions: o.captions === "off" ? "off" : "words", __v2: { slots, ctaSlot } };
    const capsOn = legacyInp.captions === "words" && voice && secs.some((x) => x > 0);
    legacyInp.__deliver = !capsOn;  // the caption burn is the final encode when captions are on
    const logo = b.logoUrl ? await H.fetchPhoto(b.logoUrl) : null;
    const voLines = lines.map((t, i) => ({ text: t, sec: secs[i], caption: i < n ? sc[i].caption : inp.script?.cta?.caption }));
    const master = await renderRealisticAd(dir, legacyInp, { photo: null, photos: [], logo, voWav, music: o.music ? H.musicFile(o.music) : null }, { ffmpeg: H.ffArr, gemini: null, falKey: H.FAL_KEY, renderScene: H.renderScene }, voLines, (m) => log(m), fmt0);

    let timed = null;
    if (capsOn) { let t = 0; timed = voLines.map((l, i) => { const o2 = { ...l, start: t, sec: i < n ? l.sec / (rows[i]?.line?.tempo || 1) : l.sec }; t += i < n ? slots[i] : ctaSlot; return o2; }); }
    await prog("upload", "Uploading…");
    const outputs = {}; const formats = (o.formats?.length ? o.formats : ["reel"]).filter((f) => FORMATS[f]);
    for (const f of formats.includes(fmt0) ? formats : [fmt0, ...formats]) {
      const { w: W, h: H2 } = FORMATS[f];
      // Reframe FIRST, then burn the captions at the TARGET size. Burning them
      // on the 9:16 master and shrinking afterwards is what put ~35 px text on
      // a square post. Square is centre-cropped (the still prompt already puts
      // the subject in the middle); 16:9 keeps the letterbox, because cropping
      // a vertical master to wide throws away most of the picture.
      let file = master;
      if (f !== fmt0) file = await reframe(H.ffArr, master, path.join(dir, `ad-${f}-rf.mp4`), { W, H: H2, mode: "fit", final: !capsOn });
      if (capsOn) {
        await prog("captions", "Adding captions…");
        const cues = await renderCuePngs(path.join(dir, `caps-${f}`), wordCues(timed), { W, H: H2, accent: legacyInp.template === "clean" ? "#0e9e90" : "#FFD54A" });
        const capped = path.join(dir, `ad-${f}-cap.mp4`); await burnCaptions(H.ffArr, file, capped, cues, { W, H: H2 }); file = capped;
      }
      const key = `ai-media/${job.owner_id}/ad-${job.id}-${f}.mp4`; await put(H, "media", key, fs.readFileSync(file), "video/mp4"); outputs[f] = `${pub(H, key)}?v=${Date.now()}`;
    }
    const duration = +(slots.reduce((a, b2) => a + b2, 0) + ctaSlot).toFixed(1);
    await patchJob(H, job.id, { status: "done", stage: "done", output_url: outputs[formats[0]] ?? outputs.reel, progress: { n, text: "Done" }, input: { ...inp, reassemble: false, outputs, rendered_lines: lines, duration_sec: duration } }, "&status=eq.running");
    log(`done · ${duration}s · ${Object.keys(outputs).join(",")}`);
  } catch (e) {
    failed = true; const msg = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    H.log(`[ad2] ${job.id} RENDER FAILED: ${msg}`);
    // credits stay held: the owner gets a free "Retry render" (cached clips are reused) or "Discard" (full refund)
    await patchJob(H, job.id, { status: "review", stage: "render_failed", error: msg, progress: { n, text: "Rendering failed — retry is free" } }, "&status=eq.running");
  } finally { if (!failed) fs.rmSync(dir, { recursive: true, force: true }); }
}

/** Housekeeping (run hourly by the worker): abandoned storyboards → discarded; failed renders nobody retried → refunded. */
export async function sweepV2(H) {
  const iso = (h) => new Date(Date.now() - h * 3600_000).toISOString();
  try {
    await H.sb(`/rest/v1/media_jobs?pipeline=eq.2&status=eq.review&stage=eq.await&cost=eq.0&updated_at=lt.${iso(48)}`, { method: "PATCH", body: JSON.stringify({ status: "failed", error: "Discarded", stage: "expired", updated_at: new Date().toISOString() }) });
    const r = await H.sb(`/rest/v1/media_jobs?pipeline=eq.2&status=eq.review&stage=eq.render_failed&updated_at=lt.${iso(72)}&select=id,owner_id,cost,output_url`);
    for (const j of r.ok ? await r.json() : []) {
      // A job that has ALREADY delivered a video (output_url is set) reached
      // render_failed by rebuilding it — "Change music", "Redo one scene". The
      // owner still has the first video, so refunding the full original price
      // here would turn a paid ad into a free one. Close the row, keep the money.
      const delivered = !!j.output_url;
      const f = await H.sb(`/rest/v1/media_jobs?id=eq.${j.id}&status=eq.review`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: delivered ? "done" : "failed", error: delivered ? null : "Render failed — refunded", stage: delivered ? "done" : "refunded", updated_at: new Date().toISOString() }) });
      if (f.ok && (await f.json()).length && j.cost > 0 && !delivered) await H.sb(`/rest/v1/rpc/grant_credits`, { method: "POST", body: JSON.stringify({ p_user: j.owner_id, p_amount: j.cost, p_reason: "ad-refund", p_ref: j.id }) });
    }
  } catch (e) { H.log(`[ad2] sweep error ${e?.message ?? e}`); }
}
