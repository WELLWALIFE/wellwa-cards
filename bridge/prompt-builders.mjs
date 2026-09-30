// Pure prompt builders (spec §5 b/d). Code — never the LLM — writes every product-fidelity sentence,
// and a positive prompt NEVER names an object we do not want drawn (image models draw what is named).
const J = (xs, sep = ", ") => (xs ?? []).map((x) => String(x ?? "").trim()).filter(Boolean).join(sep);
const cap = (s) => { const t = String(s ?? "").trim(); return t ? t[0].toUpperCase() + t.slice(1) : ""; };
const noDot = (s) => String(s ?? "").trim().replace(/[.\s]+$/, "");
const lc1 = (s) => { const t = noDot(s); return t ? t[0].toLowerCase() + t.slice(1) : ""; };
export const UNWANTED = /\b(tap|taps|faucet|faucets|sink|sinks|bottle|bottles|jug|jugs|purifier|purifiers)\b/i;
/** Strip any unwanted noun a creative field may carry next to a visible product. */
const scrub = (s) => (UNWANTED.test(String(s ?? "")) ? "" : String(s ?? "").trim());

/** "a clear glass held directly beneath the end of the hose" → "the glass" */
export function receptacleNoun(facts) {
  const r = String(facts?.output?.receptacle ?? "").toLowerCase();
  if (!r) return "";
  const head = r.split(/\b(held|placed|standing|set|kept|positioned|directly|beneath|under|below|on|in front)\b/)[0].trim();
  const w = head.replace(/^(a|an|the|one)\s+/, "").split(/\s+/).filter(Boolean);
  return w.length ? `the ${w[w.length - 1]}` : "";
}
const VIEW_WORDS = { front: "front view", three_quarter: "three-quarter view", back: "back view", in_use: "working, in use", packaging: "in its packaging", other: "another view" };

/** 2–3 identity refs for a shot. Never role:"context" (the installed photo shows the real tap). */
export function pickRefs(photos, shot) {
  const ids = (photos ?? []).filter((p) => p && p.role !== "context" && p.view !== "installed" && p.view !== "generated");
  const by = (v) => ids.find((p) => p.view === v);
  if (!shot?.product?.visible) return [];
  const want = shot.product.in_use ? [by("in_use"), by("front"), by("output_closeup")] : [by("three_quarter"), by("front"), by("output_closeup")];
  const out = want.filter(Boolean);
  for (const p of ids) if (out.length < 2 && !out.includes(p)) out.push(p);
  return out.slice(0, 3);
}
function refLines(facts, refs, plate) {
  const lines = refs.map((r, i) => `- Image ${i + 1}: ${r.view === "output_closeup" ? `close-up of ${facts.output?.part || "the working part"}` : `${facts.label}, ${VIEW_WORDS[r.view] || "another view"}`}.`);
  if (plate) lines.push(`- Image ${refs.length + 1}: the room. Use only its counter, wall, window and light. Ignore everything else in it.`);
  return lines.join(" ");
}
const peoplePhrase = (shot) => { const n = Number(shot?.people?.faces) || 0; return n === 0 ? (shot?.hands_visible ? "one hand at the frame edge" : "") : n === 1 ? "one person" : `${n} people`; };

/**
 * opts: { ratio:"9:16", refs:[photo], plate:boolean, fix_instruction?:string, tone?:string }
 * shot: planner's creative choices (setting_desc, people, framing, lens, lighting, product{visible,in_use,placement,frame_share}, hero_motion)
 */
