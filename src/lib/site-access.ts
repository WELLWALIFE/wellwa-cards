// Who may have a WEBSITE (owner, 16 Oct 2026): the free plan is the digital card only. The website comes with a paid plan
// (Standard, Premium; Starter and the card plans keep what they had). This is the server's one word on it.
//
// It only ever decides whether a website is NEWLY switched on. A free account that already has a live website keeps it:
// callers check `card.site.enabled` first and never take a running website away.
//
// Fails OPEN: if the plan cannot be read (a network hiccup, a database before a migration) the answer is "allowed", so a
// paying customer is never refused because of a lookup error.
import { restAsUser, posterQuota } from "@/lib/poster-server";
import { myCard } from "@/lib/site-server";

/** What a free account is told when it asks for a website. `plan: true` is the flag the screens read to open the upgrade sheet. */
export const WEBSITE_PLAN_MESSAGE = "A website is part of the Standard plan (₹2,999 a month) or Premium. Your free plan is the digital card, and it stays free.";

type Row = Record<string, unknown>;
const first = (d: unknown): Row | null => (Array.isArray(d) ? (d[0] as Row | undefined) ?? null : (d as Row | null)) ?? null;

/** True when this account has a running paid plan of any kind (Standard / Premium subscription, Starter, a card plan, a partner plan). */
export async function hasPaidPlan(token: string, userId: string): Promise<boolean> {
  try {
    const [plan, saas, quota] = await Promise.all([
      restAsUser<Row[]>(token, "rpc/my_plan", { method: "POST", body: "{}" }),
      restAsUser<Row[]>(token, "rpc/my_saas", { method: "POST", body: "{}" }),
      posterQuota(token, userId).catch(() => null),
    ]);
    const p = first(plan.data), s = first(saas.data);
    if (p && p.plan && p.plan !== "free" && !p.expired) return true;
    if (s && s.tier && s.tier !== "none" && (s.state === "active" || s.state === "grace")) return true;
    if (quota && quota.plan !== "free") return true;
    // Nothing paid was found. Only call the account free when at least one of the lookups actually answered.
    return !(plan.ok || saas.ok);
  } catch {
    return true;
  }
}

/** True when this request would switch a website ON for a free account that has none: the card is not showing a website now and
 *  the plan is free. (A free account whose website is already on, or an account with no card yet, is never blocked here.) */
export async function newWebsiteBlocked(me: { id: string; token: string }, cardId?: string): Promise<boolean> {
  try {
    const row = await myCard(me.id, cardId);
    if (!row || row.data.site?.enabled) return false;
    return !(await hasPaidPlan(me.token, me.id));
  } catch {
    return false;
  }
}
