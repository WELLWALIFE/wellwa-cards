"use client";
// Client helpers for the Shubhora app: auth headers, API calls, sharing,
// and the persona/copy tables (Hindi first, Hinglish where it reads better).
import { getBrowserSupabase } from "@/lib/supabase/browser";

export type Persona = "business" | "personal" | "home" | "community" | "student" | "professional";
export type Layout = { title?: string; sub?: string; custom?: string; accent?: string; nameSize?: "S" | "M" | "L"; photoSide?: "right"; hideLine?: boolean; hidePhone?: boolean; hideLogo?: boolean; hidePhoto?: boolean; showName?: boolean; showLine?: boolean; showPhone?: boolean; showPhoto?: boolean; voice?: { on?: boolean; gender?: string; by?: string }; artGroup?: string; varyStyle?: boolean; autoStatusVideo?: boolean; look?: "vibrant" | "classic" | "old"; usps?: string[] };
export type Party = { name: string; symbol_url: string; slogan: string; colors: string[]; leaders: { name: string; photo_url: string }[] };
export type Profile = {
  id: string; persona: Persona; name: string; tagline: string | null; phone: string | null; city: string | null;
  photo_url: string | null; logo_url: string | null; lang: string; is_default: boolean; kids_mode: boolean; mode?: "greeting" | "product";
  style?: string; layout?: Layout; category?: string; party?: Party | null;
};
export type Poster = { id: string; url: string; title: string; occasion_slug: string; shares: number; for_date?: string; style?: string; video_url?: string; music?: string; caption?: string | null; /** file mtime — cache key of the picture */ v?: number };
export type Quota = { plan: string; used: number; limit: number | null };

export const PERSONAS: { key: Persona; hi: string; sub: string; emoji: string; taglineHint: string; needsLogo: boolean }[] = [
  { key: "business",     hi: "व्यापारी / दुकानदार",   sub: "Dukan, showroom, distributor, agency",     emoji: "🏪", taglineHint: "दुकान / कंपनी का नाम", needsLogo: true },
  { key: "personal",     hi: "व्यक्तिगत",             sub: "Parivaar, dost, tyohaar ki shubhkamnayein", emoji: "🙏", taglineHint: "जैसे: सपरिवार", needsLogo: false },
  { key: "home",         hi: "घर से व्यवसाय",         sub: "Tiffin, boutique, beauty, tuition, kitty",  emoji: "🏠", taglineHint: "जैसे: रीना का किचन", needsLogo: true },
  { key: "community",    hi: "समाज / संगठन / राजनीति", sub: "Samiti, sangathan, party, NGO",           emoji: "🚩", taglineHint: "पद और संगठन का नाम", needsLogo: true },
  { key: "student",      hi: "छात्र / बच्चे",         sub: "School, college — sirf greetings, safe",   emoji: "🎒", taglineHint: "स्कूल / कक्षा", needsLogo: false },
  { key: "professional", hi: "प्रोफ़ेशनल / नौकरी",    sub: "Doctor, CA, engineer, manager, teacher",   emoji: "💼", taglineHint: "पद और कंपनी", needsLogo: false },
];

export const LANGS = [
  { key: "hi", label: "हिंदी" }, { key: "en", label: "English" }, { key: "hinglish", label: "Hinglish" },
  { key: "mr", label: "मराठी" }, { key: "gu", label: "ગુજરાતી" }, { key: "pa", label: "ਪੰਜਾਬੀ" }, { key: "bn", label: "বাংলা" },
  { key: "ta", label: "தமிழ்" }, { key: "te", label: "తెలుగు" }, { key: "kn", label: "ಕನ್ನಡ" }, { key: "ml", label: "മലയാളം" }, { key: "or", label: "ଓଡ଼ିଆ" },
];

