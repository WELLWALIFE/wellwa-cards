"use client";
// Orders & job cards (owner, 30 Oct 2026 — a saree showroom: fall-pico, blouse stitching, alterations by karigars and
// tailors; every garment's status at a glance). The list ("My work" for staff), the filters and "New order".
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, ChevronRight, LoaderCircle, MessageCircle, Pencil, Plus, Printer, Ruler, Search, Settings2, Shirt, Trash2, UserCog, UserRound, Users, X } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { balanceOf, can, cleanPhone, daysFor, fieldsFor, flowFor, fmtDay, isDueToday, isLate, isoPlus, nextStep, receiptMessage, rupees, stepLabel, toPaise, workFor, type JobRow, type JobSetup, type Karigar, type Measurement } from "@/lib/jobs";
import { Fold, JobPhotos, MeasureEditor, MeasurementView, PickChips, StatusBadge, WorkspaceSwitch, blankDraft, draftFilled, draftFrom, useJobSetup, useWorkspace, type MeasureDraft, type Me, type Member } from "@/components/orders/orders-common";

type ListAnswer = { jobs: JobRow[]; role: "owner" | "manager" | "agent"; me: Me; karigars: Karigar[]; team: Member[]; counts: Record<string, number>; setup: JobSetup; error?: string };
type Customer = { name: string; orders: number; last: string; lastAt: string; pendingPaise: number } | null;

