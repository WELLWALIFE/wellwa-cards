// Auto-reply: every 30 min (pm2 cron) answer new FB/IG comments and Google
// reviews for accounts that have auto_reply on. One reply per item, tracked in
// social_replies. Mirrors src/lib/reviews-server.ts (this cron can't import
// Next.js server code). Permission errors are logged, never retried in a loop.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(__dirname, "..");
function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !(m[1] in process.env)) env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  } catch { /* no env file */ }
  return env;
}
const env = loadEnv();
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY, GEMINI_KEY = env.GEMINI_API_KEY;
const GRAPH = "https://graph.facebook.com/v21.0", V4 = "https://mybusiness.googleapis.com/v4";
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const MAX_PER_ACCOUNT = 10;

async function rest(q, init) { const r = await fetch(`${SUPA}/rest/v1/${q}`, { ...init, headers: { ...H, ...(init?.headers ?? {}) } }); const t = await r.text(); try { return JSON.parse(t); } catch { return null; } }
// PostgREST returns an error OBJECT (not an array) when a table/column is missing —
// e.g. before migration 0033 is applied — so never iterate a rest() result blindly.
async function restList(q) { const j = await rest(q); if (Array.isArray(j)) return j; if (j?.message) console.error(`[autoreply] ${q.split("?")[0]}: ${j.message}`); return []; }
async function gget(p, params) { const r = await fetch(`${GRAPH}/${p}?${new URLSearchParams(params)}`); const j = await r.json().catch(() => ({})); if (j.error) { const e = new Error(j.error.message); e.code = j.error.code; throw e; } return j; }
async function gpost(p, params) { const r = await fetch(`${GRAPH}/${p}`, { method: "POST", body: new URLSearchParams(params) }); const j = await r.json().catch(() => ({})); if (j.error) { const e = new Error(j.error.message); e.code = j.error.code; throw e; } return j; }

