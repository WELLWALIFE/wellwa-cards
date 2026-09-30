"use client";
import { SITE_HOST } from "@/lib/site-url";

// Client-side cloud operations: publish cards, submit leads, auth helpers.
// Every function is null-safe: without Supabase env vars the app stays in demo mode.

import { getBrowserSupabase } from "./supabase/browser";
import { attribution } from "./track";
import type { Card } from "./types";
import { safeColor } from "./looks";

export function isCloudConfigured(): boolean {
  return getBrowserSupabase() !== null;
}

/* ---------------- auth ---------------- */

export async function getSessionUser(): Promise<{ id: string; email: string; name: string } | null> {
  const sb = getBrowserSupabase();
  if (!sb) return null;
  let { data } = await sb.auth.getUser();
  // getUser() asks the server; on a bad network it returns no user even though the person is signed in. The
  // session stored on this phone is the fallback — "signed out" must only mean signed out.
  if (!data.user) {
    const { data: s } = await sb.auth.getSession();
    if (!s.session?.user) return null;
    data = { user: s.session.user };
  }
  const m = data.user.user_metadata ?? {};
  // display_name is our own field; full_name/name are rewritten by Google on every Google sign-in.
  const name = String(m.display_name || m.full_name || m.name || "").trim();
  return { id: data.user.id, email: data.user.email ?? "", name };
}

export async function signOut(): Promise<void> {
  const sb = getBrowserSupabase();
  if (sb) await sb.auth.signOut();
}

/* ---------------- publish ---------------- */

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = meta.match(/data:(.*?)[;,]/)?.[1] ?? "application/octet-stream";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/** Studio reference photo → hosted URL. The media worker only fetches images
 *  from our own storage, so a data URL has to become a real URL first.
 *
 *  Every upload gets its own name. The old name came from a counter/clock
 *  ((Date.now() + i) % 1000) with upsert, so two uploads a second apart could land on the
 *  same object and the second one silently replaced the photo a queued, already-paid render
 *  was still pointing at. A random id can never collide.
 *
 *  The second argument is kept only so existing callers keep compiling; it is ignored. */
