// The owner's script → a shot list: what is ON SCREEN for each shot, and what words go over it.
//
// The unit here is a SHOT (a few seconds, one or more whole sentences), not a paragraph. That is the difference
// between a film and a slideshow: a paragraph can run half a minute, and a picture that sits there that long is
// the thing the owner rejected.
//
// It decides nothing about the narration: the words spoken are the owner's, untouched. It chooses the picture,
// and it writes the short title that appears with it — and the title it writes is checked by headline.mjs,
// which throws away anything that reads as half a sentence.
import { HEADLINE_RULES, pickHeadline, scriptOf } from "./headline.mjs";
import { FRAMES, PICTURE_RULES, sanitizeOrder, pictureStats } from "./explainer-picture.mjs";

const MODEL = "gemini-3.5-flash";
// A long video is planned in batches. 20 shots of Devanagari headings and picture descriptions overran the
// model's output limit and came back as truncated JSON — every heading in that batch was lost. Ten fits.
const PER_CALL = 6;    // six shots of five picture fields each is what fits in one reply without truncating

export const SHOT_KINDS = ["stock", "image", "text", "photo"];

const clampKind = (k, hasPhotos) => {
  const v = String(k || "").toLowerCase();
  if (v === "photo") return hasPhotos ? "photo" : "image";
  return SHOT_KINDS.includes(v) ? v : "image";
};
/** The words that name the picture the owner threw out. Cheaper to catch here than to generate and judge. */
const GENRE = /\b(team|teamwork|success|growth|professional|professionals|modern office|office meeting|meeting|discussing|planning|smiling|happy|collaboration|lifestyle|business people|handshake|thumbs up)\b/i;
const words = (s, n) => String(s || "").split(/\s+/).filter(Boolean).slice(0, n).join(" ");


/**
 * BEFORE any picture is planned, one call reads the WHOLE script and works out what this video actually is.
 *
 * Without it the planner sees two sentences at a time and nothing else, so it picks a disconnected object for
 * each line — a paper ledger for a line about Google, a village room for a line about AI. Understanding the
 * video first is what makes the pictures belong to the same film.
 */
export async function understandScript(fullText, { geminiKey, log = () => {} }) {
  const EMPTY = { about: "", audience: "", world: "", era: "", avoid: "", look: "" };
  if (!geminiKey || !fullText) return EMPTY;
  const prompt = `Read this narration for a video and work out what it is, before anyone decides what to show.

"""
${String(fullText).slice(0, 6000)}
"""

Return ONLY JSON:
{"about":"<what this video is selling or explaining, one English sentence>",
 "audience":"<who is watching, one short English phrase>",
 "world":"<the world the pictures must live in: the kind of places, objects and tools that belong in this video, one English sentence>",
 "era":"<how current it must look, one short English phrase>",
 "avoid":"<what would be plainly wrong to show, one short English phrase>",
 "look":"<the one photographic look every picture in this film shares — time of day, quality of light, colour palette, lens feel — one English sentence, specific>"}

"world" decides every picture in the film, so be concrete about the PLACES and the OBJECTS. If the narration is
about software, phones, the internet, marketing or AI, the world is present-day working India: a tidy small shop
or a small office, a smartphone in use, a laptop, printed order books alongside the phone, a clean counter, city
daylight. It is NOT a crumbling village room, NOT an antique ledger, NOT a bullock cart, NOT a handloom, and NOT
anything that looks like it was photographed thirty years ago.
"era" must say what year this looks like.
"look" is what makes forty separate pictures read as ONE film: pick one and commit (for example "late-morning window light, warm neutral palette with one teal accent, 35mm at f/4, gentle contrast"). Never "varied" or "mixed".`;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": geminiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: 8192 } }),
      signal: AbortSignal.timeout(90_000),
    }).then((x) => x.json());
    if (r?.error) throw new Error(`Gemini ${r.error.code ?? ""}: ${String(r.error.message ?? "").slice(0, 140)}`);
    const t = String(r.candidates?.[0]?.content?.parts?.[0]?.text ?? "");
    if (!t.includes("{")) throw new Error(`empty reply (${r.candidates?.[0]?.finishReason ?? "none"})`);
    const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
    const one = (v, n) => String(v || "").replace(/\s+/g, " ").trim().slice(0, n);
    const brief = { about: one(j.about, 200), audience: one(j.audience, 120), world: one(j.world, 260), era: one(j.era, 80), avoid: one(j.avoid, 160), look: one(j.look, 220) };
    log(`[shots] this video is about: ${brief.about}`);
    log(`[shots] the world: ${brief.world}`);
    if (brief.look) log(`[shots] the look: ${brief.look}`);
    return brief;
  } catch (e) {
    log(`[shots] could not read the script as a whole (${e?.message ?? e})`);
    return EMPTY;
  }
}

