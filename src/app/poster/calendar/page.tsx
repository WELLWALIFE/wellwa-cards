"use client";
// Month plan v2 (owner, 1 Nov 2026: "copy nahi karna, us se best banana hai"). The AI plans the month POST BY POST from the
// owner's brand, products, offers and the festivals: each day has the poster's own heading and line, a caption in the owner's
// language, hashtags and why this post. The owner sees the real poster of any day before it goes out, edits any word, asks
// for another idea (with a hint in their words) or skips a day. The 4 AM auto-post and the app's own posting follow it.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, ChevronLeft, ChevronRight, Sparkles, Check, Tag, Trash2, X, List, LayoutGrid, Palette, RefreshCw, Eye, Wand2, Copy, Clapperboard } from "lucide-react";
import Link from "next/link";
import { STYLE_LIST } from "@/lib/poster-categories";
import { api, isLoggedIn, currentProfileId, type Profile } from "@/lib/poster-client";
import { FOCUS, DEFAULT_FOCUS, KIND_TEXT, TONES, brandReady, type BrandSnapshot, type DayBrief, type DayKind } from "@/lib/brand-plan";
import { useT } from "@/lib/poster-i18n";
import { goBack } from "@/lib/nav-back";

type Day = { date: string; festival: string | null };
type Over = { style?: string; voice?: "on" | "off"; music?: string; custom?: string; title?: string; sub?: string };
type Entry = { id: string; for_date: string; kind: string; product_id: string | null; note: string; status: string; overrides?: Over; brief?: DayBrief };
type Prod = { id: string; name: string; offer: string; category?: string };
type Offer = { id: string; text: string; starts: string; ends: string; scope: "all" | "products" | "category"; product_ids: string[]; categories?: string[]; active: boolean };
type Data = { days: Day[]; entries: Entry[]; products: Prod[]; offers: Offer[]; posters?: { for_date: string; url: string }[]; planReady?: boolean };
type Sheet = { date: string; kind: string; product_id: string | null; title: string; sub: string; custom: string; caption: string; hashtags: string; style: string; voice: string; music: string; why: string; hint: string };
type Shot = { url?: string; err?: string; busy?: boolean };

const MUSIC: [string, string, string][] = [["", "Usual", "सामान्य"], ["soft", "Soft", "हल्का"], ["festive", "Festive", "त्योहार वाला"], ["calm", "Calm", "शांत"], ["upbeat", "Lively", "जोशीला"], ["none", "No music", "बिना music"]];
const EDIT_KINDS: DayKind[] = ["product", "offer", "tip", "trust", "testimonial", "about", "greeting", "auto", "skip"];
const WEEK_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], WEEK_HI = ["सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि", "रवि"];

