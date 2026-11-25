// The owner's Google Business Profile, edited from the app (owner, 26 Nov 2026: "SaaS hai, sab kuch app se hona chahiye").
//   GET (bearer)            → { profile }   what Google has now (name, address, categories, description, phone, website, hours)
//   GET ?cat=<words>        → { categories } Google's category list searched by name
//   PATCH { description?, phone?, website?, periods?, primaryCategory?, additionalCategories? } → saves only what is sent
//   POST { ai: "description" } → a draft description (≤ 750 characters, no links or phone numbers — Google's rules) to look over
//   GET ?attrs=1            → { meta, values } the yes/no service options Google offers for this category, and what is set
//   GET ?photos=1           → { google, mine } photos on the profile, and the owner's own uploaded pictures to add from
//   POST { photo: <url> }   → adds one of the owner's own pictures to the profile
//   PATCH also takes { attributes: { "attributes/has_delivery": true, … }, special: [{ date: "2026-12-25", closed: true } | { date, open, close }] }
// The name and address are not changed from here: Google asks the business to verify again when they change.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { rateLimited } from "@/lib/api-security";
import { addProfilePhoto, attributeOptions, friendlyGoogleError, getProfile, googleRow, googleToken, profilePhotoCount, searchCategories, updateAttributes, updateProfile, type GPeriod, type GSpecial, type ProfilePatch } from "@/lib/google-server";
import { isOwnMedia } from "@/lib/card-inputs";
import { cardOf, businessOf } from "@/lib/customer-send";
import { geminiComplete } from "@/lib/gemini";

export const maxDuration = 60;
const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

async function ctx(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return { res: NextResponse.json({ error: "Please log in." }, { status: 401 }) };
  const g = await googleRow(me.id);
  if (!g?.refresh_token || g.status !== "ok") return { res: NextResponse.json({ error: "Connect your Google Business Profile first." }, { status: 400 }) };
  return { me, g, token: await googleToken(g) };
}
const fail = (e: unknown) => NextResponse.json({ error: friendlyGoogleError(e) }, { status: 502 });

export async function GET(request: Request) {
  const c = await ctx(request); if ("res" in c) return c.res;
  const sp = new URL(request.url).searchParams;
  const q = sp.get("cat");
  try {
    if (sp.get("attrs")) return NextResponse.json(await attributeOptions(c.token, c.g.location_name));
    if (sp.get("photos")) {
      const card = await cardOf(c.me.id);
      const mine = [...new Set((JSON.stringify(card?.data ?? {}).match(/https:\/\/[^"\s]+?\.(?:jpe?g|png|webp)/gi) ?? []).filter((u) => isOwnMedia(u, c.me.id)))].slice(0, 60);
      return NextResponse.json({ google: await profilePhotoCount(c.token, c.g.location_name).catch(() => null), mine });
    }
    if (q !== null) return NextResponse.json({ categories: q.trim().length < 2 ? [] : await searchCategories(c.token, q.trim()) });
    return NextResponse.json({ profile: await getProfile(c.token, c.g.location_name) });
  } catch (e) { return fail(e); }
}

const time = (v: unknown) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(v ?? "")); if (!m) return null; const h = +m[1], mi = +m[2]; return h <= 24 && mi < 60 ? { hours: h, minutes: mi } : null; };
function cleanPeriods(v: unknown): GPeriod[] | null {
  if (!Array.isArray(v)) return null;
  const out: GPeriod[] = [];
  for (const x of v.slice(0, 21) as { day?: string; open?: string; close?: string }[]) {
    const day = String(x?.day ?? "").toUpperCase(); const o = time(x?.open), cl = time(x?.close);
    if (!DAYS.includes(day) || !o || !cl) return null;
    // Closing after midnight (8 pm – 1 am) closes on the next day.
    const over = cl.hours * 60 + cl.minutes <= o.hours * 60 + o.minutes;
    const closeDay = over ? DAYS[(DAYS.indexOf(day) + 1) % 7] : day;
    out.push({ openDay: day, openTime: o, closeDay, closeTime: cl.hours === 24 ? { hours: 24 } : cl });
  }
  return out;
}

export async function PATCH(request: Request) {
  const c = await ctx(request); if ("res" in c) return c.res;
  if (rateLimited(`gprofile:${c.me.id}`, 30, 60 * 60_000)) return NextResponse.json({ error: "Too many changes in an hour. Please wait a little." }, { status: 429 });
  const b = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const p: ProfilePatch = {};
  if (typeof b.description === "string") {
    const d = b.description.trim();
    if (/https?:\/\/|www\./i.test(d)) return NextResponse.json({ error: "Google does not allow links in the description. Remove the web address." }, { status: 400 });
    p.description = d.slice(0, 750);
  }
  if (typeof b.phone === "string") {
    const d = b.phone.replace(/[^\d+]/g, ""); const n = d.replace(/\D/g, "");
    if (n.length < 10) return NextResponse.json({ error: "Enter a 10-digit phone number." }, { status: 400 });
    p.phone = n.length === 10 ? `+91 ${n.slice(0, 5)} ${n.slice(5)}` : d;
  }
  if (typeof b.website === "string") {
    const w = b.website.trim();
    if (w && !/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(w)) return NextResponse.json({ error: "The website should start with https://" }, { status: 400 });
    p.website = w;
  }
  if (b.periods !== undefined) { const per = cleanPeriods(b.periods); if (!per) return NextResponse.json({ error: "Check the opening hours (like 09:30 to 19:00)." }, { status: 400 }); p.periods = per; }
  if (typeof b.primaryCategory === "string" && /^categories\/[\w:.-]+$/.test(b.primaryCategory)) p.primaryCategory = b.primaryCategory;
  if (Array.isArray(b.special)) {
    const out: GSpecial[] = [];
    for (const x of b.special.slice(0, 30) as { date?: string; closed?: boolean; open?: string; close?: string }[]) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(x?.date ?? "")); if (!m) return NextResponse.json({ error: "Pick a date for each special day." }, { status: 400 });
      const d = { year: +m[1], month: +m[2], day: +m[3] };
      if (x.closed) { out.push({ startDate: d, closed: true }); continue; }
      const o = time(x.open), cl = time(x.close);
      if (!o || !cl) return NextResponse.json({ error: "Give the open and close time of each special day, or mark it closed." }, { status: 400 });
      out.push({ startDate: d, openTime: o, closeTime: cl });
    }
    p.special = out;
  }
  if (Array.isArray(b.additionalCategories)) p.additionalCategories = b.additionalCategories.filter((x): x is string => typeof x === "string" && /^categories\/[\w:.-]+$/.test(x)).slice(0, 9);
  try {
    const keep = await getProfile(c.token, c.g.location_name);
    await updateProfile(c.token, c.g.location_name, p, keep);
    if (b.attributes && typeof b.attributes === "object") {
      const ch: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(b.attributes as Record<string, unknown>)) if (typeof v === "boolean") ch[k] = v;
      await updateAttributes(c.token, c.g.location_name, ch);
    }
    return NextResponse.json({ ok: true, profile: await getProfile(c.token, c.g.location_name) });
  } catch (e) { return fail(e); }
}

