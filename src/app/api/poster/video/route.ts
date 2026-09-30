// Status video for a poster.
// GET  ?poster=<id>[&name=1&phone=1&custom=…] → music list + suggested voice script (AI) + saved voice prefs.
// POST { poster_id, music?, voice?: { on, gender, text } } → renders (cached per music/voice) and stores the choice.
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { userFromRequest, restAsService, posterVideoEngine, posterEngine, posterQuota, OUT_URL, dayPlan, stockEngineMod } from "@/lib/poster-server";

const DIR = path.join(process.cwd(), "public", "poster", "out");
type PosterRow = { id: string; url: string; profile_id: string; for_date: string; video_url: string; music: string; voice_text: string; voice_gender: string; occasion_slug: string };
type Prof = { id: string; name: string; tagline: string | null; phone: string | null; lang: string; persona: string; mode?: string; layout?: { voice?: { on?: boolean; gender?: string; by?: string } } };

async function load(me: { id: string }, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const poster = (await restAsService<PosterRow[]>(`posters?id=eq.${id}&select=id,url,profile_id,for_date,video_url,music,voice_text,voice_gender,occasion_slug`)).data?.[0];
  if (!poster) return null;
  const prof = (await restAsService<Prof[]>(`poster_profiles?id=eq.${poster.profile_id}&user_id=eq.${me.id}&select=id,name,tagline,phone,lang,persona,mode,layout`)).data?.[0];
  return prof ? { poster, prof } : null;
}
const brandOf = (p: Prof) => (p.persona === "personal" || p.persona === "student" ? p.name : (p.tagline || p.name));

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const q = new URL(request.url).searchParams;
  const v = await posterVideoEngine();
  const ctx = await load(me, q.get("poster") ?? "");
  if (!ctx) return NextResponse.json({ music: v.MUSIC, script: "" });
  const { poster, prof } = ctx;
  const eng = await posterEngine();
  const theme = eng.themeFor(poster.for_date);
  let product: { name?: string; offer?: string; benefits?: string[] } | null = null;
  const kind = prof.mode === "product" ? "product" : "";
  if (prof.mode === "product") product = (await restAsService<{ name: string; offer: string; benefits: string[] }[]>(`poster_products?user_id=eq.${me.id}&active=eq.true&order=sort,created_at&limit=1&select=name,offer,benefits`)).data?.[0] ?? null;
  const plan = await dayPlan(me.id, prof.id, poster.for_date);
  const dayCustom = plan.offer;
  const LANGS = ["hi", "en", "hinglish", "mr", "gu", "pa", "bn", "ta", "te", "kn", "ml", "or"];
  const lang = LANGS.includes(q.get("lang") ?? "") ? q.get("lang")! : prof.lang;
  const script = q.get("fresh") === "1" || !poster.voice_text || (q.get("lang") && q.get("lang") !== prof.lang)
    ? await v.suggestVoiceScript({ theme, lang, brand: brandOf(prof), name: prof.name, phone: prof.phone ?? "", product, includeName: q.get("name") === "1", includePhone: q.get("phone") === "1", custom: (q.get("custom") || dayCustom || "").slice(0, 120), category: String((prof as { category?: string }).category ?? "") })
    : poster.voice_text;
  return NextResponse.json({ music: v.MUSIC, script, lang, gender: poster.voice_gender || prof.layout?.voice?.gender || "female", voice_on: plan.cal?.overrides?.voice ? plan.cal.overrides.voice === "on" : v.voiceWanted(prof.layout), video_url: poster.video_url, current_music: poster.music || plan.cal?.overrides?.music || v.musicFor(theme, kind), offer: dayCustom });
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const ctx = await load(me, String(b.poster_id ?? ""));
  if (!ctx) return NextResponse.json({ error: "Poster not found." }, { status: 404 });
  const { poster, prof } = ctx;
  const quota = await posterQuota(me.token, me.id);
  // Free: the status video itself (stock clip + music) is free; the AI voice is part of the plan.
  const free = quota.plan === "free";
  if (free) return NextResponse.json({ error: "plan", message: "Status videos are part of Growth. Your free plan includes the digital V-Card — upgrade to get the daily poster and video." }, { status: 402 });
  const music = typeof b.music === "string" ? b.music : (poster.music || "soft");
  const von = !free && !!b.voice?.on && typeof b.voice?.text === "string" && b.voice.text.trim().length > 2;
  if (free && b.voice?.on) return NextResponse.json({ error: "plan", message: "The AI voice-over is part of Growth. Your status video without voice is free — switch the voice off." }, { status: 402 });
  const gender = ["female", "female2", "male", "male2"].includes(b.voice?.gender) ? b.voice.gender : "female";
  const text = von ? String(b.voice.text).trim().slice(0, 260) : "";
  const file = path.join(DIR, path.basename(poster.url));
  try {
    const v = await posterVideoEngine();
    // A moving stock clip behind the poster (chosen for the trade and the day, cached per trade) — falls back to the gradient.
    let clip: string | null = null;
    if (!fs.existsSync(`${file}.spec.json`)) try {   // a Signature poster is filmed full-frame from its own 9:16 layout
      const eng = await posterEngine();
      const theme = eng.themeFor(poster.for_date);
      const kind = eng.rosterKind(theme, poster.for_date, { hasProducts: prof.mode === "product" });
      const category = String((prof as unknown as { category?: string }).category ?? "");
      const st = await stockEngineMod();
      clip = (await st.ensureStockClip({ theme, category, kind, dateStr: poster.for_date }))?.file ?? null;
    } catch (e) { console.log("[stock] clip skipped:", e instanceof Error ? e.message : e); clip = null; }
    const out = await v.renderStatusVideo(file, { music, force: b.force === true, voice: von ? { text, gender, lang: prof.lang } : null, clip });
    const url = OUT_URL(out);
    await restAsService(`posters?id=eq.${poster.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ video_url: url, music, voice_text: text, voice_gender: von ? gender : "" }) });
    // remember the voice preference on the profile — `by: "user"` marks it as the owner's own choice (the 4 AM video
    // keeps its voice unless the owner switched it off here)
    const layout = { ...(prof.layout ?? {}), voice: { on: von, gender, by: "user" } };
    await restAsService(`poster_profiles?id=eq.${prof.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ layout }) });
    return NextResponse.json({ ok: true, video_url: url, music, voice: von ? { text, gender } : null });
  } catch (e) { return NextResponse.json({ error: "The video could not be made right now. Please try again in a minute.", detail: (e as Error).message.slice(0, 200) }, { status: 500 }); }
}
