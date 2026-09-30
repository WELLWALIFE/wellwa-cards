// Reviews inbox: comments on the user's own FB posts / IG media, Facebook Page
// reviews (recommendations) and Google reviews, plus AI-drafted replies.
//
// Meta permissions needed beyond the original connect scopes:
//   read FB comments       pages_read_engagement   (already granted)
//   read FB Page reviews   pages_read_user_content (new)
//   reply to FB comments   pages_manage_engagement (new)
//   read/reply IG comments instagram_manage_comments (new)
// A Graph permission error is reported as `needs` so the UI can ask the owner
// to reconnect; nothing is faked.
import { graph, type AccountRow } from "@/lib/social-server";
import { restAsService } from "@/lib/poster-server";

export type ReviewItem = {
  provider: "facebook" | "instagram" | "google";
  kind: "comment" | "review";
  id: string;              // comment id (FB/IG) or review name (Google)
  account_row: string;     // social_accounts.id ("" for google)
  author: string;
  text: string;
  rating: number | null;
  created_at: string;
  post_text: string;       // the post/media the comment is on
  replied: string | null;  // existing reply text if any
  link: string | null;
};
export type Needs = { provider: "facebook" | "instagram"; permission: string; why: string };

const PERM_CODES = new Set([10, 200, 210, 100, 190]);
const isPermErr = (e: unknown) => PERM_CODES.has(Number((e as { code?: number })?.code));

export async function fetchMetaItems(a: AccountRow): Promise<{ items: ReviewItem[]; needs: Needs[] }> {
  const items: ReviewItem[] = []; const needs: Needs[] = [];
  const tok = a.access_token;
  if (a.provider === "facebook") {
    try {
      const r = await graph<{ data: { id: string; message?: string; permalink_url?: string; comments?: { data: { id: string; message?: string; from?: { id: string; name: string }; created_time: string; permalink_url?: string }[] } }[] }>(
        `${a.account_id}/posts`, { fields: "id,message,permalink_url,comments.limit(25){id,message,from,created_time,permalink_url}", limit: "12", access_token: tok });
      for (const p of r.data ?? []) for (const c of p.comments?.data ?? []) {
        if (c.from?.id === a.account_id) continue; // our own replies
        items.push({ provider: "facebook", kind: "comment", id: c.id, account_row: a.id, author: c.from?.name ?? "Facebook user", text: c.message ?? "", rating: null, created_at: c.created_time, post_text: (p.message ?? "").slice(0, 80), replied: null, link: c.permalink_url ?? p.permalink_url ?? null });
      }
    } catch (e) { if (isPermErr(e)) needs.push({ provider: "facebook", permission: "pages_read_engagement", why: "read comments" }); else throw e; }
    try {
      const r = await graph<{ data: { reviewer?: { name?: string; id?: string }; rating?: number; recommendation_type?: string; review_text?: string; created_time: string; open_graph_story?: { id: string } }[] }>(
        `${a.account_id}/ratings`, { fields: "reviewer,rating,recommendation_type,review_text,created_time,open_graph_story", limit: "25", access_token: tok });
      for (const x of r.data ?? []) {
        const id = x.open_graph_story?.id ?? `${x.reviewer?.id ?? "anon"}-${x.created_time}`;
        const rating = typeof x.rating === "number" ? x.rating : x.recommendation_type === "positive" ? 5 : x.recommendation_type === "negative" ? 1 : null;
        items.push({ provider: "facebook", kind: "review", id, account_row: a.id, author: x.reviewer?.name ?? "Facebook user", text: x.review_text ?? "", rating, created_at: x.created_time, post_text: "", replied: null, link: `https://www.facebook.com/${a.account_id}/reviews` });
      }
    } catch (e) { if (isPermErr(e)) needs.push({ provider: "facebook", permission: "pages_read_user_content", why: "read Page reviews" }); }
  } else if (a.provider === "instagram") {
    try {
      const r = await graph<{ data: { id: string; caption?: string; permalink?: string; comments?: { data: { id: string; text?: string; username?: string; timestamp: string }[] } }[] }>(
        `${a.account_id}/media`, { fields: "id,caption,permalink,comments.limit(25){id,text,username,timestamp}", limit: "12", access_token: tok });
      for (const m of r.data ?? []) for (const c of m.comments?.data ?? []) {
        if (c.username && c.username === a.username) continue;
        items.push({ provider: "instagram", kind: "comment", id: c.id, account_row: a.id, author: c.username ? `@${c.username}` : "Instagram user", text: c.text ?? "", rating: null, created_at: c.timestamp, post_text: (m.caption ?? "").slice(0, 80), replied: null, link: m.permalink ?? null });
      }
    } catch (e) { if (isPermErr(e)) needs.push({ provider: "instagram", permission: "instagram_manage_comments", why: "read & reply to comments" }); else throw e; }
  }
  return { items, needs };
}

