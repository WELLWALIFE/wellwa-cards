import "server-only";
import { SUPA_URL, serviceHeaders } from "@/lib/admin-guard";
import type { AccountKind } from "@/lib/account-kind";

/** Sets the account's kind (app_metadata: only the server can write it). The admin PUT merges top-level app_metadata keys. */
export async function setAccountKind(userId: string, kind: AccountKind): Promise<boolean> {
  try {
    const r = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, { method: "PUT", headers: serviceHeaders(), body: JSON.stringify({ app_metadata: { account_kind: kind } }) });
    return r.ok;
  } catch { return false; }
}
