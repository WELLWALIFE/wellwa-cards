// AI phone receptionist (phase 3, owner's call 8 Oct 2026): a WebSocket server the telephony provider streams a live
// call into (Exotel "Voicebot" applet, or Twilio Media Streams), bridged to Gemini's Live API so the caller talks to the
// owner's AI — the same knowledge as their WhatsApp and website assistant — in Hindi, Hinglish or English.
//
//   pm2 start bridge/phone-worker.mjs --name neuraledge-phone
//   Apache: ProxyPass /phone/stream ws://127.0.0.1:8790/stream   (wss://shubhora.com/phone/stream for the provider)
//
// Per call: the provider's first message names the line (our number) and the caller → GET /api/phone/context (how to
// answer: system prompt, greeting, voice) → one Gemini Live session; caller audio (8 kHz) goes up at 16 kHz, the AI's
// voice (24 kHz) comes down at 8 kHz; the caller interrupting clears what is queued. When the call ends the transcript
// goes to POST /api/phone/call, which sums it up, makes the lead / booking and tells the owner.
//
// Audio shapes: Exotel = 16-bit PCM 8 kHz base64; Twilio = μ-law 8 kHz base64. Gemini Live in = PCM16 16 kHz, out =
// PCM16 24 kHz. Everything below is plain Node: no native modules.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { decodeMulaw, encodeMulaw, up8to16, down24to8 } from "./phone-audio.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(__dirname, "..");
function loadEnv() {
  const env = { ...process.env };
  try { for (const line of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !(m[1] in process.env)) env[m[1]] = m[2].replace(/^"|"$/g, ""); } } catch { /* no env file */ }
  return env;
}
const env = loadEnv();
const PORT = Number(env.PHONE_WS_PORT || 8790);
const APP_URL = env.INTERNAL_APP_URL || "http://127.0.0.1:3001";
const INTERNAL_KEY = env.INTERNAL_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "";
const GEMINI_KEY = env.GEMINI_API_KEY || "";
const LIVE_MODEL = env.GEMINI_LIVE_MODEL || "gemini-live-2.5-flash-preview";
const MAX_CALL_MS = Number(env.PHONE_MAX_CALL_MIN || 10) * 60_000;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), "[phone]", ...a);

/* ---------------- provider adapters ---------------- */
/** Exotel and Twilio differ only in field names and the audio codec; this reads both. */
function adapt(start) {
  const s = start.start ?? {};
  if (s.stream_sid || s.call_sid) {
    return { provider: "exotel", sid: s.stream_sid, callSid: s.call_sid, from: String(s.from ?? s.custom_parameters?.From ?? s.custom_parameters?.from ?? ""), to: String(s.to ?? s.custom_parameters?.To ?? s.custom_parameters?.to ?? ""), codec: "pcm16", sidKey: "stream_sid" };
  }
  const cp = s.customParameters ?? {};
  return { provider: "twilio", sid: s.streamSid, callSid: s.callSid, from: String(cp.From ?? cp.from ?? ""), to: String(cp.To ?? cp.to ?? ""), codec: "mulaw", sidKey: "streamSid" };
}

/* ---------------- Gemini Live ---------------- */
function liveUrl() { return `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(GEMINI_KEY)}`; }

