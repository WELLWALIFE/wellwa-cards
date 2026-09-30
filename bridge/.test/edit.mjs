// Offline test of the Scene Editor's engine side: a first build, then edits applied on top of it.
//   A  first build (no picture service: the planner's fallback; own photos + word cards)
//   B  a fresh build with a seeded plan + pictures on disk (what a normal film looks like)
//   C  edit 1: title, a heading, a camera move, subtitles off, a picture regenerated (fake picture service),
//      a picture picked from the film, an own photo uploaded, a scene turned into a words card — fast path
//   D  edit 2: a paragraph rewritten and spoken again — timing changes, every shot remade, plan carried over
// No network: Supabase, Gemini and uploads are answered by stubs below.
import fs from "node:fs"; import path from "node:path"; import os from "node:os";
import { execFile } from "node:child_process"; import sharp from "sharp";
import { processExplainer } from "../explainer-engine.mjs";
const run = (args) => new Promise((res, rej) => execFile("ffmpeg", ["-y", "-loglevel", "error", ...args.filter((a, i) => !(i < 3 && ["-y", "-loglevel", "error"].includes(a)))], { maxBuffer: 8e6 }, (e, so, se) => e ? rej(new Error(se || e.message)) : res(so)));
const photo = async (i, label = `photo ${i}`) => sharp({ create: { width: 1600, height: 1000, channels: 3, background: { r: 40 + i * 40, g: 90, b: 150 - i * 20 } } })
  .composite([{ input: Buffer.from(`<svg width="1600" height="1000"><circle cx="${400 + i * 250}" cy="500" r="220" fill="#ffcc66"/><text x="80" y="900" font-size="90" fill="#fff">${label}</text></svg>`), top: 0, left: 0 }]).jpeg().toBuffer();
const fakePicture = async (n) => sharp({ create: { width: 1344, height: 768, channels: 3, background: { r: 30, g: 60 + n * 30, b: 90 } } })
  .composite([{ input: Buffer.from(`<svg width="1344" height="768"><rect x="200" y="150" width="900" height="450" fill="#ff8844"/><text x="240" y="420" font-size="120" fill="#fff">AI ${n}</text></svg>`), top: 0, left: 0 }]).jpeg().toBuffer();
const logo = await sharp({ create: { width: 300, height: 300, channels: 4, background: "#0e9e90" } }).png().toBuffer();

