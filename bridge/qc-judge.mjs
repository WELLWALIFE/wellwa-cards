// Still QC (spec §5c): Call A = BLIND inventory of the generated picture (no facts, no expected answer),
// Call A2 = identity check on a crop, Step B = deterministic comparison against the owner's facts.
import sharp from "sharp";
export const JUDGE_MODEL = "gemini-3.5-flash";
const judgeModel = () => process.env.JUDGE_MODEL || JUDGE_MODEL;

const shuffle = (xs, seed = 7) => { const a = [...xs]; let s = seed; for (let i = a.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor((s / 233280) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export function watchListFor(facts) {
  const items = new Set(["tap or faucet", "bottle", "jug or pitcher", "second appliance", "extra pipes", "steam"]);
  if (facts?.output?.part_short) items.add(facts.output.part_short.replace(/^the\s+/i, ""));
  const rec = String(facts?.output?.receptacle ?? "").match(/\b(glass|cup|bowl|plate|mug|tumbler|bucket|jar)\b/i)?.[0]; if (rec) items.add(rec.toLowerCase());
  for (const m of facts?.must_not_show ?? []) { const t = String(m).toLowerCase(); if (t.length <= 40) items.add(t); }
  return shuffle([...items]).slice(0, 12);
}
export const inventoryPrompt = (watch) => `Describe this picture as a careful inspector. Report only what is visible. Return ONLY JSON:
{"appliances":[{"what":"","count":1,"bbox":[x0,y0,x1,y1]}],
 "emitters":[{"kind":"tap_or_faucet|hose_or_tube|spout_on_appliance|bottle|jug_or_pitcher|kettle|shower|other","attached_to":"main_appliance|wall_or_sink|held_by_person|freestanding","emitting":true,"what_is_emitted":"","lands_in":""}],
 "stream_origin":"<if any liquid, air, light or steam is moving: say IN WORDS exactly which object and part it starts from; else ''>",
 "watch":[{"item":"<each of: ${watch.join(", ")}>","present":true}],
 "faces":0,"hands_visible":0,"hands_touching":"","held_objects":[""],
 "readable_text":[{"text":"","on":"main_appliance|product_pack|elsewhere"}],
 "is_single_photo":true,
 "main_subject_bbox":[x0,y0,x1,y1],"main_subject_fully_in_frame":true,
 "defects":["<warped shapes, duplicated parts, extra fingers, melted edges — or empty>"]}
"is_single_photo" is false when the picture is a collage, split screen, stacked or repeated panels, has borders or bars, or shows the same scene twice. bbox values are fractions 0-1 of the image (x0,y0 = top-left). List EVERY tap, faucet, spout, hose, nozzle, bottle, jug and kettle, even small or in the background, and say for each whether anything is coming out of it.`;
export const identityPrompt = (fixed) => `Images 1-2 are photographs of a real product. The last image is a crop from a generated picture that should show the same product. Ignore angle and lighting.
Count hoses, tubes and cables carefully: the real product has exactly as many as the photographs show. If the crop shows an extra hose, a second hanging segment, a loop, or a hose that splits in two, list it in "parts_added" (e.g. "second hose segment hanging at the side").
First, in the crop, TRACE the hose or tube from the point where it is attached to the unit to its free open end, and describe that path in "hose_trace". Then look for any OTHER hose or tube piece that is not on that single path — for example a piece hanging down beside or behind the unit, or a second curve entering from the edge of the picture. If there is one, set "extra_hose_segment": true.
Return ONLY JSON {"hose_trace":"","extra_hose_segment":false,"same_body":true,"same_colour":true,"hoses_in_refs":1,"hoses_in_crop":1,"parts_missing":[""],"parts_added":[""],"fixed_parts_ok":{${(fixed ?? []).map((f) => `"${f}":true`).join(",")}},"brand_text_in_refs":"","brand_text_in_crop":"","brand_text_legible":true,"notes":""}`;

const clean = (xs) => (Array.isArray(xs) ? xs.map((x) => String(x ?? "").trim()).filter(Boolean) : []);
const FORBIDDEN_WATCH = /tap|faucet|bottle|jug|pitcher|second|another|extra pipes|plumbing|steam|held/i;

/** Deterministic verdict. A = inventory JSON, A2 = identity JSON (or null), shot = planner shot, opts.ignore = ["no_text"] for fixtures with burnt captions. */
export function compareToFacts(A, A2, facts, shot, opts = {}) {
  const ignore = new Set(opts.ignore ?? []);
  const visible = shot?.product?.visible !== false;
  const inUse = visible && !!shot?.product?.in_use && !!facts?.output;
  const emitters = Array.isArray(A?.emitters) ? A.emitters.filter((e) => e && e.kind) : [];
  const emitting = emitters.filter((e) => e.emitting === true);
  const taps = emitters.filter((e) => e.kind === "tap_or_faucet");
  // the inventory is told to list EVERY tap/faucet as an emitter; the watch flag alone is too jumpy (it fires on the product's own nozzle)
  const tap_visible = taps.length > 0 || emitters.some((e) => e.attached_to === "wall_or_sink");
  const checks = {}; const cosmetic_notes = []; let fix = ""; let wrongOutlet = false;
  const rec = String(facts?.output?.receptacle ?? "").match(/\b(glass|cup|bowl|plate|mug|tumbler|bucket|jar)\b/i)?.[0]?.toLowerCase() || "receptacle";
  const part = String(facts?.output?.part_short ?? "product's own outlet").replace(/^the\s+/i, "");

  // CRITICAL
  if (!facts?.output || !visible) checks.usage_correct = !visible ? true : emitting.every((e) => e.attached_to === "main_appliance");
  else if (inUse) {
    // the stream must come from the product's REAL outlet — an invented spout on the unit is as wrong as a kitchen tap
    const p = String(facts.output.part ?? "").toLowerCase();
    const expectKind = /hose|tube|pipe/.test(p) ? "hose_or_tube" : /spout|nozzle/.test(p) ? "spout_on_appliance" : null;
    const partNouns = (p.match(/\b(hose|tube|pipe|nozzle|spout|vent|grille|lamp|speaker)\b/g) ?? []);
    const origin = String(A?.stream_origin ?? "").toLowerCase();
    const originOnPart = partNouns.some((n) => origin.includes(n));      // "the nozzle at the end of the flexible hose" is the real outlet
    const invented = clean(A2?.parts_added).some((x) => /spout|nozzle|tap|faucet|outlet|pipe/i.test(x));
    const fromProduct = emitting.length >= 1 && emitting.every((e) => e.attached_to === "main_appliance");
    // With the identity check present, "comes from the product and no invented outlet" is the reliable signal — the inventory's
    // wording for a hose tip varies run to run ("nozzle", "spout", "tip"). Without A2, fall back to the kind / origin text.
    checks.usage_correct = fromProduct && !invented && (A2 ? true : !expectKind || originOnPart || emitting.every((e) => e.kind === expectKind));
    if (fromProduct && !checks.usage_correct) wrongOutlet = true;
  } else checks.usage_correct = emitting.length === 0;
  const watchHits = visible ? (A?.watch ?? []).filter((w) => w?.present === true && FORBIDDEN_WATCH.test(String(w.item)) && (facts?.must_not_show ?? []).concat(["tap or faucet"]).some((m) => String(m).toLowerCase().includes(String(w.item).toLowerCase().split(" or ")[0]) )).filter((w) => !/tap|faucet/i.test(String(w.item))).map((w) => String(w.item)) : [];
  const heldProduct = visible && !["handheld", "wearable", "consumable"].includes(facts?.size_class) && clean(A?.held_objects).some((h) => new RegExp(String(facts?.label ?? "").replace(/^the\s+/i, "").split(" ").pop() || "appliance", "i").test(h));
  checks.no_forbidden_objects = !visible ? true : !tap_visible && watchHits.length === 0 && !heldProduct;
  const units = (Array.isArray(A?.appliances) ? A.appliances : []).reduce((n, a) => n + (Number(a?.count) || 1), 0);
  checks.single_unit = visible ? units === 1 || (units === 0 && facts?.archetype !== "appliance_with_output") : units === 0 || facts?.archetype !== "appliance_with_output";
  // Critical = a different body/colour or an INVENTED part (the extra spout). A missing detail or a slightly different texture
  // (smooth vs ribbed hose) is a note for the owner, not a redraw loop — calibrated on the owner's real photos, 2026-09-17.
  const extraHose = !!A2 && (A2.extra_hose_segment === true || Number(A2.hoses_in_crop) > Math.max(1, Number(A2.hoses_in_refs) || 1));
  checks.same_product = !visible || !A2 ? true : A2.same_body !== false && A2.same_colour !== false && clean(A2.parts_added).length === 0 && !extraHose;
  checks.single_frame = A?.is_single_photo !== false; // a collage / stacked panels is never usable as a video frame
  checks.no_text = ignore.has("no_text") ? true : !(Array.isArray(A?.readable_text) ? A.readable_text : []).some((t) => t?.on === "elsewhere" && String(t?.text ?? "").trim().length > 1);
  const critical = ["single_frame", "usage_correct", "no_forbidden_objects", "single_unit", "same_product", "no_text"];
  const critical_ok = critical.every((k) => checks[k] === true);

  // COSMETIC
  const refsTxt = String(A2?.brand_text_in_refs ?? "").trim().toLowerCase(), cropTxt = String(A2?.brand_text_in_crop ?? "").trim().toLowerCase();
  checks.logo_ok = !cropTxt || !A2?.brand_text_legible || cropTxt === refsTxt || refsTxt.includes(cropTxt);
  if (!checks.logo_ok) cosmetic_notes.push("The printed brand name looks misspelt.");
  checks.parts_ok = !visible || !A2 ? true : clean(A2.parts_missing).length === 0 && Object.values(A2.fixed_parts_ok ?? {}).every((v) => v !== false);
  if (!checks.parts_ok) cosmetic_notes.push(`Product detail differs from your photos${clean(A2?.parts_missing).length ? ": " + clean(A2.parts_missing).slice(0, 2).join(", ") : ""}.`);
  const wantFaces = Number(shot?.people?.faces) || 0;
  checks.people_ok = Number(A?.faces ?? 0) === wantFaces; if (!checks.people_ok) cosmetic_notes.push(`Expected ${wantFaces} face(s), found ${Number(A?.faces ?? 0)}.`);
  const defects = clean(A?.defects);
  checks.hands_ok = !defects.some((d) => /finger|hand/i.test(d)); if (!checks.hands_ok) cosmetic_notes.push("A hand looks unnatural.");
  const bb = Array.isArray(A?.main_subject_bbox) ? A.main_subject_bbox.map(Number) : null;
  const wFrac = bb && bb.length === 4 ? Math.abs(bb[2] - bb[0]) / (bb[2] > 1.5 ? 1000 : 1) : null;
  checks.product_prominent = !visible ? true : A?.main_subject_fully_in_frame !== false && (wFrac == null || wFrac >= (Number(shot?.product?.frame_share) || 0.35) - 0.12);
  if (!checks.product_prominent) cosmetic_notes.push("The product is small or cut off.");
  checks.photo_quality = defects.filter((d) => !/finger|hand/i.test(d)).length === 0; if (!checks.photo_quality) cosmetic_notes.push(defects[0]);

  // fix instruction — written by code from the failing rule
  if (!checks.single_frame) fix = "Make ONE single full-frame photograph filling the whole vertical frame — no collage, no split or stacked panels, no borders, nothing repeated";
  else if (tap_visible && visible) fix = `Remove the ${taps[0]?.kind === "tap_or_faucet" ? "faucet" : "extra spout"} entirely so the wall and counter are plain${inUse ? `; the stream starts at the end of the ${part} and falls into the ${rec}` : "; nothing is flowing anywhere"}${wrongOutlet ? "; the product has no other spout" : ""}; keep the hand, counter and light`;
  else if (wrongOutlet) fix = `The product has no other spout or nozzle: remove it. The only stream starts at the end of the ${part} and falls into the ${rec}`;
  else if (!checks.usage_correct) fix = inUse ? `The only stream in the picture starts at the end of the ${part} and falls into the ${rec}` : "Nothing is flowing or pouring anywhere; the product stands idle";
  else if (!checks.no_forbidden_objects) fix = `Remove ${watchHits[0] ? "the " + watchHits[0] : "the extra object"} so only the product${inUse ? ", the " + rec : ""} and the bare surface remain${heldProduct ? "; the product stands on the surface, nobody holds it" : ""}`;
  else if (!checks.single_unit) fix = "Show exactly one product; remove every other copy or similar appliance";
  else if (!checks.same_product && (extraHose || clean(A2?.parts_added).some((x) => /hose|tube|segment|loop|pipe/i.test(x)))) fix = `The product has ONE single ${part}: remove the extra hanging segment or loop beside the unit; the one ${part} runs from the top of the unit and bends so its free end points down into the ${rec}`;
  else if (!checks.same_product) fix = `Make the product match the reference photos exactly${clean(A2?.parts_added).length ? "; remove " + clean(A2.parts_added).join(", ") : ""}`;
  else if (!checks.parts_ok) fix = `Match the reference photos more closely${clean(A2?.parts_missing).length ? ": restore " + clean(A2.parts_missing).join(", ") : ""}`;
  else if (!checks.no_text) fix = "Remove all lettering that is not printed on the product itself";
  else if (!checks.logo_ok) fix = "Make the printed name small and softly out of focus";

  const okBits = [];
  if (visible && checks.single_unit) okBits.push("one unit");
  if (visible && inUse && checks.usage_correct) okBits.push(`${facts.output.medium !== "none" ? facts.output.medium : "output"} from the product's ${part} only`);
  if (visible && !inUse && checks.usage_correct) okBits.push("nothing pouring");
  if (checks.no_text) okBits.push("no text");
  const visible_objects = [...new Set([...(A?.appliances ?? []).map((a) => String(a?.what ?? "")), ...emitters.map((e) => String(e.kind)), ...(A?.watch ?? []).filter((w) => w?.present).map((w) => String(w.item))].map((x) => x.toLowerCase()).filter(Boolean))];
  return { checks, critical_ok, cosmetic_ok: cosmetic_notes.length === 0, cosmetic_notes, fix_instruction: fix, owner_summary: critical_ok ? okBits.join(" · ") : "", tap_visible, visible_objects, stream_origin: String(A?.stream_origin ?? "") };
}

async function geminiJson(key, model, parts) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: "application/json", temperature: 0, maxOutputTokens: 8192 } }), signal: AbortSignal.timeout(60000) });
  const j = await r.json().catch(() => ({}));
  try { return JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text ?? ""); } catch { return null; }
}
const img = (buf, mime = "image/jpeg") => ({ inlineData: { mimeType: mime, data: buf.toString("base64") } });