export default function OrdersPage() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<ListAnswer | null>(null);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<string>("");   // "" until the first answer: staff start on "My work"
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [booked, setBooked] = useState<{ jobs: JobRow[]; shop: string; told: string[] } | null>(null);
  const [busy, setBusy] = useState("");

  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname + location.search)}`); return; } setReady(true); })(); }, [router]);
  const load = useCallback(async () => {
    const p = new URLSearchParams(ws.q);
    if (filter === "mine") { p.set("mine", "1"); p.set("status", "open"); }
    else if (filter === "pool") p.set("pool", "1");
    else if (filter === "today" || filter === "pending") p.set("view", filter);
    else if (filter && filter !== "all") p.set("status", filter);
    else if (!filter) p.set("status", "open");
    if (q.trim()) p.set("q", q.trim());
    const r = await api<ListAnswer>(`/api/jobs?${p}`, { fresh: true });
    if (!r.ok) { setErr(r.data?.error || T("Could not load. Please try again.", "Load नहीं हुआ। फिर try करें।")); return; }
    setErr(""); setData(r.data);
    // The first screen: staff see their work; the counter sees what is due today (else everything in work).
    if (!filter) setFilter(!can(r.data.me, "all_jobs") ? "mine" : (r.data.counts.today ?? 0) + (r.data.counts.late ?? 0) > 0 ? "today" : "open");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.q, filter, q]);
  useEffect(() => { if (!ready) return; const t = setTimeout(() => void load(), q ? 300 : 0); return () => clearTimeout(t); }, [ready, load, q]);

  /** "Done" from the list: the job goes to its next step and that step's person is told. */
  async function done(j: JobRow, to: string | null) {
    setBusy(j.id);
    const r = await api<{ error?: string }>(`/api/jobs/${j.id}`, { method: "PATCH", json: to ? { as: ws.as || undefined, action: "status", status: to } : { as: ws.as || undefined, action: "take" } });
    setBusy("");
    if (!r.ok) { setErr(r.data.error || T("Could not save.", "सेव नहीं हुआ।")); return; }
    void load();
  }

  if (!ready || (!data && !err)) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const counts = data?.counts ?? {};
  const setup = data?.setup;
  const me = data?.me;
  const openCount = Object.entries(counts).filter(([s]) => !["delivered", "cancelled", "mine", "pool", "today", "late", "pending", "pendingPaise"].includes(s)).reduce((a, [, n]) => a + n, 0);
  const allCount = Object.entries(counts).filter(([s]) => !["mine", "pool", "today", "late", "pending", "pendingPaise"].includes(s)).reduce((a, [, n]) => a + n, 0);
  const kName = (id: string | null) => data?.karigars.find((k) => k.id === id)?.name ?? "";
  const tName = (id: string | null) => data?.team.find((m) => m.id === id)?.name ?? "";
  const seeAll = can(me, "all_jobs"), money = can(me, "money");
  const attention = (counts.today ?? 0) + (counts.late ?? 0);
  // Five tabs (owner, 1 Nov 2026: "aur easy"): Today · In work · Ready · Payment due · Delivered — the steps are chips under "In work".
  const steps = setup?.steps.map((x) => x.key) ?? [];
  const inWork = filter === "open" || filter === "received" || steps.includes(filter);
  const tabs = [
    ...(!seeAll || data?.role !== "owner" || (counts.mine ?? 0) > 0 ? [{ k: "mine", l: T("My work", "मेरा काम"), n: counts.mine ?? 0 }] : []),
    ...((counts.pool ?? 0) > 0 ? [{ k: "pool", l: T("🆕 To pick", "🆕 लेने को"), n: counts.pool ?? 0 }] : []),
    ...(seeAll ? [{ k: "today", l: T("Today", "आज"), n: attention, hot: (counts.late ?? 0) > 0 }] : []),
    { k: "open", l: T("In work", "चालू"), n: openCount, on: inWork },
    { k: "ready", l: T("Ready", "तैयार"), n: counts.ready ?? 0 },
    ...(money && (counts.pending ?? 0) > 0 ? [{ k: "pending", l: T("Payment due", "पैसे बाकी"), n: counts.pending ?? 0 }] : []),
    { k: "delivered", l: T("Delivered", "दे दिया"), n: counts.delivered ?? 0 },
    { k: "all", l: T("All", "सब"), n: allCount },
  ] as { k: string; l: string; n: number; hot?: boolean; on?: boolean }[];
  const btn = "inline-flex items-center gap-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm";

  return (
    <div className="space-y-4 pb-10">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1">
          <h1 className="text-lg font-bold">🧵 {T("Orders & job cards", "Orders · Silai")}</h1>
          {me && !me.owner && <p className="text-xs text-muted">{T("You are", "आप")}: <b>{me.title}</b></p>}
        </div>
        <WorkspaceSwitch as={ws.as} setAs={ws.setAs} teams={ws.teams} hi={hi} />
        {can(me, "book") && <button type="button" onClick={() => { setCreating(true); setBooked(null); }} className="inline-flex items-center gap-1 rounded-xl grad-brand px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> {T("New order", "नया order")}</button>}
      </div>
      {!(can(me, "assign") || can(me, "staff") || can(me, "setup")) && <Link href="/help/orders" className="inline-block text-xs font-semibold text-brand-ink underline">📖 {T("How to use Orders", "Orders कैसे चलाएँ")}</Link>}
      {(can(me, "assign") || can(me, "staff") || can(me, "setup")) && (
        <div className="flex flex-wrap gap-2">
          {can(me, "staff") && <Link href="/poster/orders/staff" className={btn}><UserCog className="h-4 w-4" /> {T("Staff & logins", "Staff · login")}</Link>}
          {can(me, "assign") && <Link href="/poster/orders/karigars" className={btn}><Users className="h-4 w-4" /> {T("Karigars", "कारीगर")}</Link>}
          {can(me, "setup") && <Link href="/poster/orders/setup" className={btn}><Settings2 className="h-4 w-4" /> {T("Setup & flow", "Setup · Flow")}</Link>}
          <Link href="/help/orders" className={btn}>📖 {T("How it works", "कैसे चलाएँ")}</Link>
        </div>
      )}

      {creating && data && <NewOrder hi={hi} q={ws.q} data={data} onClose={() => setCreating(false)} onSaved={(jobs, shop, told) => { setCreating(false); setBooked({ jobs, shop, told }); void load(); setTimeout(() => void load(), 1500); window.scrollTo({ top: 0, behavior: "smooth" }); }} />}
      {booked && <Booked hi={hi} {...booked} onClose={() => setBooked(null)} />}

      {/* Today at a glance — late in red, first. */}
      {seeAll && !creating && allCount > 0 && (
        <div className="grid grid-cols-3 gap-2 lg:grid-cols-4">
          {[
            { k: "today", l: T("Late", "देर हो गई"), n: counts.late ?? 0, tone: (counts.late ?? 0) > 0 ? "border-danger/40 bg-danger/10 text-danger" : "" },
            { k: "today", l: T("Due today", "आज देना है"), n: counts.today ?? 0, tone: (counts.today ?? 0) > 0 ? "border-amber-300 bg-amber-50 text-amber-900" : "" },
            { k: "ready", l: T("Ready to call", "तैयार — बुलाएँ"), n: counts.ready ?? 0, tone: (counts.ready ?? 0) > 0 ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "" },
            ...(money ? [{ k: "pending", l: T("Payment due", "पैसे बाकी"), n: counts.pending ?? 0, sub: rupees(counts.pendingPaise ?? 0), tone: "" }] : []),
          ].map((c, i) => (
            <button key={i} type="button" onClick={() => setFilter(c.k)} className={`rounded-2xl border px-3 py-2 text-left ${c.tone || "border-border bg-surface"} ${i === 3 ? "hidden lg:block" : ""}`}>
              <span className="block text-xl font-extrabold leading-tight tabular-nums">{c.n}</span>
              <span className="block text-[11px] font-semibold opacity-80">{c.l}{"sub" in c && c.sub && c.n > 0 ? ` · ${c.sub}` : ""}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((f) => <button key={f.k} type="button" onClick={() => setFilter(f.k)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${filter === f.k || f.on ? "border-brand bg-brand text-white font-semibold" : f.hot ? "border-danger/50 bg-danger/10 text-danger font-semibold" : "border-border bg-surface"}`}>{f.l} <span className="opacity-70">{f.n}</span></button>)}
      </div>
      {inWork && steps.length > 0 && (
        <div className="-mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {["open", "received", ...steps].map((k) => <button key={k} type="button" onClick={() => setFilter(k)} className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] ${filter === k ? "border-brand-ink bg-brand-soft font-semibold text-brand-ink" : "border-border bg-surface text-muted"}`}>{k === "open" ? T("All steps", "सब step") : stepLabel(setup, k, hi)} {k === "open" ? openCount : counts[k] ?? 0}</button>)}
        </div>
      )}
      <label className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2"><Search className="h-4 w-4 text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={T("Name, mobile, job number, item…", "नाम, मोबाइल, job नंबर, item…")} className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
      {err && <p className="text-sm font-semibold text-danger">{err}</p>}

      {data && data.jobs.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
          {filter === "mine" ? T("Nothing is with you right now. New work comes here (and as a notification).", "अभी आपके पास कोई काम नहीं। नया काम यहाँ आएगा (और notification भी)।")
            : filter === "today" ? T("Nothing due today and nothing late. 👍", "आज कुछ देना नहीं, कुछ late भी नहीं। 👍")
            : filter === "pending" ? T("No payment is pending.", "कोई पैसा बाकी नहीं।")
            : T("No orders here yet. Tap “New order” when a customer gives a saree or blouse for work.", "अभी कोई order नहीं। ग्राहक साड़ी या blouse काम के लिए दे तो “नया order” दबाएँ।")}
        </div>
      )}
      <ul className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
        {data?.jobs.map((j) => {
          const late = isLate(j), dueToday = isDueToday(j);
          const nx = setup ? nextStep(flowFor(setup, j.item, j.status), j.status) : null;
          const mine = j.assigned_to === me?.userId && nx;
          const pick = !j.assigned_to && setup?.steps.some((x) => x.key === j.status && !x.who) && !me?.owner;
          const bal = balanceOf(j);
          return (
            <li key={j.id} className={`rounded-2xl border bg-surface shadow-card ${late ? "border-danger/40" : "border-border"}`}>
              <Link href={`/poster/orders/${j.id}`} className="flex items-center gap-3 p-3">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-black ${late ? "bg-danger/10 text-danger" : "bg-brand-soft text-brand-ink"}`}>#{j.number}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2"><b className="truncate text-sm">{j.customer_name}</b><StatusBadge status={j.status} hi={hi} setup={setup} /></span>
                  <span className="block truncate text-xs text-muted">{[j.item, j.work].filter(Boolean).join(" · ")}{j.qty > 1 ? ` × ${j.qty}` : ""}{kName(j.karigar_id) ? ` · ${kName(j.karigar_id)}` : ""}{tName(j.assigned_to) ? ` · ${tName(j.assigned_to)}` : ""}{j.photos?.length ? " · 📷" : ""}</span>
                  {j.due_date && <span className={`block text-[11px] ${late ? "font-bold text-danger" : dueToday ? "font-bold text-amber-700" : "text-muted"}`}>{late ? T("Late — was due ", "देर — देना था ") : dueToday ? T("Due today", "आज देना है") : T("Due ", "देना है ")}{dueToday ? "" : fmtDay(j.due_date)}</span>}
                </span>
                {j.amount_paise > 0 && <span className="shrink-0 text-right text-xs"><b>{rupees(j.amount_paise)}</b>{bal > 0 && <span className="block text-[11px] font-semibold text-amber-700">{T("due", "बाकी")} {rupees(bal)}</span>}{bal === 0 && j.status !== "cancelled" && <span className="block text-[11px] text-emerald-700">{T("paid", "पूरा मिला")}</span>}</span>}
                <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
              </Link>
              {pick && (
                <div className="border-t border-border px-3 py-2">
                  <button type="button" disabled={busy === j.id} onClick={() => void done(j, null)} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-brand px-3 py-2 text-xs font-semibold text-brand-ink disabled:opacity-50">{busy === j.id && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}{T("I'll do this", "यह काम मैं करूँगा")}</button>
                </div>
              )}
              {mine && (
                <div className="border-t border-border px-3 py-2">
                  <button type="button" disabled={busy === j.id} onClick={() => void done(j, nx)} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                    {busy === j.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}{T("My work is done — send to", "मेरा काम हो गया — आगे भेजें:")} {stepLabel(setup, nx, hi)}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ================= Booked: the slip to the customer ================= */
function Booked({ hi, jobs, shop, told, onClose }: { hi: boolean; jobs: JobRow[]; shop: string; told: string[]; onClose: () => void }) {
  const T = (en: string, h: string) => (hi ? h : en);
  const phone = jobs[0]?.customer_phone.replace(/\D/g, "") ?? "";
  return (
    <section className="space-y-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4">
      <div className="flex items-start gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-white"><Check className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-emerald-900">{T("Order booked", "Order बुक हो गया")} — {jobs.map((j) => `#${j.number}`).join(", ")}</p>
          <p className="text-xs text-emerald-800">{jobs[0]?.customer_name} · {jobs.map((j) => [j.item, j.work].filter(Boolean).join(" · ")).join(" | ")}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="text-emerald-800"><X className="h-5 w-5" /></button>
      </div>
      {told.length > 0 && <ul className="space-y-0.5 text-xs text-emerald-900">{told.map((t) => <li key={t}>📲 {t}</li>)}</ul>}
      <div className="flex flex-wrap gap-2">
        {phone && <a href={`https://wa.me/${phone}?text=${encodeURIComponent(receiptMessage(jobs, shop))}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white"><MessageCircle className="h-4 w-4" /> {T("Send the slip on WhatsApp", "ग्राहक को slip WhatsApp करें")}</a>}
        <Link href={`/poster/orders/slip?ids=${jobs.map((j) => j.id).join(",")}`} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 py-2.5 text-sm font-semibold"><Printer className="h-4 w-4" /> {T("Print the slip / tag", "Slip / tag print करें")}</Link>
        {jobs.map((j) => <Link key={j.id} href={`/poster/orders/${j.id}`} className="inline-flex items-center gap-1 rounded-xl border border-emerald-300 bg-white px-3 py-2.5 text-sm font-semibold">{T("Job card", "Job card")} #{j.number}<ChevronRight className="h-4 w-4" /></Link>)}
      </div>
    </section>
  );
}

/* ================= New order ================= */
// The flow (owner, 30 Oct 2026): customer → item → (the item's measurement opens by itself) → work, charge → delivery & advance.
// Every part folds away. A returning customer's last measurement of that item comes up ready: use it, change it, or take new.
type Mode = "saved" | "new" | "skip";
type Item = {
  key: number; open: boolean; item: string; work: string; details: string; amount: string; qty: string; karigar_id: string; assigned_to: string;
  mOpen: boolean; mode: Mode; savedId: string; draft: MeasureDraft; fromId: string; autoWork: boolean; photos: string[];
};
let seq = 0;
const blank = (unit: "inch" | "cm"): Item => ({ key: ++seq, open: true, item: "", work: "", details: "", amount: "", qty: "1", karigar_id: "", assigned_to: "", mOpen: false, mode: "skip", savedId: "", draft: blankDraft(unit), fromId: "", autoWork: true, photos: [] });
const sameItem = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function NewOrder({ hi, q, data, onClose, onSaved }: { hi: boolean; q: string; data: ListAnswer; onClose: () => void; onSaved: (jobs: JobRow[], shop: string, told: string[]) => void }) {
  const T = (en: string, h: string) => (hi ? h : en);
  const setup = useJobSetup(q, data.setup);
  const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  // The date starts at the shop's usual delivery time (Setup); picking an item with its own days moves it, until it is set by hand.
  const [due, setDue] = useState(() => (data.setup?.dueDays ? isoPlus(data.setup.dueDays) : ""));
  const [dueByHand, setDueByHand] = useState(false);
  const [advance, setAdvance] = useState("");
  const [items, setItems] = useState<Item[]>(() => [blank(data.setup?.unit ?? "inch")]);
  const [past, setPast] = useState<Measurement[]>([]);
  const [customer, setCustomer] = useState<Customer>(null);
  const [looking, setLooking] = useState(false);
  const [open, setOpen] = useState({ customer: true, money: true });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const assign = can(data.me, "assign"), money = can(data.me, "money"), measure = can(data.me, "measure");
  const ten = phone.replace(/\D/g, "").slice(-10);
  const phoneBad = phone.trim() !== "" && !cleanPhone(phone);

  // A returning customer (owner, 1 Nov 2026: mobile first): the name, the last orders and the saved measurements come up as soon as the number is typed.
  useEffect(() => {
    if (ten.length !== 10) { setPast([]); setCustomer(null); return; }
    let off = false;
    setLooking(true);
    (async () => {
      const p = new URLSearchParams(q); p.set("phone", ten);
      const r = await api<{ measurements: Measurement[]; customer?: Customer }>(`/api/jobs/measurements?${p}`, { fresh: true });
      if (off) return;
      setLooking(false);
      if (!r.ok) return;
      const ms = r.data.measurements;
      setPast(ms); setCustomer(r.data.customer ?? null);
      const known = r.data.customer?.name || ms[0]?.customer_name;
      if (!name.trim() && known) setName(known);
      // Items already picked whose measurement is still empty: use the saved one.
      setItems((xs) => xs.map((x) => {
        const m = ms.find((y) => sameItem(y.garment, x.item));
        return m && x.mode !== "saved" && !draftFilled(x.draft) ? { ...x, mode: "saved", savedId: m.id } : x;
      }));
    })();
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ten, q]);

  const pastOf = (item: string) => past.filter((m) => sameItem(m.garment, item));
  const set = (k: number, patch: Partial<Item>) => setItems((xs) => xs.map((x) => (x.key === k ? { ...x, ...patch } : x)));
  /** Picking the item opens its measurement: the saved one when there is one, else a fresh form (none for e.g. Saree fall-pico). */
  function pickItem(it: Item, item: string) {
    const has = item && fieldsFor(setup.setup, item).length > 0;
    const saved = item ? pastOf(item)[0] : undefined;
    // The usual work of the item comes with it (unless a work was picked by hand).
    const work = !it.work || it.autoWork ? workFor(setup.setup, item) : it.work;
    set(it.key, { item, work, autoWork: !it.work || it.autoWork, mOpen: !!has && measure, mode: saved ? "saved" : has && measure ? "new" : "skip", savedId: saved?.id ?? "", draft: blankDraft(setup.setup.unit), fromId: "" });
    // The item's usual delivery time (the longest one among the items wins), unless the date was set by hand.
    const d = item ? daysFor(setup.setup, item) : 0;
    if (d && !dueByHand && (!due || isoPlus(d) > due)) setDue(isoPlus(d));
  }

  const total = items.reduce((a, x) => a + toPaise(x.amount), 0);
  const adv = toPaise(advance);
  /** Check what is needed, then show everything once more before it is booked. */
  function review() {
    setErr("");
    if (!name.trim()) { setOpen((o) => ({ ...o, customer: true })); setErr(T("Write the customer's name.", "ग्राहक का नाम लिखें।")); return; }
    if (phoneBad) { setOpen((o) => ({ ...o, customer: true })); setErr(T("The mobile number does not look right (10 digits).", "मोबाइल नंबर सही नहीं लग रहा (10 अंक)।")); return; }
    const empty = items.find((x) => !x.item.trim() && !x.work.trim());
    if (empty) { set(empty.key, { open: true }); setErr(T("Pick the item (or remove the empty one).", "Item चुनें (या खाली वाला हटा दें)।")); return; }
    setReviewing(true);
  }
  async function save() {
    setErr(""); setBusy(true);
    const r = await api<{ jobs?: JobRow[]; shop?: string; told?: string[]; error?: string }>("/api/jobs", { method: "POST", json: {
      as: new URLSearchParams(q).get("as") || undefined, customer_name: name, customer_phone: phone, due_date: due || undefined, advance,
      items: items.map((x) => ({
        item: x.item, work: x.work, details: x.details, amount: x.amount, qty: x.qty,
        karigar_id: x.karigar_id || undefined, assigned_to: x.assigned_to || undefined,
        measurement_id: x.mode === "saved" ? x.savedId || undefined : undefined,
        measure: x.mode === "new" && draftFilled(x.draft) ? x.draft : undefined,
        photos: x.photos,
      })),
    } });
    setBusy(false);
    if (!r.ok || !r.data.jobs) { setReviewing(false); setErr(r.data.error || T("Could not save.", "सेव नहीं हुआ।")); return; }
    onSaved(r.data.jobs, r.data.shop ?? "", r.data.told ?? []);
  }

  const field = "w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-brand";
  const label = "text-[11px] font-semibold text-muted";
  const icon = (I: typeof Shirt) => <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-ink"><I className="h-4 w-4" /></span>;
  return (
    <div className="space-y-3 rounded-3xl border border-brand/30 bg-brand-soft/20 p-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-base font-bold">{T("New order", "नया order")}</h2>
        <button type="button" onClick={() => { if ((!name && items.every((x) => !x.item)) || confirm(T("Close without saving?", "बिना सेव किए बंद करें?"))) onClose(); }} aria-label="Close" className="text-muted"><X className="h-5 w-5" /></button>
      </div>

      {/* 1 · Customer */}
      <Fold hi={hi} icon={icon(UserRound)} title={T("1 · Customer", "1 · ग्राहक")} open={open.customer} onToggle={() => setOpen({ ...open, customer: !open.customer })}
        summary={[name, ten.length === 10 ? ten : ""].filter(Boolean).join(" · ") || T("Name and mobile", "नाम और मोबाइल")}>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={label}>{T("Mobile", "मोबाइल")}
            <span className="relative block"><input autoFocus className={`${field} ${phoneBad ? "border-danger" : ""}`} inputMode="numeric" autoComplete="off" placeholder="98xxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />{looking && <LoaderCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted" />}</span>
          </label>
          <label className={label}>{T("Name", "नाम")}<input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder={ten.length === 10 && !customer && !looking ? T("New customer — write the name", "नया ग्राहक — नाम लिखें") : ""} /></label>
        </div>
        {customer ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            <b>✓ {T("Returning customer", "पुराना ग्राहक")}</b> · {customer.orders} {T(customer.orders === 1 ? "order" : "orders", "order")} · {T("last", "पिछला")}: {customer.last} ({fmtDay(customer.lastAt.slice(0, 10))})
            {customer.pendingPaise > 0 && <span className="block font-semibold text-amber-800">⚠ {T("Old balance due", "पुराना बाकी")}: {rupees(customer.pendingPaise)}</span>}
            {past.length > 0 && <span className="block">📏 {T("Saved measurements", "Saved नाप")}: {[...new Set(past.map((m) => m.garment))].join(", ")} — {T("they come up by themselves on the item.", "item चुनते ही अपने-आप आ जाएँगे।")}</span>}
          </p>
        ) : past.length > 0 ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">✓ {T("Saved measurements", "Saved नाप")}: {[...new Set(past.map((m) => m.garment))].join(", ")}</p>
        : <p className="text-[11px] text-muted">{T("The mobile brings up the name, the old orders and the saved measurements. The slip and the ready message go to it.", "मोबाइल से नाम, पुराने order और saved नाप अपने-आप आ जाते हैं। Slip और ready message इसी पर जाता है।")}</p>}
      </Fold>

      {/* 2 · Items, each with its measurement */}
      {items.map((it, n) => {
        const fields = fieldsFor(setup.setup, it.item);
        const ps = it.item ? pastOf(it.item) : [];
        const saved = ps.find((m) => m.id === it.savedId) ?? null;
        const twin = items.slice(0, n).find((x) => it.item && sameItem(x.item, it.item) && x.mode === "new" && draftFilled(x.draft));
        const mSummary = it.mode === "saved" && saved ? `${T("Saved", "पिछला नाप")} · ${new Date(saved.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
          : it.mode === "new" ? (draftFilled(it.draft) ? `${Object.values(it.draft.values).filter((v) => v.trim()).length} ${T("filled", "नाप भरे")}` : T("Not filled yet", "अभी भरा नहीं"))
          : T("No measurement", "नाप नहीं");
        const seg = (m: Mode, txt: string, patch: Partial<Item> = {}) => (
          <button type="button" onClick={() => set(it.key, { mode: m, ...patch })} className={`rounded-lg px-3 py-1.5 text-xs ${it.mode === m && !patch.draft && !(m === "new" && it.fromId) ? "bg-brand font-semibold text-white" : "border border-border bg-surface"}`}>{txt}</button>
        );
        return (
          <Fold key={it.key} hi={hi} icon={icon(Shirt)} open={it.open} onToggle={() => set(it.key, { open: !it.open })}
            title={<>{T(`${n + 2} · Item`, `${n + 2} · Item`)}{items.length > 1 ? ` ${n + 1}` : ""}{it.item ? <span className="font-normal text-muted"> — {it.item}</span> : null}</>}
            summary={[it.item, it.work, it.amount ? `₹${it.amount}` : "", it.item && (fields.length || it.mode !== "skip") ? `📏 ${mSummary}` : "", it.photos.length ? `📷 ${it.photos.length}` : ""].filter(Boolean).join(" · ") || T("Pick the item", "Item चुनें")}
            right={items.length > 1 ? <button type="button" onClick={() => setItems(items.filter((x) => x.key !== it.key))} aria-label="Remove" className="text-muted"><Trash2 className="h-4 w-4" /></button> : null}>
            <div className="space-y-1.5"><p className={label}>{T("What is it?", "क्या है?")}</p>
              <PickChips hi={hi} options={setup.setup.items.map((x) => x.name)} value={it.item} onPick={(v) => pickItem(it, v)} onAdd={setup.canEdit ? setup.addItem : undefined} newLabel={T("Item name", "Item का नाम")} />
            </div>

            {/* The measurement of this item */}
            {!measure ? null : it.item && (fields.length > 0 || it.mode !== "skip" || ps.length > 0) ? (
              <Fold hi={hi} tone="inner" icon={<Ruler className="h-4 w-4 text-brand" />} title={`${T("Measurement", "नाप")} — ${it.item}`} summary={mSummary} open={it.mOpen} onToggle={() => set(it.key, { mOpen: !it.mOpen })}>
                <div className="flex flex-wrap gap-1.5">
                  {ps.length > 0 && seg("saved", T("Same as last time", "पिछला नाप वही"), { savedId: it.savedId || ps[0].id })}
                  {ps.length > 0 && <button type="button" onClick={() => set(it.key, { mode: "new", draft: draftFrom(saved ?? ps[0]), fromId: (saved ?? ps[0]).id })} className={`rounded-lg px-3 py-1.5 text-xs ${it.mode === "new" && it.fromId ? "bg-brand font-semibold text-white" : "border border-border bg-surface"}`}>{T("Change the last one", "पिछला बदलकर")}</button>}
                  {seg("new", ps.length ? T("New measurement", "नया नाप") : T("Take measurement", "नाप लें"), it.mode === "new" && !it.fromId ? {} : { draft: blankDraft(setup.setup.unit), fromId: "" })}
                  {twin && <button type="button" onClick={() => set(it.key, { mode: "new", draft: { ...twin.draft }, fromId: "" })} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs">{T("Same as above", "ऊपर वाले जैसा")}</button>}
                  {seg("skip", T("Later", "बाद में"))}
                </div>
                {it.mode === "saved" && ps.length > 0 && (
                  <>
                    {ps.length > 1 && <select className={field} value={it.savedId} onChange={(e) => set(it.key, { savedId: e.target.value })}>{ps.map((m) => <option key={m.id} value={m.id}>{new Date(m.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}{m.customer_name && m.customer_name !== name ? ` · ${m.customer_name}` : ""}{m.taken_by_name ? ` · ${m.taken_by_name}` : ""}</option>)}</select>}
                    {saved && <MeasurementView m={saved} hi={hi} onEdit={() => set(it.key, { mode: "new", draft: draftFrom(saved), fromId: saved.id })} />}
                  </>
                )}
                {it.mode === "new" && it.fromId && <p className="text-[11px] text-muted">{T("Change only what is different — the old measurement stays in history.", "जो बदला है सिर्फ़ वही बदलें — पुराना नाप history में रहेगा।")}</p>}
                {it.mode === "new" && <MeasureEditor hi={hi} item={it.item} draft={it.draft} onChange={(d) => set(it.key, { draft: d })} setup={setup} />}
                {it.mode === "skip" && <p className="text-xs text-muted">{T("No measurement now — it can be added on the job card later.", "अभी नाप नहीं — बाद में job card पर जोड़ सकते हैं।")}</p>}
              </Fold>
            ) : it.item ? (
              <button type="button" onClick={() => set(it.key, { mode: "new", mOpen: true })} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-ink"><Ruler className="h-3.5 w-3.5" /> {T("Add a measurement", "नाप जोड़ें")}</button>
            ) : null}

            <div className="space-y-1.5"><p className={label}>{T("What work?", "क्या काम?")}</p>
              <PickChips hi={hi} options={setup.setup.works} value={it.work} onPick={(v) => set(it.key, { work: v, autoWork: false })} onAdd={setup.canEdit ? setup.addWork : undefined} newLabel={T("Work", "काम")} />
            </div>
            <div className="space-y-1.5"><p className={label}>{T("Photo of the cloth / design (optional)", "कपड़े / design की photo (optional)")}</p>
              <JobPhotos hi={hi} photos={it.photos} onChange={(photos) => set(it.key, { photos })} small />
            </div>
            <textarea className={field} rows={2} placeholder={T("Details — colour, design, lining…", "Detail — रंग, design, lining…")} value={it.details} onChange={(e) => set(it.key, { details: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              {money && <label className={label}>{T("Charge ₹", "Charge ₹")}<input className={field} inputMode="decimal" value={it.amount} onChange={(e) => set(it.key, { amount: e.target.value })} /></label>}
              <label className={label}>{T("Pieces", "Pieces")}<input className={field} inputMode="numeric" value={it.qty} onChange={(e) => set(it.key, { qty: e.target.value })} /></label>
              {assign && (
                <label className={label}>{T("Karigar", "कारीगर")}
                  <select className={field} value={it.karigar_id} onChange={(e) => set(it.key, { karigar_id: e.target.value })}>
                    <option value="">{T("Later", "बाद में")}</option>
                    {data.karigars.filter((k) => k.active).map((k) => <option key={k.id} value={k.id}>{k.name}{k.skill ? ` · ${k.skill}` : ""}</option>)}
                  </select>
                </label>
              )}
              {assign && data.team.length > 0 && (
                <label className={label}>{T("Tailor in the app", "App वाला tailor")}
                  <select className={field} value={it.assigned_to} onChange={(e) => set(it.key, { assigned_to: e.target.value })}>
                    <option value="">{T("Later", "बाद में")}</option>
                    {data.team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </label>
              )}
            </div>
            {it.item && <button type="button" onClick={() => set(it.key, { open: false })} className="w-full rounded-xl border border-border bg-bg py-2 text-xs font-semibold text-muted">{T("Done with this item", "यह item हो गया")} ✓</button>}
          </Fold>
        );
      })}
      <button type="button" onClick={() => setItems([...items.map((x) => (x.item ? { ...x, open: false } : x)), blank(setup.setup.unit)])} className="inline-flex w-full items-center justify-center gap-1 rounded-2xl border border-dashed border-brand bg-surface py-3 text-sm font-semibold text-brand-ink"><Plus className="h-4 w-4" /> {T("Another item (same customer)", "एक और item (इसी ग्राहक का)")}</button>

      {/* Delivery and money */}
      <Fold hi={hi} icon={icon(CalendarDays)} title={T(`${items.length + 2} · Delivery & payment`, `${items.length + 2} · Delivery और पैसे`)} open={open.money} onToggle={() => setOpen({ ...open, money: !open.money })}
        summary={[due ? fmtDay(due) : "", total ? `${T("Total", "कुल")} ${rupees(total)}` : "", adv ? `${T("Advance", "Advance")} ${rupees(adv)}` : ""].filter(Boolean).join(" · ") || T("Date and advance", "तारीख और advance")}>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={label}>{T("Delivery date", "देने की तारीख")}
            <input type="date" className={field} value={due} min={isoPlus(0)} onChange={(e) => { setDue(e.target.value); setDueByHand(true); }} />
            <span className="mt-1.5 flex flex-wrap gap-1.5">{[...new Set([2, 3, 5, 7, 10, 15, setup.setup.dueDays || 0].filter(Boolean))].sort((a, b) => a - b).map((d) => <button key={d} type="button" onClick={() => { setDue(isoPlus(d)); setDueByHand(true); }} className={`rounded-full border px-2.5 py-1 text-[11px] ${due === isoPlus(d) ? "border-brand bg-brand-soft font-semibold text-brand-ink" : "border-border bg-surface"}`}>{d} {T("days", "दिन")}</button>)}</span>
            {due && !dueByHand && <span className="mt-1 block text-[11px] text-muted">{T("Your usual time (Setup) — change if needed.", "आपका आम समय (Setup) — ज़रूरत हो तो बदलें।")}</span>}
          </label>
          {money && <label className={label}>{T("Advance received ₹", "Advance मिला ₹")}<input inputMode="decimal" className={field} value={advance} onChange={(e) => setAdvance(e.target.value)} /></label>}
        </div>
        {total > 0 && (
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-bg p-3 text-center text-sm">
            <p><span className="block text-[11px] text-muted">{T("Total", "कुल")}</span><b>{rupees(total)}</b></p>
            <p><span className="block text-[11px] text-muted">{T("Advance", "Advance")}</span><b>{rupees(adv)}</b></p>
            <p><span className="block text-[11px] text-muted">{T("Balance", "बाकी")}</span><b className="text-amber-700">{rupees(Math.max(0, total - adv))}</b></p>
          </div>
        )}
        {adv > total && total > 0 && <p className="text-xs font-semibold text-amber-700">{T("The advance is more than the total.", "Advance कुल से ज़्यादा है।")}</p>}
      </Fold>

      {err && <p className="px-1 text-sm font-semibold text-danger">{err}</p>}
      <button type="button" onClick={review} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl grad-brand px-4 py-3.5 text-sm font-bold text-white shadow-card disabled:opacity-50">
        <Check className="h-4 w-4" />{T("Check & book the order", "देखें और order बुक करें")}{items.length > 1 ? ` (${items.length} items)` : ""}
      </button>

      {/* The review: everything once more — Edit / Cancel / Save. */}
      {reviewing && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-surface shadow-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-base font-bold">{T("Check the order", "Order एक बार देख लें")}</p>
              <button type="button" onClick={() => setReviewing(false)} aria-label="Close" className="text-muted"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
              <div className="flex items-center justify-between rounded-xl bg-bg p-3">
                <span><b className="block">{name}</b><span className="text-xs text-muted">{ten.length === 10 ? `+91 ${ten}` : T("No mobile — no WhatsApp updates", "मोबाइल नहीं — WhatsApp update नहीं जाएगा")}</span></span>
                <span className="text-right text-xs text-muted">{T("Delivery", "देना है")}<b className="block text-sm text-ink">{fmtDay(due, true)}</b></span>
              </div>
              {items.map((x, n) => {
                const ps = pastOf(x.item); const sv = ps.find((m) => m.id === x.savedId);
                const vals = x.mode === "new" ? Object.entries(x.draft.values).filter(([, v]) => v.trim()) : x.mode === "saved" && sv ? Object.entries(sv.values) : [];
                const flow = flowFor(setup.setup, x.item).slice(1, -2);
                return (
                  <div key={x.key} className="space-y-2 rounded-xl border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold">{items.length > 1 ? `${n + 1}. ` : ""}{[x.item, x.work].filter(Boolean).join(" · ")}{Number(x.qty) > 1 ? ` × ${x.qty}` : ""}</p>
                      {money && x.amount && <b>₹{x.amount}</b>}
                    </div>
                    {x.details && <p className="text-xs text-muted">{x.details}</p>}
                    {x.photos.length > 0 && <JobPhotos hi={hi} photos={x.photos} small />}
                    <p className="text-xs"><Ruler className="mr-1 inline h-3.5 w-3.5 text-brand" />{x.mode === "skip" ? T("No measurement now", "अभी नाप नहीं") : x.mode === "saved" ? T("Last measurement", "पिछला नाप") : x.fromId ? T("Changed measurement", "बदला हुआ नाप") : T("New measurement", "नया नाप")}{x.draft.person && x.mode === "new" ? ` · ${x.draft.person}` : ""}</p>
                    {vals.length > 0 && <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 rounded-lg bg-bg p-2 text-xs">{vals.map(([k, v]) => <span key={k} className="flex justify-between gap-1"><span className="truncate text-muted">{k}</span><b>{v}</b></span>)}</div>}
                    {x.mode === "new" && x.draft.notes && <p className="text-xs text-muted">📝 {x.draft.notes}</p>}
                    {flow.length > 0 && <p className="text-[11px] text-muted">{T("Goes", "जाएगा")}: {flow.map((k) => stepLabel(setup.setup, k, hi)).join(" → ")} → {stepLabel(setup.setup, "ready", hi)}</p>}
                    {(x.karigar_id || x.assigned_to) && <p className="text-[11px] text-muted">{T("Given to", "किसे")}: {[data.karigars.find((k) => k.id === x.karigar_id)?.name, data.team.find((m) => m.id === x.assigned_to)?.name].filter(Boolean).join(" · ")}</p>}
                  </div>
                );
              })}
              {money && total > 0 && (
                <div className="grid grid-cols-3 gap-2 rounded-xl bg-bg p-3 text-center">
                  <p><span className="block text-[11px] text-muted">{T("Total", "कुल")}</span><b>{rupees(total)}</b></p>
                  <p><span className="block text-[11px] text-muted">{T("Advance", "Advance")}</span><b>{rupees(adv)}</b></p>
                  <p><span className="block text-[11px] text-muted">{T("Balance", "बाकी")}</span><b className="text-amber-700">{rupees(Math.max(0, total - adv))}</b></p>
                </div>
              )}
              {setup.setup.autoStart && <p className="text-[11px] text-muted">📲 {T("After saving, the first step's person gets the work in the app / on WhatsApp.", "Save होते ही पहले step वाले को app / WhatsApp पर काम पहुँच जाएगा।")}</p>}
              {err && <p className="text-sm font-semibold text-danger">{err}</p>}
            </div>
            <div className="grid grid-cols-3 gap-2 border-t border-border p-3">
              <button type="button" onClick={() => { if (confirm(T("Cancel this order? Nothing will be saved.", "यह order रद्द करें? कुछ सेव नहीं होगा।"))) onClose(); }} className="rounded-xl border border-border px-2 py-3 text-sm font-semibold text-danger">{T("Cancel", "रद्द करें")}</button>
              <button type="button" onClick={() => setReviewing(false)} className="inline-flex items-center justify-center gap-1 rounded-xl border border-border px-2 py-3 text-sm font-semibold"><Pencil className="h-4 w-4" />{T("Edit", "बदलें")}</button>
              <button type="button" onClick={() => void save()} disabled={busy} className="inline-flex items-center justify-center gap-1 rounded-xl grad-brand px-2 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{T("Save", "पक्का करें")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
