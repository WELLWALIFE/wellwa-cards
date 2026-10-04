// Making a picture that MEANS what is being said — and refusing the ones that do not.
//
// The old way asked an image model for "a lifestyle photograph for an Indian small-business video" plus a scene,
// and every line came back as the same picture: Indian people smiling in an office or a shop. A line about
// following up on leads produced a man packing cartons; a line about needing a marketing team produced six people
// in a meeting. Nothing checked, so all of it shipped.
//
// Two changes. First, the picture is ORDERED, not suggested: the planner names one thing a camera could
// photograph, and by default there is nobody in the frame at all — an object, a pair of objects, hands, a lit
// screen, an empty room. People are the exception, not the default, because "people in a room" is the genre we
// are escaping. Second, every picture is looked at by a model that was told nothing about what we wanted, and its
// description — not its opinion — is what decides whether the picture is kept.
//
// Kept separate from stock-reel.mjs on purpose: aiStill()/looksClean() there are shared with Reel Maker, a shipped
// product, and must not change under it.
import sharp from "sharp";

const VISION = "gemini-3.5-flash";
// The long video's own image model switch (EXPLAINER_GEMINI_IMG), falling back to the app-wide IMG_MODEL.
// Separate on purpose: reels and posters draw from the owner's product photos as references, which the
// cheaper "lite" model handles less well; a long video's pictures are made from words alone.
const IMG = () => process.env.EXPLAINER_GEMINI_IMG || process.env.IMG_MODEL || "gemini-3.1-flash-lite-image";
const EP = "https://generativelanguage.googleapis.com/v1beta/models";

export const FRAMES = ["object", "hands", "screen", "place", "pair", "person"];

/**
 * THE ONE RULEBOOK. The planner writes orders against it, the order-check reads orders against it, and the
 * picture check reads finished pictures against it. One text, three readers — so nothing can pass the order
 * stage and fail the picture stage for a reason the order stage never heard of.
 */
export const PICTURE_RULES = `A picture passes only if ALL of these hold:
1. ONE continuous photograph: no collage, no split screen, no panels, no borders, no repeated strip.
2. NO readable writing anywhere: no sign, label, price, number, logo, poster, packaging text, no readable content on any screen or sheet of paper. A phone, tablet or laptop may appear only switched OFF, or as a soft unreadable glow turned away from the camera. An order must never ask for a screen "displaying" or "showing" anything.
3. People: none, or hands and forearms only, or exactly ONE Indian person absorbed in a real task, not looking at the camera, not smiling for it, not posed. Never a group, a meeting, a handshake, a row of people, a crowd.
4. No symbols drawn to stand for an idea: no arrows, graphs, funnels, ladders, light bulbs, trophies, rockets, jigsaw pieces, upward curves.
5. Present-day India, clean and in good repair: not rustic, not vintage, not a village hut, not sepia, not decades old.
6. Bodies and objects plausible: no extra or fused fingers, no warped face, no melted or impossible object.
7. The subject is a physical thing a camera can photograph, logically tied to the spoken line. For a line about an idea, a habit, a feeling or time, a concrete scene from the right world is enough — do not try to photograph the abstraction.`;