export default function CalendarPage() {
  const router = useRouter(); const { lang } = useT(); const hi = lang !== "en";
  const [profile, setProfile] = useState<Profile | null>(null);
  const [brand, setBrand] = useState<BrandSnapshot | null>(null);
  const [today] = useState(() => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10));
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [data, setData] = useState<Data | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");
  const [focus, setFocus] = useState<string[]>(DEFAULT_FOCUS);
  const [perWeek, setPerWeek] = useState(5);
  const [planning, setPlanning] = useState(false);
  const [planMsg, setPlanMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [sheetMsg, setSheetMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [sheetBusy, setSheetBusy] = useState<"" | "save" | "redo">("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [shots, setShots] = useState<Record<string, Shot>>({});
  const [offerForm, setOfferForm] = useState<{ open: boolean; text: string; starts: string; ends: string; scope: "all" | "products" | "category"; product_ids: string[]; categories: string[] }>({ open: false, text: "", starts: "", ends: "", scope: "all", product_ids: [], categories: [] });
  const [offersOpen, setOffersOpen] = useState(false);
  const [offerMsg, setOfferMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const NET = hi ? "Internet नहीं चल रहा। फिर से कोशिश करें।" : "No internet. Please try again.";

  const load = useCallback(async (p: Profile, m: string) => {
    setLoadErr("");
    try { const r = await api<Data>(`/api/poster/calendar?profile=${p.id}&month=${m}`, { fresh: true }); if (r.ok) setData(r.data); else setLoadErr(hi ? "Plan नहीं खुल पाया। फिर से कोशिश करें।" : "Could not open the plan. Please try again."); }
    catch { setLoadErr(NET); }
  }, [hi, NET]);

  useEffect(() => { (async () => {
    // replace, not push: Back from the login / set-up screen must not land here and bounce straight back to it.
    if (!(await isLoggedIn())) { router.replace("/login?next=/poster/calendar"); return; }
    const r = await api<{ profiles: Profile[] }>("/api/poster/profiles"); const list = r.data.profiles ?? [];
    const p = list.find((x) => x.id === currentProfileId()) ?? list.find((x) => x.is_default) ?? list[0];
    if (!p) { router.replace("/poster/onboard"); return; }
    setProfile(p); load(p, month);
    api<{ brand?: BrandSnapshot }>(`/api/poster/brand?profile=${p.id}`).then((b) => { if (b.ok && b.data.brand) setBrand(b.data.brand); }).catch(() => {});
    try { if (new URLSearchParams(window.location.search).get("plan") === "1") setPlanOpen(true); } catch { /* */ }
  })(); }, [router, load, month]);

  const byDate = useMemo(() => Object.fromEntries((data?.entries ?? []).map((e) => [e.for_date, e])) as Record<string, Entry>, [data]);
  const posterOf = useMemo(() => Object.fromEntries((data?.posters ?? []).map((p) => [p.for_date, p.url])) as Record<string, string>, [data]);
  const planned = (data?.entries ?? []).filter((e) => e.kind !== "skip");
  const hasAiPlan = planned.some((e) => e.brief?.caption || e.overrides?.title);
  const posted = planned.filter((e) => e.status === "done").length;
  const nextPost = planned.find((e) => e.for_date >= today && e.status !== "done");
  const showPlanCard = planOpen || !hasAiPlan;
  const next3 = planned.filter((e) => e.for_date >= today && e.status !== "done").slice(0, 3);

  async function makePlan() {
    if (!profile) return; setPlanning(true); setPlanMsg(null);
    try {
      const r = await api<{ ok?: boolean; count?: number; ai?: boolean; error?: string }>("/api/poster/calendar", { method: "POST", json: { action: "plan", profile: profile.id, month, focus, perWeek } });
      if (!r.ok) { setPlanMsg({ ok: false, text: r.data.error || (hi ? "Plan नहीं बन पाया। फिर से कोशिश करें।" : "Could not make the plan. Please try again.") }); return; }
      setPlanMsg({ ok: true, text: r.data.ai ? (hi ? `${r.data.count} posts तैयार ✓ — किसी भी दिन पर tap करके देखें और बदलें।` : `${r.data.count} posts ready ✓ — tap any day to see and change it.`) : (hi ? `${r.data.count} दिन तय ✓ (AI अभी व्यस्त था, शब्द हर poster पर अपने-आप बनेंगे)।` : `${r.data.count} days planned ✓ (the AI was busy; each poster writes its own words).`) });
      setPlanOpen(false); setShots({}); load(profile, month);
    } catch { setPlanMsg({ ok: false, text: NET }); }
    finally { setPlanning(false); }
  }

  function openDay(date: string) {
    const e = byDate[date]; const d = data?.days.find((x) => x.date === date);
    setSheetMsg(null); setMoreOpen(false);
    setSheet({
      date, kind: e?.kind ?? (d?.festival ? "festival" : "auto"), product_id: e?.product_id ?? null,
      title: e?.overrides?.title ?? "", sub: e?.overrides?.sub ?? "", custom: e?.overrides?.custom ?? "",
      caption: e?.brief?.caption ?? "", hashtags: (e?.brief?.hashtags ?? []).join(" "), why: e?.brief?.why ?? "",
      style: e?.overrides?.style ?? "", voice: e?.overrides?.voice ?? "", music: e?.overrides?.music ?? "", hint: "",
    });
  }

  async function seePoster(date: string) {
    if (!profile) return;
    setShots((s) => ({ ...s, [date]: { busy: true } }));
    try {
      const r = await api<{ poster?: { url: string; v?: string }; error?: string; message?: string }>(`/api/poster/today?profile=${profile.id}&date=${date}&preview=1&sample=1`, { fresh: true });
      setShots((s) => ({ ...s, [date]: r.ok && r.data.poster ? { url: `${r.data.poster.url}${r.data.poster.url.includes("?") ? "&" : "?"}t=${Date.now()}` } : { err: r.data.message || r.data.error || (hi ? "Poster नहीं बन पाया।" : "Could not make the poster.") } }));
    } catch { setShots((s) => ({ ...s, [date]: { err: NET } })); }
  }

  // The next three posts open by themselves (seen live, 2 Nov 2026: three empty boxes until "See them" was found) — one after another, so
  // the server is never asked for three renders at once; a day already made or already asked is left alone.
  const autoSeen = useRef("");
  useEffect(() => {
    // Only the month that holds today (another month's previews stay one tap away — a free account may see only the next three anyway).
    if (!profile || !hasAiPlan || !next3.length || month !== today.slice(0, 7)) return;
    const key = `${profile.id}|${next3.map((e) => e.for_date).join(",")}`;
    if (autoSeen.current === key) return;
    autoSeen.current = key;
    void (async () => { for (const e of next3) if (!posterOf[e.for_date]) await seePoster(e.for_date); })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, hasAiPlan, next3.map((e) => e.for_date).join(","), posterOf, month, today]);

  async function saveSheet(over?: Partial<Sheet>) {
    if (!profile || !sheet) return;
    const s = { ...sheet, ...over };
    setSheetBusy("save"); setSheetMsg(null);
    try {
      const r = await api<{ ok?: boolean; error?: string }>("/api/poster/calendar", { method: "POST", json: {
        action: "post", profile: profile.id, for_date: s.date, kind: s.kind, product_id: s.product_id,
        title: s.title, sub: s.sub, custom: s.custom, caption: s.caption, hashtags: s.hashtags, style: s.style, voice: s.voice, music: s.music,
      } });
      if (!r.ok) { setSheetMsg({ ok: false, text: r.data.error || (hi ? "Save नहीं हुआ। फिर से कोशिश करें।" : "Could not save. Please try again.") }); return; }
      setSheet(s); setSheetMsg({ ok: true, text: hi ? "Save हो गया ✓" : "Saved ✓" });
      setShots((x) => { const n = { ...x }; delete n[s.date]; return n; });
      load(profile, month);
      // The poster on the left is made again with the new words at once — the owner sees the change, no second tap.
      if (s.kind !== "skip") void seePoster(s.date);
    } catch { setSheetMsg({ ok: false, text: NET }); }
    finally { setSheetBusy(""); }
  }

  async function redo() {
    if (!profile || !sheet) return;
    setSheetBusy("redo"); setSheetMsg(null);
    try {
      const r = await api<{ entry?: { kind: string; product_id: string | null; overrides: Over; brief: DayBrief }; error?: string }>("/api/poster/calendar", { method: "POST", json: { action: "redo", profile: profile.id, for_date: sheet.date, hint: sheet.hint } });
      if (!r.ok || !r.data.entry) { setSheetMsg({ ok: false, text: r.data.error || (hi ? "नया idea नहीं आया। फिर से कोशिश करें।" : "No new idea came. Please try again.") }); return; }
      const e = r.data.entry;
      setSheet({ ...sheet, kind: e.kind, product_id: e.product_id, title: e.overrides?.title ?? "", sub: e.overrides?.sub ?? "", custom: e.overrides?.custom ?? "", caption: e.brief?.caption ?? "", hashtags: (e.brief?.hashtags ?? []).join(" "), why: e.brief?.why ?? "", hint: "" });
      setSheetMsg({ ok: true, text: hi ? "नया idea ✓ — poster देखें या शब्द बदलें।" : "New idea ✓ — see the poster or change the words." });
      setShots((x) => { const n = { ...x }; delete n[sheet.date]; return n; });
      load(profile, month);
    } catch { setSheetMsg({ ok: false, text: NET }); }
    finally { setSheetBusy(""); }
  }

  async function saveOffer() {
    if (!profile) return;
    const miss = !offerForm.text.trim() ? (hi ? "पहले ऑफ़र के शब्द लिखें।" : "Write the offer words first.") : !offerForm.starts || !offerForm.ends ? (hi ? "शुरू और आख़िरी तारीख़ चुनें।" : "Pick the start and the end date.") : offerForm.scope === "products" && !offerForm.product_ids.length ? (hi ? "कम से कम एक product चुनें।" : "Pick at least one product.") : "";
    if (miss) { setOfferMsg(miss); return; }
    setOfferMsg("");
    try {
      const r = await api<{ error?: string }>("/api/poster/calendar", { method: "POST", json: { action: "offer", offer: { text: offerForm.text, starts: offerForm.starts, ends: offerForm.ends, scope: offerForm.scope, product_ids: offerForm.product_ids, categories: offerForm.categories } } });
      if (!r.ok) { setOfferMsg(r.data.error || (hi ? "Save नहीं हुआ।" : "Could not save.")); return; }
      setOfferForm({ open: false, text: "", starts: "", ends: "", scope: "all", product_ids: [], categories: [] }); load(profile, month);
    } catch { setOfferMsg(NET); }
  }
  async function removeOffer(id: string) {
    if (!profile) return;
    try { await api("/api/poster/calendar", { method: "POST", json: { action: "offer", delete: id } }); load(profile, month); } catch { setOfferMsg(NET); }
  }
  function shift(n: number) { const [y, m] = month.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); setData(null); setShots({}); }

  const kindText = (k: string) => { const t = KIND_TEXT[k as DayKind] ?? KIND_TEXT.auto; return { icon: t.icon, label: hi ? t.hi : t.en }; };
  const headline = (d: Day, e?: Entry) => e?.overrides?.title || e?.brief?.hook || d.festival || (e ? kindText(e.kind).label : "");
  const label = new Date(month + "-01T00:00:00").toLocaleString(hi ? "hi-IN" : "en-IN", { month: "long", year: "numeric" });

  const head = (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => goBack(router, "/poster/create?door=poster")} className="text-muted" aria-label={hi ? "पीछे" : "Back"}><ChevronLeft className="h-5 w-5" /></button>
      <h1 className="text-lg font-bold flex-1">{hi ? "महीने का plan" : "Month plan"}</h1>
      <div className="flex items-center rounded-xl border border-border">
        <button type="button" onClick={() => shift(-1)} className="p-2" aria-label={hi ? "पिछला महीना" : "Previous month"}><ChevronLeft className="h-4 w-4" /></button>
        <span className="min-w-[7.5rem] text-center text-sm font-semibold">{label}</span>
        <button type="button" onClick={() => shift(1)} className="p-2" aria-label={hi ? "अगला महीना" : "Next month"}><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
  if (loadErr) return <div className="space-y-4">{head}<p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{loadErr}</p></div>;
  if (!data) return <div className="space-y-4">{head}<div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div></div>;

  const ready = brand ? brandReady(brand) : true;
  const brandStrip = brand && (
    ready ? (
      <button type="button" onClick={() => router.push("/poster/brand/setup")} className="w-full flex items-center gap-3 rounded-2xl border border-border px-3 py-2.5 text-left">
        <span className="h-8 w-8 shrink-0 rounded-lg border border-black/10" style={{ background: brand.accent }} />
        <span className="flex-1 min-w-0"><span className="block text-sm font-semibold truncate">{brand.name}</span><span className="block text-[11px] text-muted truncate">{[brand.tone.map((t) => { const x = TONES.find((y) => y.key === t); return x ? (hi ? x.hi : x.en) : t; }).join(" · "), brand.audience].filter(Boolean).join(" — ")}</span></span>
        <span className="text-xs font-semibold text-brand-ink">{hi ? "Brand बदलें" : "Edit brand"}</span>
      </button>
    ) : (
      <button type="button" onClick={() => router.push("/poster/brand/setup")} className="w-full flex items-center gap-3 rounded-2xl border border-brand bg-brand-soft/50 px-3 py-3 text-left">
        <Palette className="h-5 w-5 shrink-0 text-brand" />
        <span className="flex-1"><span className="block text-sm font-semibold">{hi ? "पहले अपना brand बताइए — 1 मिनट" : "First tell us your brand — 1 minute"}</span><span className="block text-xs text-muted">{hi ? "रंग, अंदाज़, ग्राहक — तब plan बिल्कुल आपकी तरह बोलेगा।" : "Colours, tone, customers — then the plan sounds exactly like you."}</span></span>
        <ChevronRight className="h-4 w-4 text-muted" />
      </button>
    )
  );

  const planCard = showPlanCard && (
    <section className="rounded-2xl border border-brand bg-brand-soft/40 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
        <div className="flex-1"><p className="font-semibold">{hasAiPlan ? (hi ? "Plan फिर से बनाएँ" : "Plan the month again") : (hi ? `${label} के posts — AI एक बार में लिखेगा` : `${label}'s posts — written by the AI in one go`)}</p>
          <p className="text-xs text-muted">{hi ? "हर दिन: poster की heading और लाइन, caption, hashtags और यह post क्यों। त्योहार अपने-आप। आपके products और ऑफ़र से — कुछ भी मनगढ़ंत नहीं।" : "Every day: the poster's heading and line, a caption, hashtags and why this post. Festivals by themselves. From your own products and offers — nothing made up."}</p></div>
        {hasAiPlan && <button type="button" onClick={() => setPlanOpen(false)} className="p-1 text-muted" aria-label={hi ? "बंद करें" : "Close"}><X className="h-4 w-4" /></button>}
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold text-muted">{hi ? "Posts किस बारे में हों" : "What the posts talk about"}</p>
        <div className="flex flex-wrap gap-1.5">{FOCUS.map((f) => { const on = focus.includes(f.key); return <button key={f.key} type="button" onClick={() => setFocus(on ? focus.filter((x) => x !== f.key) : [...focus, f.key])} className={`rounded-full border px-3 py-1.5 text-xs ${on ? "border-brand bg-surface font-semibold text-brand-ink" : "border-border bg-surface/60 text-muted"}`}>{f.icon} {hi ? f.hi : f.en}</button>; })}</div>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold text-muted">{hi ? "हफ़्ते में कितने posts" : "Posts a week"}</p>
        <div className="flex gap-1.5">{[3, 4, 5, 7].map((n) => <button key={n} type="button" onClick={() => setPerWeek(n)} className={`rounded-xl border px-4 py-2 text-sm ${perWeek === n ? "border-brand bg-surface font-semibold text-brand-ink" : "border-border bg-surface/60"}`}>{n === 7 ? (hi ? "रोज़" : "Daily") : n}</button>)}</div>
      </div>
      <button type="button" onClick={makePlan} disabled={planning || !focus.length} className="w-full inline-flex items-center justify-center gap-2 rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{planning ? <><LoaderCircle className="h-4 w-4 animate-spin" /> {hi ? "AI लिख रहा है… (30–60 सेकंड)" : "The AI is writing… (30–60 seconds)"}</> : <><Wand2 className="h-4 w-4" /> {hasAiPlan ? (hi ? "नया plan बनाएँ" : "Make a new plan") : (hi ? "मेरे महीने का plan बनाएँ" : "Plan my month")}</>}</button>
      {hasAiPlan && <p className="text-[11px] text-muted">{hi ? "जो posts जा चुके हैं, वे वैसे ही रहेंगे। बाकी दिन नए बनेंगे।" : "Posts already sent stay as they are; the other days are made new."}</p>}
    </section>
  );

  const stats = (
    <div className="grid grid-cols-3 gap-2">
      <div className="rounded-xl border border-border p-2.5 text-center"><p className="text-lg font-bold">{planned.length}</p><p className="text-[11px] text-muted">{hi ? "posts तय" : "posts planned"}</p></div>
      <div className="rounded-xl border border-border p-2.5 text-center"><p className="text-lg font-bold">{posted}</p><p className="text-[11px] text-muted">{hi ? "जा चुके" : "posted"}</p></div>
      <div className="rounded-xl border border-border p-2.5 text-center"><p className="text-lg font-bold truncate">{nextPost ? new Date(nextPost.for_date + "T00:00:00").toLocaleDateString(hi ? "hi-IN" : "en-IN", { day: "numeric", month: "short" }) : "—"}</p><p className="text-[11px] text-muted">{hi ? "अगला post" : "next post"}</p></div>
    </div>
  );

  const thumb = (date: string, e?: Entry, small = false) => {
    const url = shots[date]?.url || posterOf[date];
    const k = e ? kindText(e.kind) : { icon: "·", label: "" };
    return url
      ? /* eslint-disable-line @next/next/no-img-element */ <img src={url} alt="" className={`${small ? "h-full w-full" : "h-14 w-11"} shrink-0 rounded-md object-cover border border-border`} />
      : <span className={`${small ? "h-full w-full" : "h-14 w-11"} shrink-0 grid place-items-center rounded-md text-lg`} style={{ background: brand?.accent ? `${brand.accent}1f` : "var(--color-surface2)" }}>{k.icon}</span>;
  };

  const listView = (
    <div className="space-y-1.5">
      {data.days.map((d) => {
        const e = byDate[d.date]; const dt = new Date(d.date + "T00:00:00"); const past = d.date < today; const skip = e?.kind === "skip" || (!e && !d.festival);
        if (skip && !hasAiPlan && !e) return null;
        return (
          <button key={d.date} type="button" onClick={() => openDay(d.date)} className={`w-full flex items-center gap-3 rounded-xl border p-2 text-left ${d.date === today ? "border-brand" : "border-border"} ${skip ? "opacity-55" : ""} ${past && e?.status !== "done" ? "opacity-60" : ""}`}>
            <span className="w-10 shrink-0 text-center"><span className="block text-sm font-bold">{dt.getDate()}</span><span className="block text-[10px] text-muted">{(hi ? WEEK_HI : WEEK_EN)[(dt.getDay() + 6) % 7]}</span></span>
            {skip ? <span className="h-14 w-11 shrink-0 grid place-items-center rounded-md border border-dashed border-border text-xs text-faint">—</span> : thumb(d.date, e)}
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold truncate">{skip ? (hi ? "कोई post नहीं" : "No post") : headline(d, e)}</span>
              {!skip && <span className="block text-[11px] text-muted truncate">{e?.overrides?.sub || e?.brief?.caption?.split("\n")[0] || (e ? kindText(e.kind).label : d.festival ? (hi ? "त्योहार" : "Festival") : "")}</span>}
              {!skip && e && <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-faint">{kindText(e.kind).icon} {kindText(e.kind).label}{e.product_id ? ` · ${data.products.find((p) => p.id === e.product_id)?.name ?? ""}` : ""}</span>}
            </span>
            {e?.status === "done" ? <span className="inline-flex items-center gap-1 rounded-full bg-good/15 px-2 py-0.5 text-[10px] font-semibold text-good"><Check className="h-3 w-3" />{hi ? "गया" : "Posted"}</span> : !skip ? <ChevronRight className="h-4 w-4 shrink-0 text-faint" /> : null}
          </button>
        );
      })}
    </div>
  );

  const lead = (new Date(month + "-01T00:00:00").getDay() + 6) % 7;
  const gridView = (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-muted">{(hi ? WEEK_HI : WEEK_EN).map((w) => <span key={w}>{w}</span>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: lead }).map((_, i) => <span key={`l${i}`} />)}
        {data.days.map((d) => {
          const e = byDate[d.date]; const skip = e?.kind === "skip" || (!e && !d.festival); const url = shots[d.date]?.url || posterOf[d.date];
          return (
            <button key={d.date} type="button" onClick={() => openDay(d.date)} className={`relative aspect-[4/5] overflow-hidden rounded-lg border text-left ${d.date === today ? "border-brand" : "border-border"} ${skip ? "opacity-50" : ""}`} style={!url && !skip ? { background: brand?.accent ? `${brand.accent}14` : undefined } : undefined}>
              {url && /* eslint-disable-line @next/next/no-img-element */ <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
              <span className={`absolute left-1 top-0.5 text-[11px] font-bold ${url ? "rounded bg-black/55 px-1 text-white" : ""}`}>{Number(d.date.slice(8))}</span>
              {!skip && !url && <span className="absolute inset-x-1 bottom-1 hidden text-[10px] leading-tight line-clamp-3 sm:block">{headline(d, e)}</span>}
              {!skip && !url && <span className="absolute right-1 top-0.5 text-xs">{e ? kindText(e.kind).icon : "🎉"}</span>}
              {e?.status === "done" && <Check className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full bg-good p-0.5 text-white" />}
            </button>
          );
        })}
      </div>
    </div>
  );

  const offersBox = (
    <section className="rounded-2xl border border-border p-3 space-y-2">
      <button type="button" onClick={() => setOffersOpen(!offersOpen)} className="w-full flex items-center gap-2 text-left"><Tag className="h-4 w-4 text-brand" /><span className="text-sm font-semibold flex-1">{hi ? "आपके ऑफ़र" : "Your offers"} <span className="font-normal text-muted">({data.offers.length})</span></span><ChevronRight className={`h-4 w-4 text-muted transition ${offersOpen ? "rotate-90" : ""}`} /></button>
      {offersOpen && <>
        <p className="text-[11px] text-muted">{hi ? "Plan सिर्फ़ यही ऑफ़र लिखता है — अपनी तरफ़ से कोई छूट नहीं बनाता।" : "The plan uses only these offers — it never makes up a discount."}</p>
        {data.offers.map((o) => <div key={o.id} className="flex items-center gap-2 text-xs"><span className="flex-1 truncate"><b>{o.text}</b> <span className="text-muted">· {o.starts} → {o.ends}</span></span><button type="button" onClick={() => removeOffer(o.id)} className="p-1 text-muted" aria-label={hi ? "हटाएँ" : "Remove"}><Trash2 className="h-3.5 w-3.5" /></button></div>)}
        {offerForm.open ? (
          <div className="space-y-2 rounded-xl bg-surface2/60 p-2.5 text-sm">
            <input value={offerForm.text} onChange={(e) => setOfferForm({ ...offerForm, text: e.target.value })} placeholder={hi ? "जैसे: दिवाली ऑफ़र: 20% छूट" : "e.g. Diwali offer: 20% off"} maxLength={60} className="w-full rounded-lg border border-border bg-surface px-3 py-2" />
            <div className="grid grid-cols-2 gap-2"><input type="date" value={offerForm.starts} onChange={(e) => setOfferForm({ ...offerForm, starts: e.target.value })} className="rounded-lg border border-border bg-surface px-2 py-1.5" /><input type="date" value={offerForm.ends} onChange={(e) => setOfferForm({ ...offerForm, ends: e.target.value })} className="rounded-lg border border-border bg-surface px-2 py-1.5" /></div>
            <div className="flex flex-wrap gap-1.5 text-xs">
              <button type="button" onClick={() => setOfferForm({ ...offerForm, scope: "all" })} className={`rounded-full border px-2.5 py-1 ${offerForm.scope === "all" ? "border-brand bg-brand-soft" : "border-border"}`}>{hi ? "सब पर" : "Everything"}</button>
              <button type="button" onClick={() => setOfferForm({ ...offerForm, scope: "products" })} className={`rounded-full border px-2.5 py-1 ${offerForm.scope === "products" ? "border-brand bg-brand-soft" : "border-border"}`}>{hi ? "चुने products" : "Some products"}</button>
              {offerForm.scope === "products" && data.products.map((p) => <button key={p.id} type="button" onClick={() => setOfferForm({ ...offerForm, product_ids: offerForm.product_ids.includes(p.id) ? offerForm.product_ids.filter((x) => x !== p.id) : [...offerForm.product_ids, p.id] })} className={`rounded-full border px-2.5 py-1 ${offerForm.product_ids.includes(p.id) ? "border-brand bg-brand-soft" : "border-border"}`}>📦 {p.name}</button>)}
            </div>
            {offerMsg && <p className="text-xs font-semibold text-danger">{offerMsg}</p>}
            <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setOfferForm({ ...offerForm, open: false })} className="rounded-xl border border-border py-2 text-sm">{hi ? "रहने दें" : "Cancel"}</button><button type="button" onClick={saveOffer} className="rounded-xl grad-brand py-2 text-sm font-semibold text-white">{hi ? "ऑफ़र save करें" : "Save offer"}</button></div>
          </div>
        ) : <button type="button" onClick={() => { setOfferMsg(""); setOfferForm({ ...offerForm, open: true }); }} className="rounded-lg border border-border px-2.5 py-1 text-xs">{hi ? "+ ऑफ़र जोड़ें" : "+ Add offer"}</button>}
        <p className="text-[11px] text-faint">{hi ? "नया ऑफ़र जोड़ा? Plan फिर से बनाएँ ताकि posts में आए।" : "Added an offer? Plan again so the posts use it."}</p>
      </>}
    </section>
  );

  const s = sheet; const sd = s ? data.days.find((x) => x.date === s.date) : null; const se = s ? byDate[s.date] : undefined; const shot = s ? shots[s.date] : undefined;
  const isDone = se?.status === "done"; const canPost = s ? s.date >= today : false;
  const fullCaption = s ? [s.caption, s.hashtags].filter(Boolean).join("\n\n") : "";
  const sheetView = s && (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 md:items-center" onClick={() => setSheet(null)}>
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-surface p-4 md:rounded-3xl" onClick={(ev) => ev.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2">
          <h3 className="flex-1 font-bold">{new Date(s.date + "T00:00:00").toLocaleDateString(hi ? "hi-IN" : "en-IN", { weekday: "long", day: "numeric", month: "long" })}{sd?.festival ? ` · 🎉 ${sd.festival}` : ""}</h3>
          <button type="button" onClick={() => setSheet(null)} className="p-1 text-muted" aria-label={hi ? "बंद करें" : "Close"}><X className="h-5 w-5" /></button>
        </div>
        {isDone && <p className="mb-3 rounded-xl bg-good/10 px-3 py-2 text-xs font-semibold text-good">{hi ? "यह post जा चुका है। बदलाव अगली बार के लिए नहीं गिने जाएँगे।" : "This post has gone out. Changes here no longer go anywhere."}</p>}
        {!canPost && !isDone && <p className="mb-3 rounded-xl bg-surface2 px-3 py-2 text-xs text-muted">{hi ? "यह दिन बीत चुका है।" : "This day has passed."}</p>}
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          {/* the real poster of the day */}
          <div className="mx-auto w-full max-w-[220px] space-y-2 md:max-w-none">
            <div className="aspect-[4/5] overflow-hidden rounded-xl border border-border bg-surface2 grid place-items-center">
              {shot?.busy ? <div className="text-center text-xs text-muted"><LoaderCircle className="mx-auto mb-1 h-5 w-5 animate-spin" />{hi ? "Poster बन रहा है…" : "Making the poster…"}</div>
                : shot?.url || posterOf[s.date] ? /* eslint-disable-line @next/next/no-img-element */ <img src={shot?.url || posterOf[s.date]} alt="" className="h-full w-full object-cover" />
                : <div className="p-3 text-center text-xs text-muted">{shot?.err ? <span className="text-danger font-semibold">{shot.err}</span> : s.kind === "skip" ? (hi ? "इस दिन कोई post नहीं।" : "No post this day.") : (hi ? "इस दिन का असली poster देखें — जैसा जाएगा।" : "See this day's real poster — exactly as it will go.")}</div>}
            </div>
            {s.kind !== "skip" && canPost && <button type="button" onClick={() => seePoster(s.date)} disabled={shot?.busy} className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-brand py-2 text-sm font-semibold text-brand-ink disabled:opacity-60"><Eye className="h-4 w-4" /> {shot?.url ? (hi ? "फिर से बनाएँ" : "Make again") : (hi ? "Poster देखें" : "See the poster")}</button>}
            {/* The same idea as a free Reel (voice, music, the product's photos) — the reel screen opens with this day filled in. */}
            {s.kind !== "skip" && s.kind !== "auto" && <Link href={`/poster/reel?date=${s.date}`} className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-sm font-semibold"><Clapperboard className="h-4 w-4 text-brand" /> {hi ? "इसकी Reel बनाएँ" : "Make a Reel of this"}</Link>}
            {s.why && <p className="rounded-xl bg-surface2 px-3 py-2 text-[11px] text-muted"><b className="text-ink">{hi ? "यह post क्यों: " : "Why this post: "}</b>{s.why}</p>}
          </div>
          {/* the words */}
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-1.5">
              {(sd?.festival ? (["festival", ...EDIT_KINDS] as DayKind[]) : EDIT_KINDS).map((k) => { const t = kindText(k); return <button key={k} type="button" onClick={() => setSheet({ ...s, kind: k, product_id: k === "product" || k === "offer" ? s.product_id ?? data.products[0]?.id ?? null : null })} className={`rounded-full border px-2.5 py-1 text-xs ${s.kind === k ? "border-brand bg-brand-soft font-semibold" : "border-border"}`}>{t.icon} {t.label}</button>; })}
            </div>
            {(s.kind === "product" || s.kind === "offer") && (data.products.length
              ? <div className="flex flex-wrap gap-1.5">{data.products.map((p) => <button key={p.id} type="button" onClick={() => setSheet({ ...s, product_id: p.id })} className={`rounded-full border px-2.5 py-1 text-xs ${s.product_id === p.id ? "border-brand bg-brand-soft font-semibold" : "border-border"}`}>📦 {p.name}</button>)}</div>
              : <p className="text-xs text-muted">{hi ? "पहले Products में अपने products जोड़ें।" : "First add your products under Products."}</p>)}
            {s.kind !== "skip" && <>
              <label className="block"><span className="text-xs font-semibold text-muted">{hi ? "Poster की heading" : "Poster heading"}</span><input value={s.title} onChange={(ev) => setSheet({ ...s, title: ev.target.value })} maxLength={40} placeholder={hi ? "खाली = poster अपने-आप लिखेगा" : "Empty = the poster writes its own"} className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2" /></label>
              <label className="block"><span className="text-xs font-semibold text-muted">{hi ? "उसके नीचे की लाइन" : "Line under it"}</span><input value={s.sub} onChange={(ev) => setSheet({ ...s, sub: ev.target.value })} maxLength={48} className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2" /></label>
              {(s.kind === "offer" || s.kind === "product") && <label className="block"><span className="text-xs font-semibold text-muted">{hi ? "ऑफ़र / दाम की लाइन (आपके शब्द)" : "Offer / price line (your words)"}</span><input value={s.custom} onChange={(ev) => setSheet({ ...s, custom: ev.target.value })} maxLength={60} className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2" /></label>}
              <label className="block"><span className="flex items-center text-xs font-semibold text-muted">{hi ? "Caption" : "Caption"}<span className="flex-1" />{fullCaption && <button type="button" onClick={() => { try { navigator.clipboard.writeText(fullCaption); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* */ } }} className="inline-flex items-center gap-1 font-normal text-brand-ink"><Copy className="h-3 w-3" />{copied ? (hi ? "Copy हुआ" : "Copied") : "Copy"}</button>}</span><textarea value={s.caption} onChange={(ev) => setSheet({ ...s, caption: ev.target.value })} rows={4} maxLength={600} placeholder={hi ? "खाली = post के समय AI लिखेगा" : "Empty = the AI writes it when posting"} className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2" /></label>
              <p className="-mt-2 text-[11px] text-faint">{hi ? "आपका नंबर और card का link अपने-आप जुड़ते हैं।" : "Your number and card link are added by themselves."}</p>
              <label className="block"><span className="text-xs font-semibold text-muted">Hashtags</span><input value={s.hashtags} onChange={(ev) => setSheet({ ...s, hashtags: ev.target.value })} className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2" placeholder="#jaipur #sweets" /></label>
              <div className="rounded-xl border border-dashed border-border p-2.5 space-y-2">
                <p className="text-xs font-semibold">{hi ? "दूसरा idea चाहिए?" : "Want another idea?"}</p>
                <div className="flex gap-2"><input value={s.hint} onChange={(ev) => setSheet({ ...s, hint: ev.target.value })} maxLength={140} placeholder={hi ? "Optional: जैसे \"नए stock की बात करो\"" : "Optional: e.g. \"talk about the new stock\""} className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs" />
                  <button type="button" onClick={redo} disabled={!!sheetBusy || !canPost} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-brand px-3 text-xs font-semibold text-brand-ink disabled:opacity-50">{sheetBusy === "redo" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} {hi ? "नया idea" : "New idea"}</button></div>
              </div>
              <button type="button" onClick={() => setMoreOpen(!moreOpen)} className="text-xs font-semibold text-brand-ink">{moreOpen ? "−" : "+"} {hi ? "Style, आवाज़, music" : "Style, voice, music"}</button>
              {moreOpen && <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">{[{ key: "", en: "Usual", hi: "सामान्य", emoji: "•" }, ...STYLE_LIST].map((st) => <button key={st.key} type="button" onClick={() => setSheet({ ...s, style: st.key })} className={`rounded-full border px-2.5 py-1 text-xs ${s.style === st.key ? "border-brand bg-brand-soft font-semibold" : "border-border"}`}>{st.emoji} {hi ? st.hi : st.en}</button>)}</div>
                <div className="flex flex-wrap gap-1.5">{[["", hi ? "आवाज़: सामान्य" : "Voice: usual"], ["on", hi ? "आवाज़ चालू" : "Voice on"], ["off", hi ? "आवाज़ बंद" : "Voice off"]].map(([k, l]) => <button key={k} type="button" onClick={() => setSheet({ ...s, voice: k })} className={`rounded-full border px-2.5 py-1 text-xs ${s.voice === k ? "border-brand bg-brand-soft font-semibold" : "border-border"}`}>{l}</button>)}</div>
                <div className="flex flex-wrap gap-1.5">{MUSIC.map(([k, en, h]) => <button key={k} type="button" onClick={() => setSheet({ ...s, music: k })} className={`rounded-full border px-2.5 py-1 text-xs ${s.music === k ? "border-brand bg-brand-soft font-semibold" : "border-border"}`}>🎵 {hi ? h : en}</button>)}</div>
              </div>}
            </>}
            {sheetMsg && <p className={`rounded-lg px-3 py-2 text-xs font-semibold ${sheetMsg.ok ? "bg-good/10 text-good" : "border border-danger/40 bg-danger/10 text-danger"}`}>{sheetMsg.text}</p>}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button type="button" onClick={() => setSheet(null)} className="rounded-xl border border-border py-2.5 text-sm">{hi ? "बंद करें" : "Close"}</button>
              <button type="button" onClick={() => saveSheet()} disabled={!!sheetBusy || isDone} className="inline-flex items-center justify-center gap-1.5 rounded-xl grad-brand py-2.5 text-sm font-semibold text-white disabled:opacity-60">{sheetBusy === "save" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {hi ? "Save करें" : "Save"}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {head}
      {brandStrip}
      {planCard}
      {planMsg && <p className={`rounded-xl px-3 py-2 text-sm font-semibold ${planMsg.ok ? "bg-good/10 text-good" : "border border-danger/40 bg-danger/10 text-danger"}`}>{planMsg.text}</p>}
      {(planned.length > 0 || hasAiPlan) && stats}
      {next3.length > 0 && (
        <section className="rounded-2xl border border-border p-3 space-y-2">
          <div className="flex items-center gap-2"><p className="text-sm font-semibold flex-1">{hi ? "अगले 3 posts — जैसे जाएँगे" : "Next 3 posts — exactly as they will go"}</p>
            <button type="button" onClick={() => next3.forEach((e) => seePoster(e.for_date))} disabled={next3.some((e) => shots[e.for_date]?.busy)} className="inline-flex items-center gap-1 rounded-lg border border-brand px-2.5 py-1 text-xs font-semibold text-brand-ink disabled:opacity-60"><Eye className="h-3.5 w-3.5" /> {next3.some((e) => shots[e.for_date]?.url) ? (hi ? "फिर से" : "Again") : (hi ? "देखें" : "See them")}</button></div>
          <div className="grid grid-cols-3 gap-2">
            {next3.map((e) => { const sh = shots[e.for_date]; const url = sh?.url || posterOf[e.for_date]; return (
              <button key={e.for_date} type="button" onClick={() => openDay(e.for_date)} className="text-left">
                <span className="relative block aspect-[4/5] overflow-hidden rounded-xl border border-border bg-surface2">
                  {url ? /* eslint-disable-line @next/next/no-img-element */ <img src={url} alt="" className="h-full w-full object-cover" /> : sh?.busy ? <LoaderCircle className="absolute inset-0 m-auto h-5 w-5 animate-spin text-muted" /> : sh?.err ? <span className="absolute inset-0 grid place-items-center p-2 text-center text-[10px] text-danger">{sh.err}</span> : <span className="absolute inset-0 grid place-items-center text-2xl">{kindText(e.kind).icon}</span>}
                </span>
                <span className="mt-1 block truncate text-[11px] font-semibold">{new Date(e.for_date + "T00:00:00").toLocaleDateString(hi ? "hi-IN" : "en-IN", { day: "numeric", month: "short" })} · {e.overrides?.title || e.brief?.hook || kindText(e.kind).label}</span>
              </button>
            ); })}
          </div>
        </section>
      )}
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-xl border border-border p-0.5">
          <button type="button" onClick={() => setView("list")} className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold ${view === "list" ? "bg-brand-soft text-brand-ink" : "text-muted"}`}><List className="h-3.5 w-3.5" /> {hi ? "सूची" : "List"}</button>
          <button type="button" onClick={() => setView("grid")} className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold ${view === "grid" ? "bg-brand-soft text-brand-ink" : "text-muted"}`}><LayoutGrid className="h-3.5 w-3.5" /> {hi ? "Calendar" : "Calendar"}</button>
        </div>
        <span className="flex-1" />
        {hasAiPlan && !planOpen && <button type="button" onClick={() => setPlanOpen(true)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold"><Sparkles className="h-3.5 w-3.5 text-brand" /> {hi ? "Plan फिर से" : "Plan again"}</button>}
      </div>
      {!planned.length && !hasAiPlan && <p className="text-xs text-muted">{hi ? "अभी इस महीने का plan नहीं है — ऊपर से बनाइए। बिना plan के भी रोज़ का poster अपने-आप बनता है।" : "No plan for this month yet — make one above. Even without a plan, the daily poster is made by itself."}</p>}
      {view === "list" ? listView : gridView}
      {offersBox}
      {sheetView}
    </div>
  );
}
