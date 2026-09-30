// Product facts ("Visual Bible"): the owner-confirmed truth every ad prompt is built from (spec §3).
import { CATEGORIES } from "@/lib/poster-categories";
import { GROUP_DEFAULTS, KEY_OVERRIDES, type FactSeed } from "./product-defaults";

export type Archetype = "appliance_with_output" | "item_used_by_person" | "static_item";
export type SizeClass = "handheld" | "tabletop" | "countertop" | "floor" | "wall" | "wearable" | "consumable" | "vehicle" | "service";
export type PhotoView = "in_use" | "front" | "three_quarter" | "back" | "output_closeup" | "installed" | "packaging" | "generated" | "other";
export type ProductPhoto = { url: string; view: PhotoView; role: "identity" | "context"; w?: number; h?: number; generated_crop?: boolean };
export type FactsOutput = { part: string; part_short: string; medium: "water" | "air" | "light" | "sound" | "heat" | "food" | "none"; receptacle: string; action_positive: string; point?: { photo: number; x: number; y: number } };
export type ProductFacts = {
  v: 1; label: string; name: string; category_key: string; category_group: string; archetype: Archetype;
  what_it_is: string; size_class: SizeClass; appearance: string; stage_positive: string; idle_positive: string; use_positive: string | null;
  output: FactsOutput | null; fixed_parts: string[]; must_show: string[]; must_not_show: string[]; removed_defaults: string[];
  hands: "none" | "edge" | "operating"; people_default: string; settings: string[];
  benefits: string[]; proof: { text: string; number?: string; source: string }[]; offers: string[];
  claims_allowed: string[]; banned_claims: string[]; pronunciations: Record<string, Record<string, string>>;
  unverified: string[]; confirmed_by_owner: boolean;
};

export const PHOTO_VIEWS: { key: PhotoView; label: string }[] = [
  { key: "in_use", label: "Working / in use" }, { key: "front", label: "Front" }, { key: "three_quarter", label: "Three-quarter" },
  { key: "output_closeup", label: "Output close-up" }, { key: "installed", label: "Installed" }, { key: "packaging", label: "Packaging" }, { key: "back", label: "Back" }, { key: "other", label: "Other" },
];
export const roleOf = (view: PhotoView): "identity" | "context" => (view === "installed" || view === "generated" ? "context" : "identity");
/** Fields the owner must have seen before a realistic ad may use the facts. */
export const CORE_FIELDS = ["output", "stage_positive", "appearance", "must_not_show"] as const;
/** Words that must never be written into a positive staging / usage sentence (image models draw what is named). */
export const UNWANTED_IN_POSITIVE = /\b(tap|taps|faucet|faucets|sink|sinks|spout of the sink)\b/i;

const S = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const L = (v: unknown, n: number, each = 140) => [...new Set((Array.isArray(v) ? v : []).map((x) => S(x, each)).filter(Boolean))].slice(0, n);
const SIZES: SizeClass[] = ["handheld", "tabletop", "countertop", "floor", "wall", "wearable", "consumable", "vehicle", "service"];
const MEDIA = ["water", "air", "light", "sound", "heat", "food", "none"] as const;

export function categoryKeyFor(text: string): string {
  const t = String(text ?? "").trim().toLowerCase();
  if (!t) return "other";
  const hit = CATEGORIES.find((c) => c.key === t) ?? CATEGORIES.find((c) => c.en.toLowerCase() === t || c.hi === text.trim()) ?? CATEGORIES.find((c) => c.en.toLowerCase().split(/[\s/]+/).includes(t) || t.split(/[\s/,]+/).some((w) => w.length > 3 && c.en.toLowerCase().includes(w)));
  return hit?.key ?? "other";
}
export function seedFor(categoryKey: string): { group: string; seed: FactSeed } {
  const cat = CATEGORIES.find((c) => c.key === categoryKey);
  const group = cat?.group ?? "Retail";
  // A category override replaces the group's must-not-show list (a water ionizer sits in Health but needs no 'blood / needles').
  const g = GROUP_DEFAULTS[group] ?? {}; const k = KEY_OVERRIDES[categoryKey] ?? {};
  return { group, seed: { ...g, ...k, must_not_show: k.must_not_show?.length ? k.must_not_show : (g.must_not_show ?? []), banned_claims: [...new Set([...(g.banned_claims ?? []), ...(k.banned_claims ?? [])])] } };
}
export function deriveArchetype(f: Pick<ProductFacts, "output" | "size_class">): Archetype {
  if (f.output) return "appliance_with_output";
  return ["wearable", "consumable", "handheld"].includes(f.size_class) ? "item_used_by_person" : "static_item";
}