/** Orders that would break rule 2 or 3 on sight — caught before a rupee is spent. */
const SCREEN_CONTENT = /\b(display(?:ing|s|ed)?|show(?:ing|s)?)\b[^.,;]{0,60}\b(screen|chart|graph|dashboard|form|list|interface|app|messages?|chat|conversation|notification|menu|website|web ?page|profile|pipeline|analytics|report|invoice|catalog|catalogue|feed|video|photo|post|story|reel|content|data|table|map|text|numbers?|results?|options?|homepage|page)\b|\b(dashboard|spreadsheet|screenshot|interface|webpage|web page|signboard|sign board|nameplate|name plate|price tag|price list|banner|poster|flyer|pamphlet|brochure|logo|label|invoice|receipt|bill|notification|text message|chat window|whatsapp chat|caption|headline|list of|menu card|qr code|barcode)\b/i;
const GROUP = /\b(two people|three people|several people|group of|a group|crowd|team of|the team|meeting|handshake|shaking hands|another person|second person|two men|two women|colleagues|family|couple|audience|a queue of people|people (?:standing|sitting|waiting|talking))\b/i;
const DEVICE = /\b(phone|smartphone|mobile|tablet|laptop|computer|monitor|screen|tv|television)\b/i;
/** Cleans one order in code. Returns { order, fixed: [reasons] }. */
export function sanitizeOrder(order) {
  const fixed = [];
  let { subject = "", moment = "", backup = "", frame = "object" } = order;
  const hit = (t) => (String(t).match(SCREEN_CONTENT) || String(t).match(GROUP) || [])[0] || "";
  const bad = (t) => !!hit(t);
  if (bad(subject) || bad(moment)) {
    const word = hit(subject) || hit(moment);
    if (bad(subject) && backup && !bad(backup)) { fixed.push(`subject "${subject}" → backup (because of "${word}")`); subject = backup; moment = ""; frame = "object"; }
    else if (!bad(subject)) { fixed.push(`moment dropped (because of "${word}")`); moment = ""; }
    else {
      const before = subject;
      // Drop only the "displaying …" clause, keep the place: "a laptop displaying a website on a counter" →
      // "a laptop on a counter".
      subject = subject.replace(/\s*\b(display(?:ing|s|ed)?|show(?:ing|s)?)\b\s+(?:a|an|the|its|their)?[^,;]*?(?=\s+(?:on|at|in|inside|beside|next to|near|by|against|under|over|behind|across)\b|[,;]|$)/i, "").replace(/\s{2,}/g, " ").replace(/[,;:\s]+$/, "").trim();
      if (DEVICE.test(subject) && !/switched off|screen dark|face-down|face down|unreadable glow/i.test(subject)) subject += frame === "screen" ? ", its screen a soft unreadable glow" : ", its screen switched off";
      if (GROUP.test(subject)) subject = subject.replace(GROUP, "one person").replace(/\bone person\b(.*)\bone person\b/i, "one person$1");
      moment = bad(moment) ? "" : moment;
      if (!subject) subject = before;
      fixed.push(`subject "${before}" → "${subject}" (because of "${word}")`);
      if (GROUP.test(before) && frame !== "person" && frame !== "hands") frame = "person";
    }
  }
  return { order: { ...order, subject, moment, backup, frame }, fixed };
}

/** Counters for the film's cost line: what was generated where, and what the checks cost. */
export const pictureStats = { imagen: 0, gemini: 0, judgeA: 0, judgeB: 0, kept: 0, spare: 0, failed: 0, reviewed: 0, rewritten: 0, codeFixed: 0, reasons: {} };
export const resetPictureStats = () => { for (const k of Object.keys(pictureStats)) pictureStats[k] = k === "reasons" ? {} : 0; };
const tally = (reasons) => { for (const r of reasons || []) { const k = r.replace(/\d+/g, "n").slice(0, 40); pictureStats.reasons[k] = (pictureStats.reasons[k] ?? 0) + 1; } };
/** Rupees, roughly, at ₹84/$: Imagen 4 Fast $0.02, Gemini image $0.067, a vision check ≈ $0.006, a text check ≈ $0.001. */
const geminiPictureRupees = () => (/lite/i.test(IMG()) ? 2.8 : /pro/i.test(IMG()) ? 11.3 : 5.6);
export const pictureCostRupees = () => Math.round(pictureStats.imagen * 1.7 + pictureStats.gemini * geminiPictureRupees() + pictureStats.judgeA * 0.5 + pictureStats.judgeB * 0.1 + pictureStats.reviewed * 0.03);

/** How many faces each kind of frame is allowed. Anything above this is a reject, whatever the picture looks like. */
const FACE_OK = { object: 0, hands: 0, screen: 0, place: 0, pair: 0, person: 1 };

