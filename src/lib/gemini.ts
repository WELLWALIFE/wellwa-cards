// Thin wrapper around the Gemini REST API for plain text generation.
// Raw fetch, not an SDK — matches the pattern already used elsewhere in this
// codebase for Gemini image/TTS calls (bridge/media-worker.mjs).

const MODEL = "gemini-3.5-flash-lite";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const BLOCKED_FINISH = new Set(["SAFETY", "PROHIBITED_CONTENT", "RECITATION", "BLOCKLIST", "SPII"]);

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };
type GeminiMessage = { role: "user" | "model"; parts: GeminiPart[] };

export async function geminiComplete(opts: {
  apiKey: string;
  system?: string;
  contents: GeminiMessage[];
  maxOutputTokens?: number;
  webSearch?: boolean;
  temperature?: number;
}): Promise<{ text: string; blocked: boolean }> {
  const body: Record<string, unknown> = {
    contents: opts.contents,
    generationConfig: { maxOutputTokens: opts.maxOutputTokens ?? 800, ...(opts.temperature != null ? { temperature: opts.temperature } : {}) },
  };
  if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };
  if (opts.webSearch) body.tools = [{ google_search: {} }];

  const r = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "x-goog-api-key": opts.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error?.message || `gemini ${r.status}`);
  const cand = d?.candidates?.[0];
  const blocked = BLOCKED_FINISH.has(cand?.finishReason);
  const text = (cand?.content?.parts ?? [])
    .filter((p: { text?: string }) => typeof p.text === "string")
    .map((p: { text?: string }) => p.text)
    .join("")
    .trim();
  return { text, blocked };
}
