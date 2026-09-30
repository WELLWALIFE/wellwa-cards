"use client";
// Monthly content calendar: generate a plan (product/greeting/offer mix +
// festivals), review day by day, edit or skip; the daily engine follows it.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, ChevronLeft, ChevronRight, Sparkles, Check, Tag, Trash2, X } from "lucide-react";
import { STYLE_LIST } from "@/lib/poster-categories";
import { api, isLoggedIn, currentProfileId, type Profile } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { Guide } from "@/components/poster/guide";


type Day = { date: string; festival: string | null };
type Over = { style?: string; voice?: "on" | "off"; music?: string; custom?: string };
type Entry = { id: string; for_date: string; kind: string; product_id: string | null; note: string; status: string; overrides?: Over };
type Prod = { id: string; name: string; offer: string; category?: string };
type Offer = { id: string; text: string; starts: string; ends: string; scope: "all" | "products" | "category"; product_ids: string[]; categories?: string[]; active: boolean };
const MUSIC = [["soft", "Soft"], ["festive", "Festive"], ["calm", "Calm"], ["upbeat", "Upbeat"], ["none", "No music"]];
const KIND = { auto: ["🤖", "Auto"], festival: ["🎉", "Festival"], product: ["📦", "Product"], offer: ["🏷️", "Offer"], testimonial: ["💬", "Testimonial"], greeting: ["🙏", "Greeting"], skip: ["⏸", "Skip"] } as Record<string, [string, string]>;

