// Super Admin → what kind of account this is (owner, 17 Oct 2026). See lib/account-kind.ts.
//   POST { op: "consumer", id }                          → the account is a consumer: it uses the app, it is never in the team tree
//   POST { op: "pending", id }                           → back to "waiting for review"
//   POST { op: "make-partner", id, sponsor, leg, parent? } → a partner ID is made with that sponsor and place (left/right under `parent`,
//                                                           anywhere in the tree) and tied to the account, which becomes a partner
// An account that already has a partner ID is not touched here (unlink it first, in the Users page).
import { adminAllowed, serviceConfigured, serviceHeaders, SUPA_URL } from "@/lib/admin-guard";
import { kindOf } from "@/lib/account-kind";
import { setAccountKind } from "@/lib/account-kind-server";
import { makePartnerId, partnerCall } from "@/lib/partner-link";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (!(await adminAllowed(request))) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return Response.json({ error: "not configured" }, { status: 503 });
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const op = String(b.op ?? "");
  const id = String(b.id ?? "");
  if (!UUID.test(id)) return Response.json({ error: "bad account" }, { status: 400 });
  const ur = await fetch(`${SUPA_URL}/auth/v1/admin/users/${id}`, { headers: serviceHeaders(), cache: "no-store" });
  if (!ur.ok) return Response.json({ error: "account not found" }, { status: 404 });
  const was = kindOf((await ur.json()).app_metadata);
  // An account that already has a partner ID keeps it: its kind is not changed from here.
  const has = await partnerCall<{ code?: string }>("summary", { suiteUserId: id }, 6000);
  if (has.ok) return Response.json({ error: `This account already has the partner ID ${has.data.code ?? ""}. Unlink it first (Unlink ID), then change its kind.`.replace("  ", " ") }, { status: 409 });
  if (has.status !== 404) return Response.json({ error: "Could not check the partner panel. Try again in a moment." }, { status: 502 });

  if (op === "consumer" || op === "pending") {
    if (!(await setAccountKind(id, op))) return Response.json({ error: "Could not save." }, { status: 500 });
    return Response.json({ ok: true, kind: op });
  }
  if (op === "make-partner") {
    const sponsor = String(b.sponsor ?? "").trim();
    const leg = String(b.leg ?? "").toUpperCase() === "R" ? "R" : String(b.leg ?? "").toUpperCase() === "L" ? "L" : "";
    const parent = String(b.parent ?? "").trim();
    if (!sponsor) return Response.json({ error: "Write the sponsor's username." }, { status: 400 });
    if (!leg) return Response.json({ error: "Choose the side, left or right." }, { status: 400 });
    if (!(await setAccountKind(id, "partner"))) return Response.json({ error: "Could not save." }, { status: 500 });
    const r = await makePartnerId(id, { sponsor, leg, parent: parent || undefined });
    if (!r.ok) {
      await setAccountKind(id, was);      // nothing was made: the account stays as it was
      return Response.json({ error: r.error ?? "Could not make the partner ID." }, { status: 409 });
    }
    return Response.json({ ok: true, kind: "partner", code: r.code });
  }
  return Response.json({ error: "unknown op" }, { status: 400 });
}
