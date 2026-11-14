import "server-only";
// Design-test links (owner, 19 Oct 2026: "6 links apne ya kisi aur ke WhatsApp par testing ke liye"): the six designs of a website, each as a page
// anyone with the link can open — on any phone, in its own tab — to test and compare. The card and the six looks are written to disk once
// (.test-links/<token>.json, kept 14 days, never in search results); the page applies one look to the card the way the build screen does.
import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type { Card } from "@/lib/types";
import type { Look } from "@/lib/site-looks";
import type { AdvPreview } from "@/lib/adv-preview";

const DIR = path.join(process.cwd(), ".test-links");
const KEEP_MS = 14 * 24 * 60 * 60_000;
const TOKEN = /^[a-f0-9]{16}$/;

/** A Premium design as a test link (owner, 14 Nov 2026: "ye design kisi ko WhatsApp karna ho to?"): its spec and words; the page puts them on the card. */
export type TestDesign = { key: string; name: string; adv: AdvPreview };
export type TestLinks = { uid: string; at: number; card: Card; looks: Look[]; designs?: TestDesign[] };

/** The six looks and the card, as a token. Old files are removed on the way. */
export async function saveTestLinks(uid: string, card: Card, looks: Look[], designs: TestDesign[] = []): Promise<string> {
  await fs.mkdir(DIR, { recursive: true });
  const token = randomBytes(8).toString("hex");
  // the owner's private assistant instructions never leave the server
  const safe: Card = { ...card, botPersona: undefined, botKnowledge: undefined };
  await fs.writeFile(path.join(DIR, `${token}.json`), JSON.stringify({ uid, at: Date.now(), card: safe, looks, ...(designs.length ? { designs } : {}) } satisfies TestLinks));
  void prune();
  return token;
}

export async function loadTestLinks(token: string): Promise<TestLinks | null> {
  if (!TOKEN.test(token)) return null;
  try {
    const j = JSON.parse(await fs.readFile(path.join(DIR, `${token}.json`), "utf8")) as TestLinks;
    return j && Date.now() - j.at < KEEP_MS && Array.isArray(j.looks) && j.card ? j : null;
  } catch { return null; }
}

async function prune() {
  try {
    for (const f of await fs.readdir(DIR)) {
      const p = path.join(DIR, f);
      const st = await fs.stat(p).catch(() => null);
      if (st && Date.now() - st.mtimeMs > KEEP_MS) await fs.rm(p, { force: true });
    }
  } catch { /* best effort */ }
}
