// Bot training helper. Turns an uploaded PDF (or pasted text) into a clean,
// structured knowledge base the AI bot can use — works for ANY product
// (water ionizer or anything else the distributor sells).
//
// Body: { pdfBase64?, filename?, text? }  ->  { knowledge: string }
// Env-gated: without GEMINI_API_KEY, PDF is rejected with a hint and pasted
// text is passed through unchanged.

import { geminiComplete } from "@/lib/gemini";
import { readOwnSite } from "@/lib/reference-site";
import { clientKey, rateLimited, requireUser, sameOrigin } from "@/lib/api-security";

type Body = { pdfBase64?: string; filename?: string; text?: string; url?: string };

const INSTRUCTION = `You are building a knowledge base for a sales/support chatbot.
From the document, extract ALL useful facts a customer or prospect might ask about, as clean plain text.
Organise under short headings when helpful: Products, Prices/Offers, Key Benefits, How it works, Warranty/Support, FAQs, Business/Compensation (if any).
Keep it factual and concise. Do NOT invent anything not in the document. Return only the knowledge text, no preamble.`;

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const session = await requireUser();
  if (!session) return Response.json({ error: "sign in required" }, { status: 401 });
  if (rateLimited(clientKey(request, `ai-train:${session.user.id}`), 5, 60 * 60_000)) {
    return Response.json({ error: "AI training limit reached." }, { status: 429 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > 4_000_000) {
    return Response.json({ error: "PDF must be smaller than 2.5 MB." }, { status: 413 });
  }
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }

  const key = process.env.GEMINI_API_KEY;

  // The owner's own website (owner's call, 10 Oct 2026): read its pages and distil them the same way as a PDF.
  if (body.url) {
    const raw = String(body.url).trim();
    if (!/^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}/i.test(raw)) return Response.json({ error: "Enter the website address, e.g. alkafresh.in" }, { status: 400 });
    if (!key) return Response.json({ error: "Reading a website needs the AI key. You can paste its text instead." }, { status: 400 });
    const site = await readOwnSite(raw).catch(() => null);
    if (!site || site.text.trim().length < 80) return Response.json({ error: "Could not read that website (it may block robots or be built only in JavaScript). Paste its text instead." }, { status: 422 });
    try {
      const { text: knowledge, blocked } = await geminiComplete({
        apiKey: key, maxOutputTokens: 2500, tag: "ai-train:site",
        contents: [{ role: "user", parts: [{ text: `${INSTRUCTION}\n\nThe document is the text of the business's own website ${site.url}:\n\n${site.text.slice(0, 60_000)}` }] }],
      });
      if (blocked || !knowledge) return Response.json({ error: "Could not distil that website. Paste its text instead." }, { status: 422 });
      return Response.json({ knowledge, url: site.url });
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "ai error" }, { status: 500 });
    }
  }

  // Pasted text with no PDF: nothing to distill, return as-is.
  if (!body.pdfBase64) {
    return Response.json({ knowledge: (body.text || "").trim() });
  }

  if (!key) {
    return Response.json(
      { error: "PDF extraction needs the AI key. You can paste the text manually instead." },
      { status: 400 }
    );
  }

  try {
    const { text: knowledge, blocked } = await geminiComplete({
      apiKey: key,
      maxOutputTokens: 2000,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: "application/pdf", data: body.pdfBase64 } },
            { text: INSTRUCTION + (body.text ? `\n\nAlso merge in these extra notes:\n${body.text}` : "") },
          ],
        },
      ],
    });
    if (blocked || !knowledge)
      return Response.json({ error: "Could not read this PDF. Please paste the text instead." }, { status: 422 });
    return Response.json({ knowledge });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "ai error" }, { status: 500 });
  }
}
