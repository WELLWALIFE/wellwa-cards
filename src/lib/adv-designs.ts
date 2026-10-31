import "server-only";
// The Premium designs an owner has made for a card, kept on disk (owner, 24 Oct 2026: "ek baar design banne ke baad user close bhi kar de
// to auto save ho jaaye; dobara banaye to pehle bane wale page par le jaye — 1, 2 ya 3 design pehle se bane hon to dobara na banaye").
// Each finished preview is written here the moment it is made, so a closed screen, another phone or a server restart never loses it
// and the same design is never paid for twice. The newest KEEP are kept (one payment = 3 designs). Next to the build jobs (.card-jobs/).
import fs from "node:fs/promises";
import path from "node:path";

type Obj = Record<string, unknown>;
const DIR = path.join(process.cwd(), ".card-jobs");
// Every design made is kept and shown (owner, 31 Oct 2026: "4th, 5th, 6th bhi dikhni chahiye, user koi bhi chune"), up to 12 — older ones
// drop off the far end.
const KEEP = 12;
const g = globalThis as unknown as { __advDesigns?: Map<string, Obj[]> };
const mem = (g.__advDesigns ??= new Map());
const fileOf = (k: string) => path.join(DIR, `adv-${k.replace(/[^a-zA-Z0-9-]/g, "")}.json`);
const keyOf = (uid: string, cardId: string) => `${uid}-${cardId}`;

export async function advDesigns(uid: string, cardId: string): Promise<Obj[]> {
  const k = keyOf(uid, cardId);
  const hit = mem.get(k);
  if (hit) return hit;
  let list: Obj[] = [];
  try { const j = JSON.parse(await fs.readFile(fileOf(k), "utf8")) as unknown; if (Array.isArray(j)) list = j.filter((x) => x && typeof x === "object") as Obj[]; } catch { /* none yet */ }
  mem.set(k, list);
  return list;
}

export async function rememberAdvDesign(uid: string, cardId: string, result: Obj): Promise<void> {
  const k = keyOf(uid, cardId);
  const seed = (result.spec as { seed?: unknown } | undefined)?.seed;
  const list = (await advDesigns(uid, cardId)).filter((r) => seed === undefined || (r.spec as { seed?: unknown } | undefined)?.seed !== seed);
  const next = [...list, { ...result, madeAt: Date.now() }].slice(-KEEP);
  mem.set(k, next);
  try {
    await fs.mkdir(DIR, { recursive: true });
    const tmp = `${fileOf(k)}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(next));
    await fs.rename(tmp, fileOf(k));
  } catch (e) { console.log("[adv-designs] save failed:", e instanceof Error ? e.message : e); }
}
