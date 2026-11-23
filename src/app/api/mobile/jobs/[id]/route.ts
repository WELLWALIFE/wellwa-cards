// One repair job: GET it; PATCH to change its details, move its status, put parts on it (they leave the stock at once), take an
// advance, give the phone back (this makes the bill), or return / cancel it (its parts go back on the shelf). Never deleted.
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { cleanPayment, type Payment } from "@/lib/jewellery";
import { istDay, isUuid } from "@/lib/jewellery-server";
import { billTotals } from "@/lib/mobile";
import { cleanJobFields, jobBillLines, jobOpen, jobStatus, jobTotals, type JobPart, type JobRow, type JobStatus } from "@/lib/mobile-repair";
import { createBill, itemsByIds, msCtx, msDenied, msHas, qtyAdd, shopOf, trueLines } from "@/lib/mobile-server";
import { hideJobCost, jobById, jobEvent, jobLink, partsBack, saveJob, sendJob } from "@/lib/mobile-repair-server";

type Ctx = { params: Promise<{ id: string }> };
const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);
const rs = (p: number) => `₹${Math.round(p / 100).toLocaleString("en-IN")}`;

export async function GET(request: Request, { params }: Ctx) {
  const { id } = await params;
  const c = await msCtx(request, new URL(request.url).searchParams.get("as"));
  if (!c.ok) return c.res;
  if (!msHas(c.access, "repair") && !msHas(c.access, "reports")) return msDenied("see repair jobs");
  const job = await jobById(c.scope.ownerId, id);
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  const staff = list(await restAsService<{ id: string; name: string }[]>(`crm_agents?owner_id=eq.${c.scope.ownerId}&active=is.true&select=id,name&order=created_at`));
  return NextResponse.json({ job: hideJobCost(job, c.access), setup: c.setup, access: c.access, shop: await shopOf(c.scope.ownerId, c.setup), link: jobLink(job), staff, today: istDay() });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const c = await msCtx(request, typeof b.as === "string" ? b.as : null);
  if (!c.ok) return c.res;
  const { scope, setup, access } = c;
  if (!msHas(access, "repair")) return msDenied("work on repair jobs");
  const o = scope.ownerId;
  const job = await jobById(o, id);
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  const ev = (text: string) => [...(job.events ?? []), jobEvent(access.name, text)].slice(-60);
  const out = (j: JobRow | null, extra: Record<string, unknown> = {}) => (j ? NextResponse.json({ job: hideJobCost(j, access), ...extra }) : NextResponse.json({ error: "Could not save." }, { status: 500 }));
  const open = jobOpen(job.status);
  const closed = () => NextResponse.json({ error: "This job is closed." }, { status: 400 });

  switch (b.action) {
    case "send": {
      const what = b.what === "received" || b.what === "ready" ? b.what : "status";
      return NextResponse.json(await sendJob(scope, setup, job, what));
    }
    case "update": {
      if (!open) return closed();
      const f = cleanJobFields({ ...job, ...b });
      if (!f.device) return NextResponse.json({ error: "Type the phone's model." }, { status: 400 });
      const patch: Partial<JobRow> = { ...f };
      if (b.labour_paise !== undefined) patch.labour_paise = Math.max(0, Math.min(1e10, Math.round(Number(b.labour_paise) || 0)));
      if (b.tech_id !== undefined) {
        const t = isUuid(b.tech_id) ? list(await restAsService<{ id: string; name: string }[]>(`crm_agents?id=eq.${b.tech_id}&owner_id=eq.${o}&select=id,name&limit=1`))[0] : null;
        patch.tech_id = t?.id ?? null; patch.tech_name = t?.name ?? "";
      }
      return out(await saveJob(o, job.id, patch));
    }
    case "status": {
      if (!open) return closed();
      const to = (["received", "repairing", "waiting", "ready"] as JobStatus[]).find((s) => s === b.to);
      if (!to) return NextResponse.json({ error: "Unknown status." }, { status: 400 });
      const next = await saveJob(o, job.id, { status: to, events: ev(`${jobStatus(to).en}${typeof b.note === "string" && b.note.trim() ? ` — ${b.note.trim().slice(0, 120)}` : ""}`) });
      const sent = next && to === "ready" && b.notify === true ? await sendJob(scope, setup, next, "ready") : null;
      return out(next, { sent });
    }
    case "part_add": {
      if (!open) return closed();
      const it = isUuid(b.itemId) ? (await itemsByIds(o, [b.itemId]))[0] : null;
      if (!it || it.serial || it.kind === "service") return NextResponse.json({ error: "Pick a part or accessory from your items." }, { status: 400 });
      const qty = Math.max(1, Math.min(99, Math.round(Number(b.qty) || 1)));
      const price = b.price !== undefined ? Math.max(0, Math.min(1e10, Math.round(Number(b.price) || 0))) : it.price_paise;
      await qtyAdd(o, it.id, -qty);
      const name = [it.brand, it.name, it.variant].filter(Boolean).join(" ");
      const parts: JobPart[] = [...(job.parts ?? []), { itemId: it.id, name, qty, price, cost: it.cost_paise }];
      return out(await saveJob(o, job.id, { parts, events: ev(`Part used: ${name} ×${qty}`) }));
    }
    case "part_remove": {
      if (!open) return closed();
      const at = Math.round(Number(b.index));
      const p = (job.parts ?? [])[at];
      if (!p) return NextResponse.json({ error: "Part not found." }, { status: 400 });
      if (p.itemId) await qtyAdd(o, p.itemId, p.qty);
      return out(await saveJob(o, job.id, { parts: job.parts.filter((_, i) => i !== at), events: ev(`Part taken off: ${p.name} ×${p.qty}`) }));
    }
    case "advance": {
      if (!open) return closed();
      const p = cleanPayment(b.payment);
      if (!p) return NextResponse.json({ error: "Type the amount." }, { status: 400 });
      return out(await saveJob(o, job.id, { payments: [...(job.payments ?? []), { ...p, at: new Date().toISOString() }], events: ev(`Advance ${rs(p.paise)} (${p.mode})`) }));
    }
    case "refund": {
      if (open || job.status === "delivered") return NextResponse.json({ error: "An advance is returned only on a job that was returned or cancelled." }, { status: 400 });
      const paid = jobTotals(job).paid;
      if (!paid) return NextResponse.json({ error: "No advance on this job." }, { status: 400 });
      return out(await saveJob(o, job.id, { payments: [], events: ev(`Advance ${rs(paid)} returned to the customer`) }));
    }
    case "return":
    case "cancel": {
      if (!open) return closed();
      if (b.action === "cancel" && !msHas(access, "cancel")) return msDenied("cancel jobs");
      const reason = String(b.reason ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
      if (!reason) return NextResponse.json({ error: "Write the reason." }, { status: 400 });
      const status: JobStatus = b.action === "cancel" ? "cancelled" : "returned";
      const next = await saveJob(o, job.id, { status, parts: [], labour_paise: 0, cancel_reason: `${reason} — ${access.name}`, delivered_at: new Date().toISOString(), events: ev(`${jobStatus(status).en}: ${reason}`) });
      if (next) await partsBack(o, job).catch((e) => console.error("[mobile] parts back", e));
      return out(next);
    }
    case "deliver": {
      if (!open) return closed();
      if (!msHas(access, "bill")) return msDenied("make bills");
      const labour = b.labour_paise !== undefined ? Math.max(0, Math.min(1e10, Math.round(Number(b.labour_paise) || 0))) : job.labour_paise;
      const withLabour = { ...job, labour_paise: labour };
      if (jobTotals(withLabour).total <= 0) return NextResponse.json({ error: "Type the repair charge (or add the parts used)." }, { status: 400 });
      const tl = await trueLines(o, jobBillLines(withLabour), "sale");
      if ("error" in tl) return NextResponse.json({ error: tl.error }, { status: 400 });
      // The repair line keeps its service HSN; a part keeps the cost it had when it went on the job.
      const lines = tl.lines.map((l, i) => (l.itemId ? { ...l, cost: job.parts[i]?.cost ?? l.cost } : { ...l, hsn: "9987" }));
      const now = new Date().toISOString();
      const fresh = (Array.isArray(b.payments) ? b.payments : []).slice(0, 5).map(cleanPayment).filter((x): x is Payment => !!x).map((p) => ({ ...p, at: now }));
      const payments = [...(job.payments ?? []), ...fresh];
      const t = billTotals({ lines, payments, discountPaise: 0, customerState: "" }, setup);
      if (t.paid > t.total) return NextResponse.json({ error: `The money received is more than the bill (${rs(t.total)}, advance ${rs(jobTotals(job).paid)}).` }, { status: 400 });
      const notes = [`Repair job ${job.code}`, job.device, job.imei && `IMEI ${job.imei}`, job.warranty_days > 0 && `Repair warranty ${job.warranty_days} days`].filter(Boolean).join(" · ");
      const bill = await createBill(scope, setup, "sale", { customer_name: job.customer_name, customer_phone: job.customer_phone, customer_gstin: "", customer_state: "", lines, payments, discount_paise: 0, notes: notes.slice(0, 300), due_date: null, client_id: `job-${job.id}-${(job.events ?? []).length}`, created_by: scope.userId, created_by_name: access.name }, true);
      if (!bill) return NextResponse.json({ error: "Could not make the bill. Please try again." }, { status: 500 });
      const next = await saveJob(o, job.id, { status: "delivered", labour_paise: labour, bill_id: bill.id, delivered_at: now, events: ev(`Given back · bill ${bill.code} ${rs(bill.total_paise)}`) });
      return out(next, { billId: bill.id });
    }
    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}
