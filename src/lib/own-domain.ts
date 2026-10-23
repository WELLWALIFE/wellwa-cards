import "server-only";
// The owner's own web address (owner, 23 Oct 2026: "website apne domain par shift ki, to app me website aur card par bhi ushi ka
// link aana chahiye"). card_domains is the truth: a domain counts once it is verified (DNS points here and the certificate is
// on). Everything the app shows, copies, shares or sends uses this; the Shubhora link keeps working and points search engines
// to the own domain (app/c/[username]/render.tsx).
import { restAsService } from "@/lib/poster-server";
import { SITE_URL } from "@/lib/site-url";

type Row = { domain: string; card_id: string; username: string };
const cache = new Map<string, { at: number; domain: string | null }>();
const TTL = 60_000;

/** The bare domain preferred over www, shorter first. */
const best = (rows: Row[]) => rows.map((r) => r.domain).sort((a, b) => Number(a.startsWith("www.")) - Number(b.startsWith("www.")) || a.length - b.length)[0] ?? null;

/** The verified own domain of a card (by its id or its username), or null. Cached a minute. */
export async function ownDomainOf(by: { cardId?: string; username?: string }): Promise<string | null> {
  const key = by.cardId ? `id:${by.cardId}` : by.username ? `u:${by.username}` : "";
  if (!key) return null;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.domain;
  const filter = by.cardId ? `card_id=eq.${encodeURIComponent(by.cardId)}` : `username=eq.${encodeURIComponent(by.username!)}`;
  const r = await restAsService<Row[]>(`card_domains?${filter}&verified=is.true&select=domain,card_id,username&limit=10`).catch(() => null);
  if (!r?.ok) return hit?.domain ?? null;
  const domain = best(Array.isArray(r.data) ? r.data : []);
  cache.set(key, { at: Date.now(), domain });
  if (cache.size > 2000) cache.delete(cache.keys().next().value!);
  return domain;
}

/** The card's public address: https://<own domain> when there is one, else the Shubhora link. */
export async function publicCardUrl(username: string, cardId?: string): Promise<string> {
  const d = await ownDomainOf(cardId ? { cardId } : { username });
  return d ? `https://${d}` : `${SITE_URL}/c/${username}`;
}

/** Keeps the card's own copy (data.customDomain) equal to its verified domain — set when one goes live, cleared when it goes. */
export async function syncCardDomain(cardId: string, known?: string): Promise<string | null> {
  // `known`: the card's current copy, when the caller has it — then nothing is read or written unless it differs.
  if (known === undefined) cache.delete(`id:${cardId}`);
  const domain = await ownDomainOf({ cardId });
  if (known !== undefined && known === (domain ?? "")) return domain;
  const row = (await restAsService<{ id: string; username: string; data: Record<string, unknown> | null }[]>(`cards?id=eq.${encodeURIComponent(cardId)}&select=id,username,data&limit=1`).catch(() => null))?.data?.[0];
  if (!row?.data) return domain;
  cache.delete(`u:${row.username}`);
  const have = typeof row.data.customDomain === "string" ? row.data.customDomain : "";
  if (have === (domain ?? "")) return domain;
  const data = { ...row.data }; if (domain) data.customDomain = domain; else delete data.customDomain;
  await restAsService(`cards?id=eq.${row.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ data }) }).catch(() => null);
  return domain;
}
