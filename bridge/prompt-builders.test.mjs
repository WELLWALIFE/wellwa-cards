// node bridge/prompt-builders.test.mjs
import assert from "node:assert/strict";
import { buildStillPrompt, buildStillPromptSafe, buildKlingPrompt, buildKlingNegative, pickRefs, receptacleNoun, UNWANTED } from "./prompt-builders.mjs";
import { compareToFacts } from "./qc-judge.mjs";
const ionizer = { label: "the water ionizer", name: "Wellwa Alkaline Ionizer", archetype: "appliance_with_output", size_class: "countertop",
  appearance: "white glossy rectangular body about 35 cm tall, dark touch display centred on the front, three silver buttons below the display, brand name printed small at the top centre of the front, a flexible white hose rising from the top and curving forward and down",
  stage_positive: "on a clear stretch of white kitchen counter against a plain light tiled wall", idle_positive: "stands switched on with its display lit, the white hose resting in its normal curved position", use_positive: null,
  output: { part: "the flexible white hose on top of the unit", part_short: "white hose on top", medium: "water", receptacle: "a clear glass held directly beneath the end of the hose", action_positive: "a steady clear stream of water flows from the end of the flexible white hose on top of the unit into a clear glass held directly beneath it" },
  fixed_parts: ["white hose on top", "front display", "three silver buttons"], must_show: ["the stream of water starts at the end of the unit's white hose", "the front display is lit"],
  must_not_show: ["liquid leaving any tap, faucet or spout that is not part of the product", "a second appliance or purifier", "a bottle, jug or pitcher pouring", "extra pipes or plumbing on the unit", "the unit held in someone's hands", "steam"], hands: "edge", people_default: "Indian family, 30–45, everyday home clothing" };
const saree = { label: "the silk saree", name: "Meera Silks Kanchipuram", archetype: "item_used_by_person", size_class: "wearable", appearance: "deep maroon silk with a gold zari border and small gold butta motifs", stage_positive: "in a softly lit showroom against a plain cream wall", idle_positive: "is draped neatly over a wooden stand", use_positive: "a woman wears the saree, pallu draped over the left shoulder", output: null, fixed_parts: ["gold zari border", "butta motifs"], must_show: [], must_not_show: ["changed fabric pattern or colour"], hands: "operating", people_default: "Indian woman, 25–40" };
const atta = { label: "the atta pack", name: "Shree Kirana", archetype: "static_item", size_class: "tabletop", appearance: "a 10 kg printed flour bag, yellow and red, standing upright", stage_positive: "on a clean wooden shop counter against a plain wall", idle_positive: "stands upright facing the camera", use_positive: null, output: null, fixed_parts: ["printed front label"], must_show: [], must_not_show: ["legible price tags"], hands: "edge", people_default: "Indian shopkeeper" };
const shotUse = { setting: "kitchen", setting_desc: "bright modern Indian kitchen, white counter, plain light tiled wall, window light from the left", people: { faces: 0, desc: "" }, hands_visible: true, framing: "close_up", lens: "50mm", lighting: "soft morning daylight", product: { visible: true, in_use: true, placement: "centre of the counter", frame_share: 0.5 }, hero_motion: "water flows into the glass", camera: "slow_push_in" };
const shotIdle = { ...shotUse, people: { faces: 1, desc: "a woman about 35 in a cotton kurta smiling at the camera with a full glass" }, framing: "medium", lens: "35mm", product: { visible: true, in_use: false, placement: "beside her on the counter", frame_share: 0.35 }, hero_motion: "she lifts the glass slightly", camera: "slow_push_in" };
const shotNo = { setting: "kitchen", setting_desc: "a busy Indian kitchen", people: { faces: 1, desc: "a woman sets a heavy pack of water bottles on the counter and sighs" }, framing: "medium", lens: "35mm", lighting: "morning light", product: { visible: false }, hero_motion: "she lowers the pack onto the counter", camera: "gentle_handheld" };
const photos = [{ url: "a", view: "front", role: "identity" }, { url: "b", view: "three_quarter", role: "identity" }, { url: "c", view: "output_closeup", role: "identity" }, { url: "d", view: "installed", role: "context" }];