const FRAME_CLAUSE = {
  object: (s, m) => `The photograph is a close, straight-on shot of ${s}.${m ? ` ${m}.` : ""} There are no people and no parts of people anywhere in the frame.`,
  hands: (s, m) => `The photograph shows only Indian hands and forearms: ${s}.${m ? ` ${m}.` : ""} The frame is cropped at the forearm — no face, no head, no shoulders, no full body.`,
  screen: (s, m) => `The photograph shows ${s}.${m ? ` ${m}.` : ""} The device is switched on and glowing, tilted away from the lens and thrown just out of focus, so that not one word, number, digit or icon on it can be read — only the soft shapes of a list or a chat. No face is in the frame.`,
  place: (s, m) => `The photograph is of the place itself: ${s}.${m ? ` ${m}.` : ""} There is nobody in it — no face, no figure, the room is empty.`,
  pair: (s, m) => `The photograph shows ${s} — both of them together in ONE continuous photograph, on the same surface, in the same light, so the difference between them is obvious at a glance.${m ? ` ${m}.` : ""} It is one scene photographed once: not a split screen, no dividing line, no panels, no before-and-after strip. There are no people in the frame.`,
  person: (s, m) => `The photograph shows exactly ONE Indian person, ${s}, in the middle of doing something real${m ? `: ${m}` : ""}. They are absorbed in the task, caught mid-action, and they are NOT looking at the camera and NOT smiling at it. No second person, no group, no meeting, no handshake.`,
};

/** The order sent to the image model. Everything that pulled the old prompt towards stock photography is gone. */
export function stillPrompt({ frame = "object", subject, moment = "", wide = true, note = "", world = "", look = "" }) {
  return [
    `A photograph taken this year, ${wide ? "widescreen 16:9" : "vertical 9:16"} — one single frame, not a collage, not a split or stacked image.`,
    // First, because it is the rule most often broken: the picture carries no writing of any kind.
    "There is NO writing anywhere in this photograph: no sign, no label, no price, no number, no logo, no poster, no printed packaging, nothing readable on any paper. Any phone, tablet or laptop in it is switched off or shows only a soft unreadable glow, turned away from the lens.",
    (FRAME_CLAUSE[frame] || FRAME_CLAUSE.object)(subject, moment),
    // The world comes from reading the whole script, so a film about software does not get a picture from a film
    // about farming. Without it every picture is invented on its own and they never belong together.
    world ? `The setting is ${world}` : "The setting is present-day working India: a tidy small shop or a small office, a smartphone or laptop in use, a clean counter, daylight.",
    // Written against a real failure: an earlier version said "documentary, available light only, nothing tidied,
    // not an advertisement", and every picture came back as a crumbling village room with a clay pot — a film
    // about AI and Google illustrated with the India of thirty years ago. Clean and current, without going glossy.
    "It is PRESENT DAY India, this year: clean, well kept and in good repair, the way a working shop or office looks today. NOT old, NOT rustic, NOT a village hut, NOT peeling walls, NOT a mud floor, NOT antique registers or oil lamps or clay pots, nothing sepia, nothing distressed, nothing vintage.",
    // One look for the whole film, decided once from the script (shotlist.understandScript). Without it every
    // picture picks its own light and palette, and forty good pictures still do not make one film.
    look
      ? `The light and colour are the same as every other picture in this film: ${look}. Sharp and clear, true colour — a real photograph of a real place, not a posed advertisement and not a glossy corporate stock image.`
      : "Bright natural daylight, sharp and clear, true colour, photographed on a 35mm lens at f/4 — a real photograph of a real place, not a posed advertisement and not a glossy corporate stock image.",
    wide
      ? "The subject sits slightly left of centre with clean uncluttered space to the right, and the top sixth of the frame is calm empty background."
      : "The subject sits in the middle of the frame; the top fifth and the bottom third are calm empty background.",
    note,
  ].filter(Boolean).join(" ");
}

