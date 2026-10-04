// AI writing helper for the dashboard AI Studio.
// task ∈ tagline | bio | rewrite | translate-hi | translate-en | card
// Env-gated: returns demo output when no GEMINI_API_KEY.

import { geminiComplete } from "@/lib/gemini";
import { clientKey, rateLimited, requireUser, sameOrigin } from "@/lib/api-security";

type Body = { task: string; input: string; role?: string; company?: string };

const PROMPTS: Record<string, (b: Body) => string> = {
  // "Write again" helpers (owner's call, 4 Oct 2026): the owner says in a few rough words what picture or what
  // change they want, and the AI turns it into a full brief the picture model / the writer can act on.
  "image-wish": (b) => `The owner of ${b.company || "a small business"}${b.role ? ` (${b.role})` : ""} in India wants a new picture for the top of their website and said, in their own words: "${b.input}".
Write the complete picture brief for an image model, in plain English, 2–4 sentences: exactly what is shown, the setting, the people if any (Indian, naturally dressed), the mood, the light and the colours. It is a wide banner photograph with clear empty space on one side for a headline. No text, letters, logos or watermarks in the picture. Keep everything the owner asked for; add only what makes it a good photograph. Return only the brief.`,
  "words-wish": (b) => `The owner of ${b.company || "a small business"}${b.role ? ` (${b.role})` : ""} in India wants the words on their website changed and said, in their own words: "${b.input}".
Write their request clearly for the copywriter, in plain English, 1–3 sentences: what to change, in what tone, and what must stay. Do not write the website text itself. Return only the request.`,
  tagline: (b) => `Write ONE punchy, professional tagline (max 10 words) for a digital business card. Person/role: ${b.role || b.input}. Company: ${b.company || ""}. Return only the tagline, no quotes.`,
  bio: (b) => `Write a warm, confident 2-3 sentence "About me" bio for a digital business card. Details: ${b.input}. Role: ${b.role || ""}, Company: ${b.company || ""}. First person. Return only the bio.`,
  rewrite: (b) => `Rewrite this to be clearer, warmer and more professional, same length. Return only the rewrite:\n\n${b.input}`,
  "translate-hi": (b) => `Translate to natural Hindi (Devanagari). Return only the translation:\n\n${b.input}`,
  "translate-en": (b) => `Translate to natural English. Return only the translation:\n\n${b.input}`,
  // Ads: the owner knows their business but not how to write an ad, so this
  // returns something they can paste straight into Facebook without editing.
  ad: (b) => `Write a Facebook/Instagram ad for an Indian small business that uses a digital visiting card as the landing page.

Business: ${b.input}
Role: ${b.role || ""}
Company: ${b.company || ""}

Rules: simple everyday language an Indian customer understands, no hype, no fake claims, no medical claims. The action is a WhatsApp message, not a purchase. Rupees not dollars.

Return EXACTLY this format and nothing else:
HEADLINE: <max 8 words>
PRIMARY: <2-3 short lines, first line must hook>
CTA: <2-4 words>
AUDIENCE: <who to target — age range, interests, location hint>
BUDGET: <a sensible starting daily budget in rupees and why, one line>`,
  // Reading the numbers is the part a non-marketer can't do. This turns the
  // campaign table into a plain instruction: keep, fix, or stop.
  "ad-advice": (b) => `You are advising an Indian small-business owner who is not a marketer. Here is their ad performance from the last 30 days. "Contacts" means someone tapped WhatsApp, called, or filled the form.

${b.input}

For each campaign give ONE clear instruction in simple English: increase budget, keep running, change the ad, or stop it. A contact rate above 5% is good, 2-5% is average, below 2% is poor. If a campaign has fewer than 30 visits say it is too early to judge.

Then add one line of overall advice.

Return plain text, max 6 short lines, no headings, no markdown, no jargon.`,
  "social-post": (b) => `Create one ready-to-post organic social media post for an Indian small business.
Business/offer: ${b.input}
Role: ${b.role || ""}
Company: ${b.company || ""}
Use natural Hinglish unless the user clearly asks for another language. No fake, medical, income, or guaranteed claims.
Return exactly:
HOOK: <short first line>
CAPTION: <4-7 short lines>
CTA: <one action>
HASHTAGS: <6-10 relevant hashtags>
CREATIVE: <one simple poster/photo direction>`,
  "campaign-kit": (b) => `Create a seven-day manual social media campaign for this Indian small business.
Business, audience and offer: ${b.input}
Role: ${b.role || ""}; Company: ${b.company || ""}.
For each day give: topic, format (image/carousel/reel script), short caption, CTA, and 5 hashtags. Include one educational post, one trust post, one offer, one FAQ, one testimonial prompt and one founder story. No fake claims. Plain text only.`,
  "follow-up": (b) => `Write a respectful three-message WhatsApp follow-up sequence for this lead or offer: ${b.input}.
Business: ${b.company || ""}. Sender role: ${b.role || ""}.
Messages are sent immediately, after 1 day and after 3 days. Natural Hinglish, max 45 words each, helpful not pushy, with opt-out language in the final message. Return exactly MESSAGE 1, MESSAGE 2, MESSAGE 3.`,
  // Onboarding: turns a few notes (or just the business name and type) into the "About your business" text the
  // card, website and WhatsApp AI all reuse.
  "about-business": (b) => `Write the "About our business" text for an Indian small business, 60 to 100 words, in simple English.
Business name: ${b.company || ""}
Type of business: ${b.role || ""}
Owner's notes (may be empty or in Hinglish): ${b.input}
Rules: use only the facts given; never invent prices, years, awards, numbers or guarantees; no medical or income claims; warm and clear; say what they offer, for whom, and how to reach them (visit, call or WhatsApp). Return only the text, no heading, no quotes.`,
  card: (b) => `Draft digital business card copy for: ${b.input}. Return exactly this format:\nTAGLINE: <one line>\nABOUT: <2-3 sentences>\nHIGHLIGHTS: <4 short bullet points separated by " | ">`,
};

