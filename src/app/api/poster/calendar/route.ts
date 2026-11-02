// Monthly calendar: GET ?profile&month=YYYY-MM → entries (+ festival info per day)
// POST { action:"generate", profile, month, mix:{product,greeting,offer,testimonial} } builds the month
// POST { action:"set", id|profile+for_date, kind, product_id, note } edits one day
import { NextResponse } from "next/server";
import { userFromRequest, ownProfile, restAsUser, restAsService, posterEngine, istDate } from "@/lib/poster-server";
import { rateLimited } from "@/lib/api-security";
import { brandSnapshot, draftMonth, redraftDay } from "@/lib/content-plan";
import { DAY_KINDS, cleanBrief, clampStr, cleanTags, type DayBrief } from "@/lib/brand-plan";
import { isOwnMedia } from "@/lib/card-inputs";
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
  const posterRows = list((await restAsService<{ id: string; for_date: string; url: string }[]>(`posters?profile_id=eq.${profile}&for_date=gte.${month}-01&for_date=lte.${days[days.length - 1].date}&select=id,for_date,url`)).data);
  const posters = posterRows.filter((p) => p.url).map(({ for_date, url }) => ({ for_date, url }));
  return NextResponse.json({ days, entries: Array.isArray(r.data) ? r.data : [], products: await products(me.id), offers: Array.isArray(offers.data) ? offers.data : [], posters, planReady,
    activity: await monthActivity(me.id, month, days[days.length - 1].date, posterRows), channels: await autoChannels(me.id),
    strategy: await monthNote(me.token, profile, month) });
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
    const { days, ai, strategy } = await draftMonth(me.id, brand, month, focus, Number(b.perWeek ?? 5));
    const today = istDate();
    const last = days[days.length - 1].for_date;
    const done = ((await restAsUser<{ for_date: string }[]>(me.token, `poster_calendar?profile_id=eq.${profile}&status=eq.done&for_date=gte.${month}-01&for_date=lte.${last}&select=for_date`)).data ?? []).map((x) => x.for_date);
    // A day's own photo (the owner's "Use my photo") stays through a new plan.
    const photos = new Map(list((await restAsUser<{ for_date: string; overrides: Record<string, unknown> | null }[]>(me.token, `poster_calendar?profile_id=eq.${profile}&for_date=gte.${month}-01&for_date=lte.${last}&select=for_date,overrides`)).data)
      .filter((x) => typeof x.overrides?.photo === "string" && x.overrides.photo).map((x) => [x.for_date, String(x.overrides!.photo)]));
    // the past of this month is left as it is (nothing can be posted there any more)
    const ins = days.filter((d) => !done.includes(d.for_date) && d.for_date >= today).map((d) => ({ user_id: me.id, profile_id: profile, for_date: d.for_date, kind: d.kind, product_id: d.product_id, note: "", status: "planned", overrides: { ...d.overrides, ...(photos.get(d.for_date) ? { photo: photos.get(d.for_date) } : {}) }, brief: d.brief }));
    if (!ins.length) return NextResponse.json({ error: "This month is over — plan the next one." }, { status: 400 });
    await restAsUser(me.token, `poster_calendar?profile_id=eq.${profile}&for_date=gte.${ins[0].for_date}&for_date=lte.${last}&status=neq.done`, { method: "DELETE" });
    const r = await restAsUser(me.token, "poster_calendar", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(ins) });
    if (!r.ok) return NextResponse.json({ error: /brief|kind_check/.test(r.text) ? "Run migration 0083 in Supabase first." : r.text.slice(0, 200) }, { status: 400 });
    // Posters and captions already made for those days were for the old plan: the unposted, unshared ones go (they are drawn again with
    // the new words — before, the 4 AM post reused the old picture under the new caption); the rest only lose their caption.
    const keep = done.length ? `&for_date=not.in.(${done.join(",")})` : "";
    await restAsService(`posters?profile_id=eq.${profile}&for_date=gte.${ins[0].for_date}&for_date=lte.${last}${keep}&shares=eq.0`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    await restAsService(`posters?profile_id=eq.${profile}&for_date=gte.${ins[0].for_date}&for_date=lte.${last}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ caption: null }) });
    // The month's two-line strategy goes on the profile (layout.planNotes, last three months) — the plan page shows it on top.
    if (strategy) {
      const cur = list((await restAsUser<{ layout: Record<string, unknown> | null }[]>(me.token, `poster_profiles?id=eq.${profile}&select=layout`)).data)[0]?.layout ?? {};
      const notes = { ...((cur.planNotes && typeof cur.planNotes === "object") ? cur.planNotes as Record<string, string> : {}), [month]: strategy };
      const keep = Object.fromEntries(Object.entries(notes).sort(([a], [b2]) => b2.localeCompare(a)).slice(0, 3));
      await restAsUser(me.token, `poster_profiles?id=eq.${profile}&user_id=eq.${me.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ layout: { ...cur, planNotes: keep } }) }).catch(() => undefined);
    }
    return NextResponse.json({ ok: true, count: ins.filter((d) => d.kind !== "skip").length, ai, strategy });
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
    // The owner's own photo for this day ("" = back to the usual picture); only a photo this account uploaded.
    if (typeof b.photo === "string") { if (!b.photo) delete overrides.photo; else if (isOwnMedia(b.photo, me.id)) overrides.photo = b.photo; }
    const brief: DayBrief = { ...(cur?.brief ?? {}) };
    if (typeof b.caption === "string") { const c = cleanBrief({ caption: b.caption }).caption; if (c) brief.caption = c; else delete brief.caption; }
    if (b.hashtags !== undefined) { const t = cleanTags(typeof b.hashtags === "string" ? b.hashtags.split(/[\s,]+/) : b.hashtags); if (t.length) brief.hashtags = t; else delete brief.hashtags; }
    const kind = (DAY_KINDS as readonly string[]).includes(String(b.kind)) ? String(b.kind) : cur?.kind ?? "auto";
    const product_id = b.product_id === null ? null : UUID.test(String(b.product_id ?? "")) ? String(b.product_id) : cur?.product_id ?? null;
    const row = { user_id: me.id, profile_id: profile, for_date: date, kind, product_id: kind === "product" || kind === "offer" ? product_id : null, note: cur?.note ?? "", status: cur?.status === "done" ? "done" : "planned", overrides, brief };
    const r = await restAsUser(me.token, "poster_calendar?on_conflict=profile_id,for_date", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(row) });
    if (!r.ok) return NextResponse.json({ error: /brief|kind_check/.test(r.text) ? "Run migration 0083 in Supabase first." : r.text.slice(0, 200) }, { status: 400 });
    await freshDay(profile, date, row.status);
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
    const cur = list((await restAsUser<{ overrides: Record<string, unknown> | null; status: string }[]>(me.token, `poster_calendar?profile_id=eq.${profile}&for_date=eq.${date}&select=overrides,status`)).data)[0];
    const curPhoto = cur?.overrides?.photo;
    const row = { user_id: me.id, profile_id: profile, for_date: date, kind: day.kind, product_id: day.product_id, note: "", status: "planned", overrides: { ...day.overrides, ...(typeof curPhoto === "string" && curPhoto ? { photo: curPhoto } : {}) }, brief: day.brief };
    const r = await restAsUser(me.token, "poster_calendar?on_conflict=profile_id,for_date", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(row) });
    if (!r.ok) return NextResponse.json({ error: /brief|kind_check/.test(r.text) ? "Run migration 0083 in Supabase first." : r.text.slice(0, 200) }, { status: 400 });
    await freshDay(profile, date, cur?.status === "done" ? "done" : row.status);
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

