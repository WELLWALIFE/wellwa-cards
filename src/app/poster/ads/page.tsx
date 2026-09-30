"use client";
// Ads — run a Facebook / Instagram ad from the app in five steps: 1 picture or video → 2 goal → 3 who sees it →
// 4 budget → 5 words & review. The campaign is made on the owner's own ad account, PAUSED unless they tap
// "Start now"; a daily budget and an end date are always set. "My ads" shows spend, reach and clicks, with Start / Pause.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, ChevronLeft, ChevronRight, Megaphone, MessageCircle, Phone, Globe, Check, Sparkles, Play, Pause, ExternalLink, RefreshCw, MapPin, X, Image as ImageIcon, Film, Upload, AlertTriangle, Wallet } from "lucide-react";
import { api, isLoggedIn, uploadImage } from "@/lib/poster-client";
import { compressToFile } from "@/lib/image-utils";
import { useT } from "@/lib/poster-i18n";
import { Guide } from "@/components/poster/guide";
import { usePlan } from "@/lib/plan";
import { AD_BUDGET, GOALS, roughResults } from "@/lib/ads-shared";
import type { AdGoal, AdTargeting, AdAccountInfo, CampaignRow, CampaignLive } from "@/lib/ads-server";

type Profile = { id: string; name: string; tagline?: string | null; phone?: string | null; city?: string | null; category?: string; lang?: string; logo_url?: string | null; is_default?: boolean; card_facts?: { primaryCardId?: string } | null };
type Poster = { id: string; for_date: string; title: string; url: string; video_url?: string };
type Product = { id: string; name: string; photo_url: string | null; photos?: { url: string }[]; price?: string; offer?: string };
type Job = { id: string; kind?: string; status: string; output_url: string | null; created_at: string; input?: { title?: string; product?: string; tier?: string; outputs?: Record<string, string> } };
type Creative = { kind: "image" | "video"; url: string; thumbUrl?: string; label: string };
type Accounts = { connected: boolean; page?: string; picture?: string | null; accounts: AdAccountInfo[]; selected: string; permission: "ok" | "missing" | "none" | "error"; error?: string };
type Tab = "new" | "mine";

