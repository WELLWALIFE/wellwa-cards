"use client";
// Social → Google → "Edit Google profile" (owner, 26 Nov 2026: "SaaS hai, sab kuch app se hona chahiye"): the category, description,
// phone, website and opening hours, changed here and sent to Google. Name and address are shown only — Google asks for a new
// verification when they change, so those stay on business.google.com.
import { useState } from "react";
import { LoaderCircle, Pencil, Sparkles, X, Plus, Search, ImagePlus, Check } from "lucide-react";
import { api } from "@/lib/poster-client";

type Cat = { name: string; displayName: string };
type GTime = { hours?: number; minutes?: number };
type GPeriod = { openDay: string; openTime?: GTime; closeDay: string; closeTime?: GTime };
type GDate = { year: number; month: number; day: number };
type GSpecial = { startDate: GDate; closed?: boolean; openTime?: GTime; closeTime?: GTime };
type Profile = { title: string; address: string; primaryCategory: Cat | null; additionalCategories: Cat[]; description: string; phone: string; website: string; periods: GPeriod[]; pendingEdits: boolean; special: GSpecial[] };
type Special = { date: string; closed: boolean; from: string; to: string };
type Attr = { name: string; displayName: string; group: string };
type Day = { day: string; open: boolean; from: string; to: string; extra: boolean };

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const DAY_HI: Record<string, string> = { MONDAY: "सोमवार", TUESDAY: "मंगलवार", WEDNESDAY: "बुधवार", THURSDAY: "गुरुवार", FRIDAY: "शुक्रवार", SATURDAY: "शनिवार", SUNDAY: "रविवार" };
const hhmm = (t?: GTime) => `${String(t?.hours ?? 0).padStart(2, "0")}:${String(t?.minutes ?? 0).padStart(2, "0")}`;
const daysOf = (p: GPeriod[]): Day[] => DAYS.map((d) => {
  const mine = p.filter((x) => x.openDay === d);
  return mine.length ? { day: d, open: true, from: hhmm(mine[0].openTime), to: hhmm(mine[0].closeTime) === "24:00" ? "23:59" : hhmm(mine[0].closeTime), extra: mine.length > 1 } : { day: d, open: false, from: "10:00", to: "19:00", extra: false };
});
const specialsOf = (l: GSpecial[]): Special[] => l.map((s) => ({ date: `${s.startDate.year}-${String(s.startDate.month).padStart(2, "0")}-${String(s.startDate.day).padStart(2, "0")}`, closed: !!s.closed, from: s.closed ? "10:00" : hhmm(s.openTime), to: s.closed ? "19:00" : hhmm(s.closeTime) }));
const inputCls = "w-full rounded-xl border border-border bg-surface2/50 px-3 py-2 text-sm outline-none focus:border-brand";

