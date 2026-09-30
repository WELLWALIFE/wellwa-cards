// Monthly calendar: GET ?profile&month=YYYY-MM → entries (+ festival info per day)
// POST { action:"generate", profile, month, mix:{product,greeting,offer,testimonial} } builds the month
// POST { action:"set", id|profile+for_date, kind, product_id, note } edits one day
import { NextResponse } from "next/server";
import { userFromRequest, ownProfile, restAsUser, restAsService, posterEngine } from "@/lib/poster-server";
const UUID = /^[0-9a-f-]{36}$/i;
type Entry = { id: string; for_date: string; kind: string; product_id: string | null; note: string; status: string; overrides?: Record<string, unknown> };
type Offer = { id: string; text: string; starts: string; ends: string; scope: "all" | "products" | "category"; product_ids: string[]; categories: string[]; active: boolean };
const STYLES = new Set(["classic", "bold", "clean", "festive", "minimal", "traditional"]);
const MUSIC = new Set(["soft", "festive", "calm", "upbeat", "none"]);
function cleanOverrides(v: unknown) {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (STYLES.has(String(o.style))) out.style = String(o.style);
  if (o.voice === "on" || o.voice === "off") out.voice = o.voice;
  if (MUSIC.has(String(o.music))) out.music = String(o.music);
  if (typeof o.custom === "string" && o.custom.trim()) out.custom = o.custom.trim().slice(0, 60);
  // One day's own words and colour (the poster's "Only today" edit): a heading, a small line, an accent.
  if (typeof o.title === "string" && o.title.trim()) out.title = o.title.trim().slice(0, 60);
  if (typeof o.sub === "string" && o.sub.trim()) out.sub = o.sub.trim().slice(0, 80);
  if (typeof o.accent === "string" && /^#[0-9a-f]{6}$/i.test(o.accent.trim())) out.accent = o.accent.trim();
  return out;
}

function daysOf(month: string) {
  const [y, m] = month.split("-").map(Number); const out: string[] = [];
  for (let d = 1; d <= new Date(y, m, 0).getDate(); d++) out.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  return out;
}
async function products(userId: string) {
  let list = (await restAsService<{ id: string; name: string; offer: string; category: string }[]>(`poster_products?user_id=eq.${userId}&brand_id=is.null&active=eq.true&order=sort,created_at&select=id,name,offer,category`)).data ?? [];
  if (!list.length) { const bid = (await restAsService<{ brand_id: string | null }[]>(`profiles?id=eq.${userId}&select=brand_id`)).data?.[0]?.brand_id; if (bid) list = (await restAsService<{ id: string; name: string; offer: string; category: string }[]>(`poster_products?brand_id=eq.${bid}&active=eq.true&order=sort,created_at&select=id,name,offer,category`)).data ?? []; }
  return list;
}

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const u = new URL(request.url); const profile = u.searchParams.get("profile") ?? ""; const month = u.searchParams.get("month") ?? "";
  if (!UUID.test(profile) || !/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "bad params" }, { status: 400 });
  const eng = await posterEngine();
  const days = daysOf(month).map((d) => { const t = eng.themeFor(d); return { date: d, festival: t.kind === "occasion" ? t.hi : null }; });
  const r = await restAsUser<Entry[]>(me.token, `poster_calendar?profile_id=eq.${profile}&for_date=gte.${month}-01&for_date=lte.${days[days.length - 1].date}&order=for_date&select=id,for_date,kind,product_id,note,status,overrides`);
  const offers = await restAsUser<Offer[]>(me.token, "poster_offers?select=id,text,starts,ends,scope,product_ids,categories,active&order=starts.desc&limit=50");
  return NextResponse.json({ days, entries: Array.isArray(r.data) ? r.data : [], products: await products(me.id), offers: Array.isArray(offers.data) ? offers.data : [] });
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  if (b.action === "generate") {
    const profile = String(b.profile ?? ""), month = String(b.month ?? "");
    if (!UUID.test(profile) || !/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "bad params" }, { status: 400 });
    if (!(await ownProfile(me.token, profile))) return NextResponse.json({ error: "profile not found" }, { status: 404 });
    const n7 = (v: unknown, d: number) => Math.min(7, Math.max(0, Number(v ?? d)));
    const mix = { product: n7(b.mix?.product, 4), greeting: n7(b.mix?.greeting, 2), offer: n7(b.mix?.offer, 1), testimonial: n7(b.mix?.testimonial, 0) };
    const eng = await posterEngine(); const prods = await products(me.id);
    const hasReviews = ((await restAsService<{ id: string }[]>(`poster_testimonials?user_id=eq.${me.id}&approved=eq.true&limit=1&select=id`)).data ?? []).length > 0;
    // weekly pattern: spread kinds over the 7 days (product → offer → testimonial → greeting → skip), festival days override
    const pattern: string[] = []; for (let i = 0; i < 7; i++) pattern.push(i < mix.product ? "product" : i < mix.product + mix.offer ? "offer" : i < mix.product + mix.offer + mix.testimonial ? "testimonial" : i < mix.product + mix.offer + mix.testimonial + mix.greeting ? "greeting" : "skip");
    const order = [0, 3, 5, 1, 4, 6, 2]; // Mon, Thu, Sat, Tue, Fri, Sun, Wed — products land on strong days
    const byDow: Record<number, string> = {}; order.forEach((dow, i) => { byDow[dow] = pattern[i]; });
    const rows = daysOf(month).map((d, i) => {
      const t = eng.themeFor(d); const dow = (new Date(d + "T00:00:00Z").getUTCDay() + 6) % 7; // Mon=0
      let kind = t.kind === "occasion" ? "festival" : byDow[dow];
      if ((kind === "product" || kind === "offer") && !prods.length) kind = "greeting";
      if (kind === "testimonial" && !hasReviews) kind = "greeting";
      const withOffer = prods.filter((p) => p.offer);
      const product = kind === "offer" ? (withOffer[i % Math.max(1, withOffer.length)] ?? prods[i % prods.length]) : kind === "product" ? prods[i % prods.length] : null;
      return { user_id: me.id, profile_id: profile, for_date: d, kind, product_id: product?.id ?? null, note: "", status: "planned" };
    });
    // keep already-done days, replace the rest
    await restAsUser(me.token, `poster_calendar?profile_id=eq.${profile}&for_date=gte.${month}-01&for_date=lte.${rows[rows.length - 1].for_date}&status=neq.done`, { method: "DELETE" });
    const done = (await restAsUser<{ for_date: string }[]>(me.token, `poster_calendar?profile_id=eq.${profile}&status=eq.done&for_date=gte.${month}-01&select=for_date`)).data?.map((x) => x.for_date) ?? [];
    const ins = rows.filter((r) => !done.includes(r.for_date));
    const r = await restAsUser(me.token, "poster_calendar", { method: "POST", body: JSON.stringify(ins) });
    if (!r.ok) return NextResponse.json({ error: r.text.slice(0, 200) }, { status: 400 });
    return NextResponse.json({ ok: true, count: ins.length });
  }
  if (b.action === "set") {
    const profile = String(b.profile ?? ""), date = String(b.for_date ?? "");
    if (!UUID.test(profile) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "bad params" }, { status: 400 });
    const kind = ["auto", "festival", "product", "offer", "greeting", "testimonial", "skip"].includes(b.kind) ? b.kind : "auto";
    const row: Record<string, unknown> = { user_id: me.id, profile_id: profile, for_date: date, kind, product_id: UUID.test(String(b.product_id ?? "")) ? b.product_id : null, note: String(b.note ?? "").slice(0, 120), status: "planned" };
    if ("overrides" in b) row.overrides = cleanOverrides(b.overrides);
    const r = await restAsUser(me.token, "poster_calendar?on_conflict=profile_id,for_date", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(row) });
    if (!r.ok) return NextResponse.json({ error: r.text.slice(0, 200) }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  if (b.action === "day") {
    // The poster's "Only today" edit: heading / extra line / colour for ONE date, everything else about the day
    // (its kind, product, note, status) left exactly as the calendar had it. An empty string clears a field.
    const profile = String(b.profile ?? ""), date = String(b.for_date ?? "");
    if (!UUID.test(profile) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "bad params" }, { status: 400 });
    if (!(await ownProfile(me.token, profile))) return NextResponse.json({ error: "profile not found" }, { status: 404 });
    const cur = (await restAsUser<Entry[]>(me.token, `poster_calendar?profile_id=eq.${profile}&for_date=eq.${date}&select=kind,product_id,note,status,overrides`)).data?.[0];
    const given = (b.overrides && typeof b.overrides === "object" ? b.overrides : {}) as Record<string, unknown>;
    const overrides: Record<string, unknown> = { ...(cur?.overrides ?? {}), ...cleanOverrides(given) };
    for (const k of ["title", "sub", "custom", "accent", "style"]) if (given[k] === "" || given[k] === null) delete overrides[k];
    const row = { user_id: me.id, profile_id: profile, for_date: date, kind: cur?.kind ?? "auto", product_id: cur?.product_id ?? null, note: cur?.note ?? "", status: cur?.status ?? "planned", overrides };
    const r = await restAsUser(me.token, "poster_calendar?on_conflict=profile_id,for_date", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(row) });
    if (!r.ok) return NextResponse.json({ error: r.text.slice(0, 200) }, { status: 400 });
    return NextResponse.json({ ok: true, overrides });
  }
  if (b.action === "offer") {
    // { offer: { id?, text, starts, ends, scope, product_ids, active } } → upsert; { delete: id } → remove
    if (UUID.test(String(b.delete ?? ""))) { await restAsUser(me.token, `poster_offers?id=eq.${b.delete}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }); return NextResponse.json({ ok: true }); }
    const o = (b.offer ?? {}) as Record<string, unknown>;
    const text = String(o.text ?? "").trim().slice(0, 60);
    const D = /^\d{4}-\d{2}-\d{2}$/;
    if (!text || !D.test(String(o.starts)) || !D.test(String(o.ends))) return NextResponse.json({ error: "Offer text, start and end dates are required." }, { status: 400 });
    const row = { user_id: me.id, text, starts: o.starts, ends: o.ends, scope: o.scope === "products" ? "products" : o.scope === "category" ? "category" : "all", product_ids: (Array.isArray(o.product_ids) ? o.product_ids : []).filter((x: unknown) => UUID.test(String(x))).slice(0, 50), categories: (Array.isArray(o.categories) ? o.categories : []).map((x: unknown) => String(x).trim().slice(0, 30)).filter(Boolean).slice(0, 20), active: o.active !== false };
    const id = UUID.test(String(o.id ?? "")) ? String(o.id) : null;
    const r = id ? await restAsUser(me.token, `poster_offers?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(row) })
      : await restAsUser(me.token, "poster_offers", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(row) });
    if (!r.ok) return NextResponse.json({ error: r.text.slice(0, 200) || "Could not save (run migration 0042?)." }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "bad action" }, { status: 400 });
}
