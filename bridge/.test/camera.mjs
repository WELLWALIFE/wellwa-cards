// Camera test: real-length shots on one detailed picture, every move, then measure the motion frame by frame.
import fs from "node:fs"; import path from "node:path";
import { execFile } from "node:child_process";
import { buildShots, MOVES } from "../explainer-shots.mjs";
const run = (args) => new Promise((res, rej) => execFile("ffmpeg", ["-y","-loglevel","error",...args.slice(3)], { maxBuffer: 8e6 }, (e, so, se) => e ? rej(new Error(se||e.message)) : res(so)));
const dir = "/tmp/cam/out"; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
const W = Number(process.env.W || 1920), H = Number(process.env.H || 1080);
const pic = "/tmp/cam/pic.jpg";
const secs = [4, 6.5, 9, 11, 3.5, 7, 5.5];      // one length per move, spread across the real range
// Every shot is its own paragraph, so nothing is reframed — except the last two, which share one (reframe test).
const shots = secs.map((s, i) => ({ text: `shot ${i}`, frames: Math.round(s * 30), para: i < 6 ? i : 5, slice: 0, slices: 1 }));
const plan = shots.map(() => ({ kind: "image", heading: "" }));
const pictures = new Map(shots.map((_, i) => [i, pic]));
const t0 = Date.now();
const files = await buildShots(dir, { W, H }, { shots, plan, pictures, photoFiles: [], accent: "#0e9e90", logoPng: null, ff: run, findClip: null, H: { log: console.log }, tag: "t", fallbackCard: async () => { throw new Error("no card expected"); }, cuesByShot: new Map(), onStep: (i, k) => console.log("shot", i, MOVES[i % MOVES.length], secs[i] + "s", k) });
fs.writeFileSync(path.join(dir, "list.txt"), files.map((f) => `file '${f}'`).join("\n"));
await run(["-y","-loglevel","error","-f","concat","-safe","0","-i",path.join(dir,"list.txt"),"-c","copy",path.join(dir,"all.mp4")]);
console.log("built", files.length, ((Date.now()-t0)/1000).toFixed(1)+"s");
