// Reviews inbox. GET (bearer) → comments/reviews across the active FB/IG accounts
// + Google, with any replies already sent. POST { provider, item_id, kind, text,
// author?, item_text?, rating?, ignore? } → send (or mark ignored).
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { listAccounts, metaConfigured } from "@/lib/social-server";
import { fetchMetaItems, replyMeta, repliesFor, recordReply, isPermErr, metaPermissionFor, type ReviewItem, type Needs } from "@/lib/reviews-server";
import { googleRow, googleToken, listReviews, replyReview, starsOf, googleConfigured } from "@/lib/google-server";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const accounts = (await listAccounts(me.id)).filter((a) => a.is_active && a.status === "ok" && (a.provider === "facebook" || a.provider === "instagram"));
  const items: ReviewItem[] = []; const needs: Needs[] = []; const errors: string[] = [];
  for (const a of accounts) {
    try { const r = await fetchMetaItems(a); items.push(...r.items); needs.push(...r.needs); }
    catch (e) { errors.push(`${a.provider}: ${(e as Error).message}`); }
  }
  const g = await googleRow(me.id);
  let google: { connected: boolean; title: string; status: string } = { connected: false, title: "", status: "none" };
  if (g) {
    google = { connected: true, title: g.location_title, status: g.status };
    try {
      const tok = await googleToken(g);
      for (const r of (await listReviews(tok, g.location_name)).reviews) {
        items.push({ provider: "google", kind: "review", id: r.name, account_row: "", author: r.reviewer?.displayName ?? "Google user", text: r.comment ?? "", rating: starsOf(r.starRating), created_at: r.createTime, post_text: "", replied: r.reviewReply?.comment ?? null, link: null });
      }
    } catch (e) { errors.push(`google: ${(e as Error).message}`); }
  }
  const sent = await repliesFor(me.id);
  for (const it of items) { const s = sent[`${it.provider}:${it.id}`]; if (s && !it.replied && s.status !== "failed") it.replied = s.status === "ignored" ? "" : s.reply_text; }
  items.sort((x, y) => (y.created_at > x.created_at ? 1 : -1));
  return NextResponse.json({ items: items.slice(0, 100), needs, errors, configured: metaConfigured(), google_configured: googleConfigured(), google, accounts: accounts.map((a) => ({ id: a.id, provider: a.provider, name: a.name, auto_reply: !!a.auto_reply })) });
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const provider = String(b.provider ?? ""), itemId = String(b.item_id ?? "").slice(0, 200), kind = b.kind === "review" ? "review" : "comment";
  const text = String(b.text ?? "").trim().slice(0, 600);
  const meta = { provider, id: itemId, kind, author: String(b.author ?? "").slice(0, 80), text: String(b.item_text ?? "").slice(0, 1000), rating: typeof b.rating === "number" ? b.rating : null };
  if (!["facebook", "instagram", "google"].includes(provider) || !itemId) return NextResponse.json({ error: "bad item" }, { status: 400 });
  if (b.ignore) { await recordReply(me.id, meta, "", "ignored"); return NextResponse.json({ ok: true, ignored: true }); }
  if (!text) return NextResponse.json({ error: "Reply text is empty." }, { status: 400 });
  try {
    if (provider === "google") {
      const g = await googleRow(me.id); if (!g) return NextResponse.json({ error: "Google not connected." }, { status: 400 });
      await replyReview(await googleToken(g), itemId, text);
    } else {
      const a = (await listAccounts(me.id)).find((x) => x.provider === provider && x.is_active);
      if (!a) return NextResponse.json({ error: "Account not connected." }, { status: 400 });
      await replyMeta(a, { id: itemId, kind }, text);
    }
    await recordReply(me.id, meta, text, "sent");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = (e as Error).message;
    await recordReply(me.id, meta, text, "failed", false, msg);
    if (provider !== "google" && isPermErr(e)) return NextResponse.json({ error: msg, needs_permission: metaPermissionFor(provider, kind) }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