function buildPrompt(groups, { brief, hasPhotos, prefer, offset }) {
  const numbered = groups.map((g, i) => {
    const mark = g.opensParagraph ? "  [NEW TOPIC]" : "";
    return `${offset + i} (${g.sec.toFixed(1)}s)${mark}: ${g.text.slice(0, 420)}`;
  }).join("\n\n");

  const b = brief || {};
  return `You are the editor of a narrated video for an Indian small business.

WHAT THIS VIDEO IS: ${b.about || "a video for an Indian small business"}
WHO IS WATCHING: ${b.audience || "Indian small-business owners"}
THE WORLD EVERY PICTURE LIVES IN: ${b.world || "present-day working India: a tidy small shop or office, a smartphone in use, a laptop, a clean counter, city daylight"}
HOW CURRENT IT MUST LOOK: ${b.era || "today, this year"}
NEVER SHOW: ${b.avoid || "anything that looks decades old"}

Every picture you choose must belong to that ONE world. A picture that would be at home in a different film is
wrong even if it matches the words.

THE RULES EVERY PICTURE IS CHECKED AGAINST — write every order so that it passes them on the first try:
${PICTURE_RULES}

Below are the SHOTS of the video in order — each is a few seconds of narration, with its length in seconds.
For EACH shot decide what the viewer SEES while those words are spoken.

${numbered}

Choose one kind per shot:
- "image": a picture is made for exactly these words. This is the normal choice.
- "text": the words alone on screen, because the point IS the words — a number, a price, a promise, a conclusion.
- "photo": these words are about the owner's own product, shop or work.${hasPhotos ? "" : " (No photos in this video — never choose it.)"}
- "stock": real filmed footage of a place, a crowd, a street, an activity.${prefer === "images" ? " NOT available for this film — never choose it; order an \"image\" instead." : ""}

Rules:
- A shot marked [NEW TOPIC] starts a new part of the script. Its picture must be a clear break from the shot before it.
- Never the same kind more than twice in a row.
- "text" is rare: at most one shot in every EIGHT, never two in a row, and only for a price, a number, a promise or the closing line. A film that keeps cutting to words is a slideshow.
- Every shot, whatever its kind, still carries a complete picture order (frame, subject, moment, backup): if the words cannot be shown, the picture will be.
- For an "image" shot do NOT describe a scene that would go nicely with the words. DECIDE THE PICTURE: choose ONE
  thing a camera could photograph in an Indian town today that MEANS what this line says. Fill five fields:
  - "idea": what this line actually claims, plain English, max 12 words, with a doing word in it.
    ("enquiries go cold when nobody calls them back", "one person is doing the work of four")
  - "frame": exactly one of these six words —
      "object"  one object, or a few objects together, and no people at all — this is the normal choice
      "hands"   Indian hands and forearms doing one action, no face in the frame
      "screen"  a phone or laptop switched on, its content out of focus and unreadable
      "place"   a room, counter, shop, street or workshop with nobody in it
      "pair"    two real things side by side on one surface, because the DIFFERENCE between them is the point
                (a knee-high stack and a tall one, a full crate and an empty crate, one chair and four chairs)
      "person"  exactly ONE Indian person, absorbed in doing one specific thing, not looking at the camera
  - "subject": the ONE thing in the frame, an English noun phrase of at most 14 words, carrying a detail that makes
    it real: "a phone lying face-up on a shop counter beside a half-filled order book", not "a phone".
    Never a category of people ("a businessman", "a team", "staff", "customers", "a happy family").
    Never a symbol: no arrow, graph, funnel, ladder, light bulb, trophy, jigsaw piece, rocket, handshake.
    Never anything whose point is writing on it. Never these words: team, success, growth, professional,
    modern office, meeting, discussing, planning, smiling, happy, collaboration, lifestyle.
  - "moment": what is happening at the instant the shutter fires, one short English clause, max 12 words.
  - "backup": the SAME idea with NO people and NO hands — objects and a place only, max 14 words. It must name
    DIFFERENT things from "subject", not a closer crop of it. It is used when the first picture fails.

HOW TO CHOOSE. This is the whole job. The left-hand side is what a real rejected video produced:
  heading "लीड्स का फॉलो-अप"  → NOT a man packing cardboard boxes in a storeroom.
    idea "enquiries go cold when nobody calls them back" · frame "screen"
    subject "a phone lying face-up on a shop counter, screen lit, beside a half-filled order book"
    moment "a thumb held just above the screen, not yet pressing"
    backup "an order book open on a counter, half its rows ticked, a phone lying across it"
  heading "बड़ा बिज़नेस बनाने का तरीका"  → NOT six people smiling in a modern office.
    idea "a big business is built by adding one more, every day" · frame "pair"
    subject "two stacks of sealed cartons on one shop counter, one knee-high, one taller than the counter"
    moment "the top carton of the tall stack still sitting crooked"
    backup "two stacks of cartons of very different heights on one counter in a godown doorway"
  heading "मार्केटिंग टीम की ज़रूरत"  → NOT hands holding a phone showing a chat app.
    idea "one person is doing the work of four" · frame "place"
    subject "one worn chair at a small shop desk with four empty chairs pulled up around it"
    moment "morning light from the doorway falling across the empty seats"
    backup "four empty plastic chairs around one shop desk, an unopened bundle of pamphlets on it"

- Two shots in a row must never share a "frame" and never repeat a "subject".
- Choose whichever frame SHOWS THIS LINE best. There is no quota: if the line is about a person doing something,
  show that person. People belong in this film and most lines are about people.
  The one thing that is never allowed is the old failure — a group posed for the camera, a meeting, a team
  smiling at the lens, people arranged in a row for the picture. One person, absorbed in one real task, looking
  at the task and not at us.
- Never two "person" shots in a row — vary what the camera is on, even when both lines are about people.
- A shot marked [NEW TOPIC] must change BOTH the frame and the place it is photographed in.
- For "photo" shots leave idea, frame, subject, moment and backup empty. A "text" shot still carries all five.
- "abstract": true when the line is about an idea, a habit, a feeling or time ("consistency is the real problem",
  "trust takes years") rather than a thing or an action a camera could catch; false otherwise.
- "search" is for "stock": a 2-5 word English footage query. Empty otherwise.

${HEADLINE_RULES}

Return ONLY JSON: {"shots":[{"n":${offset},"kind":"image","abstract":false,"idea":"...","frame":"object","subject":"...","moment":"...","backup":"...","search":"","heading":"...","keyword":"..."}]}`;
}