const DEMO: Record<string, string> = {
  tagline: "Pure water, healthier life — the miracle in your glass",
  bio: "I help families switch to healthier alkaline water. With 10+ years in wellness, I make it simple to get started — ask me about a free home demo.",
  rewrite: "Helping families enjoy healthier, alkaline water — simple, proven, and backed by 10+ years of experience.",
  "translate-hi": "मैं परिवारों को स्वस्थ alkaline पानी अपनाने में मदद करता हूँ — free home demo के लिए पूछें।",
  "translate-en": "I help families adopt healthier alkaline water — ask me for a free home demo.",
  ad: "HEADLINE: Is your drinking water actually clean?\nPRIMARY: Most homes never test their water.\nWe check yours free, at home, in 20 minutes — no obligation.\nSee the difference before you decide.\nCTA: Message on WhatsApp\nAUDIENCE: 30-55, homeowners in your city, interested in health, fitness and family wellbeing\nBUDGET: Start at Rs 300/day for 5 days — enough for Facebook to learn who responds without wasting money",
  "ad-advice": "diwali-offer: Working well at 8% — increase the budget slowly.\ngeneral-ad: Only 1% contact you. Stop this one and put the money into diwali-offer.\nOverall: keep one good ad running rather than three weak ones.",
  "social-post": "HOOK: Aapke business ki pehli impression ab digital hai.\nCAPTION: Apni services, contact details aur offers ek smart digital card mein share karein. Ek link, har jagah ready.\nCTA: Aaj apna card share karein\nHASHTAGS: #DigitalBusinessCard #SmallBusinessIndia #BusinessGrowth #DigitalMarketing #EntrepreneurIndia #Shubhora\nCREATIVE: Phone screen par digital card aur WhatsApp CTA dikhayein.",
  "campaign-kit": "DAY 1 — Founder story | Image | Aapne business kyun shuru kiya | Apni story share karein | #FounderStory #SmallBusiness\nDAY 2 — Customer FAQ | Carousel | Sabse common sawal ka simple jawab | Message karein | #FAQ #BusinessTips",
  "follow-up": "MESSAGE 1: Namaste! Aapki enquiry mil gayi hai. Main details share karne ke liye available hoon—kya aapka main question price, demo ya product ke baare mein hai?\nMESSAGE 2: Namaste, bas follow-up kar raha hoon. Agar helpful ho to main short details ya demo timing share kar sakta hoon.\nMESSAGE 3: Ye mera final follow-up hai. Jab bhi zarurat ho message karein; updates nahi chahiye to STOP likh dein.",
  card: "TAGLINE: Pure water, healthier life\nABOUT: I help families switch to healthier alkaline water with a proven home system. 10+ years in wellness. Ask me for a free demo.\nHIGHLIGHTS: Free home demo | Chemical-free | Wi-Fi smart control | Guided installation",
};

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const session = await requireUser();
  if (!session) return Response.json({ error: "sign in required" }, { status: 401 });
  if (rateLimited(clientKey(request, `ai-write:${session.user.id}`), 20, 60 * 60_000)) {
    return Response.json({ error: "AI hourly limit reached. Please try later." }, { status: 429 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > 25_000) {
    return Response.json({ error: "request too large" }, { status: 413 });
  }
  const body = (await request.json()) as Body;
  body.input = String(body.input ?? "").slice(0, 6000);
  body.role = String(body.role ?? "").slice(0, 200);
  body.company = String(body.company ?? "").slice(0, 200);
  const build = PROMPTS[body.task];
  if (!build) return Response.json({ error: "unknown task" }, { status: 400 });

  // "About your business" is the owner's own words on their card, website and WhatsApp replies. Canned demo text
  // would put a made-up business ("We are a family-run business…") on a real card, so this task only ever returns
  // real AI text or an honest error, and the owner's typed notes stay untouched.
  const real = body.task === "about-business" || body.task === "image-wish" || body.task === "words-wish";
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return real
      ? Response.json({ error: "The AI is not available right now. Please type a few lines yourself." }, { status: 400 })
      : Response.json({ text: DEMO[body.task] ?? "", demo: true });
  }

  const noText = () => Response.json({ error: "The AI could not write it now. Please type a few lines yourself." }, { status: 502 });
  try {
    const { text, blocked } = await geminiComplete({
      apiKey: key,
      contents: [{ role: "user", parts: [{ text: build(body) }] }],
      maxOutputTokens: 400,
    });
    if (blocked || !text) return real ? noText() : Response.json({ text: DEMO[body.task] ?? "", demo: false });
    return Response.json({ text });
  } catch (e) {
    if (real) return noText();
    return Response.json({ error: e instanceof Error ? e.message : "ai error" }, { status: 500 });
  }
}