const field = "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand";
const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-sm font-medium transition ${on ? "border-brand bg-brand-soft text-brand-ink" : "border-border bg-surface text-ink hover:bg-surface2"}`;
const abs = (u: string) => (u.startsWith("http") ? u : `${typeof window !== "undefined" ? window.location.origin : ""}${u}`);
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export default function AdsPage() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const { plan, loading: planLoading } = usePlan();
  const [tab, setTab] = useState<Tab>("new");
  const [acc, setAcc] = useState<Accounts | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posters, setPosters] = useState<Poster[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [videos, setVideos] = useState<Job[]>([]);
  const [step, setStep] = useState(0);
  const [creative, setCreative] = useState<Creative | null>(null);
  const [productId, setProductId] = useState("");
  const [goal, setGoal] = useState<AdGoal>("whatsapp");
  const [targeting, setTargeting] = useState<AdTargeting>({ cities: [], ageMin: 21, ageMax: 60, gender: "all", interests: [] });
  const [placements, setPlacements] = useState<"auto" | "feeds" | "stories">("auto");
  const [daily, setDaily] = useState<number>(AD_BUDGET.defaultDaily);
  const [days, setDays] = useState(5);
  const [copy, setCopy] = useState({ primaryText: "", headline: "", description: "" });
  const [link, setLink] = useState("");
  const [phone, setPhone] = useState("");
  const [offer, setOffer] = useState("");
  const [est, setEst] = useState<{ daily: number; monthlyLow: number; monthlyHigh: number } | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ managerUrl: string; status: string; id?: string } | null>(null);
  const [q, setQ] = useState(""); const [hits, setHits] = useState<{ key: string; name: string; region: string; type: string }[]>([]);
  const [iq, setIq] = useState(""); const [ihits, setIhits] = useState<{ id: string; name: string; size: number }[]>([]);
  const [mine, setMine] = useState<{ campaigns: CampaignRow[]; live: Record<string, CampaignLive>; managerUrl: string; liveError?: string } | null>(null);
  const cityTimer = useRef<number | null>(null);

  const loadAccounts = useCallback(async () => { try { const r = await api<Accounts>("/api/ads/accounts"); if (r.ok) setAcc(r.data); } catch { /* offline */ } }, []);
  const loadMine = useCallback(async () => { try { const r = await api<{ campaigns: CampaignRow[]; live: Record<string, CampaignLive>; managerUrl: string; liveError?: string }>("/api/ads/campaigns"); if (r.ok) setMine(r.data); } catch { /* offline */ } }, []);

  useEffect(() => { (async () => {
    if (!(await isLoggedIn())) { router.push("/login?next=/poster/ads"); return; }
    loadAccounts(); loadMine();
    const pr = await api<{ profiles?: Profile[] }>("/api/poster/profiles").catch(() => null);
    const list = pr?.data.profiles ?? [];
    const p = list.find((x) => x.is_default) ?? list[0] ?? null;
    setProfile(p);
    if (p) {
      setPhone(p.phone ?? "");
      api<{ posters?: Poster[] }>(`/api/poster/history?profile=${p.id}`).then((r) => setPosters((r.data.posters ?? []).slice(0, 8))).catch(() => {});
      // the profile's town becomes the audience's first circle
      if (p.city) api<{ results: { key: string; name: string; region: string; type: string }[] }>(`/api/ads/search?kind=city&q=${encodeURIComponent(p.city)}`).then((r) => { const c = r.data.results?.[0]; if (c) setTargeting((t) => (t.cities.length ? t : { ...t, cities: [{ key: c.key, name: c.name, radius: 25, type: c.type === "region" ? "region" : "city" }] })); }).catch(() => {});
    }
    api<{ products?: Product[] }>("/api/poster/products").then((r) => setProducts((r.data.products ?? []).slice(0, 12))).catch(() => {});
    fetch("/api/media/jobs", { cache: "no-store" }).then((x) => x.json()).then((r) => setVideos(((r.jobs ?? []) as Job[]).filter((j) => j.status === "done" && j.output_url).slice(0, 8))).catch(() => {});
  })(); }, [router, loadAccounts, loadMine]);

  // city search (typed)
  useEffect(() => {
    if (cityTimer.current) window.clearTimeout(cityTimer.current);
    if (q.trim().length < 2) { setHits([]); return; }
    cityTimer.current = window.setTimeout(async () => { try { const r = await api<{ results: typeof hits }>(`/api/ads/search?kind=city&q=${encodeURIComponent(q.trim())}`); setHits(r.data.results ?? []); } catch { /* ignore */ } }, 350);
  }, [q]);
  useEffect(() => {
    if (iq.trim().length < 2) { setIhits([]); return; }
    const t = window.setTimeout(async () => { try { const r = await api<{ results: typeof ihits }>(`/api/ads/search?kind=interest&q=${encodeURIComponent(iq.trim())}`); setIhits(r.data.results ?? []); } catch { /* ignore */ } }, 350);
    return () => window.clearTimeout(t);
  }, [iq]);
  // Meta's reach estimate whenever the audience changes (debounced)
  useEffect(() => {
    if (step !== 2 && step !== 3) return;
    const t = window.setTimeout(async () => { try { const r = await api<{ estimate: typeof est }>("/api/ads/estimate", { method: "POST", json: { targeting, placements } }); setEst(r.data.estimate ?? null); } catch { setEst(null); } }, 600);
    return () => window.clearTimeout(t);
  }, [targeting, placements, step]);

  async function writeWords() {
    if (!profile) return;
    setBusy("copy"); setErr("");
    try {
      const r = await api<{ copy?: { primaryText: string; headline: string; description: string }; link?: string; phone?: string; error?: string }>("/api/ads/copy", { method: "POST", json: { profile_id: profile.id, goal, product_id: productId || undefined, offer } });
      if (!r.ok || !r.data.copy) { setErr(r.data.error ?? "Could not write the words."); return; }
      setCopy(r.data.copy); if (r.data.link) setLink(r.data.link); if (r.data.phone && !phone) setPhone(r.data.phone);
    } catch { setErr("No internet — please try again."); }
    finally { setBusy(""); }
  }
  async function upload(file: File | null) {
    if (!file) return; setBusy("up");
    try { const u = await uploadImage(await compressToFile(file, "ad.jpg", 1600, 0.9), "wide"); if (u) setCreative({ kind: "image", url: u, label: hi ? "Aapki photo" : "Your photo" }); else setErr("Could not upload the picture."); }
    catch { setErr("Could not upload the picture."); }
    finally { setBusy(""); }
  }
  async function create(startNow: boolean) {
    if (!creative) return;
    const total = daily * days;
    if (startNow && !confirm(hi ? `Ad abhi shuru ho jayegi. Facebook aapke ad account se roz ${inr(daily)} tak, ${days} din me zyada se zyada ${inr(total)} lega. Shuru karein?` : `The ad starts now. Facebook will charge your ad account up to ${inr(daily)} a day — at most ${inr(total)} over ${days} days. Start?`)) return;
    setBusy("create"); setErr(""); setMsg("");
    try {
      const r = await api<{ ok?: boolean; managerUrl?: string; status?: string; row?: { id: string }; error?: string }>("/api/ads/create", { method: "POST", json: {
        name: copy.headline, goal, creative: { kind: creative.kind, url: abs(creative.url), thumbUrl: creative.thumbUrl ? abs(creative.thumbUrl) : undefined },
        primary_text: copy.primaryText, headline: copy.headline, description: copy.description, link, phone, daily_rupees: daily, days, targeting, placements, start_now: startNow,
      } });
      if (!r.ok) { setErr(r.data.error ?? "Could not create the ad."); return; }
      setDone({ managerUrl: r.data.managerUrl ?? "", status: r.data.status ?? "PAUSED", id: r.data.row?.id });
      loadMine();
    } catch { setErr("No internet — please try again."); }
    finally { setBusy(""); }
  }
  async function setStatus(id: string, status: "ACTIVE" | "PAUSED") {
    setBusy(`st-${id}`);
    try { const r = await api<{ ok?: boolean; error?: string }>("/api/ads/status", { method: "POST", json: { id, status } }); if (!r.ok) setMsg(r.data.error ?? "Could not change it."); else loadMine(); }
    catch { setMsg("No internet — please try again."); }
    finally { setBusy(""); }
  }
  function reset() { setStep(0); setCreative(null); setProductId(""); setCopy({ primaryText: "", headline: "", description: "" }); setDone(null); setErr(""); setOffer(""); }

  const paid = planLoading || plan !== "free";
  const rough = roughResults(daily, days, goal);
  const goalMeta = GOALS.find((g) => g.key === goal)!;
  const selectedAcct = acc?.accounts.find((a) => a.id === acc.selected);
  const audienceLine = useMemo(() => `${targeting.cities.length ? targeting.cities.map((c) => `${c.name}${c.type === "region" ? "" : ` +${c.radius} km`}`).join(", ") : (hi ? "Poora Bharat" : "All India")} · ${targeting.ageMin}–${targeting.ageMax} · ${targeting.gender === "all" ? (hi ? "sab" : "everyone") : targeting.gender}${targeting.interests.length ? ` · ${targeting.interests.map((i) => i.name).join(", ")}` : ""}`, [targeting, hi]);
  const canNext = [!!creative, true, true, daily >= AD_BUDGET.minDaily && days >= 1, !!copy.primaryText.trim() && !!copy.headline.trim()][step];
  const STEPS = hi ? ["Photo/Video", "Maqsad", "Kaun dekhe", "Budget", "Shabd & check"] : ["Creative", "Goal", "Audience", "Budget", "Words & review"];

  /* ---------- gates ---------- */
  if (!acc) return <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const header = (
    <div className="flex items-center gap-2">
      <Link href="/poster/create" className="text-muted"><ChevronLeft className="h-5 w-5" /></Link>
      <h1 className="text-lg font-bold flex-1">{hi ? "Facebook / Instagram ads" : "Facebook / Instagram ads"}</h1>
      <div className="flex rounded-full border border-border p-0.5 text-xs font-semibold">
        {(["new", "mine"] as Tab[]).map((k) => <button key={k} type="button" onClick={() => { setTab(k); if (k === "mine") loadMine(); }} className={`rounded-full px-3 py-1.5 ${tab === k ? "grad-brand text-white" : "text-muted"}`}>{k === "new" ? (hi ? "Nayi ad" : "New ad") : (hi ? "Meri ads" : "My ads")}</button>)}
      </div>
    </div>
  );
  if (!acc.connected || acc.permission !== "ok") return (
    <div className="space-y-4">
      {header}
      <section className="rounded-2xl border border-border p-4 space-y-3">
        <p className="flex items-center gap-2 text-base font-bold"><Megaphone className="h-5 w-5 text-brand" /> {hi ? "Pehle Facebook jodein" : "Connect Facebook first"}</p>
        {!acc.connected
          ? <p className="text-sm text-muted">{hi ? "Ads aapke apne Facebook ad account se chalti hain. Connections me Facebook Page jodein aur 'Manage ads' allow karein." : "Ads run from your own Facebook ad account. Connect your Facebook Page in Connections and allow 'Manage ads'."}</p>
          : acc.permission === "missing"
          ? <p className="text-sm text-muted">{hi ? `Facebook (${acc.page}) juda hai, par is login me ads ki permission nahi hai. Connections me Facebook disconnect karke dobara jodein — is baar 'Manage ads' allow karein.` : `Facebook (${acc.page}) is connected, but this login has no ads permission. In Connections, disconnect Facebook and connect again — allow 'Manage ads' this time.`}</p>
          : <p className="text-sm text-danger">{acc.error || "Facebook did not answer."}</p>}
        <Link href="/poster/connect" className="inline-flex items-center gap-2 rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white">{hi ? "Connections kholein" : "Open Connections"} <ChevronRight className="h-4 w-4" /></Link>
        <button type="button" onClick={loadAccounts} className="ml-2 inline-flex items-center gap-1 text-sm font-medium text-brand-ink"><RefreshCw className="h-4 w-4" /> {hi ? "Dobara check" : "Check again"}</button>
      </section>
      <Guide hi="Ads ka paisa Facebook seedha aapke ad account (card/UPI) se leta hai — Shubhora ke credits nahi lagte. App me aap ad banate ho, budget aur din tay karte ho, aur Start/Pause karte ho." en="Facebook charges the ad money directly to your ad account (card/UPI) — no Shubhora credits are used. In the app you make the ad, set the budget and days, and Start / Pause it." />
    </div>
  );
  if (!acc.accounts.length) return (
    <div className="space-y-4">
      {header}
      <section className="rounded-2xl border border-border p-4 space-y-3">
        <p className="flex items-center gap-2 text-base font-bold"><Wallet className="h-5 w-5 text-brand" /> {hi ? "Ad account nahi mila" : "No ad account found"}</p>
        <p className="text-sm text-muted">{hi ? "Is Facebook login par koi ad account nahi hai. Meta Business Suite → Ads Manager me ad account banayein, payment method (card/UPI) jodein, phir yahan 'Dobara check' dabayein." : "This Facebook login has no ad account. Create one in Meta Business Suite → Ads Manager, add a payment method (card / UPI), then tap 'Check again' here."}</p>
        <div className="flex flex-wrap gap-2">
          <a href="https://business.facebook.com/adsmanager" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white">Ads Manager <ExternalLink className="h-4 w-4" /></a>
          <button type="button" onClick={loadAccounts} className="inline-flex items-center gap-1 rounded-xl border border-border px-4 py-3 text-sm font-semibold"><RefreshCw className="h-4 w-4" /> {hi ? "Dobara check" : "Check again"}</button>
        </div>
      </section>
    </div>
  );

  /* ---------- my ads ---------- */
  if (tab === "mine") return (
    <div className="space-y-4">
      {header}
      {msg && <p className="text-sm rounded-lg bg-surface2 px-3 py-2">{msg}</p>}
      {!mine ? <div className="py-16 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>
        : !mine.campaigns.length ? <section className="rounded-2xl border border-border p-6 text-center space-y-2"><p className="font-semibold">{hi ? "Abhi koi ad nahi" : "No ads yet"}</p><p className="text-sm text-muted">{hi ? "Pehli ad 5 steps me banayein." : "Make your first ad in five steps."}</p><button type="button" onClick={() => setTab("new")} className="rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white">{hi ? "Nayi ad" : "New ad"}</button></section>
        : (
          <div className="space-y-3">
            {mine.liveError && <p className="text-xs text-muted flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> {hi ? "Facebook ke live numbers abhi nahi mile — thodi der me dobara dekhein." : "Facebook's live numbers did not come through — check again in a while."}</p>}
            {mine.campaigns.map((c) => {
              const l = mine.live[c.campaign_id];
              const active = (l?.effective_status ?? c.status) === "ACTIVE";
              const eff = l?.effective_status ?? c.status;
              const G = GOALS.find((g) => g.key === c.goal);
              return (
                <section key={c.id} className="rounded-2xl border border-border p-3 space-y-2">
                  <div className="flex items-start gap-3">
                    {c.creative_url && (c.creative_kind === "video" ? <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-black text-white"><Film className="h-6 w-6" /></span> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={c.creative_url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover bg-surface2" />)}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{c.name}</p>
                      <p className="text-xs text-muted">{hi ? G?.hi : G?.en} · {inr(c.daily_paise / 100)}/{hi ? "din" : "day"} · {c.days} {hi ? "din" : "days"} · {new Date(c.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</p>
                      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${active ? "bg-good/15 text-good" : eff === "PAUSED" ? "bg-surface2 text-muted" : "bg-amber-100 text-amber-800"}`}>{active ? (hi ? "Chal rahi hai" : "Running") : eff === "PAUSED" ? (hi ? "Ruki hui" : "Paused") : eff.replace(/_/g, " ").toLowerCase()}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[[hi ? "Kharch" : "Spent", inr(l?.spend ?? 0)], [hi ? "Logon tak" : "Reached", (l?.reach ?? 0).toLocaleString("en-IN")], [hi ? "Dikhi" : "Views", (l?.impressions ?? 0).toLocaleString("en-IN")], [hi ? "Clicks" : "Clicks", (l?.clicks ?? 0).toLocaleString("en-IN")]].map(([k, v]) => <div key={k} className="rounded-lg bg-surface2 px-1 py-2"><p className="text-sm font-bold">{v}</p><p className="text-[10px] text-muted">{k}</p></div>)}
                  </div>
                  <div className="flex gap-2">
                    {active
                      ? <button type="button" disabled={busy === `st-${c.id}`} onClick={() => setStatus(c.id, "PAUSED")} className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold disabled:opacity-60"><Pause className="h-4 w-4" /> {hi ? "Rokein" : "Pause"}</button>
                      : <button type="button" disabled={busy === `st-${c.id}`} onClick={() => { if (confirm(hi ? `Ad shuru karein? Facebook roz ${inr(c.daily_paise / 100)} tak lega.` : `Start this ad? Facebook will charge up to ${inr(c.daily_paise / 100)} a day.`)) setStatus(c.id, "ACTIVE"); }} className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl grad-brand px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Play className="h-4 w-4" /> {hi ? "Shuru karein" : "Start"}</button>}
                    <a href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${c.ad_account.replace("act_", "")}&selected_campaign_ids=${c.campaign_id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold">Ads Manager <ExternalLink className="h-3.5 w-3.5" /></a>
                  </div>
                </section>
              );
            })}
            <p className="text-[11px] text-muted">{hi ? "Numbers Facebook se aate hain, kuch minute purane ho sakte hain. Ad review me 'in review' dikh sakta hai — Facebook aam taur par 24 ghante me approve karta hai." : "Numbers come from Facebook and can be a few minutes old. A new ad may show 'in review' — Facebook usually approves within 24 hours."}</p>
          </div>
        )}
    </div>
  );

  /* ---------- done ---------- */
  if (done) return (
    <div className="space-y-4">
      {header}
      <section className="rounded-2xl border border-good/40 bg-good/5 p-4 space-y-3 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-good text-white"><Check className="h-6 w-6" /></span>
        <p className="text-base font-bold">{done.status === "ACTIVE" ? (hi ? "Ad shuru ho gayi" : "Your ad has started") : (hi ? "Ad ban gayi (ruki hui)" : "Your ad is ready (paused)")}</p>
        <p className="text-sm text-muted">{done.status === "ACTIVE"
          ? (hi ? "Facebook pehle review karega (aam taur par 24 ghante ke andar), phir dikhna shuru. 'Meri ads' me kharch aur results dekhein." : "Facebook reviews it first (usually within 24 hours), then it starts showing. See spend and results under 'My ads'.")
          : (hi ? "Abhi koi paisa nahi lagega. Jab chahein 'Meri ads' me Start dabayein." : "Nothing is charged yet. Tap Start under 'My ads' whenever you are ready.")}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {done.status !== "ACTIVE" && done.id && <button type="button" disabled={busy.startsWith("st-")} onClick={() => { if (confirm(hi ? `Ad shuru karein? Facebook roz ${inr(daily)} tak lega, ${days} din.` : `Start now? Facebook will charge up to ${inr(daily)} a day for ${days} days.`)) setStatus(done.id!, "ACTIVE").then(() => setDone({ ...done, status: "ACTIVE" })); }} className="inline-flex items-center gap-1 rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white"><Play className="h-4 w-4" /> {hi ? "Abhi shuru karein" : "Start now"}</button>}
          <button type="button" onClick={() => { setTab("mine"); reset(); }} className="rounded-xl border border-border px-4 py-3 text-sm font-semibold">{hi ? "Meri ads" : "My ads"}</button>
          <button type="button" onClick={reset} className="rounded-xl border border-border px-4 py-3 text-sm font-semibold">{hi ? "Ek aur ad" : "Another ad"}</button>
        </div>
        {msg && <p className="text-sm text-danger">{msg}</p>}
      </section>
    </div>
  );

  /* ---------- the wizard ---------- */
  return (
    <div className="space-y-4 pb-28">
      {header}
      {!paid && <p className="rounded-lg bg-[#12144a] px-3 py-2 text-xs text-white">{hi ? "Ads banana Growth plan ka hissa hai — pehli ad free me try karein; Facebook ka ad kharch aapke ad account se hi jata hai." : "Making ads is part of Growth — try your first ad free; Facebook's ad spend is always charged to your own ad account."}</p>}
      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs">
        {acc.picture ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={acc.picture} alt="" className="h-7 w-7 rounded-full" /> : <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-soft text-brand"><Megaphone className="h-4 w-4" /></span>}
        <span className="min-w-0 flex-1 truncate"><b>{acc.page}</b> · {selectedAcct ? `${selectedAcct.name}${selectedAcct.ok ? "" : (hi ? " (band / payment baaki)" : " (disabled / payment due)")}` : ""}</span>
        {acc.accounts.length > 1 && <select value={acc.selected} onChange={async (e) => { const v = e.target.value; await api("/api/ads/accounts", { method: "POST", json: { ad_account: v } }); setAcc({ ...acc, selected: v }); }} className="max-w-[40%] rounded-lg border border-border bg-surface px-2 py-1 text-xs">{acc.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>}
      </div>
      {selectedAcct && !selectedAcct.ok && <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {hi ? "Ye ad account abhi active nahi hai (payment method ya verification baaki). Ads Manager me theek karein, warna ad chalegi nahi." : "This ad account is not active (a payment method or verification is pending). Fix it in Ads Manager or the ad will not run."}</p>}

      {/* steps */}
      <div className="grid grid-cols-5 gap-1">{STEPS.map((t, i) => <button key={t} type="button" disabled={i > step && !canNext} onClick={() => i <= step && setStep(i)} className={`h-9 rounded-lg text-xs font-bold ${i === step ? "grad-brand text-white" : i < step ? "bg-brand-soft text-brand-ink" : "bg-surface2 text-muted"}`}>{i + 1}</button>)}</div>
      <p className="text-sm font-semibold">{step + 1}/5 · {STEPS[step]}</p>
      {err && <p className="text-sm text-danger">{err}</p>}

      {step === 0 && (
        <section className="space-y-4">
          <Guide hi="Wahi poster ya video chunein jo aap logon ko dikhana chahte hain. Product ki apni photo ya naya upload bhi chal sakta hai." en="Pick the poster or video people will see. A product photo or a fresh upload works too." />
          {posters.length > 0 && <div><p className="mb-1.5 text-xs font-semibold text-muted">{hi ? "Mere posters" : "My posters"}</p><div className="flex gap-2 overflow-x-auto pb-1">{posters.map((p) => <button key={p.id} type="button" onClick={() => setCreative({ kind: "image", url: p.url, label: p.title })} className={`h-28 w-[88px] shrink-0 overflow-hidden rounded-xl border-2 ${creative?.url === p.url ? "border-brand" : "border-border"}`}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={p.url} alt={p.title} className="h-full w-full object-cover" /></button>)}</div></div>}
          {products.some((p) => p.photo_url) && <div><p className="mb-1.5 text-xs font-semibold text-muted">{hi ? "Product photos" : "Product photos"}</p><div className="flex gap-2 overflow-x-auto pb-1">{products.filter((p) => p.photo_url).map((p) => <button key={p.id} type="button" onClick={() => { setCreative({ kind: "image", url: p.photo_url!, label: p.name }); setProductId(p.id); }} className={`h-24 w-24 shrink-0 overflow-hidden rounded-xl border-2 bg-white ${creative?.url === p.photo_url ? "border-brand" : "border-border"}`}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={p.photo_url!} alt={p.name} className="h-full w-full object-contain" /></button>)}</div></div>}
          {videos.length > 0 && <div><p className="mb-1.5 text-xs font-semibold text-muted">{hi ? "Meri videos" : "My videos"}</p><div className="flex gap-2 overflow-x-auto pb-1">{videos.map((j) => <button key={j.id} type="button" onClick={() => setCreative({ kind: "video", url: j.output_url!, thumbUrl: profile?.logo_url ?? undefined, label: j.input?.title || j.input?.product || "Video" })} className={`flex h-24 w-32 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 bg-black/90 px-2 text-center text-white ${creative?.url === j.output_url ? "border-brand" : "border-border"}`}><Film className="h-6 w-6" /><span className="line-clamp-2 text-[11px]">{j.input?.title || j.input?.product || new Date(j.created_at).toLocaleDateString("en-IN")}</span></button>)}</div></div>}
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border p-3 text-sm">{busy === "up" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5 text-brand" />} {hi ? "Apni photo upload karein (1080×1080 ya 1080×1350 best)" : "Upload your own picture (1080×1080 or 1080×1350 is best)"}<input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0] ?? null)} /></label>
          {creative && <p className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-good" /> {creative.kind === "video" ? <Film className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />} {creative.label}</p>}
          {!posters.length && !products.length && !videos.length && <p className="text-xs text-muted">{hi ? "Abhi koi poster/video nahi — pehle Home par aaj ka poster banayein, ya upar photo upload karein." : "No poster or video yet — make today's poster on Home first, or upload a picture above."}</p>}
        </section>
      )}

      {step === 1 && (
        <section className="space-y-3">
          <Guide hi="Ad ka button kya kare? Zyadatar dukaan aur services ke liye WhatsApp sabse achha kaam karta hai." en="What should the button do? For most shops and services, WhatsApp works best." />
          {GOALS.map((g) => { const I = g.key === "whatsapp" ? MessageCircle : g.key === "calls" ? Phone : Globe; return (
            <button key={g.key} type="button" onClick={() => setGoal(g.key)} className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left ${goal === g.key ? "border-brand bg-brand-soft/40" : "border-border"}`}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"><I className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{hi ? g.hi : g.en}</span><span className="block text-xs text-muted">{hi ? g.subHi : g.sub}</span></span>
              {goal === g.key && <Check className="h-5 w-5 text-brand" />}
            </button>
          ); })}
          {goal !== "website" && <label className="block text-sm font-semibold">{goal === "whatsapp" ? "WhatsApp number" : (hi ? "Phone number" : "Phone number")}<input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="98765 43210" className={field} /></label>}
          {goal === "website" && <label className="block text-sm font-semibold">{hi ? "Kaunsa link khule" : "Which link opens"}<input value={link} onChange={(e) => setLink(e.target.value.trim())} inputMode="url" placeholder="https://shubhora.com/c/…" className={field} /><span className="mt-1 block text-xs font-normal text-muted">{hi ? "Khali chhodein to aapka card/website link lagega." : "Leave empty and your card / website link is used."}</span></label>}
          {products.length > 0 && <div><p className="text-xs font-semibold text-muted mb-1.5">{hi ? "Ad kis product ke baare me hai? (optional)" : "Which product is the ad about? (optional)"}</p><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setProductId("")} className={chip(!productId)}>{hi ? "Poora business" : "Whole business"}</button>{products.map((p) => <button key={p.id} type="button" onClick={() => setProductId(p.id)} className={chip(productId === p.id)}>{p.name}</button>)}</div></div>}
          <label className="block text-sm font-semibold">{hi ? "Offer (optional)" : "Offer (optional)"}<input value={offer} onChange={(e) => setOffer(e.target.value)} maxLength={80} placeholder={hi ? "e.g. is hafte 10% off" : "e.g. 10% off this week"} className={field} /></label>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <Guide hi="Apne sheher ke aas-paas ke logon ko dikhayein — local ads sabse sasti aur asardaar hoti hain. Interests zaroori nahi." en="Show it to people around your town — local ads are the cheapest and most effective. Interests are optional." />
          <div>
            <p className="text-sm font-semibold flex items-center gap-1.5"><MapPin className="h-4 w-4 text-brand" /> {hi ? "Kahan" : "Where"}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {targeting.cities.map((c) => (
                <span key={c.key} className="inline-flex items-center gap-1 rounded-full border border-brand bg-brand-soft px-3 py-1.5 text-sm">
                  {c.name}{c.type !== "region" && <> · <select value={c.radius} onChange={(e) => setTargeting({ ...targeting, cities: targeting.cities.map((x) => (x.key === c.key ? { ...x, radius: Number(e.target.value) } : x)) })} className="bg-transparent text-sm">{[10, 15, 25, 40, 60, 80].map((r) => <option key={r} value={r}>{r} km</option>)}</select></>}
                  <button type="button" onClick={() => setTargeting({ ...targeting, cities: targeting.cities.filter((x) => x.key !== c.key) })} aria-label="Remove"><X className="h-3.5 w-3.5" /></button>
                </span>
              ))}
              {!targeting.cities.length && <span className="rounded-full border border-brand bg-brand-soft px-3 py-1.5 text-sm">{hi ? "Poora Bharat" : "All India"}</span>}
            </div>
            <div className="relative mt-2">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={hi ? "Sheher / zila jodein, e.g. Rewari" : "Add a city / district, e.g. Rewari"} className={`${field} mt-0`} />
              {hits.length > 0 && <div className="absolute z-10 mt-1 w-full rounded-xl border border-border bg-surface shadow-float">{hits.map((h) => <button key={h.key} type="button" onClick={() => { if (!targeting.cities.some((c) => c.key === h.key)) setTargeting({ ...targeting, cities: [...targeting.cities, { key: h.key, name: h.name, radius: 25, type: h.type === "region" ? "region" : "city" }] }); setQ(""); setHits([]); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-surface2">{h.name}<span className="text-muted"> · {h.region || (h.type === "region" ? (hi ? "rajya" : "state") : "")}</span></button>)}</div>}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold">{hi ? "Umar" : "Age"} <span className="font-normal text-muted">{targeting.ageMin}–{targeting.ageMax}</span></p>
            <div className="mt-1 grid grid-cols-2 gap-3">
              <label className="text-xs text-muted">{hi ? "Se" : "From"}<input type="range" min={18} max={64} value={targeting.ageMin} onChange={(e) => setTargeting({ ...targeting, ageMin: Math.min(Number(e.target.value), targeting.ageMax - 1) })} className="w-full" /></label>
              <label className="text-xs text-muted">{hi ? "Tak" : "To"}<input type="range" min={19} max={65} value={targeting.ageMax} onChange={(e) => setTargeting({ ...targeting, ageMax: Math.max(Number(e.target.value), targeting.ageMin + 1) })} className="w-full" /></label>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold">{hi ? "Kaun" : "Who"}</p>
            <div className="mt-1.5 flex gap-2">{([["all", hi ? "Sab" : "Everyone"], ["men", hi ? "Purush" : "Men"], ["women", hi ? "Mahila" : "Women"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setTargeting({ ...targeting, gender: k })} className={chip(targeting.gender === k)}>{l}</button>)}</div>
          </div>
          <div>
            <p className="text-sm font-semibold">{hi ? "Interests (optional)" : "Interests (optional)"}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">{targeting.interests.map((i) => <span key={i.id} className="inline-flex items-center gap-1 rounded-full border border-brand bg-brand-soft px-3 py-1.5 text-sm">{i.name}<button type="button" onClick={() => setTargeting({ ...targeting, interests: targeting.interests.filter((x) => x.id !== i.id) })}><X className="h-3.5 w-3.5" /></button></span>)}</div>
            <div className="relative mt-2">
              <input value={iq} onChange={(e) => setIq(e.target.value)} placeholder={hi ? "e.g. jewellery, fitness, real estate" : "e.g. jewellery, fitness, real estate"} className={`${field} mt-0`} />
              {ihits.length > 0 && <div className="absolute z-10 mt-1 w-full rounded-xl border border-border bg-surface shadow-float">{ihits.map((h) => <button key={h.id} type="button" onClick={() => { if (!targeting.interests.some((c) => c.id === h.id)) setTargeting({ ...targeting, interests: [...targeting.interests, { id: h.id, name: h.name }] }); setIq(""); setIhits([]); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-surface2">{h.name}{h.size ? <span className="text-muted"> · {Math.round(h.size / 100000) / 10} cr</span> : null}</button>)}</div>}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold">{hi ? "Kahan dikhe" : "Placements"}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">{([["auto", hi ? "Facebook + Instagram (auto)" : "Facebook + Instagram (auto)"], ["feeds", hi ? "Sirf feed" : "Feeds only"], ["stories", hi ? "Stories & Reels" : "Stories & Reels"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setPlacements(k)} className={chip(placements === k)}>{l}</button>)}</div>
          </div>
          {est && est.monthlyHigh > 0 && <p className="rounded-lg bg-surface2 px-3 py-2 text-xs">{hi ? "Is audience me Facebook par lagbhag" : "Facebook estimates about"} <b>{est.monthlyLow.toLocaleString("en-IN")}–{est.monthlyHigh.toLocaleString("en-IN")}</b> {hi ? "log hain." : "people in this audience."}</p>}
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          <Guide hi="Budget roz ka hai aur din tay hain — isse zyada Facebook kabhi nahi lega. Chhote se shuru karein, results dekh kar badhayein." en="The budget is per day and the days are fixed — Facebook never charges more than this. Start small, raise it once you see results." />
          <div>
            <p className="text-sm font-semibold">{hi ? "Roz ka budget" : "Daily budget"} <span className="font-normal text-muted">{inr(daily)}/{hi ? "din" : "day"}</span></p>
            <div className="mt-1.5 flex flex-wrap gap-2">{[100, 200, 300, 500, 1000].map((v) => <button key={v} type="button" onClick={() => setDaily(v)} className={chip(daily === v)}>{inr(v)}</button>)}</div>
            <input type="number" min={AD_BUDGET.minDaily} max={AD_BUDGET.maxDaily} value={daily} onChange={(e) => setDaily(Math.min(AD_BUDGET.maxDaily, Math.max(0, Number(e.target.value) || 0)))} className={`${field} w-40`} />
          </div>
          <div>
            <p className="text-sm font-semibold">{hi ? "Kitne din" : "How many days"} <span className="font-normal text-muted">{days}</span></p>
            <div className="mt-1.5 flex flex-wrap gap-2">{[3, 5, 7, 14, 30].map((v) => <button key={v} type="button" onClick={() => setDays(v)} className={chip(days === v)}>{v} {hi ? "din" : "days"}</button>)}</div>
          </div>
          <div className="rounded-2xl border border-border p-4">
            <p className="text-xs text-muted">{hi ? "Kul kharch (zyada se zyada)" : "Total spend (at most)"}</p>
            <p className="text-2xl font-bold">{inr(daily * days)}</p>
            <p className="mt-1 text-sm text-muted">{hi ? "Andaza:" : "Estimate:"} <b>{rough.low}–{rough.high}</b> {hi ? (goal === "whatsapp" ? "WhatsApp messages" : goal === "calls" ? "calls" : "visits") : rough.unit}{est?.daily ? ` · ${hi ? "roz lagbhag" : "about"} ${est.daily.toLocaleString("en-IN")} ${hi ? "logon tak pahunch" : "people reached a day"}` : ""}</p>
            <p className="mt-1 text-[11px] text-muted">{hi ? "Ye andaza hai — asli results ad, offer aur ilaake par depend karte hain. Facebook aapke ad account (card/UPI) se paisa leta hai, Shubhora credits nahi." : "An estimate — real results depend on the ad, the offer and the area. Facebook charges your ad account (card / UPI), not Shubhora credits."}</p>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="space-y-4">
          <Guide hi="AI aapke apne facts se ad ke shabd likhta hai — padh kar apni bhasha me sudhaar lein. Neeche waisa hi dikhega jaisa Facebook par." en="The AI writes the ad's words from your own facts — read and fix them in your own words. Below is how it will look on Facebook." />
          {!copy.primaryText && !busy && <button type="button" onClick={writeWords} className="inline-flex items-center gap-2 rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white"><Sparkles className="h-4 w-4" /> {hi ? "AI se shabd likhwayein" : "Write the words with AI"}</button>}
          {busy === "copy" && <p className="inline-flex items-center gap-2 text-sm text-muted"><LoaderCircle className="h-4 w-4 animate-spin" /> {hi ? "Likh raha hai…" : "Writing…"}</p>}
          {(copy.primaryText || copy.headline) && (
            <>
              <label className="block text-sm font-semibold">{hi ? "Ad ka text" : "Ad text"}<textarea value={copy.primaryText} onChange={(e) => setCopy({ ...copy, primaryText: e.target.value })} rows={5} maxLength={1500} className={field} /></label>
              <div className="grid grid-cols-[1.4fr_1fr] gap-2">
                <label className="block text-sm font-semibold">{hi ? "Headline" : "Headline"}<input value={copy.headline} onChange={(e) => setCopy({ ...copy, headline: e.target.value })} maxLength={40} className={field} /></label>
                <label className="block text-sm font-semibold">{hi ? "Chhoti line" : "Description"}<input value={copy.description} onChange={(e) => setCopy({ ...copy, description: e.target.value })} maxLength={30} className={field} /></label>
              </div>
              <button type="button" onClick={writeWords} className="inline-flex items-center gap-1 text-sm font-medium text-brand-ink"><RefreshCw className="h-4 w-4" /> {hi ? "Dobara likhwayein" : "Write again"}</button>
              {/* the ad as Facebook shows it */}
              <div className="mx-auto max-w-sm overflow-hidden rounded-2xl border border-border bg-white text-[#050505] shadow-card">
                <div className="flex items-center gap-2 px-3 pt-3">{acc.picture ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={acc.picture} alt="" className="h-9 w-9 rounded-full" /> : <span className="h-9 w-9 rounded-full bg-gray-200" />}<div className="leading-tight"><p className="text-sm font-semibold">{acc.page}</p><p className="text-[11px] text-gray-500">Sponsored · 🌐</p></div></div>
                <p className="whitespace-pre-line px-3 py-2 text-sm">{copy.primaryText}</p>
                {creative?.kind === "video" ? <div className="grid aspect-square place-items-center bg-black text-white"><Play className="h-12 w-12" /></div> : creative && /* eslint-disable-next-line @next/next/no-img-element */ <img src={creative.url} alt="" className="aspect-square w-full object-cover" />}
                <div className="flex items-center gap-3 bg-gray-100 px-3 py-2.5"><div className="min-w-0 flex-1"><p className="truncate text-[11px] uppercase text-gray-500">{goal === "whatsapp" ? "wa.me" : (link || "shubhora.com").replace(/^https?:\/\//, "").split("/")[0]}</p><p className="truncate text-sm font-semibold">{copy.headline}</p>{copy.description && <p className="truncate text-xs text-gray-500">{copy.description}</p>}</div><span className="shrink-0 rounded-md bg-gray-200 px-3 py-1.5 text-sm font-semibold">{goal === "whatsapp" ? "WhatsApp" : goal === "calls" ? "Call now" : "Learn more"}</span></div>
              </div>
              <div className="rounded-2xl border border-border p-3 text-sm space-y-1">
                <p><b>{hi ? "Maqsad:" : "Goal:"}</b> {hi ? goalMeta.hi : goalMeta.en}{goal !== "website" ? ` · ${phone}` : ""}</p>
                <p><b>{hi ? "Kaun dekhe:" : "Audience:"}</b> {audienceLine}</p>
                <p><b>{hi ? "Budget:" : "Budget:"}</b> {inr(daily)}/{hi ? "din" : "day"} × {days} {hi ? "din" : "days"} = {hi ? "zyada se zyada" : "at most"} {inr(daily * days)}</p>
              </div>
            </>
          )}
        </section>
      )}

      {/* footer buttons */}
      <div className="fixed bottom-[64px] left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
        {step < 4 ? (
          <div className="flex gap-2">
            <button type="button" onClick={() => (step === 0 ? router.push("/poster/create") : setStep(step - 1))} className="inline-flex items-center gap-1 rounded-xl border border-border px-4 py-3 text-sm font-semibold"><ChevronLeft className="h-4 w-4" /> {hi ? "Peeche" : "Back"}</button>
            <button type="button" disabled={!canNext} onClick={() => { setStep(step + 1); if (step === 3 && !copy.primaryText) writeWords(); }} className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">{hi ? "Aage" : "Next"} <ChevronRight className="h-4 w-4" /></button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(3)} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-3 text-sm font-semibold"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" disabled={!canNext || busy === "create"} onClick={() => create(false)} className="flex-1 rounded-xl border border-brand px-3 py-3 text-sm font-semibold text-brand-ink disabled:opacity-40">{busy === "create" ? "…" : (hi ? "Banayein (ruki hui)" : "Create (paused)")}</button>
            <button type="button" disabled={!canNext || busy === "create"} onClick={() => create(true)} className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl grad-brand px-3 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy === "create" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {hi ? "Abhi shuru" : "Start now"}</button>
          </div>
        )}
      </div>
    </div>
  );
}