async function callPlanner(groups, opts, offset) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": opts.geminiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(groups, { ...opts, offset }) }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.4, maxOutputTokens: 8192 },
    }),
    signal: AbortSignal.timeout(120_000),
  }).then((x) => x.json());
  // An API that refuses us — no credit on the account, a bad key, a quota — must never look like "the model had
  // no opinion". Silently falling back to no headings is how a whole video came out blank and nothing said why.
  if (r?.error) throw new Error(`Gemini ${r.error.code ?? ""}: ${String(r.error.message ?? "").slice(0, 160)}`);
  const t = String(r.candidates?.[0]?.content?.parts?.[0]?.text ?? "");
  if (!t) throw new Error(`Gemini returned nothing (${r?.candidates?.[0]?.finishReason ?? "no candidates"})`);
  try {
    const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
    if (Array.isArray(j.shots)) return j.shots;
  } catch { /* fall through and salvage */ }
  // A reply cut off mid-array is still useful: every COMPLETE object in it is a shot we can use, and losing the
  // last one beats losing all ten.
  const out = [];
  for (const m of t.matchAll(/\{[^{}]*\}/g)) {
    try { const o = JSON.parse(m[0]); if (o && o.n !== undefined) out.push(o); } catch { /* not a shot */ }
  }
  return out;
}

/**
 * groups: [{ text, sec, opensParagraph }] — one per shot, in order.
 * Returns one entry per shot: { kind, picture, search, heading }.
 * A failure is never fatal: the shot falls back to a picture of its own words.
 */