export async function POST(request: Request) {
  const c = await ctx(request); if ("res" in c) return c.res;
  const b = await request.json().catch(() => null) as { ai?: string; hi?: boolean; photo?: string } | null;
  if (b?.photo !== undefined) {
    if (!isOwnMedia(b.photo, c.me.id)) return NextResponse.json({ error: "Only your own uploaded photos can go to Google." }, { status: 400 });
    if (rateLimited(`gprofile-photo:${c.me.id}`, 30, 24 * 60 * 60_000)) return NextResponse.json({ error: "30 photos a day at most." }, { status: 429 });
    try { await addProfilePhoto(c.token, c.g.location_name, b.photo); return NextResponse.json({ ok: true }); } catch (e) { return fail(e); }
  }
  if (b?.ai !== "description") return NextResponse.json({ error: "Bad request." }, { status: 400 });
  if (rateLimited(`gprofile-ai:${c.me.id}`, 10, 24 * 60 * 60_000)) return NextResponse.json({ error: "Enough drafts for today." }, { status: 429 });
  const apiKey = process.env.GEMINI_API_KEY; if (!apiKey) return NextResponse.json({ error: "AI is not set up." }, { status: 503 });
  try {
    const [prof, card] = await Promise.all([getProfile(c.token, c.g.location_name), cardOf(c.me.id)]);
    const facts = [`Business: ${prof.title || businessOf(card)}`, `Category: ${[prof.primaryCategory?.displayName, ...prof.additionalCategories.map((x) => x.displayName)].filter(Boolean).join(", ")}`,
      `Address: ${prof.address}`, card?.data?.tagline ? `Tagline: ${card.data.tagline}` : "", card?.data?.about ? `About: ${String(card.data.about).slice(0, 1200)}` : "",
      prof.description ? `Current description: ${prof.description}` : ""].filter(Boolean).join("\n");
    const { text } = await geminiComplete({ apiKey, tag: "gbp-description", maxOutputTokens: 1500, temperature: 0.6, contents: [{ role: "user", parts: [{ text:
`Write the "From the business" description for this Google Business Profile.

Rules (Google's): at most 700 characters; plain text; no web links, no phone numbers, no email, no prices or offers, no ALL CAPS, no emojis.
Say what the business does, for whom, where (city / area), and what makes it different. Use the words a customer would search for, naturally — no keyword lists.
Only facts given below; invent nothing (no years, awards or numbers that are not given).
${b.hi ? "Write in simple Hindi (Devanagari), with common English product words as they are." : "Write in simple English."}
Return only the description.

${facts}` }] }] });
    const d = text.trim().replace(/^["']|["']$/g, "").replace(/https?:\/\/\S+|www\.\S+/gi, "").slice(0, 750);
    if (!d) return NextResponse.json({ error: "AI could not write it now. Try again." }, { status: 502 });
    return NextResponse.json({ description: d });
  } catch (e) { return fail(e); }
}