export async function authHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = { "content-type": "application/json" };
  try {
    const sb = getBrowserSupabase();
    const { data } = (await sb?.auth.getSession()) ?? { data: { session: null } };
    if (data.session?.access_token) h.authorization = `Bearer ${data.session.access_token}`;
  } catch { /* ignore */ }
  return h;
}
export async function isLoggedIn(): Promise<boolean> {
  try { const sb = getBrowserSupabase(); const { data } = (await sb?.auth.getSession()) ?? { data: { session: null } }; return !!data.session; } catch { return false; }
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<{ ok: boolean; status: number; data: T }> {
  const headers = await authHeaders();
  const r = await fetch(path, {
    ...init,
    headers: { ...headers, ...(init?.headers ?? {}) },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    cache: "no-store",
  });
  const data = (await r.json().catch(() => ({}))) as T;
  return { ok: r.ok, status: r.status, data };
}

/** kind: "photo" = 600×600 face crop · "logo" = small PNG · "product" = PNG up to 1400 px ·
 *  "wide" = a shop or work photo, JPEG up to 1600 px, never cropped. Null on any failure (also offline). */
export async function uploadImage(file: File, kind: "photo" | "logo" | "product" | "wide"): Promise<string | null> {
  try {
    const headers = await authHeaders();
    delete headers["content-type"];
    const fd = new FormData(); fd.append("file", file); fd.append("kind", kind);
    const r = await fetch("/api/poster/upload", { method: "POST", headers, body: fd });
    const j = await r.json().catch(() => ({}));
    return r.ok && typeof j.url === "string" ? j.url : null;
  } catch {
    return null;
  }
}

/** A voice-over the owner made themselves (or somewhere else) — uploaded as-is, never re-encoded here. */
export async function uploadAudio(file: File): Promise<{ url?: string; error?: string }> {
  try {
    const headers = await authHeaders();
    delete headers["content-type"];
    const fd = new FormData(); fd.append("file", file);
    const r = await fetch("/api/poster/upload-audio", { method: "POST", headers, body: fd });
    const j = await r.json().catch(() => ({}));
    return r.ok && typeof j.url === "string" ? { url: j.url } : { error: String(j.error ?? "Upload failed.") };
  } catch {
    return { error: "No internet — please try again." };
  }
}

type CapWin = Window & { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: Record<string, unknown> } };
function nativePlugins(): Record<string, unknown> | null {
  const c = (window as CapWin).Capacitor; return c?.isNativePlatform?.() ? (c.Plugins ?? {}) : null;
}
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.onerror = rej; r.readAsDataURL(blob); });
}
/** In the Android app: write to cache and hand the file to the system share sheet (WhatsApp first).
 *  Errors are logged (not swallowed) so a device connected via chrome://inspect shows the real reason. */
async function nativeShare(blob: Blob, text: string, name: string): Promise<boolean> {
  const P = nativePlugins(); if (!P) return false;
  const FS = P.Filesystem as { writeFile?: (o: { path: string; data: string; directory: string }) => Promise<{ uri: string }> } | undefined;
  const SH = P.Share as { share?: (o: { text?: string; files?: string[]; url?: string; dialogTitle?: string }) => Promise<unknown> } | undefined;
  if (!FS?.writeFile || !SH?.share) { console.warn("[share] Filesystem/Share plugin not available on this build"); return false; }
  try {
    const { uri } = await FS.writeFile({ path: name, data: await blobToBase64(blob), directory: "CACHE" });
    await SH.share({ files: [uri], text, dialogTitle: "Share" });
    return true;
  } catch (e) {
    console.error("[share] native share failed", e);
    return false;
  }
}
/** Share any file (poster image, ad video…) — Android app's native share sheet first
 *  (WhatsApp shows up there directly), Web Share API next, plain download last. */
/** Supabase storage serves a public object as a download when asked: `?download=<name>` sets Content-Disposition.
 *  That is how a 50 MB video reaches the Downloads folder without first being pulled into the page's memory. */