// These models think before they answer, and the thinking is charged against the same budget. At 2048 the whole
// budget went into thinking and the reply came back empty with finishReason MAX_TOKENS — which read here as
// "the checker is broken, keep the picture", i.e. no checking at all.
const json = async (key, model, parts, maxOutputTokens = 8192, ms = 45_000) => {
  const r = await fetch(`${EP}/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: "application/json", temperature: 0, maxOutputTokens } }),
    signal: AbortSignal.timeout(ms),
  }).then((x) => x.json());
  if (r?.error) throw new Error(`Gemini ${r.error.code ?? ""}: ${String(r.error.message ?? "").slice(0, 140)}`);
  const c = r.candidates?.[0];
  const t = String(c?.content?.parts?.[0]?.text ?? "");
  if (!t.includes("{")) throw new Error(`empty reply (${c?.finishReason ?? "no candidate"})`);
  return JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
};

const SEE = `Describe this photograph as a careful inspector. Report only what is visible. Do not guess what it is meant to mean.
Return ONLY JSON:
{"saw":"<what is happening in the picture, at most 16 words>",
 "objects":["<the 3-6 things a viewer would actually notice>"],
 "faces":0,
 "people":"none|one|group",
 "look":"na|indian|not_indian|unsure",
 "posed":false,
 "readable_text":false,
 "single_photo":true,
 "defects":false}
"faces" is how many human faces are recognisable, however small. "people" counts recognisable people; hands alone are "none".
"look": "na" when there are no people; otherwise "indian" only if every visible person could be South Asian, "unsure" if you cannot tell.
"posed" is true when anyone faces the camera, smiles for it, or is arranged in a row or group for the picture.
"readable_text" is true only if a viewer could actually READ a word, a number or a logo at a glance — clear and in focus, on a sign, label, price tag, packaging, paper or screen. Tiny, blurred or illegible marks, and a screen showing only soft unreadable shapes, are false.
"single_photo" is false for a collage, split screen, stacked or repeated panels, a repeated strip or band, or borders.
"defects" is true for extra or fused fingers, a warped face, or a melted or impossible object.`;

/**
 * Two questions, in this order, and neither of them is "is this good?".
 *  A. A model that has been told NOTHING about what we wanted describes the picture.
 *  B. A second, text-only call asks whether THAT DESCRIPTION supports the line being spoken.
 * The verdict is then computed here in code — never taken from the model's own opinion, which is the same
 * discipline the stock-clip picker already uses.
 */
export async function judgePicture(key, buf, { frame, subject, idea, heading, nextHeading = "", abstract = false }) {
  const small = await sharp(buf).resize({ width: 768 }).jpeg({ quality: 80 }).toBuffer();
  pictureStats.judgeA++;
  const A = await json(key, VISION, [{ inlineData: { mimeType: "image/jpeg", data: small.toString("base64") } }, { text: SEE }]);

  // Hard faults nobody should see: a collage, readable text, a visible defect, a person who plainly is not
  // Indian, a group posed for the camera (the genre this whole engine exists to escape).
  const faces = Number(A.faces ?? 0);
  if (A.people === "group" && faces < 2) A.people = faces === 1 ? "one" : "none";   // "group" with no faces is a guess, not a sighting
  if (A.people === "none") A.look = "na";
  const hard = A.single_photo === false || A.readable_text === true || A.defects === true || A.look === "not_indian" || (A.people === "group" && A.posed === true);
  const craft = !hard && A.posed !== true
    && Number(A.faces ?? 0) <= (FACE_OK[frame] ?? 0)
    && (frame !== "object" || A.people === "none")
    && (frame !== "person" || (A.people === "one" && A.look === "indian"))
    && (A.people === "none" || A.look === "indian");
  // A soft craft miss (posed, one person more than ordered, "unsure" about the look) is a picture a viewer
  // would still accept; makePicture keeps it as the last resort rather than showing the same picture twice.
  if (!craft) {
    // Say WHICH rule broke, in words a person can act on. This is what the log and the cost line report.
    const reasons = [];
    if (A.single_photo === false) reasons.push("collage/panels");
    if (A.readable_text === true) reasons.push("readable text");
    if (A.defects === true) reasons.push("defect (hands/face/object)");
    if (A.look === "not_indian") reasons.push("person not Indian");
    if (A.look === "unsure") reasons.push("person's look unsure");
    if (A.posed === true) reasons.push("posed for camera");
    if (A.people === "group") reasons.push("group of people");
    if (Number(A.faces ?? 0) > (FACE_OK[frame] ?? 0)) reasons.push(`${A.faces} face(s), ${FACE_OK[frame] ?? 0} allowed for "${frame}"`);
    else if (frame === "object" && A.people !== "none") reasons.push(`person in an "object" frame`);
    else if (frame === "person" && A.people !== "one") reasons.push(`"person" frame with ${A.people} people`);
    return { ok: false, why: "craft", soft: !hard, reasons, A, B: null };
  }

  const ask = `A viewer will see ONE photograph on screen, under a title, while a narrator speaks.
Someone who had not been told what was wanted described that photograph as: "${A.saw}", containing: ${(A.objects ?? []).join(", ")}.
The line being spoken means: "${idea}".
The title on screen says: "${heading}".
The photograph was ordered as: "${subject}".
${nextHeading ? `Afterwards the SAME photograph will be held on screen under a second title: "${nextHeading}".` : ""}
Judge only from that description. Everyday synonyms count as the same thing (register/ledger/notebook, shop/store, godown/warehouse, carton/box).
Return ONLY JSON:
{"on_idea":0,"on_title":"yes|partly|no","has_subject":"yes|partly|no","fits_next":"yes|no","missing":"<max 8 words>"}
"on_idea" — how well a viewer who sees ONLY this photograph lands on the idea:
  3 = they would get the idea from the photograph alone
  2 = the ordered thing is clearly there, doing what was ordered; the spoken words carry the rest
  1 = only the general world of the topic — an office, a shop, a workplace, people working, a meeting, someone at
      a counter, someone on a phone, someone smiling
  0 = nothing to do with it
A photograph of people working, a team, a meeting, an office, a shopkeeper standing in his shop, or a generic shop
counter that does not show the ordered thing is 1. Never give such a photograph 2.
"on_title" — would a viewer who sees only this photograph and that title say the photograph is about the title?
"fits_next" — same question for the second title; "no" when there is no second title.`;
  const B = await json(key, VISION, [{ text: ask }], 4096, 35_000);
  pictureStats.judgeB++;
  // A line about an idea ("consistency matters") cannot be photographed; for it, the right world under the right
  // title is the pass mark. A line about a thing must show the thing.
  const need = abstract ? 1 : 2;
  const meaning = Number(B.on_idea ?? 0) >= need && B.on_title !== "no" && (abstract || B.has_subject !== "no");
  // on_idea 1 = the right world, not the exact point: under its title and narration, still a usable last resort.
  const reasons = meaning ? [] : [
    Number(B.on_idea ?? 0) < need ? `on_idea ${B.on_idea ?? 0} < ${need}` : "",
    B.on_title === "no" ? "does not fit the title" : "",
    !abstract && B.has_subject === "no" ? "ordered subject missing" : "",
    B.missing ? `missing: ${B.missing}` : "",
  ].filter(Boolean);
  return { ok: meaning, why: meaning ? "" : "meaning", soft: !meaning && Number(B.on_idea ?? 0) >= 1 && B.on_title !== "no", reasons, A, B };
}

/** Attempt 2 is a DIFFERENT picture, not the same order rolled again — re-rolling returns the same genre. */
function nextAttempt(order, verdict) {
  const { A, B, why } = verdict;
  const tight = order.frame === "person" ? "object" : order.frame === "place" ? "object" : order.frame;
  if (why === "craft") {
    if (A?.readable_text) return { ...order, note: "There is absolutely no writing anywhere: no sign, no label, no price, no number, no logo. Any screen or paper in the picture is turned away from the camera or thrown out of focus." };
    if (Number(A?.faces ?? 0) > 0 || A?.look === "not_indian" || A?.look === "unsure") return { ...order, frame: "hands", note: "" };
    return { ...order, note: "One single photograph, one continuous scene, no panels, no borders, no repeated strip. Nobody poses for the camera. Hands and faces are anatomically correct." };
  }
  return {
    ...order,
    frame: order.frame === "person" ? "object" : tight,
    subject: order.frame === "person" && order.backup ? order.backup : order.subject,
    note: `Do NOT show: ${A?.saw ?? "a generic workplace scene"}. Show ${order.subject} and nothing else, filling most of the frame, photographed close.`,
  };
}

/**
 * One picture, up to three DIFFERENT attempts, each judged.
 * Returns { buf, attempts, verdict } or { buf: null } when nothing passed — the caller then shows the words,
 * which is always better than a picture of the wrong thing.
 */
/** Imagen 4 Fast — a dedicated text-to-image model that follows a photographic order far more literally than the
 *  conversational Gemini image model, at about a third of the price. `predict`, not `generateContent`. */
// Which Imagen the key can actually call is asked of Google once per process (ListModels), never guessed: model
// names change, and a wrong guess silently sends every picture to the dearer Gemini model. EXPLAINER_IMG_MODEL
// pins a name; "none" turns Imagen off.
let imagenModel = null;      // resolved name, "" when there is none
let imagenDown = false;      // set when the key cannot use Imagen at all (404/403): every later picture goes to Gemini
export async function resolveImagen(key, { log = () => {} } = {}) {
  if (imagenModel !== null) return imagenModel;
  const pinned = process.env.EXPLAINER_IMG_MODEL;
  if (pinned === "none") { imagenModel = ""; return imagenModel; }
  if (pinned && pinned !== "auto") { imagenModel = pinned; return imagenModel; }
  try {
    const names = [], others = [];
    let pageToken = "";
    for (let page = 0; page < 5; page++) {
      const r = await fetch(`${EP}?pageSize=200${pageToken ? `&pageToken=${pageToken}` : ""}`, { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(20_000) }).then((x) => x.json());
      for (const m of r?.models ?? []) {
        const name = String(m.name || "").replace(/^models\//, "");
        if (/imagen/i.test(name) && (m.supportedGenerationMethods ?? []).includes("predict")) names.push(name);
        else if (/image/i.test(name) && (m.supportedGenerationMethods ?? []).includes("generateContent")) others.push(name);
      }
      pageToken = r?.nextPageToken || "";
      if (!pageToken) break;
    }
    // Printed so a person can pick a cheaper image model by hand (IMG_MODEL) when Imagen is not on the key.
    if (others.length) log(`[pictures] Gemini image models on this key: ${others.join(", ")}`);
    // Fast first (a third of the price), then standard, never "ultra" by default; newest version wins.
    const rank = (n) => (/fast/i.test(n) ? 0 : /ultra/i.test(n) ? 2 : 1);
    names.sort((a, b) => rank(a) - rank(b) || b.localeCompare(a));
    imagenModel = names[0] || "";
    log(imagenModel ? `[pictures] Imagen available on this key: ${names.join(", ")} → using ${imagenModel}` : `[pictures] no Imagen model on this key — pictures will come from ${IMG()}`);
  } catch (e) { log(`[pictures] could not list models (${e?.message ?? e}) — using ${IMG()}`); imagenModel = ""; }
  return imagenModel;
}
const IMAGEN = () => imagenModel || "";
async function generateImagen(key, prompt, { wide }) {
  const r = await fetch(`${EP}/${IMAGEN()}:predict`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio: wide ? "16:9" : "9:16", personGeneration: "allow_adult", outputMimeType: "image/jpeg" } }),
    signal: AbortSignal.timeout(90_000),
  }).then((x) => x.json());
  if (r?.error) {
    const err = new Error(`Imagen ${r.error.code ?? ""}: ${String(r.error.message ?? "").slice(0, 120)}`);
    err.code = r.error.code;
    if (r.error.code === 402 || r.error.code === 429) err.provider = r.error.code;
    throw err;
  }
  const b64 = r.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error(`Imagen: no image (${JSON.stringify(r).slice(0, 120)})`);
  return Buffer.from(b64, "base64");
}
async function generateGemini(key, prompt, { wide }) {
  const r = await fetch(`${EP}/${IMG()}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: wide ? "16:9" : "9:16" } },
    }),
    signal: AbortSignal.timeout(90_000),
  }).then((x) => x.json());
  if (r?.error) {
    const err = new Error(`Gemini ${r.error.code ?? ""}: ${String(r.error.message ?? "").slice(0, 120)}`);
    if (r.error.code === 402 || r.error.code === 429) err.provider = r.error.code;
    throw err;
  }
  const part = (r.candidates?.[0]?.content?.parts ?? []).find((x) => x.inlineData?.data);
  return part ? Buffer.from(part.inlineData.data, "base64") : null;
}

