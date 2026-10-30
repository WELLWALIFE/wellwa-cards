"use client";
// Orders & job cards (owner, 30 Oct 2026 — a saree showroom: fall-pico, blouse stitching, alterations by karigars and
// tailors; every garment's status at a glance). The list ("My work" for staff), the filters and "New order".
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, ChevronRight, LoaderCircle, MessageCircle, Pencil, Plus, Ruler, Search, Settings2, Shirt, Trash2, UserCog, UserRound, Users, X } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { can, cleanPhone, fieldsFor, flowFor, nextStep, receiptMessage, rupees, stepLabel, toPaise, workFor, type JobRow, type JobSetup, type Karigar, type Measurement } from "@/lib/jobs";
import { Fold, MeasureEditor, MeasurementView, PickChips, StatusBadge, WorkspaceSwitch, blankDraft, draftFilled, draftFrom, useJobSetup, useWorkspace, type MeasureDraft, type Me, type Member } from "@/components/orders/orders-common";

type ListAnswer = { jobs: JobRow[]; role: "owner" | "manager" | "agent"; me: Me; karigars: Karigar[]; team: Member[]; counts: Record<string, number>; setup: JobSetup; error?: string };
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

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
    else if (filter && filter !== "all") p.set("status", filter);
    else if (!filter) p.set("status", "open");
    if (q.trim()) p.set("q", q.trim());
    const r = await api<ListAnswer>(`/api/jobs?${p}`, { fresh: true });
    if (!r.ok) { setErr(r.data?.error || T("Could not load. Please try again.", "Load नहीं हुआ। फिर try करें।")); return; }
    setErr(""); setData(r.data);
    if (!filter) setFilter(can(r.data.me, "all_jobs") ? "open" : "mine");
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
  const openCount = Object.entries(counts).filter(([s]) => !["delivered", "cancelled", "mine", "pool"].includes(s)).reduce((a, [, n]) => a + n, 0);
  const kName = (id: string | null) => data?.karigars.find((k) => k.id === id)?.name ?? "";
  const tName = (id: string | null) => data?.team.find((m) => m.id === id)?.name ?? "";
  const filters = [
    { k: "mine", l: T("My work", "मेरा काम"), n: counts.mine ?? 0 },
    ...((counts.pool ?? 0) > 0 ? [{ k: "pool", l: T("🆕 New work to pick", "🆕 नया काम — लें"), n: counts.pool ?? 0 }] : []),
    { k: "open", l: T("In work", "चालू"), n: openCount },
    ...["received", ...(setup?.steps.map((x) => x.key) ?? []), "ready", "delivered"].map((k) => ({ k, l: stepLabel(setup, k, hi), n: counts[k] ?? 0 })),
    { k: "all", l: T("All", "सब"), n: Object.entries(counts).filter(([s]) => s !== "mine" && s !== "pool").reduce((a, [, n]) => a + n, 0) },
  ].filter((f) => f.k !== "mine" || data?.role !== "owner" || (counts.mine ?? 0) > 0);
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

      {creating && data && <NewOrder hi={hi} q={ws.q} data={data} onClose={() => setCreating(false)} onSaved={(jobs, shop, told) => { setCreating(false); setBooked({ jobs, shop, told }); void load(); window.scrollTo({ top: 0, behavior: "smooth" }); }} />}
      {booked && <Booked hi={hi} {...booked} onClose={() => setBooked(null)} />}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((f) => <button key={f.k} type="button" onClick={() => setFilter(f.k)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${filter === f.k ? "border-brand bg-brand text-white font-semibold" : "border-border bg-surface"}`}>{f.l} <span className="opacity-70">{f.n}</span></button>)}
      </div>
      <label className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2"><Search className="h-4 w-4 text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={T("Name, mobile, job number, item…", "नाम, मोबाइल, job नंबर, item…")} className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
      {err && <p className="text-sm font-semibold text-danger">{err}</p>}

      {data && data.jobs.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
          {filter === "mine" ? T("Nothing is with you right now. New work comes here (and as a notification).", "अभी आपके पास कोई काम नहीं। नया काम यहाँ आएगा (और notification भी)।")
            : T("No orders here yet. Tap “New order” when a customer gives a saree or blouse for work.", "अभी कोई order नहीं। ग्राहक साड़ी या blouse काम के लिए दे तो “नया order” दबाएँ।")}
        </div>
      )}
      <ul className="space-y-2">
        {data?.jobs.map((j) => {
          const late = j.due_date && j.due_date < today() && !["ready", "delivered", "cancelled"].includes(j.status);
          const nx = setup ? nextStep(flowFor(setup, j.item, j.status), j.status) : null;
          const mine = j.assigned_to === me?.userId && nx;
          const pick = !j.assigned_to && setup?.steps.some((x) => x.key === j.status && !x.who) && !me?.owner;
          return (
            <li key={j.id} className="rounded-2xl border border-border bg-surface shadow-card">
              <Link href={`/poster/orders/${j.id}`} className="flex items-center gap-3 p-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-sm font-black text-brand-ink">#{j.number}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2"><b className="truncate text-sm">{j.customer_name}</b><StatusBadge status={j.status} hi={hi} setup={setup} /></span>
                  <span className="block truncate text-xs text-muted">{[j.item, j.work].filter(Boolean).join(" · ")}{j.qty > 1 ? ` × ${j.qty}` : ""}{kName(j.karigar_id) ? ` · ${kName(j.karigar_id)}` : ""}{tName(j.assigned_to) ? ` · ${tName(j.assigned_to)}` : ""}</span>
                  {j.due_date && <span className={`block text-[11px] ${late ? "font-bold text-danger" : "text-muted"}`}>{late ? T("Late — due ", "देर — देना था ") : T("Due ", "देना है ")}{new Date(`${j.due_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
                </span>
                {j.amount_paise > 0 && <span className="shrink-0 text-right text-xs"><b>{rupees(j.amount_paise)}</b>{j.amount_paise > j.advance_paise && <span className="block text-[11px] text-amber-700">{T("due", "बाकी")} {rupees(j.amount_paise - j.advance_paise)}</span>}</span>}
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
  mOpen: boolean; mode: Mode; savedId: string; draft: MeasureDraft; fromId: string; autoWork: boolean;
};
let seq = 0;
const blank = (unit: "inch" | "cm"): Item => ({ key: ++seq, open: true, item: "", work: "", details: "", amount: "", qty: "1", karigar_id: "", assigned_to: "", mOpen: false, mode: "skip", savedId: "", draft: blankDraft(unit), fromId: "", autoWork: true });
const sameItem = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const isoPlus = (days: number) => { const d = new Date(Date.now() + days * 86400_000); return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); };

function NewOrder({ hi, q, data, onClose, onSaved }: { hi: boolean; q: string; data: ListAnswer; onClose: () => void; onSaved: (jobs: JobRow[], shop: string, told: string[]) => void }) {
  const T = (en: string, h: string) => (hi ? h : en);
  const setup = useJobSetup(q, data.setup);
  const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [due, setDue] = useState(""); const [advance, setAdvance] = useState("");
  const [items, setItems] = useState<Item[]>(() => [blank(data.setup?.unit ?? "inch")]);
  const [past, setPast] = useState<Measurement[]>([]);
  const [open, setOpen] = useState({ customer: true, money: true });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const assign = can(data.me, "assign"), money = can(data.me, "money"), measure = can(data.me, "measure");
  const ten = phone.replace(/\D/g, "").slice(-10);
  const phoneBad = phone.trim() !== "" && !cleanPhone(phone);

  // A returning customer: their saved measurements come up as soon as the number is typed.
  useEffect(() => {
    if (ten.length !== 10) { setPast([]); return; }
    let off = false;
    (async () => {
      const p = new URLSearchParams(q); p.set("phone", ten);
      const r = await api<{ measurements: Measurement[] }>(`/api/jobs/measurements?${p}`, { fresh: true });
      if (off || !r.ok) return;
      const ms = r.data.measurements;
      setPast(ms);
      if (!name.trim() && ms[0]?.customer_name) setName(ms[0].customer_name);
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
          <label className={label}>{T("Name", "नाम")}<input className={field} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className={label}>{T("Mobile — for the slip and the ready message", "मोबाइल — slip और ready message के लिए")}<input className={`${field} ${phoneBad ? "border-danger" : ""}`} inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        </div>
        {past.length > 0 && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">✓ {T("Returning customer", "पुराना ग्राहक")} — {T("saved measurements:", "saved नाप:")} {[...new Set(past.map((m) => m.garment))].join(", ")}</p>}
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
            summary={[it.item, it.work, it.amount ? `₹${it.amount}` : "", it.item && (fields.length || it.mode !== "skip") ? `📏 ${mSummary}` : ""].filter(Boolean).join(" · ") || T("Pick the item", "Item चुनें")}
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
            <textarea className={field} rows={2} placeholder={T("Details — colour, design, lining, photo reference…", "Detail — रंग, design, lining, photo reference…")} value={it.details} onChange={(e) => set(it.key, { details: e.target.value })} />
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
        summary={[due ? new Date(`${due}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "", total ? `${T("Total", "कुल")} ${rupees(total)}` : "", adv ? `${T("Advance", "Advance")} ${rupees(adv)}` : ""].filter(Boolean).join(" · ") || T("Date and advance", "तारीख और advance")}>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={label}>{T("Delivery date", "देने की तारीख")}
            <input type="date" className={field} value={due} min={isoPlus(0)} onChange={(e) => setDue(e.target.value)} />
            <span className="mt-1.5 flex flex-wrap gap-1.5">{[2, 3, 5, 7, 10, 15].map((d) => <button key={d} type="button" onClick={() => setDue(isoPlus(d))} className={`rounded-full border px-2.5 py-1 text-[11px] ${due === isoPlus(d) ? "border-brand bg-brand-soft font-semibold text-brand-ink" : "border-border bg-surface"}`}>{d} {T("days", "दिन")}</button>)}</span>
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
                <span className="text-right text-xs text-muted">{T("Delivery", "देना है")}<b className="block text-sm text-ink">{due ? new Date(`${due}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}</b></span>
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
