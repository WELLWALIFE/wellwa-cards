// Signed admin tokens so the owner can open this Super Admin from the associate admin (one login for both).
// handoff: 60 seconds, travels in a URL once. session: 8 hours, kept in the browser tab like the admin password.
import crypto from "node:crypto";

type Kind = "handoff" | "session";

/** How much of Super Admin a token opens.
 *  "all"     — the platform owner: everything (the admin password and the owner's own login are always this).
 *  "support" — a Staff Admin member sent over to help a card holder: Live help only, nothing else.
 *  A token with no scope in it is "all", so handoffs minted before this existed keep working. */
export type AdminScope = "all" | "support";
const secret = () => process.env.LINK_SECRET ?? "";
const b64 = (s: string) => Buffer.from(s).toString("base64url");
const used = new Map<string, number>();

export function signAdminToken(sub: string, typ: Kind, ttlSeconds: number, scope: AdminScope = "all") {
  const body = b64(JSON.stringify({
    sub, typ, exp: Math.floor(Date.now() / 1000) + ttlSeconds, n: crypto.randomBytes(6).toString("hex"),
    // Left out for "all" so an owner token looks exactly as it did before.
    ...(scope === "all" ? {} : { sc: scope }),
  }));
  return `v1.${body}.${crypto.createHmac("sha256", secret()).update(body).digest("base64url")}`;
}

export function verifyAdminToken(token: string, typ: Kind): { sub: string; scope: AdminScope } | null {
  if (!secret() || !token.startsWith("v1.")) return null;
  const [, body, sig] = token.split(".");
  if (!body || !sig) return null;
  const want = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  if (want.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as { sub: string; typ: Kind; exp: number; sc?: string };
    if (p.typ !== typ || p.exp < Date.now() / 1000) return null;
    if (typ === "handoff") {                       // single use
      if (used.has(body)) return null;
      used.set(body, p.exp);
      for (const [k, e] of used) if (e < Date.now() / 1000) used.delete(k);
    }
    return { sub: p.sub, scope: p.sc === "support" ? "support" : "all" };
  } catch { return null; }
}
