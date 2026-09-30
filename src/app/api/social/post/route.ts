// POST (bearer) { poster_id, caption, account_ids: [] } → publish the poster
// image to each selected Facebook Page / Instagram account.
import { NextResponse } from "next/server";
import { userFromRequest, restAsService, ensurePosterCaption, dayPlan, cardLinkFor, posterEngine, ensureStatusVideo, joinLinkFor, posterCaptionWriter } from "@/lib/poster-server";
import { listAccounts, publishImage, SITE_URL } from "@/lib/social-server";

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const posterId = String(b.poster_id ?? "");
  const caption = String(b.caption ?? "").slice(0, 2000);
  const ids: string[] = Array.isArray(b.account_ids) ? b.account_ids.map(String).filter((x: string) => /^[0-9a-f-]{36}$/i.test(x)) : [];
  if (!/^[0-9a-f-]{36}$/i.test(posterId) || !ids.length) return NextResponse.json({ error: "poster_id and account_ids required" }, { status: 400 });

  const p = await restAsService<{ id: string; url: string; title: string; for_date: string; profile_id: string; poster_profiles: { user_id: string; name: string; tagline: string | null; phone: string | null; lang: string | null; mode: string | null; card_facts: { primaryCardId?: string } | null } }[]>(`posters?id=eq.${posterId}&select=id,url,title,for_date,profile_id,poster_profiles!inner(user_id,name,tagline,phone,lang,mode,card_facts)`);
  const poster = p.data?.[0];
  if (!poster || poster.poster_profiles.user_id !== me.id) return NextResponse.json({ error: "poster not found" }, { status: 404 });
  const imageUrl = poster.url.startsWith("http") ? poster.url : `${SITE_URL}${poster.url}`;
  const pr = poster.poster_profiles;
  const plan = await dayPlan(me.id, poster.profile_id, poster.for_date);
  const offer = plan.offer;
  // A caption written here talks about the product on the poster and carries the owner's V-Card link (like the auto-post).
  let finalCaption = caption;
  const link = await cardLinkFor(me.id, pr.card_facts?.primaryCardId);
  const join = await joinLinkFor(me.id).catch(() => "");
  if (!finalCaption) {
    const eng = await posterEngine();
    const cardDay = !!link && (!plan.cal?.kind || plan.cal.kind === "auto") && eng.isCardDay(poster.for_date, eng.themeFor(poster.for_date));
    type Prod = { id: string; name: string; price?: string; benefits?: string[]; offer?: string };
    let product: Prod | null = null;
    if (!cardDay && (pr.mode === "product" || ["product", "offer"].includes(plan.cal?.kind ?? ""))) {
      let list = (await restAsService<Prod[]>(`poster_products?user_id=eq.${me.id}&brand_id=is.null&active=eq.true&order=sort,created_at&select=id,name,price,benefits,offer`)).data ?? [];
      if (!list.length) {
        const bid = (await restAsService<{ brand_id: string | null }[]>(`profiles?id=eq.${me.id}&select=brand_id`)).data?.[0]?.brand_id;
        if (bid) list = (await restAsService<Prod[]>(`poster_products?brand_id=eq.${bid}&active=eq.true&order=sort,created_at&select=id,name,price,benefits,offer`)).data ?? [];
      }
      const one = plan.cal?.product_id ? list.find((x) => x.id === plan.cal?.product_id) : undefined;
      product = one ?? (list.length ? list[Math.floor(new Date(`${poster.for_date}T00:00:00Z`).getTime() / 86400000) % list.length] : null);
    }
    finalCaption = await ensurePosterCaption(posterId, { name: pr.name, tagline: pr.tagline, phone: pr.phone, lang: pr.lang, theme: poster.title, offer, link: link?.url ?? "", join, product, kind: cardDay ? "card" : product ? "product" : "" });
  }
  // WhatsApp: no hashtags, always "my card" + "make your free card" (owner, 29 Sep 2026); Facebook / Instagram keep the full caption.
  const waCaption = (await posterCaptionWriter()).statusCaption(finalCaption, { phone: pr.phone ?? "", link: link?.url ?? "", join, lang: pr.lang ?? "hi" });

  const accounts = (await listAccounts(me.id)).filter((a) => ids.includes(a.id) && a.is_active);
  const results: { id: string; provider: string; name: string; ok: boolean; error?: string }[] = [];
  for (const a of accounts) {
    try {
      let remote: string;
      if (a.provider === "whatsapp") {
        const pl = (await restAsService<{ plan_expires_at: string | null }[]>(`profiles?id=eq.${me.id}&select=plan_expires_at`)).data?.[0];
        // No "x-shubhora-ai-until" here: only the WhatsApp page decides AI on/off. Sending "none" whenever the expiry was
        // empty switched the bot off for paid accounts with no end date (owner's review, 28 Sep 2026).
        // The Status is the video — voice line + music, the same file the 4 AM job sends — whichever button the owner
        // pressed (owner's call, 29 Sep 2026). The image goes only when no video could be made.
        let videoUrl = "";
        try { const u = await ensureStatusVideo(me.id, posterId); if (u) videoUrl = `${SITE_URL}${u}`; } catch (e) { console.log("[social/post] status video skipped:", (e as Error).message); }
        const r = await fetch("http://127.0.0.1:8787/status", { method: "POST", headers: { "content-type": "application/json", "x-neuraledge-user": me.id, "x-neuraledge-plan-expires": pl?.plan_expires_at || "2999-12-31T23:59:59.000Z" }, body: JSON.stringify(videoUrl ? { videoUrl, caption: waCaption } : { imageUrl, caption: waCaption }), signal: AbortSignal.timeout(400_000) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error === "plan_expired" ? "WhatsApp AI plan needed" : j.error === "not connected" ? "WhatsApp not connected" : (j.error || `status ${r.status}`));
        remote = `status:${j.audience ?? 0}`;
      } else remote = await publishImage(a, imageUrl, finalCaption);
      await restAsService("social_posts", { method: "POST", body: JSON.stringify({ user_id: me.id, account_id: a.id, provider: a.provider, poster_id: posterId, caption: finalCaption, remote_id: remote, status: "ok" }) });
      results.push({ id: a.id, provider: a.provider, name: a.name, ok: true });
    } catch (e) {
      const err = e as Error & { code?: number };
      if (err.code === 190) await restAsService(`social_accounts?id=eq.${a.id}`, { method: "PATCH", body: JSON.stringify({ status: "reconnect" }) });
      await restAsService("social_posts", { method: "POST", body: JSON.stringify({ user_id: me.id, account_id: a.id, provider: a.provider, poster_id: posterId, caption, status: "error", error: String(err.message).slice(0, 500) }) });
      results.push({ id: a.id, provider: a.provider, name: a.name, ok: false, error: err.code === 190 ? "Please reconnect this account." : String(err.message).slice(0, 160) });
    }
  }
  return NextResponse.json({ ok: results.every((r) => r.ok), results });
}
