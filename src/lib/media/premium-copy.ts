// Premium copy + director pass for product videos (owner, 27 Oct 2026: "text ek dum natural aur premium hona chahiye —
// text jitna accha aur prompt jitna behtar hoga, video bhi utna behtar banega").
// The first plan is rewritten once by a stronger model acting as a senior Indian ad copywriter AND a commercial director:
//   - spoken lines that sound like a premium Indian TV ad (warm, everyday words, one idea a line, timed to the shot),
//   - picture prompts that describe THIS product exactly (the model sees its photo) in a cinematographer's terms,
//   - one smooth camera move + one small action per shot for the video model.
// Any failure returns null and the first plan is used unchanged — this pass can only make it better, never block it.

type Cut = { t?: string; shot?: string; action?: string; vfx?: string };
type Scene = { text: string; caption_text?: string; visual?: string; motion?: string; shot?: string; still?: string; action?: string; camera?: string; keep?: string; sound?: string; cuts?: Cut[] };
export type PolishPlan = { headline?: string; scenes: Scene[]; cta?: string; caption?: string };
export type PolishBrief = { own?: string; ownLines?: boolean; usage?: string; product: string; category?: string; brand?: string; offer?: string; lang: string; langRule: string; length: number; tier: string; goal?: string; facts?: string };

const MODEL = "gemini-3.5-flash";

