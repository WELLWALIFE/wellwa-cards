// Premium copy + director pass for product videos (owner, 27 Oct 2026: "text ek dum natural aur premium hona chahiye —
// text jitna accha aur prompt jitna behtar hoga, video bhi utna behtar banega").
// The first plan is rewritten once by a stronger model acting as a senior Indian ad copywriter AND a commercial director:
//   - spoken lines that sound like a premium Indian TV ad (warm, everyday words, one idea a line, timed to the shot),
//   - picture prompts that describe THIS product exactly (the model sees its photo) in a cinematographer's terms,
//   - one smooth camera move + one small action per shot for the video model.
// Any failure returns null and the first plan is used unchanged — this pass can only make it better, never block it.

type Scene = { text: string; caption_text?: string; visual?: string; motion?: string; shot?: string; still?: string; action?: string; camera?: string; keep?: string };
export type PolishPlan = { headline?: string; scenes: Scene[]; cta?: string; caption?: string };
export type PolishBrief = { own?: string; ownLines?: boolean; usage?: string; product: string; category?: string; brand?: string; offer?: string; lang: string; langRule: string; length: number; tier: string; goal?: string; facts?: string };

const MODEL = "gemini-3.5-flash";

export async function polishPlan(key: string, plan: PolishPlan, b: PolishBrief, photo?: { mime: string; data: string } | null): Promise<PolishPlan | null> {
  const n = plan.scenes.length;
  const real = b.tier === "realistic";
  const secPerLine = real ? 5.5 : Math.max(2.5, b.length / (n + 1));
  const words = Math.max(5, Math.round(secPerLine * 2.2)); // natural Hindi ad speech ≈ 2.2 words a second
  const prompt = `You are two people at a top Indian ad agency: a senior copywriter who writes premium TV commercials, and a commercial film director.
Rewrite this ${b.length}-second vertical product ad so it feels like a premium Indian TV commercial. Return ONLY JSON.

PRODUCT: ${b.product}${b.category ? ` (${b.category})` : ""}${b.brand ? ` · brand "${b.brand}"` : ""}${b.offer ? ` · offer: ${b.offer}` : ""}
${b.own ? `THE OWNER'S OWN WORDS — what they want to say. Keep their meaning, their facts and their order; make the wording premium and natural; never add a claim they did not make:\n"${b.own}"\n` : ""}${b.ownLines ? "The CURRENT PLAN below was written or edited by the owner: polish the wording and timing of every line but keep what each line says.\n" : ""}${b.facts ? `TRUE FACTS (use only these, never invent): ${b.facts}\n` : ""}${photo ? "The attached photo IS the product. Look at it closely: describe its real shape, colours, materials, panel/buttons and parts in every picture prompt so the video shows exactly this product.\n" : ""}LANGUAGE of every spoken line, the headline and captions: ${b.langRule}

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

${real ? `THE FILM (a Pro video: an image model draws each shot's first frame from the product photo, then Google Veo animates it for 6 seconds)
Work like a commercial director with a shot list. First write two bibles that are repeated WORD FOR WORD in every shot, so the whole ad looks like one film:
- "product_bible": one precise English sentence describing THIS product exactly as in the photo — type, shape, colours, materials, the panel/screen and what is lit on it, buttons, spout/hose or other parts, logo position. Example style: "a wall-mounted water ionizer with a glossy black frame, a brushed-silver front, a vertical black touch display glowing soft blue with white icons, and a curved chrome swivel spout on top".
- "set_bible": one English sentence for the one location and light used in every shot — e.g. "a premium modern Indian kitchen with white marble counters, warm wooden cabinets and brass utensils, soft morning sunlight from a window on the left, warm cinematic colour grade".
Then for every scene a shot card:
- "shot": shot size + lens + angle, e.g. "Medium close-up, 50mm lens, eye level, shallow depth of field".
- "still": what is in the FIRST frame — where the product stands, who is there (Indian, natural, candid) and what they are doing at that moment. The product is fully visible and the hero.
- "action": exactly ONE small natural action over the 6 seconds, written with time beats, e.g. "0-2s the camera settles; 2-4s a hand places a glass under the spout; 4-6s clear water starts to flow into the glass". Choose actions that really happen with this product.
- "camera": exactly ONE smooth move — slow dolly-in, gentle orbit, slow tilt down, rack focus, or a locked-off shot.
- "keep": the continuity rules for this shot — what must NOT change, e.g. "the display stays lit the whole time; the product keeps its exact shape, colours and position; nothing new appears; no text appears".
Shot plan: 1 = the product alone, hero lighting, a slow push-in; 2 = a hand using it the way it is really used; later = a family moment with the product clearly in frame. Never show it as a bottle, box or package unless it is one. Never let a touch switch something off.
HOW IT IS OPERATED: ${b.usage ? `the owner says: "${b.usage}" — show it EXACTLY this way and no other way.` : "you do not know how it is switched on or controlled, so NEVER show anyone pressing, tapping or touching its controls or screen — show the result instead (water flowing, a glass filling, a family drinking)."}
` : `- Keep "visual" and "motion" short English notes (they are not filmed for this video type).
`}
CURRENT PLAN (improve it; keep exactly ${n} scenes):
${JSON.stringify({ headline: plan.headline, scenes: plan.scenes.map((s) => ({ text: s.text, caption_text: s.caption_text ?? "", visual: s.visual ?? "", motion: s.motion ?? "" })), cta: plan.cta, caption: plan.caption })}

JSON shape: ${real ? `{"headline":"","product_bible":"","set_bible":"","scenes":[{"text":"","caption_text":"","shot":"","still":"","action":"","camera":"","keep":""}],"cta":"","caption":""}` : `{"headline":"","scenes":[{"text":"","caption_text":"","visual":"","motion":""}],"cta":"","caption":""}`}`;
  try {
    const parts: unknown[] = [];
    if (photo) parts.push({ inlineData: { mimeType: photo.mime, data: photo.data } });
    parts.push({ text: prompt });
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: "application/json", temperature: 0.8, maxOutputTokens: 6000 } }),
      signal: AbortSignal.timeout(45_000),
    });
    const j = await r.json().catch(() => ({}));
    const out = JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}") as PolishPlan & { product_bible?: string; set_bible?: string; scenes: (Scene & { shot?: string; still?: string; action?: string; camera?: string; keep?: string })[] };
    const pb = String(out.product_bible ?? "").trim().slice(0, 400), sb = String(out.set_bible ?? "").trim().slice(0, 400);
    if (!Array.isArray(out.scenes) || out.scenes.length !== n) return null;
    const clean = (s: unknown, max: number) => String(s ?? "").replace(/\+?\d[\d\s-]{5,}\d/g, "").replace(/\s{2,}/g, " ").trim().slice(0, max);
    const scenes = out.scenes.map((s, i) => ({
      text: clean(s.text, 200) || plan.scenes[i].text,
      caption_text: clean(s.caption_text, 60),
      // Pro video: the prompts are COMPOSED here from the bibles and the shot card, so the product and the set are
      // described word for word the same in every shot, and every motion prompt carries its continuity rules.
      visual: real && s.still
        ? `${s.shot ?? "Medium shot, 50mm lens"}. ${s.still} The product: ${pb || b.product}. Setting: ${sb || "a premium modern Indian home, soft natural light"}. Premium TV commercial, photorealistic, cinematic lighting, shallow depth of field, 9:16 vertical. No text, no letters, no logos, no watermark.`.slice(0, 1400)
        : String(s.visual ?? "").trim().slice(0, 900) || plan.scenes[i].visual || "",
      motion: real && s.action
        ? `${s.camera ?? "Slow dolly-in"}. ${s.action} Keep: ${s.keep ?? "the product keeps its exact shape, colours and lights"}; ${pb ? `it is always ${pb}` : "the product never changes"}; any screen or light on it stays on; nothing new appears; no text appears. Smooth, slow, premium TV-commercial motion, no cuts.`.slice(0, 1200)
        : String(s.motion ?? "").trim().slice(0, 300) || plan.scenes[i].motion || "",
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