/** One call. */
class Call {
  constructor(tel) {
    this.tel = tel;            // the provider's socket
    this.ai = null;            // Gemini socket
    this.meta = null;          // adapter result
    this.ctx = null;           // from /api/phone/context
    this.startedAt = Date.now();
    this.transcript = [];      // [{role:"caller"|"ai", text}]
    this.outQ = [];            // 8 kHz PCM16 frames queued for the provider
    this.pumping = null;
    this.ended = false;
    this.aiReady = false;
    this.pendingIn = [];       // caller audio that arrived before Gemini was ready
    this.inText = ""; this.outText = "";
    this.timer = setTimeout(() => this.end("max length"), MAX_CALL_MS);
  }
  async start(startMsg) {
    this.meta = adapt(startMsg);
    const { to, from } = this.meta;
    log(`call from ${from || "?"} to ${to || "?"} (${this.meta.provider})`);
    const r = await fetch(`${APP_URL}/api/phone/context?to=${encodeURIComponent(to)}&from=${encodeURIComponent(from)}`, { headers: { "x-internal-key": INTERNAL_KEY }, signal: AbortSignal.timeout(15_000) }).catch(() => null);
    if (!r?.ok) { log("no context for line", to, r?.status); this.end("no context"); return; }
    this.ctx = await r.json();
    if (!GEMINI_KEY) { log("GEMINI_API_KEY missing"); this.end("no key"); return; }
    this.openAi();
  }
  openAi() {
    const ws = new WebSocket(liveUrl());
    this.ai = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ setup: {
        model: `models/${LIVE_MODEL}`,
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: this.ctx.voice || "Aoede" } } }, temperature: 0.6 },
        systemInstruction: { parts: [{ text: `${this.ctx.system}\n\nSTART OF CALL: your first words are exactly this greeting, then wait for the caller: "${this.ctx.greeting}"` }] },
        inputAudioTranscription: {}, outputAudioTranscription: {},
        realtimeInputConfig: { automaticActivityDetection: { silenceDurationMs: 700 } },
      } }));
    };
    ws.onmessage = (ev) => this.onAi(ev.data);
    ws.onerror = (e) => { log("gemini error", e?.message ?? ""); };
    ws.onclose = (e) => { log("gemini closed", e.code, e.reason?.slice?.(0, 80) ?? ""); if (!this.ended) this.end("ai closed"); };
  }
  async onAi(data) {
    let msg;
    try { msg = JSON.parse(typeof data === "string" ? data : Buffer.from(await (data.arrayBuffer ? data.arrayBuffer() : data)).toString("utf8")); } catch { return; }
    if (msg.setupComplete) {
      this.aiReady = true;
      // Say hello (the greeting is pinned in the system instruction).
      this.ai.send(JSON.stringify({ clientContent: { turns: [{ role: "user", parts: [{ text: "(The call has just connected. Greet the caller now.)" }] }], turnComplete: true } }));
      for (const b64 of this.pendingIn.splice(0)) this.sendIn(b64);
      return;
    }
    const sc = msg.serverContent;
    if (!sc) return;
    if (sc.interrupted) { this.outQ.length = 0; this.clearTel(); }
    for (const p of sc.modelTurn?.parts ?? []) {
      if (p.inlineData?.data) this.queueOut(Buffer.from(p.inlineData.data, "base64"));
    }
    if (sc.inputTranscription?.text) this.inText += sc.inputTranscription.text;
    if (sc.outputTranscription?.text) this.outText += sc.outputTranscription.text;
    if (sc.turnComplete || sc.interrupted) {
      if (this.inText.trim()) this.transcript.push({ role: "caller", text: this.inText.trim() });
      if (this.outText.trim()) this.transcript.push({ role: "ai", text: this.outText.trim() });
      this.inText = ""; this.outText = "";
    }
  }
  /* caller → Gemini */
  onTelMedia(payloadB64) {
    const raw = Buffer.from(payloadB64, "base64");
    const pcm8 = this.meta.codec === "mulaw" ? decodeMulaw(raw) : raw;
    const pcm16 = up8to16(pcm8);
    const b64 = pcm16.toString("base64");
    if (this.aiReady) this.sendIn(b64); else if (this.pendingIn.length < 50) this.pendingIn.push(b64);
  }
  sendIn(b64) { try { this.ai.send(JSON.stringify({ realtimeInput: { audio: { data: b64, mimeType: "audio/pcm;rate=16000" } } })); } catch { /* closing */ } }
  /* Gemini → caller: 24 kHz → 8 kHz, paced at real time so the provider is not flooded */
  queueOut(pcm24) {
    const pcm8 = down24to8(pcm24);
    for (let i = 0; i < pcm8.length; i += 320) this.outQ.push(pcm8.subarray(i, Math.min(i + 320, pcm8.length))); // 20 ms frames
    if (!this.pumping) this.pump();
  }
  pump() {
    this.pumping = setInterval(() => {
      if (this.ended) { clearInterval(this.pumping); this.pumping = null; return; }
      const frames = this.outQ.splice(0, 5); // 100 ms a tick
      if (!frames.length) return;
      const pcm = Buffer.concat(frames);
      const payload = (this.meta.codec === "mulaw" ? encodeMulaw(pcm) : pcm).toString("base64");
      this.telSend({ event: "media", [this.meta.sidKey]: this.meta.sid, media: { payload } });
    }, 100);
  }
  clearTel() { this.telSend({ event: "clear", [this.meta.sidKey]: this.meta.sid }); }
  telSend(o) { try { if (this.tel.readyState === 1) this.tel.send(JSON.stringify(o)); } catch { /* gone */ } }
  async end(why) {
    if (this.ended) return;
    this.ended = true;
    clearTimeout(this.timer);
    if (this.pumping) clearInterval(this.pumping);
    try { this.ai?.close(); } catch { /* ignore */ }
    try { this.tel.close(); } catch { /* ignore */ }
    const seconds = Math.round((Date.now() - this.startedAt) / 1000);
    log(`call ended (${why}) ${seconds}s, ${this.transcript.length} turns`);
    if (this.inText.trim()) this.transcript.push({ role: "caller", text: this.inText.trim() });
    if (this.outText.trim()) this.transcript.push({ role: "ai", text: this.outText.trim() });
    if (!this.ctx) return;
    await fetch(`${APP_URL}/api/phone/call`, {
      method: "POST", headers: { "content-type": "application/json", "x-internal-key": INTERNAL_KEY }, signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({ ownerId: this.ctx.ownerId, line: this.meta?.to ?? "", caller: this.meta?.from ?? "", startedAt: new Date(this.startedAt).toISOString(), seconds, transcript: this.transcript }),
    }).then((r) => log("reported", r.status)).catch((e) => log("report failed", e?.message));
  }
}

/* ---------------- server ---------------- */
const wss = new WebSocketServer({ port: PORT, path: "/stream" });
wss.on("connection", (tel) => {
  const call = new Call(tel);
  tel.on("message", (data) => {
    let msg; try { msg = JSON.parse(data.toString()); } catch { return; }
    switch (msg.event) {
      case "connected": break;
      case "start": void call.start(msg); break;
      case "media": if (call.meta && msg.media?.payload) call.onTelMedia(msg.media.payload); break;
      case "stop": case "closed": void call.end("hangup"); break;
      default: break;
    }
  });
  tel.on("close", () => void call.end("socket closed"));
  tel.on("error", (e) => log("tel error", e?.message));
});
wss.on("listening", () => log(`listening on :${PORT}/stream, model ${LIVE_MODEL}, app ${APP_URL}`));