/** New words for a day that has not gone out yet: its poster row goes (the app and the 4 AM post then draw the day again with the new
 *  words — before, they reused the old picture; a review, 2 Nov 2026). A day already posted keeps its row; only the caption is cleared. */
async function freshDay(profile: string, date: string, status: string) {
  const where = `posters?profile_id=eq.${profile}&for_date=eq.${date}`;
  if (status !== "done") await restAsService(`${where}&shares=eq.0`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  await restAsService(where, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ caption: null }) });
}

type Act = { date: string; provider: string; kind: string; status: "ok" | "error"; error: string; at: string };
/** What went out for each day of the month (and what failed, with why): the day sheet's "Activity" and the list's posted / failed mark.
 *  A post filed under one of this business's posters is its day; a failed post filed before poster ids were kept goes by its IST date. */
async function monthActivity(userId: string, month: string, last: string, posterRows: { id: string; for_date: string }[]): Promise<Act[]> {
  const byPoster = new Map(posterRows.map((p) => [p.id, p.for_date]));
  const from = new Date(`${month}-01T00:00:00+05:30`).toISOString();
  const to = new Date(new Date(`${last}T00:00:00+05:30`).getTime() + 86400e3).toISOString();
  // `kind` came with migration 0045: without it the list is read without that column.
  const q = (cols: string) => restAsService<{ provider: string | null; kind?: string | null; status: string; error: string | null; created_at: string; poster_id: string | null }[]>(
    `social_posts?user_id=eq.${userId}&created_at=gte.${from}&created_at=lt.${to}&select=${cols}&order=created_at&limit=500`);
  let res = await q("provider,kind,status,error,created_at,poster_id");
  if (!res.ok) res = await q("provider,status,error,created_at,poster_id");
  const rows = list(res.data);
  const ist = (iso: string) => new Date(Date.parse(iso) + 5.5 * 3600e3).toISOString().slice(0, 10);
  const out: Act[] = [];
  for (const r of rows) {
    const date = r.poster_id ? byPoster.get(r.poster_id) : r.status === "error" ? ist(r.created_at) : undefined;
    if (!date) continue;
    out.push({ date, provider: r.provider || "", kind: r.kind || "feed", status: r.status === "ok" ? "ok" : "error", error: (r.error ?? "").slice(0, 160), at: r.created_at });
  }
  return out;
}

