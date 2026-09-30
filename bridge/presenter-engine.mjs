// Presenter ad: one photo of the business owner/founder + a TTS voice-over of
// the ad script → a lip-synced talking video via fal.ai's Kling AI Avatar,
// then a branded CTA end-card appended (same "cta" scene the other tiers use).
//   fal-ai/kling-video/ai-avatar/v2/standard: $0.0562/sec (~₹5/sec) — cheaper
//   than the realistic tier's multi-scene Kling clips, billed the same to the
//   user (adCredits) since the wizard doesn't price by tier.
//
// Delivery settings (fps, encode, audio master, music duck) come from
// caption-engine.mjs so this tier ships the same file every other tier does.
import fs from "node:fs";
import path from "node:path";
import { FORMATS } from "./ad-engine.mjs";
import { FPS, INTERMEDIATE, DELIVERY_V, DELIVERY_A, MASTER_AF, DUCK, MUSIC_VOL } from "./caption-engine.mjs";

const FAL = "https://queue.fal.run";
const AVATAR = "fal-ai/kling-video/ai-avatar/v2/standard";
const b64 = (buf, mime) => `data:${mime};base64,${buf.toString("base64")}`;

/** Photo + audio → lip-synced talking clip via fal queue. Returns the mp4 URL. */
export async function avatarClip({ falKey, imageBuf, wavBuf, log = () => {} }) {
  const headers = { Authorization: `Key ${falKey}`, "Content-Type": "application/json" };
  const sub = await fetch(`${FAL}/${AVATAR}`, {
    method: "POST", headers,
    body: JSON.stringify({ image_url: b64(imageBuf, "image/jpeg"), audio_url: b64(wavBuf, "audio/wav") }),
    signal: AbortSignal.timeout(60_000),
  });
  const sj = await sub.json().catch(() => ({}));
  if (!sub.ok || !sj.request_id) throw new Error("fal avatar submit: " + JSON.stringify(sj).slice(0, 200));
  const statusUrl = sj.status_url || `${FAL}/${AVATAR}/requests/${sj.request_id}/status`;
  const resultUrl = sj.response_url || `${FAL}/${AVATAR}/requests/${sj.request_id}`;
  const t0 = Date.now();
  while (Date.now() - t0 < 12 * 60_000) {
    await new Promise((r) => setTimeout(r, 6000));
    const st = await fetch(statusUrl, { headers, signal: AbortSignal.timeout(30_000) }).then((r) => r.json()).catch(() => ({}));
    log(`avatar ${sj.request_id.slice(0, 8)} ${st.status}${st.queue_position != null ? " q" + st.queue_position : ""}`);
    if (st.status === "COMPLETED") {
      const res = await fetch(resultUrl, { headers, signal: AbortSignal.timeout(30_000) }).then((r) => r.json());
      const url = res.video?.url; if (!url) throw new Error("fal avatar: no video");
      return url;
    }
    if (st.status === "FAILED" || st.status === "ERROR") throw new Error("fal avatar failed: " + JSON.stringify(st).slice(0, 200));
  }
  throw new Error("fal avatar timeout");
}

/**
 * Talking-head ad: assets.presenterPhoto (Buffer), assets.voWav (wav file
 * path — the full monologue), assets.logo, assets.music. helpers:
 * { ffmpeg, falKey, renderScene }. Returns the finished mp4 path.
 *
 * `inp.__deliver === false` means captions are burnt in afterwards, so this
 * pass must stay an intermediate — exactly one encode per delivered file.
 */
export async function renderPresenterAd(dir, inp, assets, helpers, log = () => {}, fmt = "reel") {
  const { w: W, h: H } = FORMATS[fmt] ?? FORMATS.reel;
  const wavBuf = fs.readFileSync(assets.voWav);
  const url = await avatarClip({ falKey: helpers.falKey, imageBuf: assets.presenterPhoto, wavBuf, log });
  const raw = path.join(dir, `presenter-raw-${fmt}.mp4`);
  fs.writeFileSync(raw, Buffer.from(await (await fetch(url, { signal: AbortSignal.timeout(120_000) })).arrayBuffer()));
  log("avatar clip downloaded");

  // Branded CTA end-card, same as the realistic tier's closing scene.
  const cta = path.join(dir, `presenter-cta-${fmt}.png`);
  await helpers.renderScene(cta, { kind: "cta", fmt, tpl: inp.template || "bold", inp: { ...inp, ctaText: inp.ctaText || inp.cta || "" }, photo: null, logo: assets.logo, caption: "" });
  const ctaSec = 3;
  const out = path.join(dir, `ad-${fmt}.mp4`);
  const deliver = inp.__deliver !== false;
  // The owner picked a music bed on the same screen as every other tier; before this
  // it was accepted and silently dropped. It sits under the talking voice with the
  // shared duck, and the CTA tail keeps playing it over the end card.
  const music = assets.music || null;
  const args = [
    "-y", "-loglevel", "error",
    "-i", raw,
    "-loop", "1", "-t", ctaSec.toFixed(2), "-i", cta,
    "-f", "lavfi", "-t", ctaSec.toFixed(2), "-i", "anullsrc=r=48000:cl=stereo",
  ];
  if (music) args.push("-stream_loop", "-1", "-i", music);
  let fc = `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},format=yuv420p[v0];` +
    `[1:v]scale=${W}:${H},fps=${FPS},format=yuv420p[v1];` +
    `[0:a]aresample=48000,aformat=channel_layouts=stereo[a0];[2:a]anull[a1];` +
    `[v0][a0][v1][a1]concat=n=2:v=1:a=1[vout][spoken];`;
  fc += music
    ? `[spoken]asplit=2[vo][sc];[3:a]aresample=48000,aformat=channel_layouts=stereo,volume=${MUSIC_VOL}[bed];[bed][sc]${DUCK}[duck];[vo][duck]amix=inputs=2:duration=first:dropout_transition=0,${MASTER_AF}[aout]`
    : `[spoken]${MASTER_AF}[aout]`;
  await helpers.ffmpeg([
    ...args,
    "-filter_complex", fc, "-map", "[vout]", "-map", "[aout]",
    ...(deliver ? DELIVERY_V : INTERMEDIATE), ...DELIVERY_A, out,
  ]);
  return out;
}
