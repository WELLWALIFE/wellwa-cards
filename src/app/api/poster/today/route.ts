// GET ?profile=<id>[&date=YYYY-MM-DD][&force=1] → this profile's poster for the day.
// Renders lazily (shared base art + personal layer), records the poster row,
// enforces the free-plan weekly quota.
import { NextResponse } from "next/server";
import { userFromRequest, ownProfile, posterQuota, istDate, posterEngine, restAsService, OUT_URL, dayPlan, cardLinkFor, joinLinkFor, posterVersion } from "@/lib/poster-server";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const q = new URL(request.url).searchParams;
  const profileId = q.get("profile") ?? "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(q.get("date") ?? "") ? q.get("date")! : istDate();
  const profile = await ownProfile(me.token, profileId);
  if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  // Already made today? No quota hit, just return it.
  const existing = await restAsService<{ id: string; url: string; title: string; occasion_slug: string; shares: number; style: string; video_url: string; caption: string | null }[]>(
    `posters?profile_id=eq.${profile.id}&for_date=eq.${date}&select=id,url,title,occasion_slug,shares,style,video_url,caption`,
  );
  const quota = await posterQuota(me.token, me.id);
  if (quota.plan === "free") return NextResponse.json({ error: "plan", quota, message: "Daily posters are part of Growth. Your free plan includes the digital V-Card — upgrade to get a fresh poster and status video every day." }, { status: 402 });
  // The owner's V-Card: its link goes on the poster and with every share; on Sundays the poster IS the card.
  const link = await cardLinkFor(me.id, (profile as unknown as { card_facts?: { primaryCardId?: string } | null }).card_facts?.primaryCardId);
  const card_url = link?.url ?? "";
  const force = q.get("force") === "1";
  const preview = q.get("preview") === "1"; // calendar "next 7 days": render only, no quota, no posters row (paid plans)
  if (preview && quota.plan === "free") return NextResponse.json({ error: "plan", message: "Preview of upcoming posters is part of the Personal / Business plan." }, { status: 402 });
  // style: ?style= (chip tap) beats the profile's saved style; a different style re-renders without spending quota
  const STYLE_KEYS = ["signature", "signature-classic", "classic", "bold", "clean", "festive", "minimal", "traditional"];
  const eng0 = await posterEngine();
  const plan = await dayPlan(me.id, profile.id, date);
  const styleParam = STYLE_KEYS.includes(q.get("style") ?? "") ? q.get("style")! : "";
  let style = styleParam || eng0.effectiveStyle(profile as unknown as Record<string, unknown>, date, plan.cal?.overrides?.style);
  // Signature is the default of paid profiles: report the look the engine will draw, so the chips and the posters row
  // say "signature" rather than the profile's old style key (a tapped chip is taken as it is).
  if (!styleParam) { const look = eng0.signatureLookFor(profile as unknown as Record<string, unknown>, style, { premium: quota.plan !== "free" }); if (look) style = look === "classic" ? "signature-classic" : "signature"; }
  const restyle = !!existing.data?.[0] && (existing.data[0].style || "classic") !== style;
  const overrides = { title: plan.cal?.overrides?.title ?? "", custom: plan.cal?.overrides?.custom ?? "", accent: plan.cal?.overrides?.accent ?? "" };
  if (existing.data?.[0] && !force && !restyle && !preview) {
    return NextResponse.json({ poster: { ...existing.data[0], v: await posterVersion(existing.data[0].url) }, date, theme: eng0.themeFor(date), quota, style, overrides, card_url });
  }
  if (!preview && !existing.data?.[0] && quota.limit !== null && quota.used >= quota.limit) {
    return NextResponse.json({ error: "quota", quota, message: "Today's free poster is made. Growth removes the branding and adds tomorrow's preview and the AI voice." }, { status: 402 });
  }

  const eng = await posterEngine();
  let file: string;
  try {
    const cal = plan.cal;
    if (cal?.kind === "skip") return NextResponse.json({ error: "skipped", message: "Today is marked 'skip' in the calendar.", date, theme: eng.themeFor(date), quota }, { status: 409 });
    // The day's kind: the calendar's choice wins; otherwise festival days are festivals and business days rotate
    // product / benefit / greeting / offer (see rosterKind) — real stock photos for the trade, not the same art every day.
    const theme0 = eng.themeFor(date);
    const allProducts = (await restAsService<Record<string, unknown>[]>(`poster_products?user_id=eq.${me.id}&brand_id=is.null&active=eq.true&order=sort,created_at&select=*`)).data ?? [];
    const roster = cal?.kind && cal.kind !== "auto" ? String(cal.kind) : profile.mode === "product" ? (theme0.kind === "occasion" ? "festival" : "product") : eng.rosterKind(theme0, date, { hasProducts: allProducts.length > 0 });
    const wantProduct = roster === "product" || roster === "benefit" || roster === "offer";
    const stockKind = roster === "testimonial" ? "greeting" : roster;
    // testimonial day: pick one of the user's approved reviews by day index; none → normal poster
    let testimonial: Record<string, unknown> | null = null;
    if (cal?.kind === "testimonial") {
      const list = (await restAsService<Record<string, unknown>[]>(`poster_testimonials?user_id=eq.${me.id}&approved=eq.true&order=created_at&select=*`)).data ?? [];
      if (list.length) testimonial = list[Math.floor(new Date(date + "T00:00:00Z").getTime() / 86400000) % list.length];
    }
    // The day's own words and colour (the "Only today" edit) sit over the profile's layout for this render only.
    const ov = cal?.overrides ?? {};
    const baseLayout = (profile as unknown as { layout?: Record<string, unknown> }).layout ?? {};
    // a tapped chip of the six original styles means "not Signature today"
    const dayLayout = { ...baseLayout, ...(ov.title ? { title: ov.title } : {}), ...(ov.sub ? { sub: ov.sub } : {}), ...(ov.accent ? { accent: ov.accent } : {}), ...(styleParam && !styleParam.startsWith("signature") ? { look: "old" } : {}) };
    const effProfile = { ...profile, layout: dayLayout, mode: testimonial ? "testimonial" : wantProduct ? "product" : "greeting" } as typeof profile;
    let products = effProfile.mode === "product" ? allProducts : [];
    if (cal?.product_id) { const one = products.find((p) => p.id === cal.product_id); if (one) products = [one]; }
    if (effProfile.mode === "product" && !products.length) {
      // Team mode: members inherit the company's products
      const bid = (await restAsService<{ brand_id: string | null }[]>(`profiles?id=eq.${me.id}&select=brand_id`)).data?.[0]?.brand_id;
      if (bid) products = (await restAsService<Record<string, unknown>[]>(`poster_products?brand_id=eq.${bid}&active=eq.true&order=sort,created_at&select=*`)).data ?? [];
    }
    // the product ON the poster (the engine's own pick, products[day % n]) decides which offer applies
    const dayN = Math.floor(new Date(date + "T00:00:00Z").getTime() / 86400000);
    const dayProd = effProfile.mode === "product" && products.length ? products[dayN % products.length] : null;
    const custom = plan.offer || (dayProd ? eng.offerFor(plan.offers, date, dayProd.id as string, String(dayProd.category ?? "")) : "");
    // benefit day: the product's benefit becomes the poster line (rotates through the list)
    let dayCustom = custom;
    if (roster === "benefit" && dayProd) {
      const b = (Array.isArray(dayProd.benefits) ? (dayProd.benefits as string[]) : []).filter(Boolean);
      if (b.length) dayCustom = b[Math.floor(new Date(date + "T00:00:00Z").getTime() / 86400000) % b.length];
    }
    const category = String((profile as unknown as { category?: string }).category ?? (products[0]?.category ?? "")) || "";
    const cardDay = !!link && (!cal?.kind || cal.kind === "auto") && !testimonial && eng.isCardDay(date, theme0);
    const opts: Record<string, unknown> = { force, watermark: quota.plan === "free", products, premium: quota.plan !== "free", style, custom: dayCustom, stock: { category, kind: stockKind }, link: link?.show ?? "", card: cardDay ? link!.data : null };
    if (testimonial) opts.testimonial = testimonial;
    file = await eng.renderPoster(date, effProfile as unknown as Record<string, unknown>, opts as Parameters<typeof eng.renderPoster>[2]);
  } catch (e) {
    return NextResponse.json({ error: "The poster could not be made right now. Please try again in a minute.", detail: (e as Error).message.slice(0, 200) }, { status: 500 });
  }
  const theme = eng.themeFor(date);
  const url = OUT_URL(file);
  const v = await posterVersion(url);
  if (preview) return NextResponse.json({ poster: { id: "", url, title: theme.hi, occasion_slug: theme.slug, shares: 0, style, v }, date, theme, style, quota, preview: true, card_url });
  const row = { profile_id: profile.id, for_date: date, occasion_slug: theme.slug, title: theme.hi, url, style, video_url: "" };
  const saved = await restAsService<{ id: string; url: string; title: string; occasion_slug: string; shares: number; style: string; video_url: string }[]>(
    "posters?on_conflict=profile_id,for_date",
    { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(row) },
  );
  const poster = saved.data?.[0] ?? { id: "", ...row, shares: 0 };
  const join_url = await joinLinkFor(me.id).catch(() => "");
  return NextResponse.json({ poster: { ...poster, v, caption: existing.data?.[0]?.caption ?? null }, date, theme, style, overrides, card_url, join_url, quota: { ...quota, used: existing.data?.[0] ? quota.used : quota.used + 1 } });
}