export function buildStillPrompt(facts, shot, opts = {}) {
  const ratio = opts.ratio || "9:16"; const refs = opts.refs ?? [];
  const visible = !!shot?.product?.visible;
  const arche = facts?.archetype || "static_item";
  const inUse = visible && !!shot?.product?.in_use && (arche === "appliance_with_output" ? !!facts?.output?.action_positive : arche === "item_used_by_person" ? !!facts?.use_positive : false);
  const faces = Number(shot?.people?.faces) || 0;
  const lens = /50/.test(String(shot?.lens)) ? "50mm" : "35mm";
  const framing = ["close_up", "medium", "wide"].includes(shot?.framing) ? shot.framing.replace("_", "-") : "medium";
  const lighting = noDot(shot?.lighting) || "soft natural daylight";
  const tone = noDot(opts.tone) || "warm and clean";
  const settingDesc = visible ? scrub(noDot(shot?.setting_desc)) || "a bright, tidy Indian home interior" : noDot(shot?.setting_desc) || "a bright, tidy Indian home interior";
  const head = `Photorealistic advertising still, ${ratio}, editorial product photography, shot on a ${lens} lens, natural skin texture.`;
  const subject = faces > 0 ? `${noDot(shot?.people?.desc) || (faces === 1 ? "one person" : `${faces} people`)} (Indian${facts?.people_default ? ", " + noDot(facts.people_default) : ""})` : "no people";
  const correction = opts.fix_instruction ? `\nCORRECTION TO THE LAST IMAGE: ${noDot(opts.fix_instruction)}. Change only that; keep composition, people and lighting.` : "";

  if (!visible) {
    return `${head}

SCENE
[Subject] ${subject}.
[Action] ${noDot(shot?.hero_motion) || "a natural, relaxed everyday moment"}.
[Location] ${settingDesc}.
[Composition] ${framing} shot; important detail sits in the middle band of the frame — the top quarter and the bottom third show only plain background.
[Style] ${lighting}, ${tone}.

The picture contains no lettering. No branded products or appliances are in the frame. All people are Indian.${correction}`;
  }

  const share = Math.round(Math.min(0.6, Math.max(0.25, Number(shot?.product?.frame_share) || 0.4)) * 100);
  const rec = receptacleNoun(facts);
  const action = arche === "appliance_with_output" ? lc1(facts.output?.action_positive) : lc1(facts.use_positive);
  const idle = lc1(facts?.idle_positive) || "stands ready, nobody using it";
  const handsClause = !inUse || arche !== "appliance_with_output" ? "" : facts.hands === "edge" ? `; a hand at the edge of the frame holds ${rec || "the receptacle"}` : facts.hands === "operating" ? "; one hand touches the controls without covering them" : "; nobody touches it";
  // A flexible outlet (hose / tube) hangs at rest in the owner's photos. Image models keep that hanging piece AND add a second bent one.
  // Say explicitly that it is ONE piece whose free end has been moved over the receptacle.
  const flexible = arche === "appliance_with_output" && /hose|tube|pipe|flexible/i.test(String(facts.output?.part ?? ""));
  const partName = String(facts.output?.part_short || facts.output?.part || "").replace(/^the\s+/i, "");
  const onePiece = inUse && flexible ? ` The ${partName} is ONE single continuous piece: one end is fixed to the unit, the other end is free. In the reference photos it hangs at rest; here the same piece is lifted and bent so that its free end points straight down into ${rec || "the receptacle"}. Nothing else hangs down beside the unit — there is no second ${partName.split(" ").pop()}, loop or spare segment.` : "";
  const state = (inUse ? (arche === "appliance_with_output" ? `It is switched on and working: ${action}.` : `${cap(action)}.`) : `It ${idle}.`) + onePiece;
  const actionLine = inUse ? `${action}${handsClause}` : scrub(noDot(shot?.hero_motion)) || `the ${facts.label.replace(/^the\s+/i, "")} ${idle}`;
  const centre = inUse && arche === "appliance_with_output" ? `the end of ${facts.output.part_short || facts.output.part}${rec ? " and " + rec : ""} are the visual centre` : arche === "item_used_by_person" ? `${facts.label} is fully visible and unobstructed` : "the product is the visual centre";
  const keep = arche === "item_used_by_person" ? J(["pattern", "colour", "cut or pack design", ...(facts.fixed_parts ?? [])]) : J(["body shape", "colour", "proportions", ...(facts.fixed_parts ?? [])]);
  const mustShow = inUse && facts.must_show?.length ? `\nVisible in this shot: ${J(facts.must_show.map(noDot), "; ")}.` : "";
  const complete = J(["the product", inUse ? rec : "", peoplePhrase({ ...shot, hands_visible: inUse && facts.hands === "edge" ? true : shot?.hands_visible }), "the bare surface and the wall"]);
  const placement = scrub(noDot(shot?.product?.placement)) || "placed centrally";
  return `${head}

REFERENCE IMAGES
${refLines(facts, refs, !!opts.plate)}

THE PRODUCT — identical to the reference images
${facts.label}: ${noDot(facts.appearance)}. It stands ${noDot(facts.stage_positive) || "on a clear, bare surface against a plain wall"}. Exactly one is in the picture, fully inside the frame, in sharp focus, about ${share}% of the frame width. ${state}

SCENE
[Subject] ${subject}.
[Action] ${actionLine}.
[Location] ${settingDesc}; the product is ${placement}; the surface around it is bare and tidy.
[Composition] ${framing} shot; ${centre}; important detail sits in the middle band of the frame — the top quarter and the bottom third show only plain wall and surface.
[Style] ${lighting}, ${tone}.

KEEP EXACTLY AS IN THE REFERENCES: ${keep}, and where the brand name is printed. The product has only the parts the references show. Any screen or display on it shows only what the references show — a soft glow, no invented words, icons or numbers.${mustShow}
The scene is complete as described: ${complete}. The picture contains no lettering other than what is printed on the product in the references. All people are Indian.${correction}`;
}