const JOB = "test-edit-0000-0000-000000000000";
const dir = path.join(os.tmpdir(), `explain-${JOB}`);
if ((process.argv[2] || "ABCD").includes("A")) fs.rmSync(dir, { recursive: true, force: true });
let edits = null;                    // what the "app" wrote to the bucket
const patches = [];                  // every PATCH the engine sent to the job row
let fakeN = 0;
const H = {
  sb: async (p, o) => { if (o?.method === "PATCH") patches.push({ p, body: JSON.parse(o.body) }); return { ok: true, json: async () => [{ id: "x" }] }; },
  SUPA_URL: "http://localhost:0", SUPA_KEY: "k", GEMINI: "", FAL_KEY: "",
  ttsLine: async (text, out) => { const sec = Math.max(1.5, text.split(/\s+/).length / 2.6); await run(["-f", "lavfi", "-i", `sine=frequency=300:duration=${sec}`, "-af", "volume=0.3,tremolo=f=6:d=0.9", "-ar", "24000", "-ac", "1", out]); },
  ffArr: run, fetchPhoto: async (u) => u.includes("logo") ? logo : photo(Number(u.slice(-1))), fetchOwnFile: async (u) => (u.includes("upload") ? photo(7, "MY UPLOAD") : null),
  beat: async () => {}, musicFile: () => null, log: (m) => console.log(m),
};
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o) => {
  const url = String(u);
  if (url.startsWith("http://localhost:0")) {
    if (url.endsWith("/edits.json") && (!o || !o.method || o.method === "GET")) return new Response(edits ? JSON.stringify(edits) : "", { status: edits ? 200 : 404 });
    if (url.includes("/object/list/")) return new Response("[]", { status: 200 });
    return new Response("{}", { status: 200 });
  }
  if (url.includes("generativelanguage.googleapis.com")) {
    if (url.includes("generateContent")) {
      const body = JSON.parse(o?.body || "{}");
      if (body.generationConfig?.responseModalities?.includes("IMAGE")) {
        const buf = await fakePicture(++fakeN);
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/jpeg", data: buf.toString("base64") } }] } }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "{}" }] } }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ models: [{ name: "models/gemini-3.1-flash-lite-image", supportedGenerationMethods: ["generateContent"] }] }), { status: 200 });
  }
  return realFetch(u, o);
};
const script = `Namaste dosto. Aaj hum baat karenge Shubhora Business Suite ki.\n\nChhote dukandar ke paas time nahi hota marketing ke liye. Har din poster banana, WhatsApp bhejna, video banana — sab akele karna mushkil hai.\n\nShubhora ye sab ek jagah karta hai. Ek tap mein poster, ek tap mein video, aur customer ko WhatsApp par seedha bhej do.\n\nAaj hi free trial shuru karein. Shubhora.com par jayein.`;
const input = {
  script, title: "Shubhora Business Suite", lang: "hinglish", voice: true, voiceStyle: "warm", music: "", style: "images", formats: ["wide"],
  photos: ["https://x/owner/p0", "https://x/owner/p1"], logoUrl: "https://x/owner/logo", accent: "#0e9e90", captions: true,
};
const job = () => ({ id: JOB, owner_id: "owner", cost: 20, input: { ...input } });
const manifest = () => JSON.parse(fs.readFileSync(path.join(dir, "scenes-wide.json"), "utf8"));
const lastDone = () => patches.filter((x) => x.body.status === "done").pop()?.body;
const shotFiles = () => fs.readdirSync(dir).filter((f) => /^shot-wide-\d+\.mp4$/.test(f)).map((f) => [f, fs.statSync(path.join(dir, f)).mtimeMs]);
const check = (ok, what) => { console.log(`${ok ? "PASS" : "FAIL"}  ${what}`); if (!ok) process.exitCode = 1; };
const step = process.argv[2] || "ABCD";
if (!step.includes("A")) H.GEMINI = "fake";
let t0 = Date.now();

if (step.includes("A")) {
  console.log("\n=== A: first build (no picture service) ===");
  const r = await processExplainer(job(), H);
  console.log("result", r, ((Date.now() - t0) / 1000).toFixed(1) + "s");
  const m = manifest();
  check(m.shots.length > 3 && m.paragraphs.length >= 3, `manifest: ${m.shots.length} shots, ${m.paragraphs.length} paragraphs`);
  check(fs.existsSync(path.join(dir, "shot-wide-0.mp4")), "shots kept on disk after the build");
  check(!fs.existsSync(path.join(dir, "explainer-wide.mp4")) && !fs.existsSync(path.join(dir, "voice.wav")), "big intermediates pruned");
  check(lastDone()?.input?.edits === 0 && lastDone()?.input?.edit === null, "done row carries edits: 0");
}

if (step.includes("B")) {
  console.log("\n=== B: a normal film — seeded plan and pictures ===");
  // Pretend the planner ordered a picture for every line and the pictures came back: what a real film looks like.
  const m = manifest();
  const units = Math.max(...m.shots.map((s) => s.unit)) + 1;
  const unitPlan = Array.from({ length: units }, (_, u) => ({ kind: "image", frame: ["object", "hands", "place", "person"][u % 4], subject: `subject ${u}`, moment: "", backup: "", idea: `idea ${u}`, abstract: false, search: "", heading: u % 2 ? `Heading ${u}` : "" }));
  fs.writeFileSync(path.join(dir, "plan-wide.json"), JSON.stringify({ brief: { world: "a shop", look: "daylight" }, unitPlan }));
  for (const s of m.shots) fs.writeFileSync(path.join(dir, `img-wide-${s.i}.jpg`), await photo(s.i % 5, `AI pic ${s.i}`));
  for (const f of fs.readdirSync(dir)) if (/^(shot|last|hdr|card|scenes)-/.test(f)) fs.rmSync(path.join(dir, f), { recursive: true, force: true });
  H.GEMINI = "fake";
  t0 = Date.now(); patches.length = 0;
  await processExplainer(job(), H);
  console.log(((Date.now() - t0) / 1000).toFixed(1) + "s");
  const m2 = manifest();
  const pics = m2.shots.filter((s) => s.kind === "picture").length;
  check(pics >= 3, `${pics} picture shots, ${m2.shots.filter((s) => s.kind === "reframe").length} reframes, ${m2.shots.filter((s) => s.kind === "card").length} cards`);
  check(m2.shots.every((s) => s.move || s.kind === "card"), "every picture shot records its camera move");
  console.log(m2.shots.map((s) => `${s.i}:${s.kind}:${s.picture ?? "-"}:${s.move ?? "-"}${s.heading ? `:"${s.heading}"` : ""}`).join("  "));
}

if (step.includes("C")) {
  console.log("\n=== C: edit 1 — scene changes only (fast path) ===");
  const m = manifest();
  const before = new Map(shotFiles());
  const pickFrom = m.shots.find((s) => s.kind === "picture" && s.i !== 2)?.picture;
  edits = { n: 1, at: new Date().toISOString(), title: "Shubhora — naya title", paragraphs: {},
    scenes: {
      1: { heading: "Time nahi hai", move: "pan-left", captions: false },
      2: { picture: { mode: "regen", frame: "hands", subject: "a shopkeeper's hands counting notes at a counter", moment: "" } },
      3: { picture: { mode: "pick", from: pickFrom } },
      0: { picture: { mode: "own", url: "https://x/owner/upload-1.jpg" } },
      [m.shots.length - 1]: { picture: { mode: "card" } },
    } };
  const j = job(); j.input.edit = { n: 1, credits: 1 }; j.input.edits = 0; j.input.outputs = { wide: "http://localhost:0/storage/v1/object/public/media/ai-media/owner/explainer-x-wide.mp4" }; j.cost = 1; j.input.costOriginal = 20;
  await new Promise((r) => setTimeout(r, 1100));     // so remade shots have a newer mtime
  t0 = Date.now(); patches.length = 0;
  const r = await processExplainer(j, H);
  console.log("result", r, ((Date.now() - t0) / 1000).toFixed(1) + "s");
  const after = new Map(shotFiles());
  const remade = [...after].filter(([f, t]) => !before.has(f) || before.get(f) !== t).map(([f]) => Number(f.match(/\d+/)[0])).sort((a, b) => a - b);
  console.log("remade shots:", remade.join(","), "of", after.size);
  check(remade.includes(0) && remade.includes(1) && remade.includes(2) && remade.includes(3), "the touched scenes were remade");
  const m2 = manifest();
  check(m2.title === "Shubhora — naya title", "title changed");
  check(m2.shots[1].heading === "Time nahi hai" && m2.shots[1].move === "pan-left" && m2.shots[1].captions === false, `scene 1: heading "${m2.shots[1].heading}", move ${m2.shots[1].move}, captions ${m2.shots[1].captions}`);
  check(/-e1\.jpg$/.test(m2.shots[2].picture ?? "") && m2.shots[2].kind === "picture", `scene 2: new AI picture ${m2.shots[2].picture}`);
  check(m2.shots[3].picture && m2.shots[3].picture.endsWith("-e1.jpg") && m2.shots[3].kind === "picture", `scene 3: picked picture copied to ${m2.shots[3].picture}`);
  check(m2.shots[0].picture && m2.shots[0].picture.endsWith("-e1.jpg"), `scene 0: uploaded picture ${m2.shots[0].picture}`);
  check(m2.shots[m2.shots.length - 1].kind === "card", "last scene is now a words card");
  const done = lastDone();
  check(done?.input?.edits === 1 && done?.input?.edit === null && done?.cost === 20 && done?.input?.title === "Shubhora — naya title", `done row: edits ${done?.input?.edits}, cost back to ${done?.cost}`);
  check(/-e1\.mp4$/.test(done?.output_url ?? ""), `new output name ${done?.output_url}`);
  check(fakeN === 1, `${fakeN} picture(s) bought`);
}

if (step.includes("D")) {
  console.log("\n=== D: edit 2 — a paragraph rewritten and spoken again ===");
  const m = manifest();
  const picsBefore = m.shots.filter((s) => s.kind === "picture").map((s) => s.picture);
  edits = { n: 2, at: new Date().toISOString(), paragraphs: { 1: { text: "Chhote dukandar ke paas marketing ke liye bilkul time nahi hota. Poster, WhatsApp, video, reviews — sab akele sambhalna bahut mushkil hai, aur roz ka kaam bhi karna hai.", revoice: true } }, scenes: {} };
  const j = job(); j.input.edit = { n: 2, credits: 1 }; j.input.edits = 1; j.input.title = "Shubhora — naya title"; j.cost = 1; j.input.costOriginal = 20;
  const fakeBefore = fakeN;
  t0 = Date.now(); patches.length = 0;
  const r = await processExplainer(j, H);
  console.log("result", r, ((Date.now() - t0) / 1000).toFixed(1) + "s");
  const m2 = manifest();
  check(m2.paragraphs[1].text.startsWith("Chhote dukandar ke paas marketing"), "paragraph 2 has the new words");
  check(m2.paragraphs[1].end - m2.paragraphs[1].start > m.paragraphs[1].end - m.paragraphs[1].start, `paragraph 2 longer: ${(m.paragraphs[1].end - m.paragraphs[1].start).toFixed(1)}s → ${(m2.paragraphs[1].end - m2.paragraphs[1].start).toFixed(1)}s`);
  const picsAfter = m2.shots.filter((s) => s.kind === "picture").map((s) => s.picture);
  const kept = picsAfter.filter((p) => picsBefore.includes(p)).length;
  check(kept >= Math.min(picsBefore.length, picsAfter.length) - 1, `pictures carried over: ${kept} of ${picsBefore.length} (now ${picsAfter.length} picture shots)`);
  check(fakeN === fakeBefore, "no new picture bought for a text change");
  check(m2.shots.some((s) => s.heading === "Time nahi hai"), "the edited heading survived the re-cut");
  const done = lastDone();
  check(done?.input?.edits === 2 && done?.input?.script?.includes("bilkul time nahi hota"), "done row: edits 2, script updated");
  console.log(m2.shots.map((s) => `${s.i}:${s.kind}:${s.picture ?? "-"}`).join("  "));
}
if (step.includes("F")) {
  console.log("\n=== F: edit — one heading only (fast path) ===");
  const m = manifest();
  const before = new Map(shotFiles());
  const n = (lastDone()?.input?.edits ?? m.n ?? 0) + 1;
  edits = { n, at: new Date().toISOString(), paragraphs: {}, scenes: { 1: { heading: "Sirf ek heading" } } };
  const j = job(); j.input.edit = { n, credits: 0 }; j.input.edits = n - 1; j.input.title = m.title; j.cost = 0; j.input.costOriginal = 20;
  await new Promise((r) => setTimeout(r, 1100));
  t0 = Date.now(); patches.length = 0;
  await processExplainer(j, H);
  console.log(((Date.now() - t0) / 1000).toFixed(1) + "s");
  const after = new Map(shotFiles());
  const remade = [...after].filter(([f, t]) => !before.has(f) || before.get(f) !== t).map(([f]) => Number(f.match(/\d+/)[0])).sort((a, b) => a - b);
  console.log("remade shots:", remade.join(","), "of", after.size);
  check(remade.length <= 3 && remade.includes(1), "only scene 1 and its neighbour(s) were remade");
  check(manifest().shots[1].heading === "Sirf ek heading", "heading applied");
  check(manifest().shots.filter((s) => s.kind === "picture").length === m.shots.filter((s) => s.kind === "picture").length, "same pictures as before");
}
if (step.includes("G")) {
  console.log("\n=== G: own recording — a paragraph's recording replaced (splice) ===");
  const JOB2 = "test-edit-own0-0000-0000-000000000000";
  const dir2 = path.join(os.tmpdir(), `explain-${JOB2}`);
  fs.rmSync(dir2, { recursive: true, force: true });
  const rec = path.join(os.tmpdir(), "own-rec.mp3"), clip = path.join(os.tmpdir(), "own-clip.mp3");
  // 30 s recording: three tones (one per paragraph, 10 s each) so a splice can be heard in the numbers; 6 s clip.
  await run(["-f", "lavfi", "-i", "sine=frequency=220:duration=10", "-f", "lavfi", "-i", "sine=frequency=440:duration=10", "-f", "lavfi", "-i", "sine=frequency=660:duration=10", "-filter_complex", "[0:a][1:a][2:a]concat=n=3:v=0:a=1[a]", "-map", "[a]", "-b:a", "96k", rec]);
  await run(["-f", "lavfi", "-i", "sine=frequency=880:duration=6", "-b:a", "96k", clip]);
  const H2 = { ...H, fetchOwnFile: async (u) => (u.includes("clip") ? fs.readFileSync(clip) : u.includes("rec") || u.includes("own-voice-e") ? fs.readFileSync(u.includes("own-voice-e") ? path.join(dir2, "own-voice-joined.keep.m4a") : rec) : null) };
  // The joined recording is "uploaded" to the bucket; keep a copy so the next fetch of its URL can find it.
  const realFetch2 = globalThis.fetch;
  globalThis.fetch = async (u, o) => { const url = String(u); if (url.includes("/own-voice-e") && o?.method === "POST") { fs.writeFileSync(path.join(dir2, "own-voice-joined.keep.m4a"), Buffer.from(o.body)); return new Response("{}", { status: 200 }); } return realFetch2(u, o); };
  const script2 = "Pehla paragraph hai ye, poore dus second ka. Isme hum shuru karte hain apni baat, dukan ke baare mein, apne kaam ke baare mein.\n\nDusra paragraph hai ye, poore dus second ka. Isko hum badalne wale hain ek nayi recording se, jo chhe second ki hogi, dekhte hain.\n\nTeesra paragraph hai ye, poore dus second ka. Yahan par hamari baat khatam hoti hai, aur video bhi yahin khatam hota hai.";
  const job2 = () => ({ id: JOB2, owner_id: "owner", cost: 20, input: { ...input, script: script2, voiceUrl: "https://x/owner/rec.mp3", audioSeconds: 30, title: "", logoUrl: "" } });
  edits = null;
  t0 = Date.now(); patches.length = 0;
  await processExplainer(job2(), H2);
  const m1 = JSON.parse(fs.readFileSync(path.join(dir2, "scenes-wide.json"), "utf8"));
  console.log("first build:", m1.total + "s", m1.paragraphs.map((p) => `${p.start}-${p.end}`).join("  "), ((Date.now() - t0) / 1000).toFixed(1) + "s");
  check(Math.abs(m1.total - 30) < 1.5, `recording length carried into the film (${m1.total}s)`);
  edits = { n: 1, at: new Date().toISOString(), paragraphs: { 1: { voiceUrl: "https://x/owner/clip.mp3" } }, scenes: {} };
  const j = job2(); j.input.edit = { n: 1, credits: 0 }; j.input.edits = 0; j.cost = 0; j.input.costOriginal = 20;
  t0 = Date.now(); patches.length = 0;
  await processExplainer(j, H2);
  const m2 = JSON.parse(fs.readFileSync(path.join(dir2, "scenes-wide.json"), "utf8"));
  console.log("after splice:", m2.total + "s", m2.paragraphs.map((p) => `${p.start}-${p.end}`).join("  "), ((Date.now() - t0) / 1000).toFixed(1) + "s");
  check(Math.abs(m2.total - 26) < 1.5, `film is now about 26 s (10 + 6 + 10): ${m2.total}s`);
  const done = lastDone();
  check(/own-voice-e1\.m4a$/.test(done?.input?.voiceUrl ?? ""), `job's recording is now the joined one: ${done?.input?.voiceUrl}`);
  globalThis.fetch = realFetch2;
}
console.log("\nfinished", process.exitCode ? "with FAILURES" : "clean");
