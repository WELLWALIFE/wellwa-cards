// Shop expenses (rent, electricity, salary, tea…): GET a month (?month=YYYY-MM) with totals by head, POST one, DELETE one made by
// mistake (the owner, or the person who wrote it on the same day). Writing needs the "expense" right; seeing all needs "reports".
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { istDay, isUuid } from "@/lib/jewellery-server";
import { EXPENSE_CATS, EXPENSE_COLS, type ExpenseRow } from "@/lib/mobile";
import { msCtx, msDenied, msHas } from "@/lib/mobile-server";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const c = await msCtx(request, sp.get("as"));
  if (!c.ok) return c.res;
  if (!msHas(c.access, "expense") && !msHas(c.access, "reports")) return msDenied("see expenses");
  const today = istDay();
  const month = /^\d{4}-\d{2}$/.test(sp.get("month") ?? "") ? sp.get("month")! : today.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const next = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
  const mine = msHas(c.access, "reports") ? "" : `&created_by=eq.${c.scope.userId}`;
  const rows = list(await restAsService<ExpenseRow[]>(`ms_expenses?owner_id=eq.${c.scope.ownerId}&day=gte.${month}-01&day=lt.${next}${mine}&select=${EXPENSE_COLS}&order=day.desc,created_at.desc&limit=2000`));
  const byCat: Record<string, number> = {};
  for (const e of rows) byCat[e.category] = (byCat[e.category] ?? 0) + e.amount_paise;
  return NextResponse.json({ month, today, expenses: rows, byCat, total: rows.reduce((a, e) => a + e.amount_paise, 0), access: c.access, setup: c.setup });
}

export async function POST(request: Request) {
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const c = await msCtx(request, typeof b.as === "string" ? b.as : null);
  if (!c.ok) return c.res;
  if (!msHas(c.access, "expense")) return msDenied("write expenses");
  const amount = Math.round(Number(b.amount_paise) || 0);
  if (amount <= 0 || amount > 1e11) return NextResponse.json({ error: "Type the amount." }, { status: 400 });
  const today = istDay();
  const day = typeof b.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.day) && b.day <= today ? b.day : today;
  const asked = typeof b.store === "string" ? b.store : "";
  const row = {
    owner_id: c.scope.ownerId, day, amount_paise: amount,
    category: EXPENSE_CATS.some((x) => x.key === b.category) ? String(b.category) : "other",
    mode: ["cash", "upi", "card", "bank"].includes(String(b.mode)) ? String(b.mode) : "cash",
    note: String(b.note ?? "").replace(/\s+/g, " ").trim().slice(0, 200),
    store: c.access.store || (c.setup.stores.some((s) => s.id === asked) ? asked : ""),
    created_by: c.scope.userId, created_by_name: c.access.name,
  };
  const r = await restAsService<ExpenseRow[]>(`ms_expenses?select=${EXPENSE_COLS}`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) });
  const saved = list(r)[0];
  return saved ? NextResponse.json({ expense: saved }) : NextResponse.json({ error: "Could not save. Please try again." }, { status: 500 });
}

export async function DELETE(request: Request) {
  const sp = new URL(request.url).searchParams;
  const c = await msCtx(request, sp.get("as"));
  if (!c.ok) return c.res;
  const id = sp.get("id");
  if (!isUuid(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const e = list(await restAsService<ExpenseRow[]>(`ms_expenses?id=eq.${id}&owner_id=eq.${c.scope.ownerId}&select=${EXPENSE_COLS}&limit=1`))[0];
  if (!e) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const own = e.created_by === c.scope.userId && e.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10);
  if (!c.access.owner && !msHas(c.access, "setup") && !own) return msDenied("remove this expense");
  const r = await restAsService(`ms_expenses?id=eq.${e.id}&owner_id=eq.${c.scope.ownerId}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Could not remove." }, { status: 500 });
}