/** Where the daily post goes by itself: the connected accounts with auto-post on (and any that need connecting again). */
async function autoChannels(userId: string): Promise<{ on: string[]; fix: string[] }> {
  type S = { provider: string; status: string; auto_post: boolean | null; is_active?: boolean | null };
  const s1 = await restAsService<S[]>(`social_accounts?user_id=eq.${userId}&select=provider,status,auto_post,is_active`);
  const soc = (s1.ok ? list(s1.data) : list((await restAsService<S[]>(`social_accounts?user_id=eq.${userId}&select=provider,status,auto_post`)).data)).filter((a) => a.is_active !== false);
  const g = list((await restAsService<{ status: string; auto_post: boolean | null }[]>(`google_accounts?user_id=eq.${userId}&select=status,auto_post`)).data);
  const on = [...new Set([...soc.filter((a) => a.auto_post && a.status === "ok").map((a) => a.provider), ...(g.some((x) => x.auto_post && x.status === "ok") ? ["google"] : [])])];
  const fix = [...new Set(soc.filter((a) => a.status === "reconnect").map((a) => a.provider))];
  return { on, fix };
}

/** A PostgREST answer as a list: an error answer is an object, never something to loop over. */
function list<T>(v: T[] | null | undefined): T[] { return Array.isArray(v) ? v : []; }

/** The month plan's two-line strategy, if the plan wrote one (poster_profiles.layout.planNotes). */
async function monthNote(token: string, profile: string, month: string): Promise<string> {
  const l = list((await restAsUser<{ layout: Record<string, unknown> | null }[]>(token, `poster_profiles?id=eq.${profile}&select=layout`)).data)[0]?.layout;
  const n = l?.planNotes && typeof l.planNotes === "object" ? (l.planNotes as Record<string, unknown>)[month] : "";
  return typeof n === "string" ? n : "";
}