export function GoogleProfileEdit({ hi }: { hi: boolean }) {
  const T = (en: string, h: string) => (hi ? h : en);
  const [open, setOpen] = useState(false);
  const [p, setP] = useState<Profile | null>(null);
  const [form, setForm] = useState({ description: "", phone: "", website: "" });
  const [primary, setPrimary] = useState<Cat | null>(null);
  const [extra, setExtra] = useState<Cat[]>([]);
  const [days, setDays] = useState<Day[]>([]);
  const [special, setSpecial] = useState<Special[]>([]);
  const [attrs, setAttrs] = useState<{ meta: Attr[]; values: Record<string, boolean> } | null>(null);
  const [attrCh, setAttrCh] = useState<Record<string, boolean>>({});
  const [photos, setPhotos] = useState<{ google: number | null; mine: string[] } | null>(null);
  const [sent, setSent] = useState<Record<string, "busy" | "ok" | "err">>({});
  const [q, setQ] = useState(""); const [found, setFound] = useState<Cat[] | null>(null); const [pickFor, setPickFor] = useState<"primary" | "extra">("primary");
  const [busy, setBusy] = useState(""); const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function fill(x: Profile) { setP(x); setForm({ description: x.description, phone: x.phone, website: x.website }); setPrimary(x.primaryCategory); setExtra(x.additionalCategories); setDays(daysOf(x.periods)); setSpecial(specialsOf(x.special ?? [])); setAttrCh({}); }
  async function load() {
    setOpen(true); if (p) return;
    setBusy("load"); setMsg(null);
    const r = await api<{ profile?: Profile; error?: string }>("/api/google/profile");
    setBusy("");
    if (!r.ok || !r.data.profile) { setMsg({ ok: false, text: r.data?.error ?? T("Could not read your Google profile.", "Google profile पढ़ नहीं पाए।") }); return; }
    fill(r.data.profile);
  }
  async function find() {
    if (q.trim().length < 2) return;
    setBusy("cat"); const r = await api<{ categories?: Cat[]; error?: string }>(`/api/google/profile?cat=${encodeURIComponent(q.trim())}`); setBusy("");
    setFound(r.ok ? r.data.categories ?? [] : []);
    if (!r.ok) setMsg({ ok: false, text: r.data?.error ?? "Search failed." });
  }
  function pick(c: Cat) {
    if (pickFor === "primary") { setPrimary(c); setExtra(extra.filter((x) => x.name !== c.name)); }
    else if (c.name !== primary?.name && !extra.some((x) => x.name === c.name) && extra.length < 9) setExtra([...extra, c]);
    setFound(null); setQ("");
  }
  async function loadAttrs() {
    setBusy("attrs"); const r = await api<{ meta?: Attr[]; values?: Record<string, boolean>; error?: string }>("/api/google/profile?attrs=1"); setBusy("");
    if (!r.ok || !r.data.meta) { setMsg({ ok: false, text: r.data?.error ?? T("Could not read the service options.", "Service options नहीं पढ़ पाए।") }); return; }
    setAttrs({ meta: r.data.meta, values: r.data.values ?? {} });
  }
  async function loadPhotos() {
    setBusy("photos"); const r = await api<{ google?: number | null; mine?: string[]; error?: string }>("/api/google/profile?photos=1"); setBusy("");
    if (!r.ok) { setMsg({ ok: false, text: r.data?.error ?? "Could not load photos." }); return; }
    setPhotos({ google: r.data.google ?? null, mine: r.data.mine ?? [] });
  }
  async function sendPhoto(u: string) {
    setSent((s) => ({ ...s, [u]: "busy" }));
    const r = await api<{ ok?: boolean; error?: string }>("/api/google/profile", { method: "POST", json: { photo: u } });
    setSent((s) => ({ ...s, [u]: r.ok ? "ok" : "err" }));
    if (!r.ok) setMsg({ ok: false, text: r.data?.error ?? T("Google did not take the photo.", "Google ने photo नहीं ली।") });
  }
  async function aiDesc() {
    setBusy("ai"); setMsg(null);
    const r = await api<{ description?: string; error?: string }>("/api/google/profile", { method: "POST", json: { ai: "description", hi } });
    setBusy("");
    if (r.ok && r.data.description) setForm({ ...form, description: r.data.description });
    else setMsg({ ok: false, text: r.data?.error ?? T("AI could not write it now.", "AI अभी नहीं लिख पाया।") });
  }
  async function save() {
    if (!p) return;
    const body: Record<string, unknown> = {};
    if (form.description.trim() !== p.description) body.description = form.description.trim();
    if (form.phone.trim() !== p.phone) body.phone = form.phone.trim();
    if (form.website.trim() !== p.website) body.website = form.website.trim();
    if (primary && primary.name !== p.primaryCategory?.name) body.primaryCategory = primary.name;
    if (extra.map((x) => x.name).join() !== p.additionalCategories.map((x) => x.name).join()) { body.additionalCategories = extra.map((x) => x.name); if (primary) body.primaryCategory = primary.name; }
    const sig = (l: Day[]) => JSON.stringify(l.map((d) => [d.day, d.open, d.from, d.to]));
    const before = sig(daysOf(p.periods)), now = sig(days);
    if (before !== now) body.periods = days.filter((d) => d.open).map((d) => ({ day: d.day, open: d.from, close: d.to }));
    const sp = (l: Special[]) => JSON.stringify(l.map((d) => [d.date, d.closed, d.closed ? "" : d.from, d.closed ? "" : d.to]));
    if (sp(special) !== sp(specialsOf(p.special ?? []))) body.special = special.filter((d) => d.date).map((d) => (d.closed ? { date: d.date, closed: true } : { date: d.date, open: d.from, close: d.to }));
    if (Object.keys(attrCh).length) body.attributes = attrCh;
    if (!Object.keys(body).length) { setMsg({ ok: true, text: T("Nothing changed.", "कुछ नहीं बदला।") }); return; }
    setBusy("save"); setMsg(null);
    const r = await api<{ ok?: boolean; profile?: Profile; error?: string }>("/api/google/profile", { method: "PATCH", json: body });
    setBusy("");
    if (!r.ok || !r.data.profile) { setMsg({ ok: false, text: r.data?.error ?? T("Google did not take the change.", "Google ने बदलाव नहीं लिया।") }); return; }
    fill(r.data.profile);
    if (body.attributes && attrs) setAttrs({ ...attrs, values: { ...attrs.values, ...attrCh } });
    setMsg({ ok: true, text: T("✅ Sent to Google. Some changes show at once; some wait for Google's check (minutes to a few days).", "✅ Google को भेज दिया। कुछ बदलाव तुरंत दिखते हैं, कुछ Google की जाँच के बाद (कुछ मिनट से कुछ दिन)।") });
  }

  if (!open) return (
    <button type="button" onClick={load} className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold text-ink">
      <Pencil className="h-4 w-4" />{T("Edit Google profile (category, hours, description…)", "Google profile बदलें (category, समय, जानकारी…)")}
    </button>
  );
  return (
    <section className="rounded-xl border border-border p-3 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-ink">{T("Your Google profile", "आपकी Google profile")}</div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-muted"><X className="h-4 w-4" /></button>
      </div>
      {busy === "load" && <LoaderCircle className="mx-auto h-5 w-5 animate-spin text-muted" />}
      {p && (
        <>
          <div className="rounded-lg bg-surface2/60 px-3 py-2 text-xs text-muted">
            <div className="font-semibold text-ink">{p.title}</div><div>{p.address}</div>
            <div className="mt-1">{T("Name and address change only on business.google.com — Google asks to verify again.", "नाम और पता सिर्फ business.google.com पर बदलते हैं — Google फिर से verify कराता है।")}</div>
            {p.pendingEdits && <div className="mt-1 font-semibold text-[#b7791f]">{T("Some changes are waiting for Google's check.", "कुछ बदलाव Google की जाँच में हैं।")}</div>}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-ink">{T("Category — what Google shows you for", "Category — Google आपको किस खोज में दिखाए")}</div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-ink">{primary?.displayName ?? T("Not set", "नहीं डाली")}</span>
              <button type="button" onClick={() => { setPickFor("primary"); setFound(null); }} className={`text-xs font-semibold ${pickFor === "primary" ? "text-brand-ink underline" : "text-muted"}`}>{T("Change main", "मुख्य बदलें")}</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {extra.map((c) => <span key={c.name} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-ink">{c.displayName}<button type="button" aria-label="Remove" onClick={() => setExtra(extra.filter((x) => x.name !== c.name))}><X className="h-3 w-3 text-muted" /></button></span>)}
              {extra.length < 9 && <button type="button" onClick={() => { setPickFor("extra"); setFound(null); }} className={`inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs ${pickFor === "extra" ? "text-brand-ink" : "text-muted"}`}><Plus className="h-3 w-3" />{T("More categories", "और category")}</button>}
            </div>
            <div className="flex gap-2">
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); find(); } }} placeholder={pickFor === "primary" ? T("Search main category: water purifier, jeweller…", "मुख्य category खोजें: water purifier, jeweller…") : T("Search another category…", "दूसरी category खोजें…")} className={inputCls} />
              <button type="button" onClick={find} className="shrink-0 rounded-xl border border-border px-3 text-ink" aria-label="Search">{busy === "cat" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</button>
            </div>
            {found && (found.length ? <div className="max-h-48 overflow-auto rounded-xl border border-border">{found.map((c) => <button key={c.name} type="button" onClick={() => pick(c)} className="block w-full border-b border-border px-3 py-2 text-left text-sm text-ink last:border-0 hover:bg-surface2">{c.displayName}</button>)}</div> : <p className="text-xs text-muted">{T("No Google category by that name. Try a shorter word.", "इस नाम की Google category नहीं मिली। छोटा शब्द डालें।")}</p>)}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between"><div className="text-xs font-semibold text-ink">{T("Description", "Business की जानकारी")}</div>
              <button type="button" onClick={aiDesc} disabled={busy === "ai"} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-ink disabled:opacity-60">{busy === "ai" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{T("Write with AI", "AI से लिखवाएँ")}</button></div>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, 750) })} rows={5} className={inputCls} />
            <div className="text-right text-[11px] text-muted">{form.description.length}/750 · {T("no links or phone numbers (Google's rule)", "link या फोन नंबर नहीं (Google का नियम)")}</div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1"><span className="text-xs font-semibold text-ink">{T("Phone", "फोन")}</span><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" className={inputCls} /></label>
            <label className="space-y-1"><span className="text-xs font-semibold text-ink">{T("Website", "Website")}</span><input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://" className={inputCls} /></label>
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-ink">{T("Opening hours", "खुलने का समय")}</div>
            {days.map((d, i) => (
              <div key={d.day} className="flex flex-wrap items-center gap-2 text-sm">
                <label className="flex w-28 items-center gap-1.5"><input type="checkbox" checked={d.open} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, open: e.target.checked } : x)))} /><span className="text-ink">{hi ? DAY_HI[d.day] : d.day.charAt(0) + d.day.slice(1, 3).toLowerCase()}</span></label>
                {d.open ? <>
                  <input type="time" value={d.from} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)))} className="rounded-lg border border-border bg-surface2/50 px-2 py-1" />
                  <span className="text-muted">–</span>
                  <input type="time" value={d.to} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)))} className="rounded-lg border border-border bg-surface2/50 px-2 py-1" />
                  {d.extra && <span className="text-[11px] text-[#b7791f]">{T("has a 2nd time on Google — saving keeps one", "Google पर दो समय हैं — save करने पर एक रहेगा")}</span>}
                </> : <span className="text-xs text-muted">{T("Closed", "बंद")}</span>}
              </div>
            ))}
            <button type="button" onClick={() => { const f = days.find((d) => d.open); if (f) setDays(days.map((d) => (d.open ? { ...d, from: f.from, to: f.to } : d))); }} className="text-xs font-semibold text-brand-ink">{T("Same time on all open days", "सभी खुले दिनों पर यही समय")}</button>
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-ink">{T("Holidays and special days", "छुट्टी और ख़ास दिन")}</div>
            {special.map((d, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <input type="date" value={d.date} onChange={(e) => setSpecial(special.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} className="rounded-lg border border-border bg-surface2/50 px-2 py-1" />
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={d.closed} onChange={(e) => setSpecial(special.map((x, j) => (j === i ? { ...x, closed: e.target.checked } : x)))} />{T("Closed", "बंद")}</label>
                {!d.closed && <><input type="time" value={d.from} onChange={(e) => setSpecial(special.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)))} className="rounded-lg border border-border bg-surface2/50 px-2 py-1" /><span className="text-muted">–</span><input type="time" value={d.to} onChange={(e) => setSpecial(special.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)))} className="rounded-lg border border-border bg-surface2/50 px-2 py-1" /></>}
                <button type="button" aria-label="Remove" onClick={() => setSpecial(special.filter((_, j) => j !== i))}><X className="h-4 w-4 text-muted" /></button>
              </div>
            ))}
            <button type="button" onClick={() => setSpecial([...special, { date: "", closed: true, from: "10:00", to: "19:00" }])} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-ink"><Plus className="h-3.5 w-3.5" />{T("Add a holiday / special day", "छुट्टी / ख़ास दिन जोड़ें")}</button>
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-ink">{T("Service options", "Service options")}</div>
            {!attrs ? (
              <button type="button" onClick={loadAttrs} className="text-xs font-semibold text-brand-ink">{busy === "attrs" ? <LoaderCircle className="inline h-3.5 w-3.5 animate-spin" /> : T("Show delivery, payment and other options →", "Delivery, payment और बाकी options दिखाएँ →")}</button>
            ) : attrs.meta.length === 0 ? <p className="text-xs text-muted">{T("Google offers no yes/no options for this category.", "इस category के लिए Google कोई options नहीं देता।")}</p> : (
              <div className="max-h-72 space-y-2 overflow-auto rounded-xl border border-border p-2">
                {[...new Set(attrs.meta.map((a) => a.group))].map((g) => (
                  <div key={g}>
                    {g && <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{g}</div>}
                    {attrs.meta.filter((a) => a.group === g).map((a) => { const on = attrCh[a.name] ?? attrs.values[a.name] ?? false; return (
                      <label key={a.name} className="flex items-center gap-2 py-0.5 text-sm text-ink"><input type="checkbox" checked={on} onChange={(e) => setAttrCh({ ...attrCh, [a.name]: e.target.checked })} />{a.displayName}</label>
                    ); })}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button type="button" onClick={save} disabled={busy === "save"} className="grad-brand flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy === "save" && <LoaderCircle className="h-4 w-4 animate-spin" />}{T("Save to Google", "Google पर save करें")}</button>
        </>
      )}
      {p && (
        <div className="space-y-1.5 border-t border-border pt-3">
          <div className="text-xs font-semibold text-ink">{T("Photos on Google", "Google पर photos")}</div>
          {!photos ? (
            <button type="button" onClick={loadPhotos} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-ink">{busy === "photos" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}{T("Add photos from your card / website", "Card / website की photos Google पर डालें")}</button>
          ) : (
            <>
              <p className="text-[11px] text-muted">{photos.google !== null ? T(`${photos.google} photos on Google now. `, `Google पर अभी ${photos.google} photos हैं। `) : ""}{T("Tap a photo to add it. Only your own photos (not stock pictures) can go.", "Photo पर tap करें। सिर्फ आपकी अपनी photos जाती हैं (stock नहीं)।")}</p>
              {photos.mine.length === 0 ? <p className="text-xs text-muted">{T("No photos of your own on the card yet.", "Card पर अभी आपकी अपनी कोई photo नहीं है।")}</p> : (
                <div className="grid grid-cols-4 gap-1.5">
                  {photos.mine.map((u) => (
                    <button key={u} type="button" disabled={!!sent[u]} onClick={() => sendPhoto(u)} className="relative aspect-square overflow-hidden rounded-lg border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt="" className="h-full w-full object-cover" />
                      {sent[u] && <span className={`absolute inset-0 grid place-items-center text-xs font-semibold text-white ${sent[u] === "err" ? "bg-danger/70" : "bg-black/50"}`}>{sent[u] === "busy" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : sent[u] === "ok" ? <Check className="h-5 w-5" /> : "✕"}</span>}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
      {msg && <p role="alert" className={`rounded-lg px-3 py-2 text-xs font-semibold ${msg.ok ? "bg-good/10 text-good" : "border border-danger/40 bg-danger/10 text-danger"}`}>{msg.text}</p>}
    </section>
  );
}
