// Admin v2 → payment requests (src/lib/payments-server.ts). A franchise sees and makes requests for its own users only.
//   GET  ?status=open|paid|cancelled&user=<id>&q=  → the list (scope applied), each with the user's name
//   POST { user_id, kind, tier?, months?, amount_paise, title?, note?, expires_days? } → a new request and its link
//   PATCH { id, op: "cancel" }
import { NextResponse } from "next/server";
import { requireAdmin, audit, userInScope } from "@/lib/admin-v2";
import { svc } from "@/lib/service";
import { createRequest, cancelRequest, requestById } from "@/lib/payments-server";
import { payLink, requestTitle, type PaymentRequest, type PayKind, type PayTier } from "@/lib/payments";

const COLS = "id,code,owner_id,created_by,created_role,kind,tier,months,amount_paise,title,note,status,order_id,payment_id,paid_at,expires_at,created_at";

export async function GET(request: Request) {
  const g = await requireAdmin(request, "payments.request"); if (!g.ok) return g.res;
  const q = new URL(request.url).searchParams;
  const status = q.get("status") ?? "";
  const user = q.get("user") ?? "";
  const parts = [`select=${COLS}`, "order=created_at.desc", "limit=200"];
  if (["open", "paid", "cancelled"].includes(status)) parts.push(`status=eq.${status}`);
  if (/^[0-9a-f-]{36}$/i.test(user)) parts.push(`owner_id=eq.${user}`);
  let rows = (await svc<PaymentRequest[]>(`payment_requests?${parts.join("&")}`)).data ?? [];
  if (g.me.franchiseId) {
    const ids = !g.me.franchiseIds?.length ? [] : ((await svc<{ id: string }[]>(`profiles?franchise_id=in.(${g.me.franchiseIds.join(",")})&select=id&limit=5000`)).data ?? []).map((p) => p.id);
    const set = new Set(ids); rows = rows.filter((r) => set.has(r.owner_id));
  }
  const owners = [...new Set(rows.map((r) => r.owner_id))];
  const names = owners.length ? ((await svc<{ id: string; full_name: string | null; username: string | null }[]>(`profiles?id=in.(${owners.join(",")})&select=id,full_name,username`)).data ?? []) : [];
  const byId = new Map(names.map((n) => [n.id, n]));
  return NextResponse.json({ requests: rows.map((r) => ({ ...r, label: requestTitle(r, false), link: payLink(r.code), user: { name: byId.get(r.owner_id)?.full_name ?? "", username: byId.get(r.owner_id)?.username ?? "" } })) });
}

export async function POST(request: Request) {
  const g = await requireAdmin(request, "payments.request"); if (!g.ok) return g.res;
  const b = (await request.json().catch(() => ({}))) as { user_id?: string; kind?: PayKind; tier?: PayTier; months?: number; amount_paise?: number; title?: string; note?: string; expires_days?: number };
  const userId = String(b.user_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return NextResponse.json({ error: "Pick the user." }, { status: 400 });
  if (!(await userInScope(g.me, userId))) return NextResponse.json({ error: "That user is not in your franchise." }, { status: 403 });
  if (!b.kind || !["plan", "advance", "custom"].includes(b.kind)) return NextResponse.json({ error: "Choose what the payment is for." }, { status: 400 });
  const made = await createRequest({ ownerId: userId, createdBy: g.me.id || null, createdRole: g.me.franchise ? "franchise" : "admin", kind: b.kind, tier: b.tier ?? null, months: b.months, amountPaise: Number(b.amount_paise), title: b.title, note: b.note, expiresInDays: Math.max(1, Math.min(60, Math.round(Number(b.expires_days) || 14))) });
  if (!made.ok) return NextResponse.json({ error: made.error }, { status: 400 });
  await audit(g.me, "payment.request", { type: "user", id: userId, label: `${made.request.kind} ${made.request.amount_paise}`, after: { code: made.request.code, kind: b.kind, tier: b.tier ?? null, months: b.months ?? 1, amount_paise: made.request.amount_paise } }, request);
  return NextResponse.json({ ok: true, request: { ...made.request, label: requestTitle(made.request, false), link: payLink(made.request.code) } });
}

export async function PATCH(request: Request) {
  const g = await requireAdmin(request, "payments.request"); if (!g.ok) return g.res;
  const b = (await request.json().catch(() => ({}))) as { id?: string; op?: string };
  const r = b.id ? await requestById(b.id) : null;
  if (!r) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!(await userInScope(g.me, r.owner_id))) return NextResponse.json({ error: "Not in your franchise." }, { status: 403 });
  if (b.op !== "cancel") return NextResponse.json({ error: "unknown op" }, { status: 400 });
  if (!(await cancelRequest(r.id))) return NextResponse.json({ error: "Could not cancel (already paid?)." }, { status: 400 });
  await audit(g.me, "payment.cancel", { type: "user", id: r.owner_id, label: r.code }, request);
  return NextResponse.json({ ok: true });
}
