// Premium copy + director pass for product videos (owner, 27 Oct 2026: "text ek dum natural aur premium hona chahiye —
// text jitna accha aur prompt jitna behtar hoga, video bhi utna behtar banega").
// The first plan is rewritten once by a stronger model acting as a senior Indian ad copywriter AND a commercial director:
//   - spoken lines that sound like a premium Indian TV ad (warm, everyday words, one idea a line, timed to the shot),
//   - picture prompts that describe THIS product exactly (the model sees its photo) in a cinematographer's terms,
//   - one smooth camera move + one small action per shot for the video model.
// Any failure returns null and the first plan is used unchanged — this pass can only make it better, never block it.

type Scene = { text: string; caption_text?: string; visual?: string; motion?: string };
export type PolishPlan = { headline?: string; scenes: Scene[]; cta?: string; caption?: string };
export type PolishBrief = { product: string; category?: string; brand?: string; offer?: string; lang: string; langRule: string; length: number; tier: string; goal?: string; facts?: string };

const MODEL = "gemini-3.5-flash";

export async function polishPlan(key: string, plan: PolishPlan, b: PolishBrief, photo?: { mime: string; data: string } | null): Promise<PolishPlan | null> {
  const n = plan.scenes.length;
  const real = b.tier === "realistic";
  const secPerLine = real ? 5.5 : Math.max(2.5, b.length / (n + 1));
  const words = Math.max(5, Math.round(secPerLine * 2.2)); // natural Hindi ad speech ≈ 2.2 words a second
  const prompt = `You are two people at a top Indian ad agency: a senior copywriter who writes premium TV commercials, and a commercial film director.
Rewrite this ${b.length}-second vertical product ad so it feels like a premium Indian TV commercial. Return ONLY JSON.

PRODUCT: ${b.product}${b.category ? ` (${b.category})` : ""}${b.brand ? ` · brand "${b.brand}"` : ""}${b.offer ? ` · offer: ${b.offer}` : ""}
${b.facts ? `TRUE FACTS (use only these, never invent): ${b.facts}\n` : ""}${photo ? "The attached photo IS the product. Look at it closely: describe its real shape, colours, materials, panel/buttons and parts in every picture prompt so the video shows exactly this product.\n" : ""}LANGUAGE of every spoken line, the headline and captions: ${b.langRule}

THE COPY (spoken lines)
- Sound like a real person talking warmly to one family member — not an announcer, not a brochure. Everyday words people actually say at home.
- Hindi: simple spoken Hindi (बोलचाल), never heavy shuddh/Sanskrit words and never word-for-word English translation. Common English words Indians say anyway (water, health, alkaline, filter, offer, WhatsApp) stay in Latin letters.
- One idea per line, short sentences, a little rhythm. Each line at most ${words} words so it fits its ${secPerLine.toFixed(1)}-second shot.
- Arc: line 1 = a hook that makes someone stop (a moment, a feeling or a sharp question from daily life); middle = what changes in their life with this product, one concrete true detail; last scene line = the reason to choose it now${b.offer ? " (the offer)" : ""}.
- BANNED, they sound cheap: "बेहतरीन", "भरोसेमंद", "खास तोहफा", "शुद्धता का", "सर्वश्रेष्ठ", "अद्भुत", "जबरदस्त", "बेमिसाल", "hydration", "solution", "best quality", exclamation-heavy lines, rhymes, listing features.
- No medical or cure claims, no guarantees, no invented numbers or prices. No phone number or digits in any spoken line.
- ${b.brand ? `The brand is written exactly "${b.brand}" in Latin letters wherever it appears (say it once or twice in the whole ad, not in every line).` : "Brand and product names stay in Latin letters."}
- CTA (the final line): calm and confident — the action and the channel, e.g. "आज ही WhatsApp कीजिए — number स्क्रीन पर है।" Never shout.
- headline: max 5 words, premium, no exclamation mark. caption_text per scene: 2-4 words that underline the line (or empty).
- caption: the social-media post text, 1-2 natural lines + 4 relevant hashtags.

Bad → good (Hindi):
"परिवार की सेहत के लिए लाएं शुद्धता का यह खास तोहफा।" → "सुबह का पहला गिलास… सबसे ज़रूरी होता है।"
"दुकान और घर दोनों के लिए बेहतरीन और भरोसेमंद hydration।" → "हर घूँट हल्का, ताज़ा — और पूरे परिवार के लिए।"
"अभी व्हाट्सएप करें 9876543210 पर और आर्डर बुक करें।" → "आज ही WhatsApp कीजिए — number स्क्रीन पर है।"

${real ? `THE PICTURES (one per scene; first an image model draws the still, then a video model animates it)
- "visual": one English paragraph a cinematographer would write: shot size + angle; the product described exactly as in the photo; where it stands; who is there and what they do (Indian people, natural, candid); the setting (a premium modern Indian home or a fitting real place); lighting (soft window light / warm golden hour / clean studio rim light); lens and depth of field (e.g. 50mm, shallow depth, creamy bokeh); colour mood. Photorealistic, high-end TV commercial, 9:16 vertical. No text, no logos, no captions anywhere.
- The product is the hero and fully visible in EVERY shot. Shot plan: 1 = hero shot of the product alone, beautifully lit; 2 = close-up of a hand using it the way it is really used; later = a family moment with the product clearly in frame.
- "motion": ONE smooth camera move + ONE small natural action, slow and premium, 8 seconds, e.g. "slow dolly-in towards the panel while a finger gently taps the display and it lights up" or "gentle orbit around the machine as clear water pours from the spout into a glass". No cuts, no zooming text, the product never changes shape.
` : `- Keep "visual" and "motion" short English notes (they are not filmed for this video type).
`}
CURRENT PLAN (improve it; keep exactly ${n} scenes):
${JSON.stringify({ headline: plan.headline, scenes: plan.scenes.map((s) => ({ text: s.text, caption_text: s.caption_text ?? "", visual: s.visual ?? "", motion: s.motion ?? "" })), cta: plan.cta, caption: plan.caption })}

JSON shape: {"headline":"","scenes":[{"text":"","caption_text":"","visual":"","motion":""}],"cta":"","caption":""}`;
  try {
    const parts: unknown[] = [];
    if (photo) parts.push({ inlineData: { mimeType: photo.mime, data: photo.data } });
    parts.push({ text: prompt });
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: "application/json", temperature: 0.8, maxOutputTokens: 4096 } }),
      signal: AbortSignal.timeout(45_000),
    });
    const j = await r.json().catch(() => ({}));
    const out = JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}") as PolishPlan;
    if (!Array.isArray(out.scenes) || out.scenes.length !== n) return null;
    const clean = (s: unknown, max: number) => String(s ?? "").replace(/\+?\d[\d\s-]{5,}\d/g, "").replace(/\s{2,}/g, " ").trim().slice(0, max);
    const scenes = out.scenes.map((s, i) => ({
      text: clean(s.text, 200) || plan.scenes[i].text,
      caption_text: clean(s.caption_text, 60),
      visual: String(s.visual ?? "").trim().slice(0, 900) || plan.scenes[i].visual || "",
      motion: String(s.motion ?? "").trim().slice(0, 300) || plan.scenes[i].motion || "",
    }));
    if (scenes.some((s) => !s.text)) return null;
    return { headline: clean(out.headline, 60) || plan.headline, scenes, cta: clean(out.cta, 200) || plan.cta, caption: String(out.caption ?? "").trim().slice(0, 600) || plan.caption };
  } catch { return null; }
}

/** The product photo for the director (small JPEG, inline). Only our own storage URLs are fetched. */
export async function photoFor(url: unknown): Promise<{ mime: string; data: string } | null> {
  if (typeof url !== "string" || !/^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\/media\//.test(url) || url.length > 500) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10_000) }); if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer()); if (buf.length > 6_000_000) return null;
    const sharp = (await import("sharp")).default;
    const small = await sharp(buf).rotate().resize(768, 768, { fit: "inside" }).jpeg({ quality: 85 }).toBuffer();
    return { mime: "image/jpeg", data: small.toString("base64") };
  } catch { return null; }
}
