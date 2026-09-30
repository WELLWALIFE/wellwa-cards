// Typed door to the shared rules in bridge/ad-rules.mjs (same code runs in the worker, the routes and the browser).
import * as R from "../../../bridge/ad-rules.mjs";

export type GateError = { gate: string; scene: number | "cta" | null; msg: string };
export type GateResult = { ok: boolean; errors: GateError[]; est: { per_scene_sec: number[]; cta_sec: number; total_sec: number } };
export type ScriptV2 = { angle?: string; first_visual?: string; promise?: string; headline?: string; why?: string; scenes: { role?: string; text: string; caption: string; shot?: Record<string, unknown> }[]; cta: { text: string; caption: string }; features?: string[]; post_caption?: string };
export type GateCtx = { tier: string; length: number; lang: string; facts?: unknown; brief?: { offer?: string; phone?: string; brand?: string }; speak_number?: boolean };

export const AD_LANGS: string[] = R.AD_LANGS;
export const SPEECH_MAX: number = R.SPEECH_MAX;
export const MAX_WORDS: Record<string, number> = R.MAX_WORDS;
export const slotSec: (speechSec: number) => number = R.slotSec;
export const ctaSlotSec: (ctaSec: number) => number = R.ctaSlotSec;
export const scenesFor: (tier: string, length: number) => number = R.scenesFor;
export const estSec: (text: string, lang: string) => number = R.estSec;
export const runGates: (script: ScriptV2, ctx: GateCtx) => GateResult = R.runGates;
export const brandTokens: (facts: unknown, brand?: string) => string[] = R.brandTokens;
export const legacyView: (input: unknown) => Record<string, unknown> = R.legacyView;