/** Clean + complete a facts object coming from the AI draft or from the owner's edit. Never trusts the caller for derived fields. */
export function normalizeFacts(raw: Record<string, unknown>, base: { name: string; category: string; benefits?: string[]; offer?: string; prev?: Partial<ProductFacts> | null }): ProductFacts {
  const category_key = categoryKeyFor(base.category);
  const { group, seed } = seedFor(category_key);
  const prev = base.prev ?? {};
  const removed = L(raw.removed_defaults ?? prev.removed_defaults, 20).map((x) => x.toLowerCase());
  const minusRemoved = (xs: string[]) => xs.filter((x) => !removed.includes(x.toLowerCase()));
  const o = raw.output && typeof raw.output === "object" ? (raw.output as Record<string, unknown>) : null;
  const pt = o?.point && typeof o.point === "object" ? (o.point as Record<string, unknown>) : null;
  const output: FactsOutput | null = o && S(o.part, 160)
    ? { part: S(o.part, 160), part_short: S(o.part_short, 40) || S(o.part, 40), medium: (MEDIA as readonly string[]).includes(String(o.medium)) ? (o.medium as FactsOutput["medium"]) : "none", receptacle: S(o.receptacle, 160), action_positive: S(o.action_positive, 300),
        ...(pt && Number.isFinite(Number(pt.x)) && Number.isFinite(Number(pt.y)) ? { point: { photo: Math.max(0, Math.trunc(Number(pt.photo) || 0)), x: Math.min(1, Math.max(0, Number(pt.x))), y: Math.min(1, Math.max(0, Number(pt.y))) } } : {}) }
    : null;
  const size_class = SIZES.includes(raw.size_class as SizeClass) ? (raw.size_class as SizeClass) : (seed.size_class ?? "tabletop");
  const benefits = L((raw.benefits as unknown[])?.length ? raw.benefits : base.benefits, 6, 80);
  const proof = (Array.isArray(raw.proof) ? raw.proof : []).map((p) => (p && typeof p === "object" ? { text: S((p as Record<string, unknown>).text, 80), number: S((p as Record<string, unknown>).number, 12) || undefined, source: S((p as Record<string, unknown>).source, 60) || "owner" } : null)).filter((p): p is { text: string; number: string | undefined; source: string } => !!p?.text).slice(0, 8);
  const offers = L((raw.offers as unknown[])?.length ? raw.offers : base.offer ? [base.offer] : [], 6, 80);
  const pron: Record<string, Record<string, string>> = {};
  if (raw.pronunciations && typeof raw.pronunciations === "object") for (const [lang, m] of Object.entries(raw.pronunciations as Record<string, unknown>)) if (m && typeof m === "object") pron[S(lang, 12)] = Object.fromEntries(Object.entries(m as Record<string, unknown>).map(([k, v]) => [S(k, 40), S(v, 60)]).filter(([k, v]) => k && v).slice(0, 20));
  const clean = (v: unknown, n: number) => { const t = S(v, n); return UNWANTED_IN_POSITIVE.test(t) ? "" : t; };
  const f: ProductFacts = {
    v: 1, label: S(raw.label, 40) || "the product", name: S(base.name, 60), category_key, category_group: group, archetype: "static_item",
    what_it_is: S(raw.what_it_is, 200), size_class, appearance: S(raw.appearance, 420),
    stage_positive: clean(raw.stage_positive, 200), idle_positive: S(raw.idle_positive, 200), use_positive: S(raw.use_positive, 240) || null,
    output: output ? { ...output, action_positive: clean(output.action_positive, 300) } : null,
    fixed_parts: L(raw.fixed_parts, 5, 40), must_show: L(raw.must_show, 8),
    must_not_show: minusRemoved([...new Set([...L(raw.must_not_show, 8), ...(seed.must_not_show ?? [])])]).slice(0, 8),
    removed_defaults: L(raw.removed_defaults ?? prev.removed_defaults, 20),
    hands: ["none", "edge", "operating"].includes(String(raw.hands)) ? (raw.hands as ProductFacts["hands"]) : (seed.hands ?? "edge"),
    people_default: S(raw.people_default, 120), settings: L(raw.settings, 4, 40),
    benefits, proof, offers,
    claims_allowed: [...new Set([...benefits, ...proof.map((p) => p.text), ...offers])].slice(0, 16),
    banned_claims: minusRemoved([...new Set([...L(raw.banned_claims, 8, 40), ...(seed.banned_claims ?? [])])]).slice(0, 10),
    pronunciations: Object.keys(pron).length ? pron : (prev.pronunciations ?? {}),
    unverified: L(raw.unverified, 20, 40), confirmed_by_owner: false,
  };
  f.archetype = deriveArchetype(f);
  return f;
}
/** Core fields still empty or not yet looked at by the owner → realistic ads stay locked. */
export function blockingFields(f: ProductFacts): string[] {
  const out: string[] = [];
  if (f.size_class === "service") return out;
  if (!f.appearance) out.push("appearance");
  if (!f.stage_positive) out.push("stage_positive");
  if (f.archetype === "appliance_with_output" && !f.output?.action_positive) out.push("output");
  if (!f.must_not_show.length) out.push("must_not_show");
  return [...new Set([...out, ...f.unverified.filter((u) => (CORE_FIELDS as readonly string[]).includes(u))])];
}
