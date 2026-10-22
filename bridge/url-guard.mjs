// Server-side URL guard for the workers that download pictures/audio by URL.
//
// A URL is fetched only when its parsed origin is one of the allowed origins (our Supabase project, our site),
// or — for callers that deliberately accept any public web picture — when its host is not private, loopback,
// link-local or otherwise internal. Redirects are followed by hand so every hop gets the same check.
import dns from "node:dns/promises";
import net from "node:net";

/** The origin of a configured base URL ("https://x.supabase.co/" → "https://x.supabase.co"), or "" when unset/bad. */
export function originOf(u) {
  try { return u ? new URL(String(u)).origin : ""; } catch { return ""; }
}

function v4Private(ip) {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)          // carrier-grade NAT
    || (a === 169 && b === 254)                    // link-local / cloud metadata
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 192 && b === 0 && p[2] === 0)
    || (a === 198 && (b === 18 || b === 19));
}

/** True for any address a public web picture must never resolve to. */
export function isPrivateIp(ip) {
  const s = String(ip || "").replace(/^\[|\]$/g, "").split("%")[0].toLowerCase();
  const kind = net.isIP(s);
  if (kind === 4) return v4Private(s);
  if (kind !== 6) return true;
  if (s === "::" || s === "::1") return true;
  const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return v4Private(mapped[1]);
  if (/^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(s)) return true;   // mapped v4 in hex form — just refuse
  return /^f[cd]/.test(s) || /^fe[89ab]/.test(s) || /^ff/.test(s) || s.startsWith("64:ff9b:") || s.startsWith("2001:db8:");
}

/** A public host: every address it resolves to is public. Literal IPs are checked as they are. */
async function hostIsPublic(hostname) {
  const h = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return false;
  if (net.isIP(h)) return !isPrivateIp(h);
  try {
    const addrs = await dns.lookup(h, { all: true, verbatim: true });
    return addrs.length > 0 && addrs.every((a) => !isPrivateIp(a.address));
  } catch { return false; }
}

/**
 * Is this absolute URL OK to fetch?
 * allowed: origins always OK (our own Supabase/site, even when they are localhost in development).
 * allowPublic: also accept any http(s) URL whose host is public.
 */
export async function urlAllowed(abs, { allowed = [], allowPublic = false } = {}) {
  let u;
  try { u = new URL(abs); } catch { return false; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  if (u.username || u.password) return false;
  if (allowed.filter(Boolean).includes(u.origin)) return true;
  return allowPublic ? hostIsPublic(u.hostname) : false;
}

/**
 * Download a URL into a Buffer under the guard. Returns null on any refusal, error, non-2xx or when the body
 * is larger than maxBytes. Never throws.
 */
export async function guardedFetch(abs, { allowed = [], allowPublic = false, timeoutMs = 30_000, maxBytes = 20 * 1024 * 1024, maxRedirects = 3 } = {}) {
  try {
    const signal = AbortSignal.timeout(timeoutMs);
    let url = String(abs);
    for (let hop = 0; hop <= maxRedirects; hop++) {
      if (!(await urlAllowed(url, { allowed, allowPublic }))) return null;
      const r = await fetch(url, { signal, redirect: "manual" });
      if (r.status >= 300 && r.status < 400) {
        const loc = r.headers.get("location");
        try { await r.body?.cancel(); } catch { /* ignore */ }
        if (!loc) return null;
        url = new URL(loc, url).toString();
        continue;
      }
      if (!r.ok) { try { await r.body?.cancel(); } catch { /* ignore */ } return null; }
      const len = Number(r.headers.get("content-length") || 0);
      if (len && len > maxBytes) { try { await r.body?.cancel(); } catch { /* ignore */ } return null; }
      if (!r.body) return Buffer.alloc(0);
      const chunks = []; let total = 0;
      for await (const c of r.body) {
        total += c.length;
        if (total > maxBytes) return null;
        chunks.push(Buffer.from(c));
      }
      return Buffer.concat(chunks);
    }
    return null;
  } catch { return null; }
}
