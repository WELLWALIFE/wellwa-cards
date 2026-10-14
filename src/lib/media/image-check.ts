import "server-only";
// "Perfect in one go" (owner, 14 Oct 2026: "ai se image baar baar banane ki jarurat na pade"): every picture the AI makes is
// looked at by a checker before the owner ever sees it; a flawed one is drawn again (with the checker's fix note) at no charge to
// the owner, up to a limit, and the best of the tries is kept.
import sharp from "sharp";
import { geminiComplete } from "@/lib/gemini";

/** The guide every image prompt carries: what a good picture for a small business's website is, and what must never appear. */
export const IMAGE_GUIDE = "PICTURE RULES — follow all: " +
  "ONE clear main subject, large and fully inside the frame (nothing cut off), in sharp focus on a simple, uncluttered background. " +
  "Correct anatomy: any person has exactly two hands with five fingers each, natural faces and teeth, relaxed natural poses; people look Indian, in current everyday clothes. " +
  "Objects are physically correct and plausible: right proportions, real materials, nothing melted, merged, duplicated, floating or bent out of shape. " +
  "One consistent perspective, soft natural shadows, bright natural light, true-to-life colour, a modern 2026 look. " +
  "It must look like a real photograph from a professional camera — never an illustration, painting, 3D render, cartoon, HDR glow or over-smoothed AI skin. " +
  "No text, letters, numbers, logos, watermarks, frames, borders, collages or split screens anywhere.";

export type Verdict = { pass: boolean; score: number; problems: string[]; fix: string };

/** The checker. `ref` is the owner's own photo when the picture is an improved version of it (the product must stay the same). */
export async function checkImage(img: Buffer, brief: string, ref?: Buffer): Promise<Verdict | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const small = await sharp(img, { failOn: "none" }).resize({ width: 768, withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
    const parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [];
    if (ref) {
      const r = await sharp(ref, { failOn: "none" }).resize({ width: 512, withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();
      parts.push({ text: "ORIGINAL photo:" }, { inlineData: { mimeType: "image/jpeg", data: r.toString("base64") } });
    }
    parts.push({ text: ref ? "NEW picture (the AI's improved version):" : "PICTURE:" }, { inlineData: { mimeType: "image/jpeg", data: small.toString("base64") } });
    parts.push({ text: `You are the quality checker for pictures that go on a small Indian business's website.
BRIEF: ${brief.slice(0, 600)}
Check strictly: (1) it matches the brief; ${ref ? "(1b) it is EXACTLY the same product as the original — same shape, colour, parts and printing, nothing added or removed; " : ""}(2) no visible text, letters, numbers, logos or watermarks; (3) no deformed hands or fingers, odd faces or teeth, extra or missing limbs, melted, merged, duplicated or impossible objects, wrong perspective; (4) it does not look old, dull, dark, grainy, cluttered, or like an illustration, render or cartoon; (5) the main subject is clear, large and fully in frame.
Return ONLY JSON {"pass":true|false,"score":0-10,"problems":["<short>"],"fix":"<one sentence telling the artist how to avoid these problems next time>"}. pass is true only when score is 8 or more and there are no problems.` });
    const { text } = await geminiComplete({ apiKey: key, tag: "image-check", maxOutputTokens: 500, temperature: 0, json: true, contents: [{ role: "user", parts }] });
    const j = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as Partial<Verdict>;
    const score = Math.max(0, Math.min(10, Number(j.score) || 0));
    const problems = (Array.isArray(j.problems) ? j.problems : []).map((x) => String(x).slice(0, 80)).slice(0, 5);
    return { pass: j.pass === true && score >= 8 && problems.length === 0, score, problems, fix: String(j.fix ?? "").slice(0, 240) };
  } catch { return null; }
}
