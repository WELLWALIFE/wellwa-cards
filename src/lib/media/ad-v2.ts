// Pipeline 2 input builder (spec §8.2). Until the PR4 planner writes structured shots itself, the existing
// planner's scenes are mapped onto the beat spine here — product look/usage never comes from the planner.
import type { ProductFacts, ProductPhoto } from "./product-facts";

export type ShotV2 = { setting: string; setting_desc: string; people: { faces: number; desc: string }; hands_visible: boolean; framing: "close_up" | "medium" | "wide"; lens: "35mm" | "50mm"; lighting: string; product: { visible: boolean; in_use?: boolean; placement?: string; frame_share?: number }; hero_motion: string; camera: "static" | "slow_push_in" | "subtle_parallax" | "gentle_handheld" };
type PlanScene = { text: string; caption_text?: string; visual?: string; motion?: string };
const SPINES: Record<number, string[]> = { 2: ["hook", "product_in_use"], 3: ["hook", "product_in_use", "proof"], 4: ["hook", "product_in_use", "benefit", "proof_or_offer"], 5: ["hook", "problem", "product_in_use", "benefit", "proof_or_offer"], 6: ["hook", "problem", "product_in_use", "benefit", "proof", "offer"] };
const cut = (s: unknown, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const caption = (s: PlanScene) => { const w = cut(s.caption_text || s.text, 80).replace(/[.!?।]+$/, "").split(" ").filter(Boolean); return w.slice(0, 5).join(" ").slice(0, 32); };

export function shotFor(role: string, s: PlanScene, facts: ProductFacts): ShotV2 {
  const setting = facts.settings?.[0] || "home";
  const room = `a bright, tidy Indian ${setting}, plain light wall, soft window light from the left`;
  if (role === "product_in_use" && facts.archetype !== "static_item")
    return { setting, setting_desc: room, people: { faces: 0, desc: "" }, hands_visible: facts.hands !== "none", framing: "close_up", lens: "50mm", lighting: "soft morning daylight", product: { visible: true, in_use: true, placement: "at the centre of the surface", frame_share: 0.5 }, hero_motion: "", camera: "static" };
  if (role === "product_in_use" || role === "proof" || role === "proof_or_offer" || role === "offer")
    return { setting, setting_desc: room, people: { faces: 1, desc: `${facts.people_default || "an Indian customer"}, standing beside it and smiling at the camera` }, hands_visible: false, framing: "medium", lens: "35mm", lighting: "soft warm daylight", product: { visible: true, in_use: false, placement: "beside the person, facing the camera", frame_share: 0.35 }, hero_motion: "the person smiles and nods slightly", camera: "slow_push_in" };
  // hook / problem / benefit: a human moment, the product is not in the picture (no fidelity risk)
  return { setting, setting_desc: cut(s.visual, 160) || room, people: { faces: 1, desc: cut(s.visual, 110) || facts.people_default || "an Indian family member" }, hands_visible: true, framing: "medium", lens: "35mm", lighting: "natural daylight", product: { visible: false }, hero_motion: cut(s.motion, 90) || "a small natural movement", camera: "gentle_handheld" };
}

export function scriptFromPlan(scenes: PlanScene[], ctaText: string, facts: ProductFacts, extra: { headline?: string; features?: string[]; post_caption?: string }) {
  const n = Math.min(6, Math.max(2, scenes.length));
  const spine = SPINES[n] ?? SPINES[4];
  return {
    angle: "legacy_plan", first_visual: "person_first", promise: "", headline: cut(extra.headline, 60), why: "",
    scenes: scenes.slice(0, n).map((s, i) => ({ role: spine[i], text: cut(s.text, 200), caption: caption(s), shot: shotFor(spine[i], s, facts) })),
    cta: { text: cut(ctaText, 200), caption: cut(ctaText, 40).split(" ").slice(0, 5).join(" ") }, features: (extra.features ?? []).slice(0, 4), post_caption: cut(extra.post_caption, 600),
  };
}
export const identityPhotos = (photos: ProductPhoto[]) => (photos ?? []).filter((p) => p.role !== "context" && p.view !== "installed" && p.view !== "generated");