for (const [facts, shots] of [[ionizer, [shotUse, shotIdle]], [saree, [shotIdle, { ...shotIdle, product: { ...shotIdle.product, in_use: true } }]], [atta, [shotIdle]]]) for (const sh of shots) {
  const refs = pickRefs(photos, sh); assert.ok(refs.length >= 2 && refs.every((r) => r.role !== "context"), "refs never context");
  const p = buildStillPrompt(facts, sh, { ratio: "9:16", refs, plate: true });
  assert.ok(!UNWANTED.test(p), "unwanted noun in still prompt: " + p.match(UNWANTED)?.[0]);
  assert.ok(!/\bnull\b|undefined|NaN/.test(p), "null/undefined leaked");
  const brand = facts.name.split(" ")[0]; assert.ok(!p.includes(brand), "brand token leaked");
}
const pUse = buildStillPrompt(ionizer, shotUse, { refs: pickRefs(photos, shotUse), plate: true });
assert.ok(pUse.includes("flows from the end of the flexible white hose on top of the unit") && pUse.includes("a hand at the edge of the frame holds the glass"));
assert.deepEqual(pickRefs(photos, shotUse).map((r) => r.view), ["front", "output_closeup"]);
assert.equal(receptacleNoun(ionizer), "the glass");
// a planner that writes "next to the sink" must not get it into the prompt
assert.ok(!UNWANTED.test(buildStillPrompt(ionizer, { ...shotUse, product: { ...shotUse.product, placement: "next to the sink tap" }, setting_desc: "kitchen with a steel sink" }, { refs: [] })));
assert.ok(buildStillPrompt(ionizer, shotNo, {}).includes("No branded products or appliances"));
assert.notEqual(buildStillPromptSafe(ionizer, 0), buildStillPromptSafe(ionizer, 1));
const kp = buildKlingPrompt(ionizer, shotUse, { visible_objects: ["display"] });
assert.ok(kp.startsWith("Static camera") && !UNWANTED.test(kp) && kp.includes("white hose on top into the glass") && kp.split(/\s+/).length <= 90, kp);
const kn = buildKlingNegative(ionizer, shotUse, kp);
assert.ok(/faucet/.test(kn) && !/\bwater\b|\bhose\b|\bglass\b/.test(kn) && kn.split(",").length <= 18, kn);
assert.ok(buildKlingPrompt(ionizer, shotNo, {}).startsWith("Gentle handheld"));

// the recorded 2026-09-16 failure: water from a separate faucet
const A = { appliances: [{ what: "water ionizer", count: 1, bbox: [0.5, 0.4, 0.9, 0.8] }], emitters: [{ kind: "tap_or_faucet", attached_to: "wall_or_sink", emitting: true, what_is_emitted: "water", lands_in: "glass" }, { kind: "hose_or_tube", attached_to: "main_appliance", emitting: false }], stream_origin: "the chrome faucet at the sink", watch: [{ item: "tap or faucet", present: true }], faces: 0, hands_visible: 0, held_objects: [], readable_text: [{ text: "Wellwa Elite Maxx lata hai", on: "elsewhere" }], main_subject_bbox: [0.5, 0.4, 0.9, 0.8], main_subject_fully_in_frame: true, defects: [] };
const v = compareToFacts(A, null, ionizer, shotUse, { ignore: ["no_text"] });
assert.equal(v.checks.usage_correct, false); assert.equal(v.tap_visible, true); assert.equal(v.critical_ok, false);
assert.ok(/Remove the faucet entirely/.test(v.fix_instruction) && /white hose on top/.test(v.fix_instruction), v.fix_instruction);
const good = compareToFacts({ ...A, emitters: [{ kind: "hose_or_tube", attached_to: "main_appliance", emitting: true }], watch: [{ item: "tap or faucet", present: false }], readable_text: [] }, { same_body: true, same_colour: true, parts_missing: [], parts_added: [], fixed_parts_ok: { a: true } }, ionizer, shotUse);
assert.equal(good.critical_ok, true); assert.ok(good.owner_summary.includes("from the product's white hose on top only"), good.owner_summary);
console.log("prompt-builders + compareToFacts: all tests passed");
// idle scene: nothing may pour; and the product's own nozzle is a valid outlet
const idle = compareToFacts({ appliances: [{ what: "ionizer", count: 1 }], emitters: [{ kind: "hose_or_tube", attached_to: "main_appliance", emitting: false }], watch: [], faces: 1, readable_text: [], defects: [] }, { same_body: true, same_colour: true, parts_added: [], parts_missing: [] }, ionizer, shotIdle);
assert.equal(idle.checks.usage_correct, true); assert.equal(idle.critical_ok, true);
const nozzle = compareToFacts({ appliances: [{ what: "ionizer", count: 1 }], emitters: [{ kind: "spout_on_appliance", attached_to: "main_appliance", emitting: true }], stream_origin: "the white nozzle at the end of the flexible hose", watch: [{ item: "tap or faucet", present: true }], faces: 0, readable_text: [], defects: [] }, { same_body: true, same_colour: true, parts_added: [] }, ionizer, shotUse);
assert.equal(nozzle.critical_ok, true, JSON.stringify(nozzle.checks));
console.log("judge edge cases passed");
