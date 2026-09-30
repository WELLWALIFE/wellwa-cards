// GET  → my poster profiles       POST → create / update one
import { NextResponse } from "next/server";
import { userFromRequest, restAsUser, restAsService, type PosterProfile } from "@/lib/poster-server";

const PERSONAS = new Set(["business", "personal", "home", "community", "student", "professional"]);
const LANGS = new Set(["hi", "en", "hinglish", "mr", "gu", "pa", "bn", "ta", "te", "kn", "ml", "or"]);
const STYLES = new Set(["classic", "bold", "clean", "festive", "minimal", "traditional", "signature", "signature-classic"]);
const HEX = /^#[0-9a-f]{6}$/i;
const S = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const URLOK = (v: unknown) => (typeof v === "string" && /^https?:\/\//.test(v) && v.length < 500 ? v : "");
function cleanLayout(v: unknown) {
  const l = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (S(l.title, 40)) out.title = S(l.title, 40);
  if (typeof l.sub === "string") out.sub = S(l.sub, 40);
  if (S(l.custom, 60)) out.custom = S(l.custom, 60);
  if (HEX.test(String(l.accent ?? ""))) out.accent = String(l.accent);
  if (["S", "M", "L"].includes(String(l.nameSize))) out.nameSize = String(l.nameSize);
  if (l.photoSide === "right") out.photoSide = "right";
  for (const k of ["hideLine", "hidePhone", "hideLogo", "hidePhoto", "showName", "showLine", "showPhone", "showPhoto"]) if (l[k] === true) out[k] = true;
  if (["auto", "Retail", "Food", "Health", "Services", "Education", "Sales", "Industry", "Community", "Personal"].includes(String(l.artGroup))) out.artGroup = String(l.artGroup);
  if (l.varyStyle === true) out.varyStyle = true;
  // Signature (30 Sep 2026): the look of the daily poster — "vibrant" | "classic" | "old" (the six original styles);
  // usps = up to five "why us" lines, "label|sub", drawn as the icon chips / the gold line.
  if (["vibrant", "classic", "old"].includes(String(l.look))) out.look = String(l.look);
  const usps = (Array.isArray(l.usps) ? l.usps : []).map((u) => (typeof u === "string" ? u : u && typeof u === "object" ? `${S((u as Record<string, unknown>).label, 22)}|${S((u as Record<string, unknown>).sub, 22)}` : "")).map((u) => u.split("|").map((x) => x.trim().slice(0, 22)).slice(0, 2).join("|").replace(/\|$/, "")).filter((u) => u && u !== "|").slice(0, 5);
  if (usps.length) out.usps = usps;
  if (l.autoStatusVideo === false) out.autoStatusVideo = false;
  const vc = l.voice as Record<string, unknown> | undefined;
  if (vc && typeof vc === "object") out.voice = { on: vc.on === true, gender: ["female", "female2", "male", "male2"].includes(String(vc.gender)) ? String(vc.gender) : "female", ...(vc.by === "user" ? { by: "user" } : {}) };
  return out;
}
function cleanParty(v: unknown) {
  const p = (v && typeof v === "object" ? v : null) as Record<string, unknown> | null;
  if (!p) return null;
  const out = { name: S(p.name, 60), symbol_url: URLOK(p.symbol_url), slogan: S(p.slogan, 60), colors: (Array.isArray(p.colors) ? p.colors : []).map(String).filter((c) => HEX.test(c)).slice(0, 2),
    leaders: (Array.isArray(p.leaders) ? p.leaders : []).slice(0, 3).map((x: Record<string, unknown>) => ({ name: S(x.name, 40), photo_url: URLOK(x.photo_url) })).filter((x: { photo_url: string }) => x.photo_url) };
  return out.name || out.symbol_url || out.leaders.length ? out : null;
}

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const r = await restAsUser<PosterProfile[]>(me.token, "poster_profiles?select=*&order=is_default.desc,created_at.asc");
  return NextResponse.json({ profiles: r.data ?? [] });
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const persona = PERSONAS.has(b.persona) ? b.persona : "personal";
  const row = {
    user_id: me.id,
    persona,
    name: String(b.name ?? "").trim().slice(0, 60),
    tagline: String(b.tagline ?? "").trim().slice(0, 80),
    phone: String(b.phone ?? "").trim().slice(0, 20),
    city: String(b.city ?? "").trim().slice(0, 40),
    lang: LANGS.has(b.lang) ? b.lang : "hi",
    photo_url: typeof b.photo_url === "string" && b.photo_url.length < 500 ? b.photo_url : null,
    logo_url: typeof b.logo_url === "string" && b.logo_url.length < 500 ? b.logo_url : null,
    kids_mode: persona === "student" ? true : !!b.kids_mode,
    mode: b.mode === "product" ? "product" : "greeting",
    is_default: !!b.is_default,
    style: STYLES.has(b.style) ? b.style : "classic",
    layout: cleanLayout(b.layout),
    category: S(b.category, 30),
    party: persona === "community" ? cleanParty(b.party) : null,
  };
  if (!row.name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  // Only one default per user.
  if (row.is_default) await restAsUser(me.token, `poster_profiles?user_id=eq.${me.id}`, { method: "PATCH", body: JSON.stringify({ is_default: false }) });
  const id = typeof b.id === "string" && /^[0-9a-f-]{36}$/i.test(b.id) ? b.id : null;
  const r = id
    ? await restAsUser<PosterProfile[]>(me.token, `poster_profiles?id=eq.${id}&user_id=eq.${me.id}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) })
    : await restAsUser<PosterProfile[]>(me.token, "poster_profiles", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) });
  if (!r.ok || !r.data?.[0]) return NextResponse.json({ error: "Could not save the profile.", detail: r.text.slice(0, 200) }, { status: 400 });
  // Referral (first profile only): both sides get 30 days of Personal.
  if (typeof b.ref === "string" && /^[A-Z0-9]{4,10}$/i.test(b.ref)) await applyReferral(me.id, b.ref.toUpperCase()).catch(() => {});
  // First profile becomes the default automatically.
  const all = await restAsUser<PosterProfile[]>(me.token, `poster_profiles?user_id=eq.${me.id}&select=id,is_default`);
  if (all.data && !all.data.some((p) => p.is_default)) {
    await restAsUser(me.token, `poster_profiles?id=eq.${r.data[0].id}`, { method: "PATCH", body: JSON.stringify({ is_default: true }) });
    r.data[0].is_default = true;
  }
  return NextResponse.json({ profile: r.data[0] });
}

export async function DELETE(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Bad id." }, { status: 400 });
  await restAsUser(me.token, `poster_profiles?id=eq.${id}&user_id=eq.${me.id}`, { method: "DELETE" });
  return NextResponse.json({ ok: true });
}

/** "Ek dost ko jodo, dono ko ek mahina free" — idempotent, self-referral ignored. */
async function applyReferral(userId: string, code: string) {
  const mine = await restAsService<{ referred_by: string | null; poster_plan: string; poster_plan_expires_at: string | null }[]>(`profiles?id=eq.${userId}&select=referred_by,poster_plan,poster_plan_expires_at`);
  if (!mine.data?.[0] || mine.data[0].referred_by) return;
  const ref = await restAsService<{ id: string; poster_plan: string; poster_plan_expires_at: string | null }[]>(`profiles?referral_code=eq.${encodeURIComponent(code)}&select=id,poster_plan,poster_plan_expires_at`);
  const referrer = ref.data?.[0];
  if (!referrer || referrer.id === userId) return;
  const plus30 = (exp: string | null) => new Date(Math.max(Date.now(), exp ? new Date(exp).getTime() : 0) + 30 * 86400000).toISOString();
  const upgrade = (p: { poster_plan: string; poster_plan_expires_at: string | null }) =>
    p.poster_plan === "business" ? { poster_plan_expires_at: plus30(p.poster_plan_expires_at) } : { poster_plan: "personal", poster_plan_expires_at: plus30(p.poster_plan_expires_at) };
  await restAsService(`profiles?id=eq.${userId}`, { method: "PATCH", body: JSON.stringify({ referred_by: referrer.id, ...upgrade(mine.data[0]) }) });
  await restAsService(`profiles?id=eq.${referrer.id}`, { method: "PATCH", body: JSON.stringify(upgrade(referrer)) });
}