/** Full judge: { key, image:Buffer, refs:[Buffer] (identity photos), facts, shot, ignore? } → verdict + raw calls + ms. */
export async function judgeStill({ key, image, refs = [], facts, shot, ignore }) {
  const t0 = Date.now();
  const small = await sharp(image).rotate().resize({ width: 1536, height: 1536, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
  let A = await geminiJson(key, judgeModel(), [img(small), { text: inventoryPrompt(watchListFor(facts)) }]);
  if (!A) A = await geminiJson(key, judgeModel(), [img(small), { text: inventoryPrompt(watchListFor(facts)) }]);
  if (!A) return { error: "judge unavailable", ms: Date.now() - t0 };
  let A2 = null;
  if (shot?.product?.visible !== false && refs.length) {
    const meta = await sharp(image).rotate().metadata();
    let bb = Array.isArray(A.main_subject_bbox) && A.main_subject_bbox.length === 4 ? A.main_subject_bbox.map(Number) : [0, 0, 1, 1];
    if (bb.some((v) => v > 1.5)) bb = bb.map((v) => v / 1000);
    const pad = 0.12, W = meta.width, H = meta.height;
    const x0 = Math.max(0, Math.min(bb[0], bb[2]) - pad), y0 = Math.max(0, Math.min(bb[1], bb[3]) - pad), x1 = Math.min(1, Math.max(bb[0], bb[2]) + pad), y1 = Math.min(1, Math.max(bb[1], bb[3]) + pad);
    const region = { left: Math.round(x0 * W), top: Math.round(y0 * H), width: Math.max(16, Math.round((x1 - x0) * W)), height: Math.max(16, Math.round((y1 - y0) * H)) };
    const crop = await sharp(image).rotate().extract(region).jpeg({ quality: 92 }).toBuffer().catch(() => small);
    const refParts = [];
    for (const r of refs.slice(0, 2)) refParts.push(img(await sharp(r).rotate().resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer()));
    A2 = await geminiJson(key, judgeModel(), [...refParts, img(crop), { text: identityPrompt(facts?.fixed_parts) }]);
  }
  return { ...compareToFacts(A, A2, facts, shot, { ignore }), A, A2, ms: Date.now() - t0, model: judgeModel() };
}
