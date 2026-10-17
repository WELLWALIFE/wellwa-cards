// What kind of account this is (owner, 17 Oct 2026): a PARTNER account is also a partner ID in the partner panel (team, join links, Business tab);
// a CONSUMER only uses the app (card, website, posters, plan) and is never in the tree; a PENDING account came straight from the website with
// no sponsor and waits for the admin, who either makes it a partner (with a sponsor and a place) or marks it a consumer.
// Kept in the account's app_metadata, which only the server can write (user_metadata can be edited by the user from the browser).
// Every account made before this existed has no kind and counts as a partner, so nothing changes for them.
export type AccountKind = "partner" | "pending" | "consumer";

export function kindOf(appMetadata: unknown): AccountKind {
  const k = (appMetadata as { account_kind?: unknown } | null | undefined)?.account_kind;
  return k === "pending" || k === "consumer" ? k : "partner";
}
export const isPartnerKind = (k: AccountKind) => k === "partner";