export async function planShots(groups, { geminiKey, brief = null, hasPhotos = false, prefer = "images", log = () => {} }) {
  const fallback = groups.map(() => ({ kind: "text", frame: "object", subject: "", moment: "", backup: "", idea: "", abstract: false, search: "", heading: "" }));
  if (!geminiKey || !groups.length) return fallback;

  const raw = groups.map(() => null);
  for (let start = 0; start < groups.length; start += PER_CALL) {
    const slice = groups.slice(start, start + PER_CALL);
    try {
      for (const s of await callPlanner(slice, { geminiKey, brief, hasPhotos, prefer }, start)) {
        const n = Number(s?.n);
        if (!Number.isInteger(n) || n < 0 || n >= groups.length) continue;
        raw[n] = s;
      }
    } catch (e) {
      log(`[shots] planning failed for shots ${start}-${start + slice.length - 1} (${e?.message ?? e})`);
    }
  }

  // The planner is not trusted with the words: every heading goes through the validator, and a heading that
  // reads as half a sentence becomes no heading at all.
  const usedHeadlines = new Set();
  const script = scriptOf(groups.map((g) => g.text).join(" ")); // headings stay in the owner's script
  const plan = groups.map((g, i) => {
    const s = raw[i];
    if (!s) return fallback[i];
    let kind = clampKind(s.kind, hasPhotos);
    // The long-video engine has no footage library: a "stock" order there is a shot with no picture, which then
    // borrows a neighbour's and sits through two headings. It is a picture order from the start.
    if (kind === "stock" && prefer === "images") kind = "image";
    const txt = (v, n) => String(v || "").replace(/\s+/g, " ").trim().split(/\s+/).slice(0, n).join(" ");
    let frame = FRAMES.includes(String(s.frame || "").toLowerCase()) ? String(s.frame).toLowerCase() : "object";
    let subject = txt(s.subject, 14);
    let moment = txt(s.moment, 12);
    const backup = txt(s.backup, 14);
    const idea = txt(s.idea, 12);
    // The genre gate, free, before any money moves: these words ARE the picture the owner rejected. A subject
    // carrying one of them is swapped for its no-people backup, and if that is no better it becomes a word card.
    if (kind === "image" && GENRE.test(`${subject} ${moment}`)) {
      if (backup && !GENRE.test(backup)) { subject = backup; frame = "object"; moment = ""; }
      else kind = "text";
    }
    // No subject to photograph means no picture: the words on screen beat a picture of something else.
    if (kind === "image" && !subject) kind = "text";
    // A text shot still keeps its picture order, so the film can put a picture there if it ends up with too many
    // cards (below). Without a subject the idea itself is the order — "a shop counter at opening time" reads fine.
    if (kind === "text" && !subject && !GENRE.test(idea)) subject = idea;
    return { kind, frame, subject, moment, backup, idea: idea || subject, abstract: s.abstract === true,
      search: words(String(s.search || "").replace(/[^a-z0-9 ]/gi, " "), 5),
      heading: pickHeadline(s, usedHeadlines, script) };
  });

  // The planner sees six shots at a time and cannot remember the batch before, so variety is enforced here over
  // the whole film: no two neighbours share a frame, and people stay rare.
  for (let i = 0; i < plan.length; i++) {
    const p = plan[i];
    if (p.kind !== "image") continue;
    const prev = plan[i - 1];
    if (prev && prev.kind === "image" && plan[i].frame === prev.frame) {
      const swap = { object: "hands", hands: "object", screen: "place", place: "screen", pair: "object", person: "object" };
      plan[i] = { ...plan[i], frame: swap[plan[i].frame] ?? "object" };
    }
  }

  // Structure the planner is asked for but cannot be relied on to keep: a word card at most once in eight shots,
  // never two in a row, never as the very first shot. Anything beyond that becomes the picture it was ordered with.
  let lastText = -99;
  for (let i = 0; i < plan.length; i++) {
    if (plan[i].kind !== "text") continue;
    const tooSoon = i - lastText < 8 || i === 0;
    if (tooSoon && plan[i].subject) { plan[i] = { ...plan[i], kind: "image" }; continue; }
    lastText = i;
  }
  const withHead = plan.filter((p) => p.heading).length;
  log(`[shots] ${plan.length} shots: ${plan.map((s) => s.kind[0]).join("")} · ${withHead} headings kept, ${plan.length - withHead} dropped`);
  log(`[shots] frames: ${plan.filter((p) => p.kind === "image").map((p) => p.frame[0]).join("")}`);
  return plan;
}


/**
 * THE ORDER CHECK. Before a rupee goes to the image model, every picture order is read against PICTURE_RULES —
 * first by code (the words that always fail: "displaying", "dashboard", "two people"…), then by a text model
 * that sees ten orders at a time with their spoken lines and REWRITES any order that would not pass. A text
 * check costs a hundredth of a rejected picture. Returns the plan with corrected orders; every change is logged
 * with its reason, so the planner's habits can be seen and fixed.
 */
