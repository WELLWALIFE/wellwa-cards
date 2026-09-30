import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { createClient as createBareClient, type SupabaseClient } from "@supabase/supabase-js";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/**
 * The signed-in user, from the session cookie — or, when the cookie copy is missing or stale (the phone
 * app keeps its session in the browser and sends it as a Bearer token, like /api/poster/* expect), from
 * the Authorization header. Either way the returned client acts as that user, so RLS still applies.
 */
export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (!error && data.user) return { user: data.user, supabase };
  try {
    const auth = (await headers()).get("authorization") ?? "";
    if (!/^bearer\s+\S+/i.test(auth)) return null;
    const token = auth.replace(/^bearer\s+/i, "").trim();
    const bare = createBareClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: d2, error: e2 } = await bare.auth.getUser(token);
    return e2 || !d2.user ? null : { user: d2.user, supabase: bare };
  } catch { return null; }
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const expected = process.env.NEXT_PUBLIC_SITE_URL;
  try {
    const originUrl = new URL(origin);
    const requestHost = (request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).host).toLowerCase();
    return originUrl.host.toLowerCase() === requestHost || Boolean(expected && originUrl.origin === new URL(expected).origin);
  } catch {
    return false;
  }
}

/** Strict version for public endpoints that cost money (AI): a browser always sends Origin on a POST, so a request
 *  without one is a script, not a visitor (owner's review, 28 Sep 2026). */
export function sameOriginStrict(request: Request): boolean {
  return Boolean(request.headers.get("origin")) && sameOrigin(request);
}

/** The visitor's IP as our Apache saw it. Apache APPENDS the address it got the request from to whatever
 *  X-Forwarded-For the visitor sent, so only the LAST entry cannot be forged (the first one was used before — a script
 *  could send a new value every time and never hit a limit). Next only fills the header when it is missing.
 *  If a CDN (e.g. Cloudflare) is ever put in front, switch this to its visitor header (CF-Connecting-IP). */
export function clientIp(request: Request): string {
  const last = request.headers.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean).pop();
  return last || request.headers.get("x-real-ip") || "unknown";
}

export function clientKey(request: Request, scope: string): string {
  return `${scope}:${clientIp(request)}`;
}

/** A platform-wide daily cap for AI answers on public pages (card chat, translations), so a script or a flood can never
 *  run up the AI bill. Counts reset at midnight India time. Limits: PUBLIC_AI_DAILY_CHAT / PUBLIC_AI_DAILY_TRANSLATE. */
const aiDay = { day: "", counts: new Map<string, number>() };
export function publicAiAllowed(kind: "chat" | "translate"): boolean {
  const day = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  if (aiDay.day !== day) { aiDay.day = day; aiDay.counts.clear(); }
  const limit = Number((kind === "chat" ? process.env.PUBLIC_AI_DAILY_CHAT : process.env.PUBLIC_AI_DAILY_TRANSLATE) || (kind === "chat" ? 3000 : 300));
  const used = aiDay.counts.get(kind) ?? 0;
  if (used >= limit) {
    if (used === limit) console.error(`[ai-budget] public ${kind} limit of ${limit} reached for ${day} — answering without AI until midnight`);
    aiDay.counts.set(kind, used + 1);
    return false;
  }
  aiDay.counts.set(kind, used + 1);
  return true;
}

export function rateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
  } else {
    current.count += 1;
    if (current.count > limit) return true;
  }

  if (buckets.size > 5000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
      if (buckets.size <= 4000) break;
    }
  }
  return false;
}

/**
 * Is the render worker (bridge/media-worker.mjs, pm2 "neuraledge-media") alive right now?
 *
 * Money rule: never take credits for a video nobody can make. Every route that spends
 * credits for a render calls this first and answers 503 instead of charging, so a worker
 * outage becomes a visible "try again in a minute" rather than a silent charge and a job
 * that sits queued forever.
 *
 * The worker writes media_worker_status (id = 1) on every beat; 120 s is four missed beats.
 * A missing row, an unparseable/absent beat_at or a stale beat all mean "not alive".
 * needV2 additionally requires caps.ad_v2 — the storyboard pipeline only exists on a worker
 * that reports it. Must be called with the service-role client: the table is service_role only.
 */
export async function workerAlive(admin: SupabaseClient, needV2 = false): Promise<boolean> {
  const { data } = await admin.from("media_worker_status").select("caps, beat_at").eq("id", 1).single();
  if (!data?.beat_at) return false;
  const beat = new Date(data.beat_at as string).getTime();
  if (!Number.isFinite(beat) || Date.now() - beat > 120_000) return false;
  if (needV2 && (data.caps as { ad_v2?: boolean } | null)?.ad_v2 !== true) return false;
  return true;
}

/** What every route says when workerAlive() is false — one sentence, simple English. */
export const WORKER_DOWN = "Video service is updating — try again in a minute.";

export function securityHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return headers;
}
