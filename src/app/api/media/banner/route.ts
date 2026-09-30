// Studio: render a branded banner. Synchronous — sharp takes well under a
// second — but still debited and journaled like every paid action.

import { NextResponse } from "next/server";
import { requireUser, sameOrigin } from "@/lib/api-security";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { renderBanner, CREDIT_PRICES, BANNER_STYLES, type BannerStyle } from "@/lib/media/banner";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const session = await requireUser();
  if (!session) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const admin = getAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service unavailable" }, { status: 503 });

  const b = await request.json().catch(() => ({}));
  const headline = String(b.headline ?? "").trim().slice(0, 80);
  if (headline.length < 3) return NextResponse.json({ error: "Enter a headline (at least 3 letters)." }, { status: 400 });
  const style: BannerStyle = (b.style in BANNER_STYLES ? b.style : "emerald");

  // Optional product photo — only from our own hosts, capped at 4 MB.
  let photo: Buffer | undefined;
  const photoUrl = String(b.photoUrl ?? "").trim();
  if (photoUrl) {
    const site = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
    const supa = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    if (!(photoUrl.startsWith(site + "/") || photoUrl.startsWith(supa) || photoUrl.startsWith("/"))) {
      return NextResponse.json({ error: "Choose a photo from your card / storage." }, { status: 400 });
    }
    const abs = photoUrl.startsWith("/") ? site + photoUrl : photoUrl;
    const r = await fetch(abs).catch(() => null);
    if (r?.ok) {
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length <= 4 * 1024 * 1024) photo = buf;
    }
  }

  const aiBg = b.aiBg === true && Boolean(process.env.GEMINI_API_KEY);
  const price = aiBg ? CREDIT_PRICES.banner_ai : CREDIT_PRICES.banner;

  // No worker liveness check here on purpose: a banner is rendered by sharp inside this
  // request (see src/lib/media/banner.ts), not by pm2 "neuraledge-media", so the worker
  // being down does not stop us delivering. The video routes are the ones that must gate.
  //
  // Debit first — render can't fail halfway into someone's money. The id exists before the
  // charge so the debit, the job row and the refund all carry the same ref (p_ref was null,
  // which made a refund impossible to match to its charge in credit_ledger).
  const id = crypto.randomUUID();
  const { error: spendErr } = await admin.rpc("spend_credits", {
    p_user: session.user.id, p_amount: price, p_reason: aiBg ? "banner-ai" : "banner", p_ref: id,
  });
  if (spendErr) {
    const msg = spendErr.message.includes("INSUFFICIENT_CREDITS")
      ? "Not enough credits. Renew your plan or buy a credit pack."
      : "Could not charge credits.";
    return NextResponse.json({ error: msg }, { status: 402 });
  }

  try {
    // AI background: one flash-lite image themed to the banner's message.
    let bgImage: Buffer | undefined;
    if (aiBg) {
      const prompt = `Photorealistic square advertising background photograph for an Indian small business social-media banner about: "${headline}"${b.subline ? ` (${String(b.subline).slice(0, 80)})` : ""}. Business: ${String(b.brandName ?? "").slice(0, 40)}. Rich cinematic lighting, professional product/lifestyle photography, composition leaves the lower third calm and uncluttered for text, no text, no watermark, no logos.`;
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-image:generateContent", {
        method: "POST",
        headers: { "x-goog-api-key": process.env.GEMINI_API_KEY!, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1" } },
        }),
      }).catch(() => null);
      const d = r ? await r.json().catch(() => null) : null;
      const part = (d?.candidates?.[0]?.content?.parts ?? []).find((x: { inlineData?: { data: string } }) => x.inlineData);
      if (part?.inlineData?.data) bgImage = Buffer.from(part.inlineData.data, "base64");
      // If image gen fails we fall back to the gradient — user still gets a banner.
    }

    const jpg = await renderBanner({
      headline,
      subline: String(b.subline ?? "").trim().slice(0, 110) || undefined,
      badge: String(b.badge ?? "").trim().slice(0, 24) || undefined,
      brandName: String(b.brandName ?? "").trim().slice(0, 40) || "My Business",
      website: String(b.website ?? "").trim().slice(0, 60) || undefined,
      style, photo, bgImage,
    });

    const path = `ai-media/${session.user.id}/banner-${Date.now()}.jpg`;
    const up = await admin.storage.from("media").upload(path, jpg, { contentType: "image/jpeg", upsert: true });
    if (up.error) throw new Error(up.error.message);
    const { data: pub } = admin.storage.from("media").getPublicUrl(path);

    await admin.from("media_jobs").insert({
      id, owner_id: session.user.id, kind: "banner", status: "done",
      // cost must be what we actually charged: an AI background costs more, and recording
      // the plain banner price made every AI banner look cheaper in the job history than
      // the ledger says it was.
      input: { headline, style, aiBg }, output_url: pub.publicUrl, cost: price,
    });
    return NextResponse.json({ ok: true, url: pub.publicUrl });
  } catch (e) {
    // Render/upload failed after charging — put the money back.
    await admin.rpc("grant_credits", {
      p_user: session.user.id, p_amount: price, p_reason: "banner-refund", p_ref: id,
    }).then(() => {}, (re) => console.error("[banner] refund failed", session.user.id, price, re));
    // The owner never reads an engine error: they get one plain sentence and their money.
    console.error("[banner] render failed", id, session.user.id, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "The banner could not be made. Your credits have been returned." }, { status: 500 });
  }
}