export function downloadUrl(url: string, name: string): string {
  if (!/\/storage\/v1\/object\/public\//.test(url)) return url;
  const u = new URL(url); u.searchParams.set("download", name); return u.toString();
}
const isBigMedia = (mime: string) => /^video\//.test(mime);

export async function shareFile(url: string, text: string, filename: string, mime: string, ready?: Blob | null): Promise<"shared" | "downloaded" | "failed"> {
  // A video is tens of megabytes. Fetching it first, as the images below do, takes longer than the browser
  // allows between the tap and navigator.share() — the share was then refused and the video just opened in a
  // tab. So the card fetches the video in the background as soon as it exists and hands it in here as `ready`:
  // the file itself goes to WhatsApp (status / chat) with its voice and music. Only when it is not downloaded
  // yet is the video shared as its link, at once, while the tap still counts (owner, 29 Sep 2026: a link is not
  // what a status needs).
  if (ready && ready.size > 0) {
    try {
      if (await nativeShare(ready, text, filename).catch(() => false)) return "shared";
      const file = new File([ready], filename, { type: mime });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) { await nav.share({ files: [file], text }); return "shared"; }
    } catch (e) { if ((e as Error)?.name === "AbortError") return "failed"; }
    // no file sharing on this browser (desktop) → save the file instead of sending a link
    try { const a = document.createElement("a"); a.href = URL.createObjectURL(ready); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); return "downloaded"; } catch { /* fall through */ }
  }
  if (isBigMedia(mime) && !nativePlugins()) {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    try {
      if (nav.share) { await nav.share({ title: text, text, url }); return "shared"; }
    } catch (e) { if ((e as Error)?.name === "AbortError") return "failed"; }
    try { window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank", "noopener"); return "shared"; } catch { return "failed"; }
  }
  try {
    const blob = await fetch(url, { cache: "no-store" }).then((r) => r.blob());
    if (await nativeShare(blob, text, filename).catch(() => false)) return "shared";
    const file = new File([blob], filename, { type: mime });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) { await nav.share({ files: [file], text }); return "shared"; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    return "downloaded";
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return "failed";
    try { window.open(url, "_blank"); return "downloaded"; } catch { return "failed"; }
  }
}
/** Share the poster image itself (WhatsApp status / chats). Falls back to a download. */
export async function sharePoster(url: string, text: string): Promise<"shared" | "downloaded" | "failed"> {
  return shareFile(url, text, "shubhora.jpg", "image/jpeg");
}
/** Save the poster: Android app → Documents folder (Filesystem plugin); web → download. */
export async function downloadPoster(url: string, name: string): Promise<boolean> {
  // On the web a storage file downloads straight from the bucket (see downloadUrl): the browser shows its own
  // download bar at once, nothing is buffered in the page, and a 50 MB video no longer "does nothing" for a minute.
  if (!nativePlugins() && downloadUrl(url, name) !== url) {
    try {
      const a = document.createElement("a"); a.href = downloadUrl(url, name); a.download = name; a.rel = "noopener";
      document.body.appendChild(a); a.click(); a.remove();
      return true;
    } catch (e) { console.error("[download] direct link failed, fetching instead", e); }
  }
  try {
    const blob = await fetch(url, { cache: "no-store" }).then((r) => r.blob());
    const P = nativePlugins();
    const FS = P?.Filesystem as { writeFile?: (o: { path: string; data: string; directory: string; recursive?: boolean }) => Promise<{ uri: string }> } | undefined;
    if (FS?.writeFile) { await FS.writeFile({ path: `Shubhora/${name}`, data: await blobToBase64(blob), directory: "DOCUMENTS", recursive: true }); return true; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    return true;
  } catch (e) { console.error("[download] failed, opening in browser instead", e); try { window.open(url, "_blank"); return true; } catch { return false; } }
}

/** Referral code from ?ref=… — remembered until the first profile is created. */
export function captureRef() {
  try { const r = new URLSearchParams(window.location.search).get("ref"); if (r && /^[A-Z0-9]{4,10}$/i.test(r)) localStorage.setItem("akp-ref", r.toUpperCase()); } catch { /* ignore */ }
}
export function takeRef(): string | null { try { const r = localStorage.getItem("akp-ref"); return r; } catch { return null; } }
export function clearRef() { try { localStorage.removeItem("akp-ref"); } catch { /* ignore */ } }

const DRAFT_KEY = "akp-draft";
export function saveDraft(d: Record<string, unknown>) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* ignore */ } }
export function loadDraft(): Record<string, unknown> | null { try { const r = localStorage.getItem(DRAFT_KEY); return r ? JSON.parse(r) : null; } catch { return null; } }
export function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } }
export function currentProfileId(): string | null { try { return localStorage.getItem("akp-profile"); } catch { return null; } }
export function setCurrentProfileId(id: string) { try { localStorage.setItem("akp-profile", id); } catch { /* ignore */ } }
