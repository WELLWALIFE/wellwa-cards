// Monthly calendar: GET ?profile&month=YYYY-MM → entries (+ festival info per day)
// POST { action:"generate", profile, month, mix:{product,greeting,offer,testimonial} } builds the month
// POST { action:"set", id|profile+for_date, kind, product_id, note } edits one day
import { NextResponse } from "next/server";
import { userFromRequest, ownProfile, restAsUser, restAsService, posterEngine, istDate } from "@/lib/poster-server";
import { rateLimited } from "@/lib/api-security";
import { brandSnapshot, draftMonth, redraftDay } from "@/lib/content-plan";
import { DAY_KINDS, cleanBrief, clampStr, cleanTags, type DayBrief } from "@/lib/brand-plan";
const UUID = /^[0-9a-f-]{36}$/i;
type Entry = { id: string; for_date: string; kind: string; product_id: string | null; note: string; status: string; overrides?: Record<string, unknown>; brief?: DayBrief };
type Offer = { id: string; text: string; starts: string; ends: string; scope: "all" | "products" | "category"; product_ids: string[]; categories: string[]; active: boolean };
const STYLES = new Set(["classic", "bold", "clean", "festive", "minimal", "traditional", "signature", "signature-classic"]);
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
  const q0 = `poster_calendar?profile_id=eq.${profile}&for_date=gte.${month}-01&for_date=lte.${days[days.length - 1].date}&order=for_date&select=id,for_date,kind,product_id,note,status,overrides`;
  let r = await restAsUser<Entry[]>(me.token, `${q0},brief`);
  const planReady = r.ok; // false until migration 0083 adds `brief`
  if (!r.ok) r = await restAsUser<Entry[]>(me.token, q0);
  const offers = await restAsUser<Offer[]>(me.token, "poster_offers?select=id,text,starts,ends,scope,product_ids,categories,active&order=starts.desc&limit=50");
  const posters = (await restAsService<{ for_date: string; url: string }[]>(`posters?profile_id=eq.${profile}&for_date=gte.${month}-01&for_date=lte.${days[days.length - 1].date}&select=for_date,url`)).data ?? [];
  return NextResponse.json({ days, entries: Array.isArray(r.data) ? r.data : [], products: await products(me.id), offers: Array.isArray(offers.data) ? offers.data : [], posters, planReady });
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
    // The day plan is read with the service role when the poster is drawn, so a row on someone else's profile would put
    // the caller's words on that owner's poster: only the caller's own profile.
    if (!(await ownProfile(me.token, profile))) return NextResponse.json({ error: "profile not found" }, { status: 404 });
    const kind = (DAY_KINDS as readonly string[]).includes(b.kind) ? b.kind : "auto";
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
  if (b.action === "plan") {
    // Month plan v2: the AI plans the month post by post (heading + line on the poster, caption, hashtags, why) from the brand,
    // the products, the offers and the festivals. Days already posted stay as they were; the rest are replaced.
    const profile = String(b.profile ?? ""), month = String(b.month ?? "");
    if (!UUID.test(profile) || !/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "bad params" }, { status: 400 });
    if (!(await ownProfile(me.token, profile))) return NextResponse.json({ error: "profile not found" }, { status: 404 });
    if (rateLimited(`month-plan:${me.id}`, 8, 24 * 3600_000)) return NextResponse.json({ error: "The plan was made many times today. Please change single days, or try again tomorrow." }, { status: 429 });
    const brand = await brandSnapshot(me.id, profile);
    if (!brand) return NextResponse.json({ error: "profile not found" }, { status: 404 });
    const focus = (Array.isArray(b.focus) ? b.focus : []).map(String);
    const { days, ai } = await draftMonth(me.id, brand, month, focus, Number(b.perWeek ?? 5));
    const today = istDate();
    const last = days[days.length - 1].for_date;
    const done = ((await restAsUser<{ for_date: string }[]>(me.token, `poster_calendar?profile_id=eq.${profile}&status=eq.done&for_date=gte.${month}-01&for_date=lte.${last}&select=for_date`)).data ?? []).map((x) => x.for_date);
    // the past of this month is left as it is (nothing can be posted there any more)
    const ins = days.filter((d) => !done.includes(d.for_date) && d.for_date >= today).map((d) => ({ user_id: me.id, profile_id: profile, for_date: d.for_date, kind: d.kind, product_id: d.product_id, note: "", status: "planned", overrides: d.overrides, brief: d.brief }));
    if (!ins.length) return NextResponse.json({ error: "This month is over — plan the next one." }, { status: 400 });
    await restAsUser(me.token, `poster_calendar?profile_id=eq.${profile}&for_date=gte.${ins[0].for_date}&for_date=lte.${last}&status=neq.done`, { method: "DELETE" });
    const r = await restAsUser(me.token, "poster_calendar", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(ins) });
    if (!r.ok) return NextResponse.json({ error: /brief|kind_check/.test(r.text) ? "Run migration 0083 in Supabase first." : r.text.slice(0, 200) }, { status: 400 });
    // captions already written for those days were for the old plan
    await restAsService(`posters?profile_id=eq.${profile}&for_date=gte.${ins[0].for_date}&for_date=lte.${last}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ caption: null }) });
    return NextResponse.json({ ok: true, count: ins.filter((d) => d.kind !== "skip").length, ai });
  }
  if (b.action === "post") {
    // One planned post, edited by the owner: the poster's heading / small line / offer line, the caption, the hashtags.
    const profile = String(b.profile ?? ""), date = String(b.for_date ?? "");
    if (!UUID.test(profile) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "bad params" }, { status: 400 });
    if (!(await ownProfile(me.token, profile))) return NextResponse.json({ error: "profile not found" }, { status: 404 });
    const cur = (await restAsUser<Entry[]>(me.token, `poster_calendar?profile_id=eq.${profile}&for_date=eq.${date}&select=kind,product_id,note,status,overrides,brief`)).data?.[0];
    const overrides: Record<string, unknown> = { ...(cur?.overrides ?? {}) };
    for (const [k, n] of [["title", 40], ["sub", 48], ["custom", 60]] as const) if (typeof b[k] === "string") { const v = clampStr(b[k], n); if (v) overrides[k] = v; else delete overrides[k]; }
    // the look of this one day (style / voice in the Status video / music): "" = the usual
    for (const k of ["style", "voice", "music"] as const) if (typeof b[k] === "string") { const v = cleanOverrides({ [k]: b[k] })[k]; if (v) overrides[k] = v; else delete overrides[k]; }
    const brief: DayBrief = { ...(cur?.brief ?? {}) };
    if (typeof b.caption === "string") { const c = cleanBrief({ caption: b.caption }).caption; if (c) brief.caption = c; else delete brief.caption; }
    if (b.hashtags !== undefined) { const t = cleanTags(typeof b.hashtags === "string" ? b.hashtags.split(/[\s,]+/) : b.hashtags); if (t.length) brief.hashtags = t; else delete brief.hashtags; }
    const kind = (DAY_KINDS as readonly string[]).includes(String(b.kind)) ? String(b.kind) : cur?.kind ?? "auto";
    const product_id = b.product_id === null ? null : UUID.test(String(b.product_id ?? "")) ? String(b.product_id) : cur?.product_id ?? null;
    const row = { user_id: me.id, profile_id: profile, for_date: date, kind, product_id: kind === "product" || kind === "offer" ? product_id : null, note: cur?.note ?? "", status: cur?.status === "done" ? "done" : "planned", overrides, brief };
    const r = await restAsUser(me.token, "poster_calendar?on_conflict=profile_id,for_date", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(row) });
    if (!r.ok) return NextResponse.json({ error: /brief|kind_check/.test(r.text) ? "Run migration 0083 in Supabase first." : r.text.slice(0, 200) }, { status: 400 });
    await restAsService(`posters?profile_id=eq.${profile}&for_date=eq.${date}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ caption: null }) });
    return NextResponse.json({ ok: true, entry: row });
  }
  if (b.action === "redo") {
    // "Another idea" for one day (optionally with the owner's own hint): the AI writes that one post again.
    const profile = String(b.profile ?? ""), date = String(b.for_date ?? "");
    if (!UUID.test(profile) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "bad params" }, { status: 400 });
    if (!(await ownProfile(me.token, profile))) return NextResponse.json({ error: "profile not found" }, { status: 404 });
    if (rateLimited(`day-plan:${me.id}`, 60, 24 * 3600_000)) return NextResponse.json({ error: "Many new ideas today already. Please edit the words yourself, or try tomorrow." }, { status: 429 });
    const brand = await brandSnapshot(me.id, profile);
    if (!brand) return NextResponse.json({ error: "profile not found" }, { status: 404 });
    const month = date.slice(0, 7);
    const others = (await restAsUser<Entry[]>(me.token, `poster_calendar?profile_id=eq.${profile}&for_date=gte.${month}-01&for_date=lte.${daysOf(month).slice(-1)[0]}&for_date=neq.${date}&select=for_date,brief`)).data ?? [];
    const day = await redraftDay(me.id, brand, date, clampStr(b.hint, 140), others.map((o) => o.brief?.hook ?? "").filter(Boolean));
    if (!day) return NextResponse.json({ error: "No new idea right now. Please try again in a minute." }, { status: 503 });
    const row = { user_id: me.id, profile_id: profile, for_date: date, kind: day.kind, product_id: day.product_id, note: "", status: "planned", overrides: day.overrides, brief: day.brief };
    const r = await restAsUser(me.token, "poster_calendar?on_conflict=profile_id,for_date", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(row) });
    if (!r.ok) return NextResponse.json({ error: /brief|kind_check/.test(r.text) ? "Run migration 0083 in Supabase first." : r.text.slice(0, 200) }, { status: 400 });
    await restAsService(`posters?profile_id=eq.${profile}&for_date=eq.${date}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ caption: null }) });
    return NextResponse.json({ ok: true, entry: row });
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