export async function polishPlan(key: string, plan: PolishPlan, b: PolishBrief, photo?: { mime: string; data: string } | null): Promise<PolishPlan | null> {
  const n = plan.scenes.length;
  const real = b.tier === "realistic";
  const secPerLine = real ? 7 : Math.max(2.5, b.length / (n + 1));
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

${real ? `THE FILM (a Pro video made like the best Gemini-app ads: Google's video model films each scene as ONE 10-second commercial with its OWN quick cuts — wide, macro, slow-motion — using the product photos as references, with its own music and sound. It must feel like a premium TV commercial, not a slideshow.)
First write the bibles, repeated WORD FOR WORD in every scene so the ad is one film:
- "product_bible": one precise English sentence describing THIS product exactly as in the photo — type, shape, colours, materials, the panel/screen and what is lit on it, buttons, spout/hose or other parts, the logo text and where it sits. Example style: "a wall-mounted water ionizer with a glossy black frame, a brushed-silver front, a vertical black touch display glowing soft blue with white icons, and a curved chrome swivel spout on top".
- "output_bible": one English sentence saying EXACTLY where anything comes OUT of this product, as seen in the photo — e.g. "water comes out only from the open tip of its own curved chrome spout on top". Water, steam or light never comes from anywhere else, and there is never a second tap, faucet, sink or machine in the frame.
- "set_bible": one English sentence for the one location and light used in every cut — e.g. "a luxury modern Indian kitchen with white marble, dark wood and warm under-cabinet lights, soft window light, rich cinematic contrast".
Then for every scene (each scene = one 10-second film):
- "cuts": 4 to 6 quick cuts that together last 10 seconds, each {"t":"0-2s","shot":"<shot size + lens + camera move>","action":"<what happens>","vfx":"<premium visual effect, or empty>"}. Vary the shot sizes like a real commercial: an establishing wide shot, macro close-ups of the product's details, the product in use, a slow-motion moment of the result (e.g. water pouring into a glass in slow motion), and a hero shot. Premium effects in the style of a tech commercial: soft glowing light along the product's edges, subtle holographic light lines, a glowing ring when a control lights up, floating golden bokeh particles, slow motion. Effects never change the product.
- In the LAST scene, the final cut (about 2.5 s) is a still, clean HERO FRAME: the product with its result beside it (e.g. a full glass of water), beautifully lit, with EMPTY space in the top third — the brand title is added there later.
- "sound": the film's sound design in English: a premium music bed (e.g. "modern cinematic piano with soft strings and a deep pulse") + real sounds (e.g. "the splash of water, a soft UI chime when the display lights up"). NO speech, NO singing, NO voice-over.
HOW IT IS OPERATED: ${b.usage ? `the owner says: "${b.usage}" — show it EXACTLY this way and no other way.` : "you do not know how it is switched on or controlled, so NEVER show anyone pressing, tapping or touching its controls or screen — show the result instead (water flowing, a glass filling, a family drinking)."}
The spoken "text" lines are an OPTIONAL Hindi voice-over the owner may add — keep them short; the film must tell the story on its own without words.
` : `- Keep "visual" and "motion" short English notes (they are not filmed for this video type).
`}
CURRENT PLAN (improve it; keep exactly ${n} scenes):
${JSON.stringify({ headline: plan.headline, scenes: plan.scenes.map((s) => ({ text: s.text, caption_text: s.caption_text ?? "", visual: s.visual ?? "", motion: s.motion ?? "" })), cta: plan.cta, caption: plan.caption })}

JSON shape: ${real ? `{"headline":"","product_bible":"","output_bible":"","set_bible":"","scenes":[{"text":"","caption_text":"","cuts":[{"t":"","shot":"","action":"","vfx":""}],"sound":""}],"cta":"","caption":""}` : `{"headline":"","scenes":[{"text":"","caption_text":"","visual":"","motion":""}],"cta":"","caption":""}`}`;
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
    // Where water (or anything) comes out — repeated in every picture and every motion prompt (owner, 27 Oct 2026: the
    // video added its own kitchen faucet and the water came from there, not from the ionizer's pipe).
    const ob = String((out as { output_bible?: string }).output_bible ?? "").trim().slice(0, 300) || "Anything that flows comes only out of the product's own outlet";
    const NO_TAP = "There is NO other tap, faucet, sink spout or appliance anywhere in the frame";
    if (!Array.isArray(out.scenes) || out.scenes.length !== n) return null;
    const clean = (s: unknown, max: number) => String(s ?? "").replace(/\+?\d[\d\s-]{5,}\d/g, "").replace(/\s{2,}/g, " ").trim().slice(0, max);
    const scenes = out.scenes.map((s, i) => ({
      text: clean(s.text, 200) || plan.scenes[i].text,
      caption_text: clean(s.caption_text, 60),
      // Pro video: the prompts are COMPOSED here from the bibles and the shot card, so the product and the set are
      // described word for word the same in every shot, and every motion prompt carries its continuity rules.
      // Pro video (cinematic): the scene's 10-second film prompt is COMPOSED here from the bibles and the cut list, so the
      // product, its outlet and the set read word for word the same in every film.
      ...(() => {
        const cuts = (Array.isArray(s.cuts) ? s.cuts : []).filter((c) => c && (c.action || c.shot)).slice(0, 6);
        if (!real || !cuts.length) return { visual: String(s.visual ?? "").trim().slice(0, 900) || plan.scenes[i].visual || "", motion: String(s.motion ?? "").trim().slice(0, 300) || plan.scenes[i].motion || "" };
        const last = i === n - 1;
        const list = cuts.map((c) => `[${c.t || ""}] ${c.shot || ""} — ${c.action || ""}${c.vfx ? ` (${c.vfx})` : ""}`.trim()).join("\n");
        const motion = `A premium 10-second TV commercial for the product shown in the reference image(s) <IMAGE_REF_0>, in ${cuts.length} quick cuts with varied shot sizes and smooth cinematic transitions:
${list}
The product is always exactly ${pb || b.product} — the same shape, colours, screen and logo as in the reference images in every cut. ${ob}. ${NO_TAP}.
Setting: ${sb || "a luxury modern Indian home, soft window light"}. Look: high-end tech commercial, dramatic soft light, rich contrast, shallow depth of field, subtle glowing light effects and floating golden bokeh particles, slow motion on the water.${last ? " The final cut is a clean, still hero frame of the product with its result beside it, beautifully lit, with empty space in the top third." : ""}
No on-screen text, captions or subtitles; no logos other than the one printed on the product. Audio: ${s.sound || "a modern cinematic music bed with soft natural sounds"}; no speech, no voice-over, no singing.`.slice(0, 2400);
        return { visual: `${cuts[0].shot || ""} — ${cuts[0].action || ""}`.slice(0, 400), motion };
      })(),
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
