// The one list of voices the Studio offers. The reel route validates against
// it, the Studio UI renders from it, and the AI Director is told to pick from
// it. Keep the keys in sync with VOICES in bridge/media-worker.mjs, which maps
// each key to its Gemini TTS voice name — a key that exists here but not there
// silently falls back to the default narrator.

export type VoiceGender = "male" | "female";

export type VoiceOption = {
  key: string;
  label: string;
  note: string;
  /** A pre-rendered sample exists at /voice/<key>.mp3. */
  preview: boolean;
};

export const VOICE_OPTIONS: Record<VoiceGender, VoiceOption[]> = {
  male: [
    { key: "warm", label: "Warm", note: "Informative, all-round default", preview: true },
    { key: "clear", label: "Clear", note: "Upbeat and crisp", preview: true },
    { key: "deep", label: "Deep", note: "Lower, authoritative", preview: true },
    { key: "friendly", label: "Friendly", note: "Personal, like a neighbour talking", preview: true },
    { key: "smooth", label: "Smooth", note: "Premium product feel", preview: true },
    { key: "expert", label: "Expert", note: "Knowledgeable — technical claims", preview: true },
  ],
  female: [
    { key: "calm", label: "Calm", note: "Steady and reassuring", preview: true },
    { key: "warmf", label: "Warm", note: "Warm and welcoming", preview: true },
    { key: "youthful", label: "Youthful", note: "Young and fresh", preview: true },
    { key: "soft", label: "Soft", note: "Gentle — family and emotional scripts", preview: true },
    { key: "gentle", label: "Gentle", note: "Slow and caring", preview: true },
    { key: "mature", label: "Mature", note: "Experienced and assured", preview: true },
    { key: "lively", label: "Lively", note: "High energy — offer and festival reels", preview: true },
  ],
};

export const VOICE_KEYS: string[] = [
  ...VOICE_OPTIONS.male.map((v) => v.key),
  ...VOICE_OPTIONS.female.map((v) => v.key),
];