/** Reply to one FB/IG comment. FB Page reviews have no reply API — only comments. */
export async function replyMeta(a: AccountRow, item: { id: string; kind: "comment" | "review" }, message: string): Promise<string> {
  if (a.provider === "facebook") {
    if (item.kind === "review") throw Object.assign(new Error("Facebook Page reviews can only be answered on Facebook itself."), { code: 0 });
    const r = await graph<{ id: string }>(`${item.id}/comments`, { message, access_token: a.access_token }, "POST");
    return r.id;
  }
  const r = await graph<{ id: string }>(`${item.id}/replies`, { message, access_token: a.access_token }, "POST");
  return r.id;
}
export const metaPermissionFor = (provider: string, kind: string) => provider === "facebook" ? (kind === "review" ? "pages_read_user_content" : "pages_manage_engagement") : "instagram_manage_comments";
export { isPermErr };

/** What the AI knows about this business when drafting a reply. */
export async function businessContext(userId: string): Promise<{ name: string; tagline: string; phone: string; lang: string; knowledge: string }> {
  const prof = (await restAsService<{ name: string; tagline: string | null; phone: string | null; lang: string }[]>(`poster_profiles?user_id=eq.${userId}&order=is_default.desc,created_at&limit=1&select=name,tagline,phone,lang`)).data?.[0];
  const card = (await restAsService<{ data: { company?: string; tagline?: string; about?: string; botKnowledge?: string } }[]>(`cards?owner_id=eq.${userId}&order=created_at.desc&limit=1&select=data`)).data?.[0]?.data;
  return {
    name: prof?.tagline || card?.company || prof?.name || "our business",
    tagline: card?.tagline ?? "",
    phone: prof?.phone ?? "",
    lang: prof?.lang ?? "hinglish",
    knowledge: [card?.about, card?.botKnowledge].filter(Boolean).join("\n").slice(0, 2000),
  };
}

const LANG_RULE: Record<string, string> = {
  hi: "Hindi in Devanagari script", hinglish: "Hinglish (Hindi in Roman letters)", en: "simple Indian English",
};

/** Draft a reply to a comment/review. Returns "" if AI is not configured. */
export async function draftReply(ctx: { name: string; tagline: string; phone: string; lang: string; knowledge: string }, item: { provider: string; kind: string; author: string; text: string; rating: number | null }): Promise<string> {
  const key = process.env.GEMINI_API_KEY; if (!key) return "";
  const lang = LANG_RULE[ctx.lang] ? ctx.lang : "hinglish";
  const negative = item.rating !== null && item.rating <= 3;
  const prompt = `You reply on behalf of "${ctx.name}"${ctx.tagline ? ` (${ctx.tagline})` : ""}, a small Indian business, to a ${item.provider} ${item.kind}.
${item.kind === "review" ? `Rating: ${item.rating ?? "n/a"}/5. ` : ""}From: ${item.author}
Their message: "${item.text || "(no text, rating only)"}"
${ctx.knowledge ? `Facts about the business (use only these, never invent prices/claims):\n${ctx.knowledge}\n` : ""}
Write ONE short public reply in ${LANG_RULE[lang]}: 1-3 sentences, max 50 words, warm and personal, address them by name if natural, thank them.
${negative ? `This is a complaint/low rating: apologise sincerely, do not argue or make excuses, ${ctx.phone ? `invite them to WhatsApp ${ctx.phone} so you can fix it personally` : "offer to fix it personally"}.` : item.text.includes("?") ? "They asked a question — answer it briefly from the facts if possible, otherwise invite them to message on WhatsApp." : `${ctx.phone ? `You may end with an invitation to WhatsApp ${ctx.phone} for orders or help.` : ""}`}
No hashtags, at most 1 emoji, no medical or income claims. Return only the reply text.`;
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent", { method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.6, maxOutputTokens: 200 } }) });
    const j = await r.json().catch(() => ({}));
    return String(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim().replace(/^["“]|["”]$/g, "").slice(0, 600);
  } catch { return ""; }
}

export type ReplyRow = { provider: string; item_id: string; reply_text: string; status: string; auto: boolean; created_at: string };
export async function repliesFor(userId: string): Promise<Record<string, ReplyRow>> {
  // Before migration 0033 the table doesn't exist and PostgREST returns an error object — treat as "no replies yet".
  const res = (await restAsService<ReplyRow[]>(`social_replies?user_id=eq.${userId}&select=provider,item_id,reply_text,status,auto,created_at&order=created_at.desc&limit=300`)).data;
  const rows = Array.isArray(res) ? res : [];
  const out: Record<string, ReplyRow> = {};
  for (const r of rows) out[`${r.provider}:${r.item_id}`] = r;
  return out;
}
export async function recordReply(userId: string, item: { provider: string; id: string; kind: string; author: string; text: string; rating: number | null }, reply: string, status: "sent" | "failed" | "ignored", auto = false, error?: string) {
  await restAsService("social_replies?on_conflict=user_id,provider,item_id", {
    method: "POST", headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ user_id: userId, provider: item.provider, item_id: item.id, item_kind: item.kind, author: item.author.slice(0, 80), text: item.text.slice(0, 1000), rating: item.rating, reply_text: reply.slice(0, 600), status, auto, error: error?.slice(0, 200) ?? null }),
  });
}