export async function uploadStudioRef(dataUrl: string, _n?: number): Promise<string | null> {
  void _n; // legacy numbering argument, deliberately unused
  const sb = getBrowserSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const blob = dataUrlToBlob(dataUrl);
  const ext = blob.type === "image/png" ? "png" : "jpg";
  const path = `${data.user.id}/studio-refs/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from("media").upload(path, blob, { upsert: true, contentType: blob.type });
  if (error) return null;
  return sb.storage.from("media").getPublicUrl(path).data.publicUrl;
}

async function uploadDataUrl(userId: string, username: string, n: number, dataUrl: string): Promise<string> {
  const sb = getBrowserSupabase()!;
  const blob = dataUrlToBlob(dataUrl);
  const ext = blob.type === "application/pdf" ? "pdf" : blob.type === "image/png" ? "png" : "jpg";
  const path = `${userId}/${username}/${n}.${ext}`;
  const { error } = await sb.storage.from("media").upload(path, blob, { upsert: true, contentType: blob.type });
  if (error) throw new Error(error.message);
  return sb.storage.from("media").getPublicUrl(path).data.publicUrl;
}

/** Replace every embedded data: URL in the card with a cloud storage URL. */
async function materializeMedia(card: Card, userId: string): Promise<Card> {
  const next: Card = JSON.parse(JSON.stringify(card));
  let n = 0;
  const up = async (v: string | undefined) =>
    v && v.startsWith("data:") ? uploadDataUrl(userId, next.username, n++, v) : v;

  next.avatarUrl = await up(next.avatarUrl);
  next.coverUrl = await up(next.coverUrl);
  for (const page of next.pages) {
    for (const b of page.blocks) {
      if (b.kind === "about") b.imageUrl = await up(b.imageUrl);
      if (b.kind === "gallery") for (const img of b.images) img.url = await up(img.url);
      if (b.kind === "image") for (const img of b.images) img.url = (await up(img.url)) ?? img.url;
      if (b.kind === "pdf") b.fileUrl = await up(b.fileUrl);
    }
  }
  return next;
}

/** Public-link rules, shared by the editor field and the publish check. */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 32;

/** Strip anything that can't live in a URL path segment. Underscores stay: the account username
 *  (letters, numbers, _) is the card's link too — /c/yadav_enterprises. */
export function cleanUsername(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-{2,}/g, "-")
    .slice(0, USERNAME_MAX);
}

/** Still the auto-assigned `card-xxxxxx` slug — the user never picked a link. */
export function isDefaultUsername(u: string): boolean {
  return /^card-[a-z0-9]{4,8}$/.test(u ?? "");
}

/* Devanagari → Latin letters, so a Hindi business name still gets a readable link
   ("राम किराना" → "ram kirana", "शर्मा" → "sharma"). Simple and predictable, not a full transliterator. */
const DEV_CONSONANT: Record<string, string> = {
  "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "n", "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "n",
  "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n", "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
  "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m", "य": "y", "र": "r", "ल": "l", "ळ": "l", "व": "v",
  "श": "sh", "ष": "sh", "स": "s", "ह": "h",
  // precomposed nukta letters
  "क़": "q", "ख़": "kh", "ग़": "g", "ज़": "z", "ड़": "r", "ढ़": "rh", "फ़": "f", "य़": "y",
};
/** The same nukta letters written as consonant + ़ (U+093C). */
const DEV_NUKTA: Record<string, string> = { "क": "q", "ख": "kh", "ग": "g", "ज": "z", "ड": "r", "ढ": "rh", "फ": "f", "य": "y" };
const DEV_VOWEL: Record<string, string> = {
  "अ": "a", "आ": "a", "इ": "i", "ई": "i", "उ": "u", "ऊ": "u", "ऋ": "ri", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au", "ऑ": "o", "ऍ": "e",
};
const DEV_MATRA: Record<string, string> = {
  "ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u", "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ॉ": "o", "ॅ": "e",
};
const VIRAMA = "्", NUKTA = "़";

/** Devanagari letters → Latin letters; everything else is kept as it is. The inherent "a" of a word's last
 *  consonant is dropped ("राम" → "ram"), a matra replaces it ("रामा" → "rama") and ् removes it ("शर्मा" → "sharma"). */
export function translit(s: string): string {
  const src = (s ?? "").normalize("NFC").replace(/ज्ञ/g, "ग्य");
  let out = "";
  let pending = false; // the last consonant still carries its inherent "a"
  const flush = () => { if (pending) out += "a"; pending = false; };
  const chars = Array.from(src);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === "\u200c" || ch === "\u200d" || ch === NUKTA) continue; // joiners; a nukta after a non-consonant
    const cons = DEV_CONSONANT[ch];
    if (cons !== undefined) {
      flush();
      if (chars[i + 1] === NUKTA && DEV_NUKTA[ch]) { out += DEV_NUKTA[ch]; i++; } else out += cons;
      pending = true;
      continue;
    }
    const matra = DEV_MATRA[ch];
    if (matra !== undefined) { pending = false; out += matra; continue; }
    if (ch === VIRAMA) { pending = false; continue; }
    if (ch === "ं" || ch === "ँ") { flush(); out += "n"; continue; }
    if (ch === "ः") { flush(); out += "h"; continue; }
    const vowel = DEV_VOWEL[ch];
    if (vowel !== undefined) { flush(); out += vowel; continue; }
    const code = ch.charCodeAt(0);
    if (code >= 0x0966 && code <= 0x096f) { flush(); out += String(code - 0x0966); continue; }
    // Anything else ends the word: its last consonant loses the inherent "a".
    pending = false;
    out += ch;
  }
  return out;
}

/** The name-based slug a card would get automatically, e.g. "Dr. JS Yadav" → "dr-js-yadav", "राम किराना" → "ram-kirana". */
export function nameSlug(name: string): string {
  const s = cleanUsername(translit(name ?? "")).replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
  if (s.length < USERNAME_MIN) return "";
  if (s === "your-name") return ""; // the blank-card placeholder isn't a real name
  return s;
}

/**
 * Auto-build the public link from the person's name: their name-slug if free,
 * else name2, name3… Falls back to null (keep the current slug) when offline
 * or when nothing sensible is available — publishing must never block on this.
 */
export async function suggestUsername(name: string, cardId?: string): Promise<string | null> {
  const base = nameSlug(name);
  if (!base) return null;
  const sb = getBrowserSupabase();
  if (!sb) return null;
  const candidates = [base, ...Array.from({ length: 8 }, (_, i) => `${base.slice(0, USERNAME_MAX - 2)}${i + 2}`)];
  for (const c of candidates) {
    const { data, error } = await sb.rpc("username_available", { p_username: c, p_card_id: cardId ?? null });
    if (error) return null;
    if (data === true) return c;
  }
  return null;
}

export type UsernameCheck =
  | { state: "idle" | "checking" }
  | { state: "ok" }
  | { state: "bad"; reason: string };

/**
 * Is this public link free?
 *
 * Goes through the username_available function rather than a select: RLS hides
 * paused cards from other users, so a plain select would call a taken name free
 * and the user would only discover the clash when publishing failed.
 */
export async function checkUsername(raw: string, cardId?: string): Promise<UsernameCheck> {
  const username = cleanUsername(raw);
  if (username.length < USERNAME_MIN) {
    return { state: "bad", reason: `At least ${USERNAME_MIN} characters.` };
  }
  if (/^-|-$/.test(username)) {
    return { state: "bad", reason: "Can't start or end with a hyphen." };
  }
  const sb = getBrowserSupabase();
  if (!sb) return { state: "idle" };

  const { data, error } = await sb.rpc("username_available", {
    p_username: username,
    p_card_id: cardId ?? null,
  });
  if (error) return { state: "idle" };            // offline: let publish be the judge
  return data === true
    ? { state: "ok" }
    : { state: "bad", reason: `${SITE_HOST}/c/${username} is already taken.` };
}

/** What the owner sees when a request could not get through. */
export const OFFLINE = "No internet — tap to try again.";

/** A fetch that never reached the server (offline, DNS, dropped connection). */
function isNetworkError(e: { message?: string; name?: string } | null | undefined): boolean {
  return !!e && (e.name === "AuthRetryableFetchError" || /failed to fetch|fetch failed|network|load failed|timed? ?out/i.test(e.message ?? ""));
}

export type PublishResult =
  | { ok: true; username: string }
  | { ok: false; error: string };

export async function publishCard(card: Card): Promise<PublishResult> {
  const sb = getBrowserSupabase();
  if (!sb) return { ok: false, error: "Cloud not configured yet." };
  const { data: auth, error: authError } = await sb.auth.getUser();
  if (!auth.user) return { ok: false, error: authError && isNetworkError(authError) ? OFFLINE : "Please log in first to publish." };

  // A template straight out of the box must not go live as "Your Name" at a public address.
  if (/\byour name\b/i.test(card.name ?? "") || /your-name/.test(card.username ?? "")) {
    return { ok: false, error: "Put your own name on the card (Content tab) and pick your link (Setup tab) before publishing." };
  }
  const username = cleanUsername(card.username ?? "");
  if (username.length < USERNAME_MIN) {
    return { ok: false, error: `Set a link of at least ${USERNAME_MIN} characters (Setup tab).` };
  }

  let materialized: Card;
  try {
    materialized = await materializeMedia({ ...card, username }, auth.user.id);
  } catch (e) {
    return { ok: false, error: `Photo upload failed: ${e instanceof Error ? e.message : "unknown error"}` };
  }

  // Which row is this card? Match on id first; fall back to the username for
  // cards published before ids were carried through. Without this the upsert
  // would key on username, so renaming a link inserted a *second* card and left
  // the old one live instead of moving it.
  const { data: mine, error: mineError } = await sb
    .from("cards")
    .select("id, username")
    .eq("owner_id", auth.user.id);
  // Without the list we cannot tell an update from a new card: stop rather than insert a duplicate.
  if (mineError) return { ok: false, error: isNetworkError(mineError) ? OFFLINE : "Could not reach the server. Please try again." };
  // Colours are stored only as #hex (the public card writes the theme colour into a <style> tag).
  materialized = { ...materialized, themeColor: safeColor(materialized.themeColor), avatarColor: safeColor(materialized.avatarColor, safeColor(materialized.themeColor)) };

  const existing =
    (mine ?? []).find((r) => r.id === card.id) ??
    (mine ?? []).find((r) => r.username === username);

  const row = {
    ...(existing ? { id: existing.id } : {}),
    owner_id: auth.user.id,
    username,
    name: materialized.name,
    job_title: materialized.jobTitle,
    company: materialized.company,
    tagline: materialized.tagline,
    about: materialized.about,
    theme_color: materialized.themeColor,
    avatar_url: materialized.avatarUrl ?? null,
    cover_url: materialized.coverUrl ?? null,
    active: materialized.active,
    data: materialized,
  };

  const { error } = existing
    ? await sb.from("cards").update(row).eq("id", existing.id)
    : await sb.from("cards").insert(row);

  if (error) {
    // 23505 = unique violation on username; 42501/RLS = someone else's row.
    if (error.code === "23505" || error.code === "42501" || /row-level security|duplicate key/i.test(error.message)) {
      return { ok: false, error: `The link "/c/${username}" is already taken. Try another one.` };
    }
    return { ok: false, error: isNetworkError(error) ? OFFLINE : error.message };
  }

  // White-label member? Stamp the card with their brand so <user>.<brand>
  // answers (belt to migration 0022's trigger). Best effort — a miss here
  // never fails the publish.
  try {
    const id = existing?.id
      ?? (await sb.from("cards").select("id").eq("username", username).maybeSingle()).data?.id;
    const token = (await sb.auth.getSession()).data.session?.access_token;
    if (id && token) {
      void fetch("/api/cards/brand", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: id }),
      }).catch(() => {});
    }
  } catch { /* ignore */ }
  return { ok: true, username };
}

/**
 * Every card owned by the signed-in user, or an error — never a silent "no cards".
 * Throws Error("offline") without a browser client and on any lookup error (no internet, server trouble),
 * so a failed fetch is never taken for "this user has no card" (that used to publish a duplicate card).
 * Returns [] only when the user is logged out.
 */
export async function fetchMyCardsStrict(): Promise<Card[]> {
  const sb = getBrowserSupabase();
  if (!sb) throw new Error("offline");
  // getSession reads the saved session (no round trip unless the token must be refreshed).
  const { data: s, error: sessionError } = await sb.auth.getSession();
  if (sessionError) throw new Error("offline");
  const user = s.session?.user;
  if (!user) return [];
  const { data, error } = await sb
    .from("cards")
    .select("id, data, active, username")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error("offline");
  return (data ?? []).map((row: { id: string; data: Card; active: boolean; username: string }) => ({
    ...row.data,
    id: row.id,
    username: row.username,
    active: row.active ?? true,
  }));
}

/** Every card owned by the signed-in user. Empty when logged out. */
export async function fetchMyCards(): Promise<Card[]> {
  const sb = getBrowserSupabase();
  if (!sb) return [];
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return [];
  const { data } = await sb
    .from("cards")
    .select("id, data, active, username")
    .eq("owner_id", auth.user.id)
    .order("created_at", { ascending: false });
  return (data ?? []).map((row: { id: string; data: Card; active: boolean; username: string }) => ({
    ...row.data,
    id: row.id,                    // DB id is the editor's identity
    username: row.username,
    active: row.active ?? true,
  }));
}

/** One of MY cards by id. Returns null if it doesn't exist or isn't mine. */
export async function fetchMyCard(id: string): Promise<Card | null> {
  const sb = getBrowserSupabase();
  if (!sb) return null;
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return null;
  const { data } = await sb
    .from("cards")
    .select("id, data, active, username")
    .eq("id", id)
    .eq("owner_id", auth.user.id)   // ownership check — never load someone else's
    .maybeSingle();
  if (!data) return null;
  return { ...(data.data as Card), id: data.id, username: data.username, active: data.active ?? true };
}

/** Like fetchMyCard, but a failed request THROWS instead of looking like "no such card". The editor uses it: a card
 *  that failed to load must never open as a blank card with the same id (publishing that would wipe the live card). */
export async function fetchMyCardStrict(id: string, userId: string): Promise<Card | null> {
  const sb = getBrowserSupabase();
  if (!sb) throw new Error("no cloud");
  const { data, error } = await sb
    .from("cards")
    .select("id, data, active, username")
    .eq("id", id)
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { ...(data.data as Card), id: data.id, username: data.username, active: data.active ?? true };
}

/** Delete one of my cards. */
export async function deleteMyCard(id: string): Promise<boolean> {
  const sb = getBrowserSupabase();
  if (!sb) return false;
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return false;
  const { error } = await sb.from("cards").delete().eq("id", id).eq("owner_id", auth.user.id);
  return !error;
}

/* ---------------- leads ---------------- */

export async function submitLead(
  cardUsername: string,
  lead: { name: string; phone: string; email: string; message: string; source?: "form" | "popup" },
): Promise<{ ok: boolean; error?: string }> {
  const sb = getBrowserSupabase();
  if (!sb) return { ok: false, error: "demo" };
  // Carry the campaign onto the lead itself. Without this the owner can see
  // that an ad got clicks but never which ad produced an actual customer.
  const a = attribution();
  const response = await fetch("/api/leads/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cardUsername, ...lead, attribution: a }),
  });
  const result = await response.json().catch(() => ({ ok: false, error: "Could not save the lead." }));
  return result as { ok: boolean; error?: string };
}

/** The caller's access token, for API routes that act on their behalf. */
export async function getAccessToken(): Promise<string | null> {
  const sb = getBrowserSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}

export type DomainState = {
  domain: string;
  verified: boolean;
  lastError?: string | null;
};

/** The custom domain attached to this card, if any. */
export async function fetchCardDomain(cardId: string): Promise<DomainState | null> {
  const sb = getBrowserSupabase();
  if (!sb) return null;
  const { data } = await sb
    .from("card_domains")
    .select("domain, verified, last_error")
    .eq("card_id", cardId)
    .maybeSingle();
  if (!data) return null;
  return { domain: data.domain, verified: data.verified, lastError: data.last_error };
}