export async function reviewOrders(plan, groups, { geminiKey, brief = null, log = () => {} }) {
  const out = plan.map((p, i) => {
    if (p.kind !== "image" && p.kind !== "text") return p;
    if (!p.subject) return p;
    const { order, fixed } = sanitizeOrder(p);
    if (fixed.length) { pictureStats.codeFixed = (pictureStats.codeFixed ?? 0) + 1; log(`[order] shot ${i} fixed in code: ${fixed.join("; ")}`); }
    return order;
  });
  if (!geminiKey) return out;
  const PER = 10;
  for (let start = 0; start < out.length; start += PER) {
    const idx = [];
    for (let i = start; i < Math.min(out.length, start + PER); i++) if ((out[i].kind === "image" || out[i].kind === "text") && out[i].subject) idx.push(i);
    if (!idx.length) continue;
    const list = idx.map((i) => `${i}: line="${String(groups[i]?.text || "").slice(0, 200)}" · title="${out[i].heading}" · idea="${out[i].idea}" · frame=${out[i].frame} · subject="${out[i].subject}" · moment="${out[i].moment}" · backup="${out[i].backup}" · abstract=${out[i].abstract}`).join("\n");
    const prompt = `You check photograph ORDERS before they are sent to an image model. Each order will become ONE photograph shown under its title while the line is spoken, in this world: ${brief?.world || "present-day working India: a tidy small shop or office, a smartphone, a laptop, a clean counter, daylight"}.

${PICTURE_RULES}

Also: two neighbouring orders must not show the same subject; a "frame" must be one of object, hands, screen, place, pair, person; "subject" is one concrete photographable thing (max 14 words) that a viewer connects to the line; "backup" names different things than "subject", with no people.

For EACH order decide: would the photograph it describes pass every rule, and does it logically belong to its line?
- If YES: ok:true and repeat the fields EXACTLY as given. A specific, unusual, concrete order ("one worn chair with four empty chairs around it") is a GOOD order — do not "improve" it, do not make it more generic, do not swap it for a person at a laptop.
- If NO: ok:false, name the rule in "why", and REWRITE the order so that it passes — keep the meaning, change only what breaks the rule. Prefer the smallest change (a screen turned off, a second person removed, a symbol replaced by the real thing).
- If ONLY the backup is wrong (same as the subject, or it has people), keep "subject" and "moment" EXACTLY as given and rewrite only "backup". Never reword a subject that already passes.
Set "abstract" correctly in both cases.

Orders:
${list}

Return ONLY JSON: {"orders":[{"n":0,"ok":true,"why":"<max 10 words, empty when ok>","abstract":false,"frame":"object","subject":"...","moment":"...","backup":"..."}]} — include every n, and for ok:true repeat the fields unchanged.`;
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": geminiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: 8192 } }),
        signal: AbortSignal.timeout(90_000),
      }).then((x) => x.json());
      if (r?.error) throw new Error(`Gemini ${r.error.code ?? ""}: ${String(r.error.message ?? "").slice(0, 140)}`);
      const t = String(r.candidates?.[0]?.content?.parts?.[0]?.text ?? "");
      const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
      pictureStats.reviewed += idx.length;
      for (const o of (Array.isArray(j.orders) ? j.orders : [])) {
        const i = Number(o.n);
        if (!idx.includes(i)) continue;
        const cur = out[i];
        const abstract = o.abstract === true;
        if (o.ok === true) { out[i] = { ...cur, abstract }; continue; }
        const txt = (v, n) => String(v || "").replace(/\s+/g, " ").trim().split(/\s+/).slice(0, n).join(" ");
        const bag = (t) => new Set(String(t || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2));
        const overlap = (a, b) => { const A = bag(a), B = bag(b); if (!A.size || !B.size) return 0; let n = 0; for (const w of A) if (B.has(w)) n++; return n / Math.max(A.size, B.size); };
        const newSubject = txt(o.subject, 14) || cur.subject;
        const newBackup = txt(o.backup, 14) || cur.backup;
        const frame = FRAMES.includes(String(o.frame || "").toLowerCase()) ? String(o.frame).toLowerCase() : cur.frame;
        // "one worn chair" → "one office chair" is not a rewrite, it is noise: a subject that keeps most of its
        // words keeps its original wording; only a genuinely different backup is taken from such a reply.
        if (overlap(newSubject, cur.subject) >= 0.6 && frame === cur.frame) {
          const backup = overlap(newBackup, cur.subject) < 0.6 ? newBackup : cur.backup;
          if (backup !== cur.backup) log(`[order] shot ${i} backup replaced (${txt(o.why, 10) || "backup too close to subject"}): "${backup}"`);
          out[i] = { ...cur, abstract, backup };
          continue;
        }
        const { order } = sanitizeOrder({ ...cur, abstract, frame, subject: newSubject, moment: txt(o.moment, 12), backup: newBackup });
        out[i] = order;
        pictureStats.rewritten++;
        log(`[order] shot ${i} rewritten (${txt(o.why, 10) || "would not pass"}): "${cur.subject}" → "${order.subject}"`);
      }
    } catch (e) {
      log(`[order] review failed for shots ${start}-${start + PER - 1} (${e?.message ?? e}) — orders used as planned`);
    }
  }
  return out;
}