/** Guaranteed-simple fallback still: product alone, idle, no people. k=0/1 give two different framings. */
export function buildStillPromptSafe(facts, k = 0, opts = {}) {
  const shot = { setting_desc: "", people: { faces: 0 }, hands_visible: false, framing: k === 0 ? "medium" : "close_up", lens: k === 0 ? "35mm" : "50mm", lighting: "soft even daylight", product: { visible: true, in_use: false, placement: k === 0 ? "seen in a medium three-quarter view" : "seen in a close detail of the front, shallow depth of field", frame_share: k === 0 ? 0.45 : 0.6 }, hero_motion: "" };
  return buildStillPrompt(facts, shot, opts);
}
export const buildPlatePrompt = (shot, ratio = "9:16") => `Photorealistic empty interior, ${ratio}: ${scrub(noDot(shot?.setting_desc)) || "a bright, tidy Indian home interior"}. A clear bare ${/kitchen|pantry/i.test(String(shot?.setting)) ? "counter" : "table"} in the foreground against a plain wall, soft ${noDot(shot?.lighting) || "natural daylight"}. Nothing stands on the surfaces. No people. No lettering.`;
export const buildOwnPhotoPrompt = (ratio = "9:16") => `Extend this photograph to a ${ratio} frame. Keep the original photograph exactly as it is in the centre; continue its surface, wall and light naturally above and below. Add no objects, no people, no lettering.`;

/* ---------------- Kling ---------------- */
const CAMERA = { static: "Static camera, locked off, tripod shot", slow_push_in: "Slow push-in toward the product", subtle_parallax: "Subtle parallax, the camera drifts a few centimetres", gentle_handheld: "Gentle handheld, barely moving" };
const LIQUID = new Set(["water", "food"]);
/** verdict: judge output for the approved still ({visible_objects[]}); retry → static + the failed sentence. */
export function buildKlingPrompt(facts, shot, verdict = {}, { retry = false, failed_sentence = "" } = {}) {
  const visible = !!shot?.product?.visible;
  const inUse = visible && !!shot?.product?.in_use && !!facts?.output;
  let cam = CAMERA[shot?.camera] ? shot.camera : "static";
  if (visible && cam === "gentle_handheld") cam = "static";
  if (retry || (inUse && LIQUID.has(facts.output.medium))) cam = "static";
  const rec = receptacleNoun(facts);
  const medium = facts?.output?.medium && facts.output.medium !== "none" ? facts.output.medium : "";
  const hero = inUse
    ? medium ? `A steady clear stream of ${medium} flows from the end of the ${facts.output.part_short.replace(/^the\s+/i, "")}${rec ? " into " + rec : ""}; the ${medium} level rises slightly` : noDot(facts.output.action_positive)
    : (visible ? scrub(noDot(shot?.hero_motion)) : noDot(shot?.hero_motion)) || "A small natural movement, nothing else changes";
  const seen = (verdict?.visible_objects ?? []).map((x) => String(x).toLowerCase());
  const truths = visible ? (facts?.must_show ?? []).filter((m) => /\b(lit|light|display|screen|on)\b/i.test(m) && (!seen.length || seen.some((o) => /display|screen|panel|light/.test(o)))).slice(0, 1).map(() => "The display stays lit. ").join("") : "";
  const productLine = visible ? ` ${cap(facts.label)} stays exactly as shown — same shape, colours${facts.fixed_parts?.length ? " and " + J(facts.fixed_parts) : ""}; it does not move or change.` : "";
  return `${CAMERA[cam]}.${productLine} ${cap(hero)}. ${truths}The background stays completely still; nothing new enters the frame. Real-time speed, smooth, sharp, photographic.${retry && failed_sentence ? " " + noDot(failed_sentence) + "." : ""}`;
}
const SYN = [["faucet", "tap", "sink"], ["bottle", "jug", "pitcher"], ["second appliance", "duplicate appliance"], ["extra pipes", "plumbing"], ["steam", "smoke"]];
export function buildKlingNegative(facts, shot, positive = "") {
  const pos = String(positive).toLowerCase();
  const stem = (w) => w.toLowerCase().replace(/(es|s)$/, "");
  const inPos = (term) => term.split(/\s+/).some((w) => w.length > 3 && pos.includes(stem(w)));
  const nouns = [];
  for (const phrase of facts?.must_not_show ?? []) {
    const p = String(phrase).toLowerCase();
    for (const group of SYN) for (const g of group) if (p.includes(g) && !nouns.includes(g)) nouns.push(g);
    if (/second|another|two\b/.test(p) && !nouns.includes("second appliance")) nouns.push("second appliance");
    if (/held|hands/.test(p) && !nouns.includes("product held in hands")) nouns.push("product held in hands");
  }
  const scene = nouns.filter((n) => !inPos(n)).slice(0, 8);
  const base = ["blur", "distortion", "low quality", "flicker", "morphing", "warped lettering", "duplicate product", ...scene, "floating objects", "camera shake", "watermark", "subtitles", ...(facts?.hands === "none" ? ["hands"] : ["extra fingers", "warped hands"])];
  return [...new Set(base)].slice(0, 18).join(", ");
}