/**
 * One order → one picture, or null. TWO attempts, not three: the order was already checked against the rules
 * before it got here, so a second miss is the model's, and a third try at the same thing rarely helps. The best
 * soft-rejected picture is kept as the last resort. Every rejection is logged with the rule it broke.
 */
export async function makePicture(key, order, { wide = true, world = "", look = "", log = () => {}, tag = "", judge = true } = {}) {
  let cur = { ...order, note: "" };
  let last = null;
  let spare = null;          // the best rejected picture that a viewer would still accept — used only if nothing passes
  for (let t = 0; t < 2; t++) {
    const prompt = stillPrompt({ ...cur, wide, world, look });
    let buf = null;
    if (imagenModel === null) await resolveImagen(key, { log });
    for (let net = 0; net < 2 && !buf; net++) {
      try {
        if (!imagenDown && IMAGEN()) {
          try { buf = await generateImagen(key, prompt, { wide }); pictureStats.imagen++; }
          catch (e) {
            if (e?.provider) throw e;
            if (e?.code === 404 || e?.code === 403 || e?.code === 400) { imagenDown = true; log(`${tag} Imagen not available on this key (${e.message}) — using ${IMG()} from here on`); }
            else { log(`${tag} Imagen call failed: ${e?.message ?? e}`); if (net === 0) { await new Promise((r) => setTimeout(r, 4000)); continue; } }
          }
        }
        if (!buf) { buf = await generateGemini(key, prompt, { wide }); if (buf) pictureStats.gemini++; }
        if (!buf) continue;
        const m = await sharp(buf).metadata();
        const ar = m.width && m.height ? m.width / m.height : 0;
        if (!(wide ? ar > 1.4 : ar > 0 && ar < 0.62)) { log(`${tag} picture came back in the wrong shape (${m.width}x${m.height})`); buf = null; continue; }
      } catch (e) {
        if (e?.provider) throw e;                       // billing / quota: the engine decides what to do
        log(`${tag} picture call failed: ${e?.message ?? e}`);
        if (net === 0) await new Promise((r) => setTimeout(r, 4000));
      }
    }
    if (!buf) continue;
    // An order the owner wrote in the editor is taken as it comes: they asked for exactly this, and they will
    // look at it themselves. The check is for orders a model wrote.
    if (!judge) { pictureStats.kept++; return { buf, attempts: t + 1, verdict: null }; }

    try {
      const verdict = await judgePicture(key, buf, cur);
      last = verdict;
      if (verdict.ok) { pictureStats.kept++; return { buf, attempts: t + 1, verdict }; }
      tally(verdict.reasons);
      log(`${tag} picture ${t + 1} rejected — ${verdict.reasons?.join("; ") || verdict.why}: ${verdict.A?.saw ?? ""}`);
      if (verdict.soft && (!spare || (verdict.B && !spare.verdict.B))) spare = { buf, attempts: t + 1, verdict };
      cur = nextAttempt(cur, verdict);
    } catch (e) {
      log(`${tag} picture check failed (${e?.message ?? e}) — keeping the picture`);
      pictureStats.kept++;
      return { buf, attempts: t + 1, verdict: null };     // a broken checker must not cost the owner a picture
    }
  }
  if (spare) { pictureStats.spare++; log(`${tag} keeping the best of the rejected pictures (${spare.verdict.reasons?.join("; ") || spare.verdict.why}) — better than repeating another`); return { ...spare, spare: true }; }
  pictureStats.failed++;
  return { buf: null, attempts: 2, verdict: last };
}
