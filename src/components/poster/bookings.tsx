"use client";
// The owner's bookings (owner's call, 8 Oct 2026): what the AI salesman booked on the website and WhatsApp, plus
// anything the owner adds by hand — grouped by day, with Done / Cancel, a one-tap WhatsApp reminder and a small form.
// Reminders go out by themselves (/api/cron/booking-reminders); this is where the owner sees and changes them.
import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, Check, LoaderCircle, MessageCircle, Phone, Trash2, X } from "lucide-react";
import { api } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { customerReminder, fmtWhen, relDay, tapLink, type Booking } from "@/lib/bookings";

type Form = { name: string; phone: string; service: string; date: string; time: string; note: string };
const todayIST = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const blank = (): Form => ({ name: "", phone: "", service: "", date: todayIST(), time: "11:00", note: "" });
const istDay = (iso: string) => new Date(new Date(iso).getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);

export function Bookings({ business }: { business?: string }) {
  const { lang } = useT();
  const hi = lang === "hi";
  const T = (h: string, e: string) => (hi ? h : e);
  const [list, setList] = useState<Booking[] | null>(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Form>(blank);
  const [busy, setBusy] = useState("");
  const [now, setNow] = useState(0);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);

  const load = useCallback(async () => {
    const r = await api<{ bookings?: Booking[]; error?: string }>("/api/bookings");
    if (!r.ok) { setErr(r.data.error || T("लोड नहीं हुआ।", "Could not load.")); setList([]); return; }
    setErr(""); setList(r.data.bookings ?? []);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (!form.name.trim()) { setErr(T("ग्राहक का नाम लिखें।", "Enter the customer's name.")); return; }
    setBusy("save");
    const r = await api<{ booking?: Booking; error?: string }>("/api/bookings", { method: "POST", json: { name: form.name, phone: form.phone, service: form.service, at: `${form.date}T${form.time}`, note: form.note } });
    setBusy("");
    if (!r.ok) { setErr(r.data.error || T("सेव नहीं हुआ।", "Could not save.")); return; }
    setErr(""); setAdding(false); setForm(blank()); void load();
  }
  async function setStatus(b: Booking, status: Booking["status"]) {
    setBusy(b.id);
    await api("/api/bookings", { method: "PATCH", json: { id: b.id, status } });
    setBusy(""); void load();
  }
  async function remove(b: Booking) {
    if (!confirm(T("यह बुकिंग हटा दें?", "Delete this booking?"))) return;
    setBusy(b.id);
    await api(`/api/bookings?id=${b.id}`, { method: "DELETE" });
    setBusy(""); void load();
  }

  const upcoming = (list ?? []).filter((b) => (!now || new Date(b.starts_at).getTime() >= now - 3600_000) && b.status === "booked");
  const rest = (list ?? []).filter((b) => !upcoming.includes(b)).sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const groups: { day: string; label: string; items: Booking[] }[] = [];
  for (const b of upcoming) {
    const day = istDay(b.starts_at);
    const g = groups.find((x) => x.day === day);
    if (g) g.items.push(b); else groups.push({ day, label: relDay(b.starts_at, hi), items: [b] });
  }
  const field = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
  const chip = "inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-semibold";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted">{T("वेबसाइट चैट और WhatsApp से AI जो बुक करता है वो यहाँ आता है। ग्राहक को 1 दिन और 2 घंटे पहले, आपको 2 घंटे पहले रिमाइंडर जाता है।", "Bookings the AI takes on the website chat and WhatsApp land here. The customer is reminded a day and 2 hours before, you 2 hours before.")}</p>
        <button type="button" onClick={() => { setAdding((v) => !v); setErr(""); }} className="shrink-0 inline-flex items-center gap-1.5 rounded-full grad-brand px-3 py-1.5 text-xs font-semibold text-white"><CalendarPlus className="h-3.5 w-3.5" /> {T("नई बुकिंग", "Add booking")}</button>
      </div>
      {err && <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs font-medium text-danger">{err}</p>}

      {adding && (
        <div className="rounded-2xl border border-border bg-surface p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input className={`${field} col-span-2`} placeholder={T("ग्राहक का नाम", "Customer name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className={field} inputMode="tel" placeholder={T("मोबाइल", "Mobile")} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className={field} placeholder={T("सर्विस / काम", "Service")} value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} />
            <input className={field} type="date" min={todayIST()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <input className={field} type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            <input className={`${field} col-span-2`} placeholder={T("नोट (ज़रूरी नहीं)", "Note (optional)")} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAdding(false)} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted">{T("रद्द", "Cancel")}</button>
            <button type="button" onClick={save} disabled={busy === "save"} className="rounded-full grad-brand px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{busy === "save" ? "…" : T("सेव करें", "Save")}</button>
          </div>
        </div>
      )}

      {list === null && <div className="py-10 grid place-items-center"><LoaderCircle className="h-5 w-5 animate-spin text-muted" /></div>}
      {list !== null && !upcoming.length && !adding && (
        <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
          {T("अभी कोई बुकिंग नहीं। वेबसाइट पर कोई ग्राहक चैट में समय बुक करेगा तो यहाँ आ जाएगी — या ऊपर से खुद जोड़ें।", "No upcoming bookings. When a customer books a time in the website chat it appears here — or add one above.")}
        </div>
      )}

      {groups.map((g) => (
        <section key={g.day} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{g.label}</h3>
          {g.items.map((b) => {
            const remind = tapLink(b.phone, customerReminder(b, business || "Shubhora", hi));
            const digits = b.phone.replace(/\D/g, "");
            return (
              <div key={b.id} className="rounded-2xl border border-border bg-surface p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-base font-semibold leading-tight">{fmtWhen(b.starts_at, hi).split(", ")[1]} <span className="text-sm font-medium text-ink">· {b.name || T("ग्राहक", "Customer")}</span></p>
                    <p className="mt-0.5 text-xs text-muted truncate">{[b.service, b.phone, b.note].filter(Boolean).join(" · ")}</p>
                    <p className="mt-0.5 text-[11px] text-muted">{b.source === "chat" ? T("वेबसाइट चैट से", "from website chat") : b.source === "whatsapp" ? T("WhatsApp से", "from WhatsApp") : T("आपने जोड़ी", "added by you")}{b.reminded_customer_24h || b.reminded_customer_2h ? ` · ${T("रिमाइंडर गया", "reminder sent")}` : ""}</p>
                  </div>
                  <button type="button" onClick={() => remove(b)} className="p-1 text-muted hover:text-danger" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {remind && <a href={remind} target="_blank" rel="noreferrer" className={`${chip} text-brand-ink`}><MessageCircle className="h-3.5 w-3.5" /> {T("रिमाइंडर भेजें", "Send reminder")}</a>}
                  {digits.length >= 10 && <a href={`tel:${b.phone}`} className={chip}><Phone className="h-3.5 w-3.5" /> {T("कॉल", "Call")}</a>}
                  <button type="button" disabled={busy === b.id} onClick={() => setStatus(b, "done")} className={`${chip} text-good`}><Check className="h-3.5 w-3.5" /> {T("हो गया", "Done")}</button>
                  <button type="button" disabled={busy === b.id} onClick={() => setStatus(b, "cancelled")} className={`${chip} text-muted`}><X className="h-3.5 w-3.5" /> {T("रद्द", "Cancel")}</button>
                </div>
              </div>
            );
          })}
        </section>
      ))}

      {rest.length > 0 && (
        <details className="rounded-2xl border border-border bg-surface px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold text-muted">{T(`पुरानी / पूरी हुई (${rest.length})`, `Past / finished (${rest.length})`)}</summary>
          <ul className="mt-2 space-y-1.5">
            {rest.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate"><b>{fmtWhen(b.starts_at, hi)}</b> · {b.name || T("ग्राहक", "Customer")}{b.service ? ` · ${b.service}` : ""}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 ${b.status === "done" ? "bg-good/10 text-good" : b.status === "cancelled" || b.status === "no_show" ? "bg-surface2 text-muted" : "bg-brand-soft text-brand-ink"}`}>
                  {b.status === "done" ? T("हो गया", "done") : b.status === "cancelled" ? T("रद्द", "cancelled") : b.status === "no_show" ? T("नहीं आए", "no-show") : T("बीत गई", "passed")}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
