// Audio conversions for the phone receptionist — plain Node, no native code.
// Telephony is 8 kHz (Exotel: 16-bit PCM, Twilio: μ-law); Gemini Live takes 16 kHz PCM16 and speaks 24 kHz PCM16.
// All PCM here is little-endian 16-bit mono.

const BIAS = 0x84, CLIP = 32635;
/** μ-law (G.711) bytes → PCM16 buffer. */
export function decodeMulaw(mu) {
  const out = Buffer.alloc(mu.length * 2);
  for (let i = 0; i < mu.length; i++) {
    let u = ~mu[i] & 0xff;
    const sign = u & 0x80, exp = (u >> 4) & 0x07, mant = u & 0x0f;
    let s = ((mant << 3) + BIAS) << exp;
    s -= BIAS;
    out.writeInt16LE(sign ? -s : s, i * 2);
  }
  return out;
}
/** PCM16 buffer → μ-law bytes. */
export function encodeMulaw(pcm) {
  const n = pcm.length >> 1, out = Buffer.alloc(n);
  for (let i = 0; i < n; i++) {
    let s = pcm.readInt16LE(i * 2);
    const sign = s < 0 ? 0x80 : 0;
    if (s < 0) s = -s;
    if (s > CLIP) s = CLIP;
    s += BIAS;
    let exp = 7;
    for (let m = 0x4000; (s & m) === 0 && exp > 0; m >>= 1) exp--;
    const mant = (s >> (exp + 3)) & 0x0f;
    out[i] = ~(sign | (exp << 4) | mant) & 0xff;
  }
  return out;
}
/** 8 kHz → 16 kHz PCM16 by linear interpolation (good enough for speech recognition). */
export function up8to16(pcm) {
  const n = pcm.length >> 1;
  const out = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    const a = pcm.readInt16LE(i * 2), b = i + 1 < n ? pcm.readInt16LE(i * 2 + 2) : a;
    out.writeInt16LE(a, i * 4);
    out.writeInt16LE((a + b) >> 1, i * 4 + 2);
  }
  return out;
}
/** 24 kHz → 8 kHz PCM16: the mean of each three samples (a cheap low-pass before dropping to a third). */
export function down24to8(pcm) {
  const n = Math.floor((pcm.length >> 1) / 3);
  const out = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const s = (pcm.readInt16LE(i * 6) + pcm.readInt16LE(i * 6 + 2) + pcm.readInt16LE(i * 6 + 4)) / 3;
    out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(s))), i * 2);
  }
  return out;
}