const LANG = { hi: "Hindi in Devanagari script", hinglish: "Hinglish (Hindi in Roman letters)", en: "simple Indian English" };
async function context(userId) {
  const prof = (await rest(`poster_profiles?user_id=eq.${userId}&order=is_default.desc,created_at&limit=1&select=name,tagline,phone,lang`))?.[0];
  const card = (await rest(`cards?owner_id=eq.${userId}&order=updated_at.desc&limit=1&select=data`))?.[0]?.data;
  return { name: prof?.tagline || card?.company || prof?.name || "our business", tagline: card?.tagline ?? "", phone: prof?.phone ?? "", lang: LANG[prof?.lang] ? prof.lang : "hinglish", knowledge: [card?.about, card?.botKnowledge].filter(Boolean).join("\n").slice(0, 2000) };
}
async function draft(ctx, item) {
  if (!GEMINI_KEY) return "";
  const negative = item.rating !== null && item.rating <= 3;
  const prompt = `You reply on behalf of "${ctx.name}"${ctx.tagline ? ` (${ctx.tagline})` : ""}, a small Indian business, to a ${item.provider} ${item.kind}.
${item.kind === "review" ? `Rating: ${item.rating ?? "n/a"}/5. ` : ""}From: ${item.author}
Their message: "${item.text || "(no text, rating only)"}"
${ctx.knowledge ? `Facts about the business (use only these, never invent prices/claims):\n${ctx.knowledge}\n` : ""}
Write ONE short public reply in ${LANG[ctx.lang]}: 1-3 sentences, max 50 words, warm and personal, thank them.
${negative ? `This is a complaint/low rating: apologise sincerely, do not argue, ${ctx.phone ? `invite them to WhatsApp ${ctx.phone} so you can fix it personally` : "offer to fix it personally"}.` : item.text.includes("?") ? "They asked a question — answer briefly from the facts if possible, otherwise invite them to message on WhatsApp." : ""}
No hashtags, at most 1 emoji, no medical or income claims. Return only the reply text.`;
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent", { method: "POST", headers: { "x-goog-api-key": GEMINI_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.6, maxOutputTokens: 200 } }) });
    const j = await r.json();
    return String(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim().replace(/^["“]|["”]$/g, "").slice(0, 600);
  } catch { return ""; }
}
async function record(userId, item, reply, status, error) {
  await rest("social_replies?on_conflict=user_id,provider,item_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ user_id: userId, provider: item.provider, item_id: item.id, item_kind: item.kind, author: item.author.slice(0, 80), text: item.text.slice(0, 1000), rating: item.rating, reply_text: reply.slice(0, 600), status, auto: true, error: error?.slice(0, 200) ?? null }) });
}
async function alreadyDone(userId, provider, ids) {
  if (!ids.length) return new Set();
  const rows = await restList(`social_replies?user_id=eq.${userId}&provider=eq.${provider}&item_id=in.(${ids.map((x) => `"${x}"`).join(",")})&select=item_id`);
  return new Set(rows.map((r) => r.item_id));
}

async function metaItems(a) {
  const out = [];
  if (a.provider === "facebook") {
    const r = await gget(`${a.account_id}/posts`, { fields: "id,comments.limit(25){id,message,from,created_time}", limit: "10", access_token: a.access_token });
    for (const p of r.data ?? []) for (const c of p.comments?.data ?? []) if (c.from?.id !== a.account_id && c.message) out.push({ provider: "facebook", kind: "comment", id: c.id, author: c.from?.name ?? "Facebook user", text: c.message, rating: null });
  } else {
    const r = await gget(`${a.account_id}/media`, { fields: "id,comments.limit(25){id,text,username,timestamp}", limit: "10", access_token: a.access_token });
    for (const m of r.data ?? []) for (const c of m.comments?.data ?? []) if (c.username !== a.username && c.text) out.push({ provider: "instagram", kind: "comment", id: c.id, author: c.username ? `@${c.username}` : "Instagram user", text: c.text, rating: null });
  }
  return out;
}

async function runMeta() {
  const accounts = await restList(`social_accounts?auto_reply=eq.true&is_active=eq.true&status=eq.ok&provider=in.(facebook,instagram)&select=*`);
  for (const a of accounts) {
    try {
      const items = await metaItems(a);
      const done = await alreadyDone(a.user_id, a.provider, items.map((i) => i.id));
      const fresh = items.filter((i) => !done.has(i.id)).slice(0, MAX_PER_ACCOUNT);
      if (!fresh.length) continue;
      const ctx = await context(a.user_id);
      for (const it of fresh) {
        const reply = await draft(ctx, it);
        if (!reply) { console.log(`[autoreply] ${a.provider} ${it.id}: no draft`); continue; }
        try {
          if (a.provider === "facebook") await gpost(`${it.id}/comments`, { message: reply, access_token: a.access_token });
          else await gpost(`${it.id}/replies`, { message: reply, access_token: a.access_token });
          await record(a.user_id, it, reply, "sent");
          console.log(`[autoreply] ${a.provider} replied to ${it.id}`);
        } catch (e) {
          await record(a.user_id, it, reply, "failed", e.message);
          console.error(`[autoreply] ${a.provider} ${it.id} failed: ${e.message}`);
          if ([10, 200, 190].includes(Number(e.code))) break; // permission/token problem — stop hammering this account
        }
      }
    } catch (e) { console.error(`[autoreply] ${a.provider} ${a.name}: ${e.message}`); }
  }
}

// user's own OAuth client → platform_secrets (super admin) → env
let platformCreds = null;
async function googleCreds(g) {
  if (g.client_id && g.client_secret) return { id: g.client_id, secret: g.client_secret };
  if (!platformCreds) { const p = (await restList("platform_secrets?id=eq.1&select=google_client_id,google_client_secret"))[0]; platformCreds = p?.google_client_id ? { id: p.google_client_id, secret: p.google_client_secret } : { id: env.GOOGLE_CLIENT_ID ?? "", secret: env.GOOGLE_CLIENT_SECRET ?? "" }; }
  return platformCreds;
}
async function googleToken(g) {
  const exp = g.token_expires_at ? new Date(g.token_expires_at).getTime() : 0;
  if (g.access_token && exp - Date.now() > 60_000) return g.access_token;
  const c = await googleCreds(g);
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: c.id, client_secret: c.secret, refresh_token: g.refresh_token, grant_type: "refresh_token" }) });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) { await rest(`google_accounts?user_id=eq.${g.user_id}`, { method: "PATCH", body: JSON.stringify({ status: "reconnect" }) }); throw new Error(j.error_description || "google refresh failed"); }
  await rest(`google_accounts?user_id=eq.${g.user_id}`, { method: "PATCH", body: JSON.stringify({ access_token: j.access_token, token_expires_at: new Date(Date.now() + j.expires_in * 1000).toISOString() }) });
  return j.access_token;
}
const STARS = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
async function runGoogle() {
  if (!env.GOOGLE_CLIENT_ID) return;
  const rows = await restList(`google_accounts?auto_reply=eq.true&status=eq.ok&select=*`);
  for (const g of rows) {
    try {
      const tok = await googleToken(g);
      const r = await fetch(`${V4}/${g.location_name}/reviews?pageSize=30&orderBy=updateTime%20desc`, { headers: { Authorization: `Bearer ${tok}` } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error?.message || `google ${r.status}`);
      const open = (j.reviews ?? []).filter((x) => !x.reviewReply).map((x) => ({ provider: "google", kind: "review", id: x.name, author: x.reviewer?.displayName ?? "Google user", text: x.comment ?? "", rating: STARS[x.starRating] ?? null }));
      const done = await alreadyDone(g.user_id, "google", open.map((i) => i.id));
      const fresh = open.filter((i) => !done.has(i.id)).slice(0, MAX_PER_ACCOUNT);
      if (!fresh.length) continue;
      const ctx = await context(g.user_id);
      for (const it of fresh) {
        const reply = await draft(ctx, it); if (!reply) continue;
        const pr = await fetch(`${V4}/${it.id}/reply`, { method: "PUT", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: JSON.stringify({ comment: reply }) });
        if (pr.ok) { await record(g.user_id, it, reply, "sent"); console.log(`[autoreply] google replied to ${it.id}`); }
        else { const pj = await pr.json().catch(() => ({})); await record(g.user_id, it, reply, "failed", pj.error?.message); console.error(`[autoreply] google ${it.id} failed: ${pj.error?.message}`); }
      }
    } catch (e) { console.error(`[autoreply] google ${g.location_title}: ${e.message}`); }
  }
}

await runMeta();
await runGoogle();
console.log("[autoreply] done");