export default function CalendarPage() {
  const router = useRouter(); const { lang } = useT(); const hi = lang !== "en";
  const [profile, setProfile] = useState<Profile | null>(null);
  const [today] = useState(() => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10));
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [data, setData] = useState<{ days: Day[]; entries: Entry[]; products: Prod[]; offers: Offer[] } | null>(null);
  const [over, setOver] = useState<{ date: string; o: Over } | null>(null);
  const [offerForm, setOfferForm] = useState<{ open: boolean; text: string; starts: string; ends: string; scope: "all" | "products" | "category"; product_ids: string[]; categories: string[] }>({ open: false, text: "", starts: "", ends: "", scope: "all", product_ids: [], categories: [] });
  const [preview, setPreview] = useState<{ date: string; url?: string; title?: string; style?: string; err?: string }[] | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [offerMsg, setOfferMsg] = useState("");
  const [mix, setMix] = useState({ product: 4, greeting: 2, offer: 1, testimonial: 0 });
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<string | null>(null);

  const load = useCallback(async (p: Profile, m: string) => { const r = await api<{ days: Day[]; entries: Entry[]; products: Prod[]; offers: Offer[] }>(`/api/poster/calendar?profile=${p.id}&month=${m}`); if (r.ok) setData(r.data); }, []);
  useEffect(() => { (async () => {
    if (!(await isLoggedIn())) { router.push("/login?next=/poster/calendar"); return; }
    const r = await api<{ profiles: Profile[] }>("/api/poster/profiles"); const list = r.data.profiles ?? [];
    const p = list.find((x) => x.id === currentProfileId()) ?? list.find((x) => x.is_default) ?? list[0];
    if (!p) { router.push("/poster/onboard"); return; } setProfile(p); load(p, month);
  })(); }, [router, load, month]);

  async function generate() { if (!profile) return; setBusy(true); await api("/api/poster/calendar", { method: "POST", json: { action: "generate", profile: profile.id, month, mix } }); setBusy(false); load(profile, month); }
  async function setDay(date: string, kind: string, product_id: string | null) { if (!profile) return; await api("/api/poster/calendar", { method: "POST", json: { action: "set", profile: profile.id, for_date: date, kind, product_id } }); setEdit(null); load(profile, month); }
  async function saveOver() { if (!profile || !over) return; const e = byDate[over.date]; await api("/api/poster/calendar", { method: "POST", json: { action: "set", profile: profile.id, for_date: over.date, kind: e?.kind ?? "auto", product_id: e?.product_id ?? null, note: e?.note ?? "", overrides: over.o } }); setOver(null); load(profile, month); }
  async function saveOffer() {
    if (!profile) return; setOfferMsg("");
    const r = await api<{ ok?: boolean; error?: string }>("/api/poster/calendar", { method: "POST", json: { action: "offer", offer: { text: offerForm.text, starts: offerForm.starts, ends: offerForm.ends, scope: offerForm.scope, product_ids: offerForm.product_ids, categories: offerForm.categories } } });
    if (!r.ok) { setOfferMsg(r.data.error || "Could not save."); return; }
    setOfferForm({ open: false, text: "", starts: "", ends: "", scope: "all", product_ids: [], categories: [] }); load(profile, month);
  }
  async function previewWeek() {
    if (!profile) return; setPreviewing(true);
    const days: string[] = []; for (let i = 0; i < 7; i++) days.push(new Date(new Date(today + "T00:00:00Z").getTime() + i * 86400000).toISOString().slice(0, 10));
    const out: NonNullable<typeof preview> = days.map((date) => ({ date })); setPreview([...out]);
    for (let i = 0; i < days.length; i++) {
      const e = byDate[days[i]]; if (e?.kind === "skip") { out[i] = { date: days[i], err: "skip" }; setPreview([...out]); continue; }
      const r = await api<{ poster?: { url: string; title: string; style?: string }; error?: string; message?: string }>(`/api/poster/today?profile=${profile.id}&date=${days[i]}&preview=1`);
      out[i] = r.ok && r.data.poster ? { date: days[i], url: r.data.poster.url, title: r.data.poster.title, style: r.data.poster.style } : { date: days[i], err: r.data.message || r.data.error || "failed" };
      setPreview([...out]);
    }
    setPreviewing(false);
  }
  async function removeOffer(id: string) { if (!profile || !confirm("Remove this offer?")) return; await api("/api/poster/calendar", { method: "POST", json: { action: "offer", delete: id } }); load(profile, month); }
  function shift(n: number) { const [y, m] = month.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); setData(null); }

  if (!data) return <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const byDate = Object.fromEntries(data.entries.map((e) => [e.for_date, e]));
  const label = new Date(month + "-01T00:00:00").toLocaleString(hi ? "hi-IN" : "en-IN", { month: "long", year: "numeric" });
  const planned = data.entries.length, done = data.entries.filter((e) => e.status === "done").length;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><Link href="/poster/more" className="text-muted"><ChevronLeft className="h-5 w-5" /></Link><h1 className="text-lg font-bold flex-1">📅 {hi ? "महीने का calendar" : "Monthly calendar"}</h1></div>
      <Guide hi="Slider से तय करें हफ़्ते में कितने product / ऑफ़र / शुभकामना poster — फिर 'plan बनाओ'। किसी दिन पर tap करके बदल सकते हैं।" en="Use the sliders to set how many product / offer / greeting posters per week — then tap Plan. Tap any day to change it." />
      <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
        <button type="button" onClick={() => shift(-1)}><ChevronLeft className="h-5 w-5" /></button><span className="font-semibold">{label}</span><button type="button" onClick={() => shift(1)}><ChevronRight className="h-5 w-5" /></button>
      </div>
      <div className="rounded-xl border border-brand bg-brand-soft/40 p-3 space-y-2">
        <p className="text-sm font-semibold">{hi ? "हफ़्ते का mix (7 दिन में)" : "Weekly mix (of 7 days)"}</p>
        {(["product", "offer", "testimonial", "greeting"] as const).map((k) => (
          <label key={k} className="flex items-center gap-3 text-sm"><span className="w-24">{KIND[k][0]} {hi ? { product: "प्रोडक्ट", offer: "ऑफ़र", testimonial: "ग्राहक राय", greeting: "शुभकामना" }[k] : KIND[k][1]}</span><input type="range" min={0} max={7} value={mix[k]} onChange={(e) => setMix({ ...mix, [k]: Number(e.target.value) })} className="flex-1" /><b className="w-5 text-right">{mix[k]}</b></label>
        ))}
        <p className="text-[11px] text-muted">{hi ? `बाकी ${Math.max(0, 7 - mix.product - mix.offer - mix.testimonial - mix.greeting)} दिन skip · त्योहार वाले दिन अपने-आप festival` : `Remaining ${Math.max(0, 7 - mix.product - mix.offer - mix.testimonial - mix.greeting)} days skip · festival days override`}</p>
        <button type="button" onClick={generate} disabled={busy} className="w-full inline-flex items-center justify-center gap-2 rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {planned ? (hi ? "दोबारा plan बनाओ" : "Re-plan month") : (hi ? "इस महीने का plan बनाओ" : "Plan this month")}</button>
        {planned > 0 && <p className="text-xs text-muted">{planned} {hi ? "दिन planned" : "days planned"} · {done} {hi ? "post हो चुके" : "posted"}</p>}
      </div>
      <div className="rounded-xl border border-border p-3 space-y-2">
        <div className="flex items-center gap-2"><p className="text-sm font-semibold flex-1">Next 7 days preview</p><button type="button" disabled={previewing} onClick={previewWeek} className="rounded-lg border border-border px-2.5 py-1 text-xs disabled:opacity-60">{previewing ? "Rendering…" : preview ? "Refresh" : "Preview"}</button></div>
        <p className="text-[11px] text-muted">See the actual posters before they go out — style, offer line and art as they will post at 4 AM. Personal / Business plan.</p>
        {preview && (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
            {preview.map((d) => (
              <div key={d.date} className="w-28 shrink-0">
                <div className="aspect-[4/5] overflow-hidden rounded-lg border border-border bg-surface2 grid place-items-center">
                  {d.url ? <a href={d.url} target="_blank" rel="noreferrer">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={`${d.url}?v=${d.date}`} alt={d.title ?? ""} className="h-full w-full object-cover" /></a> : d.err ? <span className="px-1 text-center text-[10px] text-faint">{d.err === "skip" ? "⏸ skip" : d.err}</span> : <LoaderCircle className="h-4 w-4 animate-spin text-muted" />}
                </div>
                <p className="mt-1 truncate text-[10px] text-muted">{d.date.slice(5)}{d.style ? ` · ${d.style}` : ""}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="rounded-xl border border-border p-3 space-y-2">
        <div className="flex items-center gap-2"><Tag className="h-4 w-4 text-brand" /><p className="text-sm font-semibold flex-1">Offers (your words, on posters + voice)</p><button type="button" onClick={() => setOfferForm({ ...offerForm, open: !offerForm.open })} className="rounded-lg border border-border px-2.5 py-1 text-xs">{offerForm.open ? "Close" : "+ Add offer"}</button></div>
        <p className="text-[11px] text-muted">Exactly what you type is shown — we never invent an offer. Applies to all products or only the ones you pick, for the dates you set.</p>
        {offerForm.open && (
          <div className="space-y-2 rounded-lg bg-surface2/60 p-2.5 text-sm">
            <input value={offerForm.text} onChange={(e) => setOfferForm({ ...offerForm, text: e.target.value })} placeholder="e.g. Diwali offer: 20% off till 31 Oct" maxLength={60} className="w-full rounded-lg border border-border bg-surface px-3 py-2" />
            <div className="grid grid-cols-2 gap-2"><label className="text-xs text-muted">From<input type="date" value={offerForm.starts} onChange={(e) => setOfferForm({ ...offerForm, starts: e.target.value })} className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm" /></label><label className="text-xs text-muted">To<input type="date" value={offerForm.ends} onChange={(e) => setOfferForm({ ...offerForm, ends: e.target.value })} className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm" /></label></div>
            <div className="flex flex-wrap gap-1.5 text-xs">
              <button type="button" onClick={() => setOfferForm({ ...offerForm, scope: "all" })} className={`rounded-full border px-2.5 py-1 ${offerForm.scope === "all" ? "border-brand bg-brand-soft" : "border-border"}`}>All posters</button>
              <button type="button" onClick={() => setOfferForm({ ...offerForm, scope: "products" })} className={`rounded-full border px-2.5 py-1 ${offerForm.scope === "products" ? "border-brand bg-brand-soft" : "border-border"}`}>Only these products</button>
              <button type="button" onClick={() => setOfferForm({ ...offerForm, scope: "category" })} className={`rounded-full border px-2.5 py-1 ${offerForm.scope === "category" ? "border-brand bg-brand-soft" : "border-border"}`}>Product category</button>
              {offerForm.scope === "category" && [...new Set(data.products.map((p) => p.category).filter(Boolean))].map((c) => <button key={c} type="button" onClick={() => setOfferForm({ ...offerForm, categories: offerForm.categories.includes(c!) ? offerForm.categories.filter((x) => x !== c) : [...offerForm.categories, c!] })} className={`rounded-full border px-2.5 py-1 ${offerForm.categories.includes(c!) ? "border-brand bg-brand-soft" : "border-border"}`}>🏷 {c}</button>)}
              {offerForm.scope === "category" && !data.products.some((p) => p.category) && <span className="text-faint">Add a category to your products first (Products page).</span>}
              {offerForm.scope === "products" && data.products.map((p) => <button key={p.id} type="button" onClick={() => setOfferForm({ ...offerForm, product_ids: offerForm.product_ids.includes(p.id) ? offerForm.product_ids.filter((x) => x !== p.id) : [...offerForm.product_ids, p.id] })} className={`rounded-full border px-2.5 py-1 ${offerForm.product_ids.includes(p.id) ? "border-brand bg-brand-soft" : "border-border"}`}>📦 {p.name}</button>)}
            </div>
            {offerMsg && <p className="text-xs text-danger">{offerMsg}</p>}
            <button type="button" disabled={!offerForm.text.trim() || !offerForm.starts || !offerForm.ends || (offerForm.scope === "products" && !offerForm.product_ids.length) || (offerForm.scope === "category" && !offerForm.categories.length)} onClick={saveOffer} className="w-full rounded-xl grad-brand py-2 text-sm font-semibold text-white disabled:opacity-50">Save offer</button>
          </div>
        )}
        {(data.offers ?? []).length === 0 ? <p className="text-xs text-faint">No offers yet.</p> : (data.offers ?? []).map((o) => (
          <div key={o.id} className="flex items-center gap-2 text-xs"><span className="flex-1 truncate"><b className="text-ink">{o.text}</b> <span className="text-muted">· {o.starts} → {o.ends} · {o.scope === "all" ? "all" : o.scope === "category" ? `category: ${(o.categories ?? []).join(", ")}` : `${o.product_ids.length} product${o.product_ids.length === 1 ? "" : "s"}`}</span></span><button type="button" onClick={() => removeOffer(o.id)} className="p-1 text-muted" aria-label="Remove"><Trash2 className="h-3.5 w-3.5" /></button></div>
        ))}
      </div>
      {over && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={() => setOver(null)}>
          <div className="w-full max-w-lg rounded-t-3xl bg-surface p-4 md:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between"><h3 className="font-bold">{over.date} · day options</h3><button type="button" onClick={() => setOver(null)} className="p-1 text-muted" aria-label="Close"><X className="h-5 w-5" /></button></div>
            <p className="mb-3 text-xs text-muted">Leave anything blank to use your profile defaults.</p>
            <div className="space-y-3 text-sm">
              <div><p className="mb-1 text-xs font-semibold text-muted">Style</p><div className="flex flex-wrap gap-1.5">{[{ key: "", en: "Default", emoji: "•" }, ...STYLE_LIST].map((st) => <button key={st.key} type="button" onClick={() => setOver({ ...over, o: { ...over.o, style: st.key || undefined } })} className={`rounded-full border px-2.5 py-1 text-xs ${(over.o.style ?? "") === st.key ? "border-brand bg-brand-soft font-semibold" : "border-border"}`}>{st.emoji} {st.en}</button>)}</div></div>
              <div><p className="mb-1 text-xs font-semibold text-muted">Voice in status video</p><div className="flex gap-1.5">{[["", "Default"], ["on", "On"], ["off", "Off"]].map(([k, l]) => <button key={k} type="button" onClick={() => setOver({ ...over, o: { ...over.o, voice: (k || undefined) as Over["voice"] } })} className={`rounded-full border px-2.5 py-1 text-xs ${(over.o.voice ?? "") === k ? "border-brand bg-brand-soft font-semibold" : "border-border"}`}>{l}</button>)}</div></div>
              <div><p className="mb-1 text-xs font-semibold text-muted">Music</p><div className="flex flex-wrap gap-1.5">{[["", "Default"], ...MUSIC].map(([k, l]) => <button key={k} type="button" onClick={() => setOver({ ...over, o: { ...over.o, music: k || undefined } })} className={`rounded-full border px-2.5 py-1 text-xs ${(over.o.music ?? "") === k ? "border-brand bg-brand-soft font-semibold" : "border-border"}`}>{l}</button>)}</div></div>
              <label className="block"><span className="text-xs font-semibold text-muted">Extra line on this day&apos;s poster (your words)</span><input value={over.o.custom ?? ""} onChange={(e) => setOver({ ...over, o: { ...over.o, custom: e.target.value || undefined } })} maxLength={60} placeholder="e.g. Shop open till 10 pm today" className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2" /></label>
              <button type="button" onClick={saveOver} className="w-full rounded-xl grad-brand py-2.5 text-sm font-semibold text-white">Save</button>
            </div>
          </div>
        </div>
      )}
      <div className="space-y-1.5">
        {data.days.map((d) => {
          const e = byDate[d.date]; const kind = e?.kind ?? "auto"; const prod = data.products.find((p) => p.id === e?.product_id);
          const dt = new Date(d.date + "T00:00:00"); const isToday = d.date === today;
          return (
            <div key={d.date} className={`rounded-xl border p-2.5 ${isToday ? "border-brand" : "border-border"} ${e?.status === "done" ? "bg-surface2" : ""}`}>
              <button type="button" onClick={() => setEdit(edit === d.date ? null : d.date)} className="w-full flex items-center gap-2 text-left">
                <span className="w-12 text-center"><span className="block text-sm font-bold">{dt.getDate()}</span><span className="block text-[10px] text-muted">{dt.toLocaleString("en-IN", { weekday: "short" })}</span></span>
                <span className="text-lg">{KIND[kind]?.[0]}</span>
                <span className="flex-1 min-w-0"><span className="block text-sm font-medium truncate">{d.festival ?? prod?.name ?? KIND[kind]?.[1]}</span><span className="block text-[11px] text-muted truncate">{d.festival ? "Festival" : KIND[kind]?.[1]}{e?.note ? ` · ${e.note}` : ""}{e?.overrides?.style ? ` · ${e.overrides.style}` : ""}{e?.overrides?.voice ? ` · voice ${e.overrides.voice}` : ""}{e?.overrides?.custom ? ` · "${e.overrides.custom}"` : ""}</span></span>
                {e?.status === "done" && <Check className="h-4 w-4 text-good" />}
              </button>
              {edit === d.date && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(KIND).filter(([k]) => k !== "festival").map(([k, [ic, l]]) => <button key={k} type="button" onClick={() => setDay(d.date, k, null)} className={`rounded-full border px-2.5 py-1 text-xs ${kind === k ? "border-brand bg-brand-soft" : "border-border"}`}>{ic} {l}</button>)}
                  {data.products.map((p) => <button key={p.id} type="button" onClick={() => setDay(d.date, "product", p.id)} className={`rounded-full border px-2.5 py-1 text-xs ${e?.product_id === p.id ? "border-brand bg-brand-soft" : "border-border"}`}>📦 {p.name}</button>)}
                  <button type="button" onClick={() => setOver({ date: d.date, o: { ...(e?.overrides ?? {}) } })} className="rounded-full border border-dashed border-brand px-2.5 py-1 text-xs text-brand-ink">🎨 Style / voice / offer line</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
