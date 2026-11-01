"use client";
// Ads — run a Facebook / Instagram ad from the app in five steps: 1 picture or video → 2 goal → 3 who sees it →
// 4 budget → 5 words & review. The campaign is made on the owner's own ad account, PAUSED unless they tap
// "Start now"; a daily budget and an end date are always set. "My ads" shows spend, reach and clicks, with Start / Pause.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, ChevronLeft, ChevronRight, Megaphone, MessageCircle, Phone, Globe, Check, Sparkles, Play, Pause, ExternalLink, RefreshCw, MapPin, X, Image as ImageIcon, Film, Upload, AlertTriangle, Wallet, CalendarDays, RotateCcw, SlidersHorizontal, CreditCard } from "lucide-react";
import { api, isLoggedIn, uploadImage } from "@/lib/poster-client";
import { compressToFile } from "@/lib/image-utils";
import { captureThumbFromUrl, captureVideoThumb, listUploadedVideos, uploadVideo, uploadVideoThumb, videoFileProblem, videoFrameSrc, type UploadedVideo } from "@/lib/video-upload";
import { useT } from "@/lib/poster-i18n";
import { Guide } from "@/components/poster/guide";
import { goBack } from "@/lib/nav-back";
import { usePlan } from "@/lib/plan";
import { AD_BUDGET, GOALS, roughResults, adStateOf, AD_STATE_TEXT, friendlyAdError, costPer, NEW_AD_ACCOUNT_URL, managerUrl } from "@/lib/ads-shared";
import type { AdGoal, AdTargeting, AdAccountInfo, CampaignRow, CampaignLive } from "@/lib/ads-server";

type Profile = { id: string; name: string; tagline?: string | null; phone?: string | null; city?: string | null; category?: string; lang?: string; logo_url?: string | null; is_default?: boolean; card_facts?: { primaryCardId?: string } | null };
type Poster = { id: string; for_date: string; title: string; url: string; video_url?: string };
type Product = { id: string; name: string; photo_url: string | null; photos?: { url: string }[]; price?: string; offer?: string };
type Job = { id: string; kind?: string; status: string; output_url: string | null; created_at: string; input?: { title?: string; product?: string; tier?: string; outputs?: Record<string, string> } };
type Creative = { kind: "image" | "video"; url: string; thumbUrl?: string; label: string };
type AcctV2 = AdAccountInfo & { hasFunding?: boolean; billingUrl?: string };
type Accounts = { connected: boolean; page?: string; picture?: string | null; accounts: AcctV2[]; selected: string; permission: "ok" | "missing" | "none" | "error"; error?: string; pageWhatsapp?: string | null; newAccountUrl?: string };
type Tab = "new" | "mine";

const field = "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand";
const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-sm font-medium transition ${on ? "border-brand bg-brand-soft text-brand-ink" : "border-border bg-surface text-ink hover:bg-surface2"}`;
const abs = (u: string) => (u.startsWith("http") ? u : `${typeof window !== "undefined" ? window.location.origin : ""}${u}`);
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const errBox = "rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger";
const todayIst = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const plusDays = (n: number) => new Date(Date.now() + n * 86400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
/** The new end after "+N days" — counted from the present end, or from today when it is already past. */
const extendedEnd = (end: string | null | undefined, extra: number) => { const now = new Date().getTime(); const cur = end ? Date.parse(end) : NaN; return dayText(new Date(Math.max(Number.isFinite(cur) ? cur : now, now) + extra * 86400_000).toISOString()); };
const dayText = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : "");

export default function AdsPage() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const hiRef = useRef(hi); useEffect(() => { hiRef.current = hi; }, [hi]);
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
  const [startDate, setStartDate] = useState("");          // "" = as soon as it is switched on; else YYYY-MM-DD (10:00 IST)
  // My ads → "Change money / days" panel for one ad (Ads v2).
  const [editing, setEditing] = useState<{ id: string; daily: number; extend: number } | null>(null);
  const [editErr, setEditErr] = useState("");
  const [copy, setCopy] = useState({ primaryText: "", headline: "", description: "" });
  const [link, setLink] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneLocked, setPhoneLocked] = useState(false);   // a number that came from the profile is shown, not edited
  const [offer, setOffer] = useState("");
  const [est, setEst] = useState<{ daily: number; monthlyLow: number; monthlyHigh: number } | null>(null);
  const [busy, setBusy] = useState("");
  // Each message sits beside the control that caused it: upErr under the photo picker, copyErr under the "write the words" buttons,
  // createErr right above the Save / Start buttons, stErr under that ad's Start / Pause, chkMsg under "Check again", acctErr under the ad-account bar.
  const [upErr, setUpErr] = useState("");
  const [copyErr, setCopyErr] = useState("");
  const [createErr, setCreateErr] = useState("");
  const [stErr, setStErr] = useState<{ id: string; text: string } | null>(null);
  const [chkMsg, setChkMsg] = useState("");
  const [mineErr, setMineErr] = useState("");
  const [acctErr, setAcctErr] = useState("");
  const createErrRef = useRef<HTMLParagraphElement | null>(null);
  const [done, setDone] = useState<{ managerUrl: string; status: string; id?: string } | null>(null);
  const [q, setQ] = useState(""); const [hits, setHits] = useState<{ key: string; name: string; region: string; type: string }[]>([]);
  const [iq, setIq] = useState(""); const [ihits, setIhits] = useState<{ id: string; name: string; size: number }[]>([]);
  const [mine, setMine] = useState<{ campaigns: CampaignRow[]; live: Record<string, CampaignLive>; managerUrl: string; liveError?: string } | null>(null);
  const cityTimer = useRef<number | null>(null);
  // Campaigns made in Facebook Ads Manager: listed on request and added to "My ads" one by one.
  type Outer = { campaign_id: string; name: string; status: string; effective_status: string; goal: AdGoal; daily_paise: number; days: number };
  const [outer, setOuter] = useState<Outer[] | null>(null);
  const [outerErr, setOuterErr] = useState("");
  const [outerBusy, setOuterBusy] = useState("");

  const loadAccounts = useCallback(async () => {
    setChkMsg("");
    try { const r = await api<Accounts>("/api/ads/accounts"); if (r.ok) setAcc({ ...r.data, accounts: Array.isArray(r.data?.accounts) ? r.data.accounts : [] }); else setChkMsg(hiRef.current ? "अभी देख नहीं पाए। थोड़ी देर बाद फिर कोशिश करें।" : "Could not check just now. Please try again in a little while."); }
    catch { setChkMsg(hiRef.current ? "Internet नहीं चल रहा। फिर से कोशिश करें।" : "No internet. Please try again."); }
  }, []);
  const loadMine = useCallback(async () => {
    setMineErr("");
    try { const r = await api<{ campaigns: CampaignRow[]; live: Record<string, CampaignLive>; managerUrl: string; liveError?: string }>("/api/ads/campaigns"); if (r.ok) setMine(r.data); else setMineErr(hiRef.current ? "आपकी ads नहीं खुल पाईं। फिर से कोशिश करें।" : "Could not open your ads. Please try again."); }
    catch { setMineErr(hiRef.current ? "Internet नहीं चल रहा। फिर से कोशिश करें।" : "No internet. Please try again."); }
  }, []);

  const loadOuter = useCallback(async () => {
    setOuterErr(""); setOuterBusy("list");
    try { const r = await api<{ campaigns?: Outer[]; error?: string }>("/api/ads/import"); if (r.ok) setOuter(r.data.campaigns ?? []); else setOuterErr(r.data.error || (hiRef.current ? "Facebook से ads नहीं मिलीं। फिर से कोशिश करें।" : "Could not get your Facebook ads. Please try again.")); }
    catch { setOuterErr(hiRef.current ? "Internet नहीं चल रहा। फिर से कोशिश करें।" : "No internet. Please try again."); }
    finally { setOuterBusy(""); }
  }, []);
  const addOuter = useCallback(async (id: string) => {
    setOuterErr(""); setOuterBusy(id);
    try {
      const r = await api<{ ok?: boolean; error?: string }>("/api/ads/import", { method: "POST", json: { campaign_id: id } });
      if (!r.ok) { setOuterErr(r.data.error || (hiRef.current ? "यह ad नहीं जुड़ पाई।" : "Could not add this ad.")); return; }
      setOuter((o) => (o ?? []).filter((x) => x.campaign_id !== id));
      await loadMine();
    } catch { setOuterErr(hiRef.current ? "Internet नहीं चल रहा। फिर से कोशिश करें।" : "No internet. Please try again."); }
    finally { setOuterBusy(""); }
  }, [loadMine]);

  useEffect(() => { (async () => {
    if (!(await isLoggedIn())) { router.replace("/login?next=/poster/ads"); return; }
    loadAccounts(); loadMine();
    const pr = await api<{ profiles?: Profile[] }>("/api/poster/profiles").catch(() => null);
    const list = pr?.data.profiles ?? [];
    const p = list.find((x) => x.is_default) ?? list[0] ?? null;
    setProfile(p);
    if (p) {
      setPhone(p.phone ?? ""); setPhoneLocked((p.phone ?? "").replace(/\D/g, "").length >= 10);
      api<{ posters?: Poster[] }>(`/api/poster/history?profile=${p.id}`).then((r) => setPosters((r.data.posters ?? []).slice(0, 8))).catch(() => {});
      // the profile's town becomes the audience's first circle
      if (p.city) api<{ results: { key: string; name: string; region: string; type: string }[] }>(`/api/ads/search?kind=city&q=${encodeURIComponent(p.city)}`).then((r) => { const c = r.data.results?.[0]; if (c) setTargeting((t) => (t.cities.length ? t : { ...t, cities: [{ key: c.key, name: c.name, radius: 25, type: c.type === "region" ? "region" : "city" }] })); }).catch(() => {});
    }
    api<{ products?: Product[] }>("/api/poster/products").then((r) => setProducts((r.data.products ?? []).slice(0, 12))).catch(() => {});
    // "🚀 Boost करें" under a finished video lands here as ?job=<id> — that video is already picked.
    const want = new URLSearchParams(window.location.search).get("job");
    fetch("/api/media/jobs", { cache: "no-store" }).then((x) => x.json()).then((r) => {
      const all = ((r.jobs ?? []) as Job[]).filter((j) => j.status === "done" && j.output_url);
      const hit = want ? all.find((j) => j.id === want) : undefined;
      setVideos(hit ? [hit, ...all.filter((j) => j.id !== hit.id)].slice(0, 8) : all.slice(0, 8));
      if (hit) { setTab("new"); setStep(0); setCreative({ kind: "video", url: hit.output_url!, thumbUrl: p?.logo_url ?? undefined, label: hit.input?.title || hit.input?.product || "Video" }); }
    }).catch(() => {});
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
    setBusy("copy"); setCopyErr("");
    try {
      const r = await api<{ copy?: { primaryText: string; headline: string; description: string }; link?: string; phone?: string; error?: string }>("/api/ads/copy", { method: "POST", json: { profile_id: profile.id, goal, product_id: productId || undefined, offer } });
      if (!r.ok || !r.data.copy) { setCopyErr(r.data.error ?? (hi ? "शब्द नहीं लिख पाए। फिर से कोशिश करें।" : "Could not write the words. Please try again.")); return; }
      setCopy(r.data.copy); if (r.data.link) setLink(r.data.link); if (r.data.phone && !phone) setPhone(r.data.phone);
    } catch { setCopyErr(hi ? "Internet नहीं चल रहा। फिर से कोशिश करें।" : "No internet. Please try again."); }
    finally { setBusy(""); }
  }
  async function upload(file: File | null) {
    if (!file) return; setBusy("up"); setUpErr("");
    try { const u = await uploadImage(await compressToFile(file, "ad.jpg", 1600, 0.9), "wide"); if (u) setCreative({ kind: "image", url: u, label: hi ? "आपकी photo" : "Your photo" }); else setUpErr(hi ? "Photo नहीं चढ़ पाई। फिर से कोशिश करें।" : "Could not add the photo. Please try again."); }
    catch { setUpErr(hi ? "Photo नहीं चढ़ पाई। फिर से कोशिश करें।" : "Could not add the photo. Please try again."); }
    finally { setBusy(""); }
  }
  // "Apni video" as the ad (owner, 21 Oct 2026): upload the file, grab a frame as the cover, done.
  const [vidPct, setVidPct] = useState(0);
  const [uploads, setUploads] = useState<UploadedVideo[]>([]);
  useEffect(() => { listUploadedVideos().then(setUploads); }, []);
  /** An uploaded video without a saved cover (older uploads) gets one now, from its own first frame. */
  async function pickUploaded(v: UploadedVideo) {
    pickCreative({ kind: "video", url: v.url, thumbUrl: v.thumbUrl ?? undefined, label: hi ? "आपकी video" : "Your video" });
    if (v.thumbUrl) return;
    const thumb = await captureThumbFromUrl(v.url); if (!thumb) return;
    const u = await uploadVideoThumb(thumb, v.url); if (!u) return;
    setUploads((list) => list.map((x) => (x.url === v.url ? { ...x, thumbUrl: u } : x)));
    setCreative((c) => (c && c.url === v.url ? { ...c, thumbUrl: u } : c));
  }
  async function uploadVid(file: File | null) {
    if (!file) return;
    const problem = videoFileProblem(file, hi); if (problem) { setUpErr(problem); return; }
    setBusy("upv"); setUpErr(""); setVidPct(0);
    try {
      const thumb = await captureVideoThumb(file);
      const r = await uploadVideo(file, setVidPct);
      if ("url" in r) {
        const thumbUrl = thumb ? (await uploadVideoThumb(thumb, r.url)) ?? undefined : undefined;
        setCreative({ kind: "video", url: r.url, thumbUrl, label: hi ? "आपकी video" : "Your video" });
        setUploads((u) => [{ url: r.url, thumbUrl: thumbUrl ?? null, name: file.name, at: new Date().toISOString() }, ...u]);
      } else setUpErr(hi ? `Video नहीं चढ़ पाई — ${r.error}` : `Could not add the video — ${r.error}`);
    } catch { setUpErr(hi ? "Video नहीं चढ़ पाई। फिर से कोशिश करें।" : "Could not add the video. Please try again."); }
    finally { setBusy(""); }
  }
  // A second tap before the first answer would make (and maybe start) a second campaign: one request at a time.
  const creating = useRef(false);
  async function create(startNow: boolean) {
    if (!creative || creating.current) return;
    const total = daily * days;
    const when = startDate && startDate > todayIst() ? (hi ? `${dayText(`${startDate}T10:00:00+05:30`)} सुबह 10 बजे से` : `from ${dayText(`${startDate}T10:00:00+05:30`)}, 10 am`) : (hi ? "अभी" : "now");
    if (startNow && !confirm(hi ? `Ad ${when} शुरू होगी। Facebook आपके ad account से रोज़ ${inr(daily)} तक लेगा, ${days} दिन में ज़्यादा से ज़्यादा ${inr(total)}। शुरू करें?` : `The ad starts ${when}. Facebook will take up to ${inr(daily)} a day from your ad account, at most ${inr(total)} in ${days} days. Start?`)) return;
    creating.current = true; setBusy("create"); setCreateErr(""); setStErr(null);
    // the error lands right above the Save / Start buttons; the preview above them is long, so bring it into view
    const fail = (t: string) => { setCreateErr(t); window.setTimeout(() => createErrRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }), 60); };
    try {
      const r = await api<{ ok?: boolean; managerUrl?: string; status?: string; row?: { id: string }; error?: string }>("/api/ads/create", { method: "POST", json: {
        name: copy.headline, goal, creative: { kind: creative.kind, url: abs(creative.url), thumbUrl: creative.thumbUrl ? abs(creative.thumbUrl) : undefined },
        primary_text: copy.primaryText, headline: copy.headline, description: copy.description, link, phone, daily_rupees: daily, days, targeting, placements, start_now: startNow, start_date: startDate || undefined,
      } });
      if (!r.ok) { fail(r.data.error ? friendlyAdError(r.data.error, hi) : (hi ? "Ad नहीं बन पाई। फिर से कोशिश करें।" : "Could not make the ad. Please try again.")); return; }
      setDone({ managerUrl: r.data.managerUrl ?? "", status: r.data.status ?? "PAUSED", id: r.data.row?.id });
      loadMine();
    } catch { fail(hi ? "Internet नहीं चल रहा। फिर से कोशिश करें।" : "No internet. Please try again."); }
    finally { creating.current = false; setBusy(""); }
  }
  // true when Facebook accepted the change; on a failure the reason shows right under THAT ad's Start / Pause button (stErr).
  async function setStatus(id: string, status: "ACTIVE" | "PAUSED"): Promise<boolean> {
    setBusy(`st-${id}`); setStErr(null);
    try {
      const r = await api<{ ok?: boolean; error?: string }>("/api/ads/status", { method: "POST", json: { id, status } });
      if (!r.ok) { setStErr({ id, text: r.data.error ? friendlyAdError(r.data.error, hi) : (hi ? "बदल नहीं पाए। फिर से कोशिश करें।" : "Could not change it. Please try again.") }); return false; }
      loadMine(); return true;
    } catch { setStErr({ id, text: hi ? "Internet नहीं चल रहा। फिर से कोशिश करें।" : "No internet. Please try again." }); return false; }
    finally { setBusy(""); }
  }
  function reset() { setStep(0); setCreative(null); setProductId(""); setCopy({ primaryText: "", headline: "", description: "" }); setDone(null); setUpErr(""); setCopyErr(""); setCreateErr(""); setStErr(null); setOffer(""); setStartDate(""); }
  /** "Run again" (Ads v2): the same picture, goal, audience and words come back into the wizard at the money step — new dates, one check, go. */
  function runAgain(c: CampaignRow) {
    reset();
    if (c.creative_url) setCreative({ kind: c.creative_kind === "video" ? "video" : "image", url: c.creative_url, thumbUrl: c.thumb_url ?? undefined, label: c.name });
    setGoal(c.goal);
    if (c.targeting && typeof c.targeting === "object") setTargeting({ cities: c.targeting.cities ?? [], ageMin: c.targeting.ageMin ?? 21, ageMax: c.targeting.ageMax ?? 60, gender: c.targeting.gender ?? "all", interests: c.targeting.interests ?? [] });
    setPlacements(c.placements === "feeds" || c.placements === "stories" ? c.placements : "auto");
    setDaily(Math.max(AD_BUDGET.minDaily, Math.round(c.daily_paise / 100))); setDays(Math.min(AD_BUDGET.maxDays, Math.max(1, c.days || 5)));
    setCopy({ primaryText: c.primary_text ?? "", headline: c.headline ?? "", description: c.description ?? "" });
    if (c.link) setLink(c.link); if (c.phone) { setPhone(c.phone); setPhoneLocked(false); }
    setTab("new"); setStep(3); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function saveEdit() {
    if (!editing) return;
    setBusy(`ed-${editing.id}`); setEditErr("");
    try {
      const r = await api<{ ok?: boolean; error?: string }>("/api/ads/update", { method: "POST", json: { id: editing.id, daily_rupees: editing.daily, ...(editing.extend ? { extend_days: editing.extend } : {}) } });
      if (!r.ok) { setEditErr(r.data.error ? friendlyAdError(r.data.error, hi) : (hi ? "बदल नहीं पाए।" : "Could not change it.")); return; }
      setEditing(null); await loadMine();
    } catch { setEditErr(hi ? "Internet नहीं चल रहा। फिर से कोशिश करें।" : "No internet. Please try again."); }
    finally { setBusy(""); }
  }
  // Moving between steps: a message about one step's action must not show under another step's buttons.
  function goStep(n: number) { setStep(n); setUpErr(""); setCopyErr(""); setCreateErr(""); }
  function pickCreative(c: Creative, pid?: string) { setCreative(c); setUpErr(""); if (pid !== undefined) setProductId(pid); }
  // Back, everywhere on this page (the arrow at the top and the Back button at the bottom do the same): My ads -> the New ad tab;
  // a later step -> the step before; the first step, the finished screen and the "connect Facebook" screens -> the screen the owner
  // came from (the Create tab when the page was opened fresh). The finished screen never goes back to the form: that would make a second ad.
  function back() {
    const wizard = !!acc && acc.connected && acc.permission === "ok" && acc.accounts.length > 0;
    if (wizard && tab === "mine") { setTab("new"); return; }
    if (wizard && !done && step > 0) { goStep(step - 1); return; }
    goBack(router, "/poster/create");
  }

  const paid = planLoading || plan !== "free";
  const rough = roughResults(daily, days, goal);
  const goalMeta = GOALS.find((g) => g.key === goal)!;
  const selectedAcct = acc?.accounts.find((a) => a.id === acc.selected);
  const audienceLine = useMemo(() => `${targeting.cities.length ? targeting.cities.map((c) => `${c.name}${c.type === "region" ? "" : ` +${c.radius} km`}`).join(", ") : (hi ? "पूरा भारत" : "All India")} · ${targeting.ageMin}–${targeting.ageMax} · ${targeting.gender === "all" ? (hi ? "सब" : "everyone") : hi ? (targeting.gender === "men" ? "पुरुष" : "महिला") : targeting.gender}${targeting.interests.length ? ` · ${targeting.interests.map((i) => i.name).join(", ")}` : ""}`, [targeting, hi]);
  const canNext = [!!creative, true, true, daily >= AD_BUDGET.minDaily && days >= 1, !!copy.primaryText.trim() && !!copy.headline.trim()][step];
  // Why Next / Save / Start is off — said right above those buttons, never a button that is just dead.
  const whyNot = canNext ? "" : [
    hi ? "आगे जाने के लिए ऊपर से कोई poster, product photo या video चुनें, या अपनी photo डालें।" : "To go on, pick a poster, product photo or video above, or add your own photo.",
    "", "",
    daily < AD_BUDGET.minDaily
      ? (hi ? `रोज़ का खर्च कम से कम ${inr(AD_BUDGET.minDaily)} रखें।` : `Spend at least ${inr(AD_BUDGET.minDaily)} a day.`)
      : (hi ? "कम से कम 1 दिन चुनें।" : "Pick at least 1 day."),
    // while the AI is already writing the words, there is nothing for the owner to fix yet
    busy === "copy" ? "" : (hi ? "ad का text और हेडिंग दोनों भरें — या ऊपर 'AI से शब्द लिखवाएँ' दबाएँ।" : "Fill in both the ad text and the heading, or tap 'Write the words with AI' above."),
  ][step];
  const STEPS = hi ? ["Photo या video", "आप क्या चाहते हैं", "कौन देखे", "खर्च", "शब्द और जाँच"] : ["Photo or video", "What you want", "Who sees it", "Spending", "Words and check"];

  /* ---------- gates ---------- */
  const header = (
    <div className="flex items-center gap-2">
      <button type="button" onClick={back} aria-label={hi ? "पीछे" : "Back"} className="text-muted"><ChevronLeft className="h-5 w-5" /></button>
      <h1 className="text-lg font-bold flex-1">Ads Boost <span className="text-sm font-medium text-muted">· Facebook / Instagram</span></h1>
      <div className="flex rounded-full border border-border p-0.5 text-xs font-semibold">
        {(["new", "mine"] as Tab[]).map((k) => <button key={k} type="button" onClick={() => { if (k === "new" && done) reset(); setTab(k); if (k === "mine") loadMine(); }} className={`rounded-full px-3 py-1.5 ${tab === k ? "grad-brand text-white" : "text-muted"}`}>{k === "new" ? (hi ? "नई ad" : "New ad") : (hi ? "मेरी ads" : "My ads")}</button>)}
      </div>
    </div>
  );
  // The first load failed: say so right here with a way to try again, never an endless spinner.
  if (!acc) return chkMsg
    ? <div className="space-y-4">{header}<section className="rounded-2xl border border-border p-4 space-y-2 text-center"><p className="text-sm font-semibold text-danger">{chkMsg}</p><button type="button" onClick={loadAccounts} className="inline-flex items-center gap-1 text-sm font-medium text-brand-ink"><RefreshCw className="h-4 w-4" /> {hi ? "फिर से देखें" : "Try again"}</button></section></div>
    : <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  if (!acc.connected || acc.permission !== "ok") return (
    <div className="space-y-4">
      {header}
      <section className="rounded-2xl border border-border p-4 space-y-3">
        <p className="flex items-center gap-2 text-base font-bold"><Megaphone className="h-5 w-5 text-brand" /> {hi ? "पहले Facebook जोड़ें" : "Connect Facebook first"}</p>
        {!acc.connected
          ? <p className="text-sm text-muted">{hi ? "Ads आपके अपने Facebook ad account से चलती हैं। Connections में अपना Facebook Page जोड़ें और 'Manage ads' की इजाज़त दें।" : "Your ads run from your own Facebook ad account. Open Connections, add your Facebook Page, and say yes to 'Manage ads'."}</p>
          : acc.permission === "missing"
          ? <p className="text-sm text-muted">{hi ? `Facebook (${acc.page}) जुड़ा है, पर अभी ads चलाने की इजाज़त नहीं मिली है। Connections में Facebook हटाकर फिर से जोड़ें — इस बार 'Manage ads' की इजाज़त दें।` : `Facebook (${acc.page}) is connected, but it cannot run ads yet. In Connections, remove Facebook and add it again. This time, say yes to 'Manage ads'.`}</p>
          : <p className="text-sm text-danger">{acc.error || (hi ? "Facebook से जवाब नहीं आया।" : "Facebook did not answer.")}</p>}
        <Link href="/poster/connect" className="inline-flex items-center gap-2 rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white">{hi ? "Connections खोलें" : "Open Connections"} <ChevronRight className="h-4 w-4" /></Link>
        <button type="button" onClick={loadAccounts} className="ml-2 inline-flex items-center gap-1 text-sm font-medium text-brand-ink"><RefreshCw className="h-4 w-4" /> {hi ? "फिर से देखें" : "Check again"}</button>
        {chkMsg && <p className="text-sm font-semibold text-danger">{chkMsg}</p>}
      </section>
      <Guide hi="Ads का पैसा Facebook सीधे आपके ad account (card या UPI) से लेता है — Shubhora के credits नहीं लगते। यहाँ आप ad बनाते हैं, रोज़ का खर्च और दिन तय करते हैं, और Start या Pause करते हैं।" en="Facebook takes the ad money straight from your ad account (card or UPI). No Shubhora credits are used. Here you make the ad, choose how much to spend each day and for how many days, and start or pause it." />
    </div>
  );
  if (!acc.accounts.length) return (
    <div className="space-y-4">
      {header}
      <section className="rounded-2xl border border-border p-4 space-y-3">
        <p className="flex items-center gap-2 text-base font-bold"><Wallet className="h-5 w-5 text-brand" /> {hi ? "Ad account नहीं मिला" : "No ad account found"}</p>
        <p className="text-sm text-muted">{hi ? "इस Facebook login पर अभी कोई ad account नहीं है। 3 minute का काम, एक बार:" : "This Facebook login has no ad account yet. A one-time, 3-minute job:"}</p>
        <ol className="space-y-1.5 text-sm">
          {(hi
            ? ["नीचे 'Ad account बनाएँ' दबाएँ → Meta Business Settings खुलेगा → Add → Create a new ad account।", "नाम कुछ भी (जैसे दुकान का नाम), समय India, currency INR।", "Payment: UPI (prepaid) या card जोड़ें — UPI में पहले ₹500–1,000 डाल दें।", "वापस आकर 'फिर से देखें' दबाएँ।"]
            : ["Tap 'Create ad account' below → Meta Business Settings opens → Add → Create a new ad account.", "Any name (your shop's), time zone India, currency INR.", "Payment: add UPI (prepaid) or a card — with UPI, put in ₹500–1,000 first.", "Come back and tap 'Check again'."]
          ).map((t, i) => <li key={i} className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-bold text-brand-ink">{i + 1}</span><span>{t}</span></li>)}
        </ol>
        <div className="flex flex-wrap gap-2">
          <a href={acc.newAccountUrl || NEW_AD_ACCOUNT_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white">{hi ? "Ad account बनाएँ" : "Create ad account"} <ExternalLink className="h-4 w-4" /></a>
          <button type="button" onClick={loadAccounts} className="inline-flex items-center gap-1 rounded-xl border border-border px-4 py-3 text-sm font-semibold"><RefreshCw className="h-4 w-4" /> {hi ? "फिर से देखें" : "Check again"}</button>
        </div>
        {chkMsg && <p className="text-sm font-semibold text-danger">{chkMsg}</p>}
      </section>
    </div>
  );

  /* ---------- my ads ---------- */
  const importBox = (
    <section className="rounded-2xl border border-dashed border-border p-3 space-y-2">
      <p className="text-sm font-semibold">{hi ? "Facebook Ads Manager में बनी ads" : "Ads made in Facebook Ads Manager"}</p>
      <p className="text-xs text-muted">{hi ? "जो ad आपने सीधे Facebook पर बनाई है, उसे यहाँ जोड़ें — फिर खर्च, chats और रोकें / शुरू करें यहीं से।" : "Add an ad you made directly on Facebook. Then see its spend and chats, and pause or start it from here."}</p>
      {outer === null
        ? <button type="button" disabled={outerBusy === "list"} onClick={loadOuter} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm font-semibold disabled:opacity-60">{outerBusy === "list" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {hi ? "Facebook से ads देखें" : "Show my Facebook ads"}</button>
        : !outer.length ? <p className="text-xs text-muted">{hi ? "कोई नई ad नहीं मिली — सब पहले से यहाँ हैं।" : "No other ads found. They are all here already."}</p>
        : outer.map((o) => (
          <div key={o.campaign_id} className="flex items-center gap-2 rounded-xl bg-surface2 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{o.name}</p>
              <p className="text-[11px] text-muted">{o.effective_status.replace(/_/g, " ").toLowerCase()}{o.daily_paise ? ` · ${inr(o.daily_paise / 100)}/${hi ? "दिन" : "day"}` : ""}{o.goal === "whatsapp" ? " · WhatsApp" : ""}</p>
            </div>
            <button type="button" disabled={!!outerBusy} onClick={() => addOuter(o.campaign_id)} className="shrink-0 rounded-lg grad-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{outerBusy === o.campaign_id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : (hi ? "जोड़ें" : "Add")}</button>
          </div>
        ))}
      {outerErr && <p className={errBox}>{outerErr}</p>}
    </section>
  );
  // Ads v2: every ad with its one-word state, running first; the totals across all of them.
  const adRows = (mine?.campaigns ?? []).map((c) => {
    const l: CampaignLive | undefined = mine!.live[c.campaign_id] ?? ((c.synced_at || c.ended_at) ? { campaign_id: c.campaign_id, status: c.status, effective_status: c.effective_status ?? c.status, spend: (c.spend_paise ?? 0) / 100, impressions: 0, reach: c.reach ?? 0, clicks: 0, results: c.results ?? 0, resultLabel: c.result_label ?? "clicks", chats: c.result_label === "chats" ? c.results ?? 0 : 0, linkClicks: c.result_label === "clicks" ? c.results ?? 0 : 0, start: c.start_time ?? undefined, stop: c.end_time ?? undefined, feedback: c.review_feedback ?? undefined } : undefined);
    return { c, l, state: adStateOf({ effective_status: l?.effective_status ?? c.effective_status, status: l?.status ?? c.status, start_time: l?.start ?? c.start_time, end_time: l?.stop ?? c.end_time, ended_at: c.ended_at }) }; });
  const stateOrder: Record<string, number> = { running: 0, review: 1, scheduled: 2, issue: 3, rejected: 4, paused: 5, ended: 6 };
  adRows.sort((a, b) => stateOrder[a.state] - stateOrder[b.state] || b.c.created_at.localeCompare(a.c.created_at));
  const adTot = adRows.reduce((t, r) => ({ spend: t.spend + (r.l?.spend ?? 0), chats: t.chats + (r.l?.chats ?? 0), clicks: t.clicks + (r.l?.linkClicks ?? r.l?.clicks ?? 0), reach: t.reach + (r.l?.reach ?? 0), running: t.running + (r.state === "running" ? 1 : 0) }), { spend: 0, chats: 0, clicks: 0, reach: 0, running: 0 });
  if (tab === "mine") return (
    <div className="space-y-4">
      {header}
      {!mine ? (mineErr
          ? <section className="rounded-2xl border border-border p-4 space-y-2 text-center"><p className="text-sm font-semibold text-danger">{mineErr}</p><button type="button" onClick={loadMine} className="inline-flex items-center gap-1 text-sm font-medium text-brand-ink"><RefreshCw className="h-4 w-4" /> {hi ? "फिर से देखें" : "Try again"}</button></section>
          : <div className="py-16 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>)
        : !mine.campaigns.length ? <section className="rounded-2xl border border-border p-6 text-center space-y-2"><p className="font-semibold">{hi ? "अभी कोई ad नहीं है" : "No ads yet"}</p><p className="text-sm text-muted">{hi ? "पहली ad 5 आसान कदम में बनाएँ।" : "Make your first ad in 5 easy steps."}</p><button type="button" onClick={() => setTab("new")} className="rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white">{hi ? "नई ad" : "New ad"}</button></section>
        : null}
      {mine && mine.campaigns.length > 0 && (
          <div className="space-y-3">
            {mine.liveError && <p className="text-xs text-muted flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> {hi ? "Facebook से अभी के आँकड़े नहीं मिले — पिछली बार के दिख रहे हैं।" : "Could not get the latest numbers from Facebook — showing the last known ones."}</p>}
            {/* All ads together (Ads v2) */}
            <div className="grid grid-cols-4 gap-2 text-center">
              {[[hi ? "चल रही" : "Running", String(adTot.running)], [hi ? "कुल खर्च" : "Spent in all", inr(adTot.spend)], [hi ? "लोगों तक" : "People reached", adTot.reach.toLocaleString("en-IN")], [adTot.chats ? (hi ? "WhatsApp chats" : "WhatsApp chats") : (hi ? "Link clicks" : "Link clicks"), (adTot.chats || adTot.clicks).toLocaleString("en-IN")]].map(([k, v]) => <div key={k} className="rounded-xl border border-border bg-surface px-1 py-2"><p className="text-base font-extrabold">{v}</p><p className="text-[10px] text-muted">{k}</p></div>)}
            </div>
            <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
            {adRows.map(({ c, l, state }) => {
              const eff = (l?.effective_status ?? c.status).replace(/^(ADSET|CAMPAIGN|AD)_PAUSED$/, "PAUSED");
              // Start / Pause follows what the campaign is SET to, not what it is doing now: a started ad that is still
              // "in review" (or waiting for its start time) will spend once Facebook lets it, so it must offer Pause.
              const switchedOn = (l?.status ?? c.status) === "ACTIVE" && eff !== "PAUSED";
              const G = GOALS.find((g) => g.key === c.goal);
              const st = AD_STATE_TEXT[state];
              const results = l?.chats || l?.linkClicks || l?.clicks || 0;
              const cp = costPer(l?.spend ?? 0, results);
              const ended = state === "ended";
              const isEditing = editing?.id === c.id;
              return (
                <section key={c.id} className={`rounded-2xl border p-3 space-y-2 ${state === "rejected" || state === "issue" ? "border-danger/40" : "border-border"} ${ended ? "opacity-80" : ""}`}>
                  <div className="flex items-start gap-3">
                    {c.creative_url && (c.creative_kind === "video" ? (c.thumb_url ? /* eslint-disable-line @next/next/no-img-element */ <img src={c.thumb_url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover bg-black" /> : <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-black text-white"><Film className="h-6 w-6" /></span>) : <img src={c.creative_url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover bg-surface2" />)}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{c.name}</p>
                      <p className="text-xs text-muted">{hi ? G?.hi : G?.en} · {inr((l?.dailyPaise ?? c.daily_paise) / 100)}/{hi ? "दिन" : "day"}{c.days ? ` · ${c.days} ${hi ? "दिन" : "days"}` : ""}</p>
                      <p className="text-[11px] text-muted">
                        {ended ? `${hi ? "चली" : "Ran"} ${dayText(l?.start ?? c.start_time ?? c.created_at)} – ${dayText(l?.stop ?? c.end_time ?? c.ended_at)}`
                          : state === "scheduled" ? `${hi ? "शुरू" : "Starts"} ${dayText(l?.start ?? c.start_time)}${(l?.stop ?? c.end_time) ? ` · ${hi ? "तक" : "till"} ${dayText(l?.stop ?? c.end_time)}` : ""}`
                          : (l?.stop ?? c.end_time) ? `${hi ? "ख़त्म" : "Ends"} ${dayText(l?.stop ?? c.end_time)}` : new Date(c.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      </p>
                      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{hi ? st.hi : st.en}</span>
                    </div>
                  </div>
                  {(state === "rejected" || state === "issue") && (
                    <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-ink">
                      <b>{hi ? "Facebook ने क्यों रोका:" : "Why Facebook stopped it:"}</b> {l?.feedback || c.review_feedback || (hi ? "कारण नहीं बताया — Ads Manager में देखें।" : "No reason given — see Ads Manager.")}
                      <span className="block text-muted">{hi ? "कोई पैसा नहीं लगा। शब्द या photo बदलकर 'फिर से चलाएँ'।" : "Nothing was charged. Change the words or the picture and 'Run again'."}</span>
                    </p>
                  )}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[[hi ? "खर्च" : "Spent", inr(l?.spend ?? 0)], [hi ? "लोगों तक" : "People reached", (l?.reach ?? 0).toLocaleString("en-IN")], c.goal === "whatsapp" ? [hi ? "WhatsApp chats" : "WhatsApp chats", (l?.chats ?? 0).toLocaleString("en-IN")] : [hi ? "Link clicks" : "Link clicks", (l?.linkClicks ?? l?.clicks ?? 0).toLocaleString("en-IN")], [hi ? "प्रति नतीजा" : "Per result", cp ? `₹${cp}` : "—"]].map(([k, v]) => <div key={k} className="rounded-lg bg-surface2 px-1 py-2"><p className="text-sm font-bold">{v}</p><p className="text-[10px] text-muted">{k}</p></div>)}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ended || state === "rejected" ? (
                      <button type="button" onClick={() => runAgain(c)} className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl grad-brand px-3 py-2.5 text-sm font-semibold text-white"><RotateCcw className="h-4 w-4" /> {hi ? "फिर से चलाएँ" : "Run again"}</button>
                    ) : switchedOn
                      ? <button type="button" disabled={busy === `st-${c.id}`} onClick={() => setStatus(c.id, "PAUSED")} className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold disabled:opacity-60"><Pause className="h-4 w-4" /> {hi ? "रोकें" : "Pause"}</button>
                      : <button type="button" disabled={busy === `st-${c.id}`} onClick={() => { if (confirm(hi ? `Ad शुरू करें? Facebook रोज़ ${inr((l?.dailyPaise ?? c.daily_paise) / 100)} तक लेगा।` : `Start this ad? Facebook will take up to ${inr((l?.dailyPaise ?? c.daily_paise) / 100)} a day.`)) setStatus(c.id, "ACTIVE"); }} className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl grad-brand px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Play className="h-4 w-4" /> {hi ? "शुरू करें" : "Start"}</button>}
                    {!ended && state !== "rejected" && <button type="button" onClick={() => { setEditErr(""); setEditing(isEditing ? null : { id: c.id, daily: Math.round((l?.dailyPaise ?? c.daily_paise) / 100), extend: 0 }); }} className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2.5 text-sm font-semibold ${isEditing ? "border-brand bg-brand-soft text-brand-ink" : "border-border"}`}><SlidersHorizontal className="h-4 w-4" /> {hi ? "पैसे / दिन" : "Money / days"}</button>}
                    {!ended && <button type="button" onClick={() => runAgain(c)} title={hi ? "इसी जैसी नई ad" : "A new ad like this one"} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold"><RotateCcw className="h-4 w-4" /></button>}
                    <a href={managerUrl(c.ad_account, c.campaign_id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold" title="Ads Manager"><ExternalLink className="h-3.5 w-3.5" /></a>
                  </div>
                  {isEditing && editing && (
                    <div className="space-y-2 rounded-xl bg-surface2 p-3">
                      <p className="text-xs font-semibold">{hi ? "रोज़ का खर्च" : "Spend each day"} <span className="font-normal text-muted">{inr(editing.daily)}</span></p>
                      <div className="flex flex-wrap gap-1.5">{[100, 200, 300, 500, 1000].map((v) => <button key={v} type="button" onClick={() => setEditing({ ...editing, daily: v })} className={chip(editing.daily === v)}>{inr(v)}</button>)}<input type="number" min={AD_BUDGET.minDaily} max={AD_BUDGET.maxDaily} value={editing.daily} onChange={(e) => setEditing({ ...editing, daily: Math.min(AD_BUDGET.maxDaily, Math.max(0, Number(e.target.value) || 0)) })} className={`${field} mt-0 max-w-[7rem]`} /></div>
                      <p className="text-xs font-semibold">{hi ? "दिन बढ़ाएँ" : "Extend by"}{(l?.stop ?? c.end_time) ? <span className="font-normal text-muted"> · {hi ? "अभी ख़त्म" : "now ends"} {dayText(l?.stop ?? c.end_time)}</span> : null}</p>
                      <div className="flex flex-wrap gap-1.5">{[0, 3, 7, 14].map((v) => <button key={v} type="button" onClick={() => setEditing({ ...editing, extend: v })} className={chip(editing.extend === v)}>{v === 0 ? (hi ? "वही रहने दें" : "Keep") : `+${v} ${hi ? "दिन" : "days"}`}</button>)}</div>
                      <p className="text-[11px] text-muted">{hi ? `बदलाव के बाद: रोज़ ${inr(editing.daily)} तक${editing.extend ? `, ${extendedEnd(l?.stop ?? c.end_time, editing.extend)} तक` : ""}।` : `After the change: up to ${inr(editing.daily)} a day${editing.extend ? `, till ${extendedEnd(l?.stop ?? c.end_time, editing.extend)}` : ""}.`}</p>
                      {editErr && <p className={errBox}>{editErr}</p>}
                      <div className="flex gap-2">
                        <button type="button" disabled={busy === `ed-${c.id}` || editing.daily < AD_BUDGET.minDaily} onClick={() => void saveEdit()} className="inline-flex items-center gap-1 rounded-xl grad-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === `ed-${c.id}` ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {hi ? "बदलें" : "Save change"}</button>
                        <button type="button" onClick={() => setEditing(null)} className="rounded-xl border border-border px-4 py-2 text-sm">{hi ? "रहने दें" : "Cancel"}</button>
                      </div>
                    </div>
                  )}
                  {stErr?.id === c.id && <p className={errBox}>{stErr.text}</p>}
                </section>
              );
            })}
            </div>
            <p className="text-[11px] text-muted">{hi ? "आँकड़े Facebook से आते हैं (हर घंटे ताज़ा)। नई ad पर 'Facebook जाँच रहा है' दिखता है — आम तौर पर 24 घंटे में मंज़ूरी; live, रुकने या ख़त्म होने पर आपको WhatsApp / notification मिलेगा।" : "Numbers come from Facebook (refreshed hourly). A new ad shows 'In review' — usually approved within 24 hours; you get a WhatsApp / notification when it goes live, is stopped or ends."}</p>
          </div>
      )}
      {mine && importBox}
    </div>
  );

  /* ---------- done ---------- */
  if (done) return (
    <div className="space-y-4">
      {header}
      <section className="rounded-2xl border border-good/40 bg-good/5 p-4 space-y-3 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-good text-white"><Check className="h-6 w-6" /></span>
        <p className="text-base font-bold">{done.status === "ACTIVE" ? (hi ? "Ad शुरू हो गई" : "Your ad has started") : (hi ? "Ad बन गई (अभी चल नहीं रही)" : "Your ad is ready (not running yet)")}</p>
        <p className="text-sm text-muted">{done.status === "ACTIVE"
          ? (hi ? "Facebook पहले इसे जाँचेगा (आम तौर पर 24 घंटे में), फिर ad दिखनी शुरू होगी। 'मेरी ads' में खर्च और नतीजे देखें।" : "Facebook will check it first (usually within 24 hours). Then it starts showing. See what you spent and the results in 'My ads'.")
          : (hi ? "अभी कोई पैसा नहीं लगेगा। जब चाहें, 'मेरी ads' में Start दबाएँ।" : "Nothing is charged yet. Tap Start under 'My ads' whenever you are ready.")}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {done.status !== "ACTIVE" && done.id && <button type="button" disabled={busy.startsWith("st-")} onClick={() => { if (confirm(hi ? `Ad शुरू करें? Facebook रोज़ ${inr(daily)} तक लेगा, ${days} दिन।` : `Start now? Facebook will take up to ${inr(daily)} a day for ${days} days.`)) setStatus(done.id!, "ACTIVE").then((ok) => { if (ok) setDone({ ...done, status: "ACTIVE" }); }); }} className="inline-flex items-center gap-1 rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white"><Play className="h-4 w-4" /> {hi ? "अभी शुरू करें" : "Start now"}</button>}
          <button type="button" onClick={() => { setTab("mine"); reset(); }} className="rounded-xl border border-border px-4 py-3 text-sm font-semibold">{hi ? "मेरी ads" : "My ads"}</button>
          <button type="button" onClick={reset} className="rounded-xl border border-border px-4 py-3 text-sm font-semibold">{hi ? "एक और ad" : "Another ad"}</button>
        </div>
        {stErr && stErr.id === done.id && <p className={errBox}>{stErr.text}</p>}
      </section>
    </div>
  );

  /* ---------- the wizard ---------- */
  return (
    <div className={`space-y-4 ${whyNot ? "pb-40" : "pb-28"}`}>
      {header}
      {!paid && <p className="rounded-lg bg-[#12144a] px-3 py-2 text-xs text-white">{hi ? "Ads बनाना Standard plan में आता है — पहली ad free में आज़माएँ। Facebook का ad खर्च आपके अपने ad account से ही कटता है।" : "Making ads comes with the Standard plan. Try your first ad free. The ad money is always taken from your own ad account."}</p>}
      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs">
        {acc.picture ? /* eslint-disable-line @next/next/no-img-element */ <img src={acc.picture} alt="" className="h-7 w-7 rounded-full" /> : <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-soft text-brand"><Megaphone className="h-4 w-4" /></span>}
        <span className="min-w-0 flex-1 truncate"><b>{acc.page}</b> · {selectedAcct ? `${selectedAcct.name}${selectedAcct.ok ? "" : (hi ? " (बंद है / payment बाकी)" : " (switched off / payment due)")}` : ""}</span>
        {acc.accounts.length > 1 && <select value={acc.selected} onChange={async (e) => { const v = e.target.value; setAcctErr(""); try { const r = await api("/api/ads/accounts", { method: "POST", json: { ad_account: v } }); if (!r.ok) { setAcctErr(hi ? "यह ad account नहीं बदल पाए। फिर से कोशिश करें।" : "Could not switch the ad account. Please try again."); return; } setAcc({ ...acc, selected: v }); } catch { setAcctErr(hi ? "Internet नहीं चल रहा। फिर से कोशिश करें।" : "No internet. Please try again."); } }} className="max-w-[40%] rounded-lg border border-border bg-surface px-2 py-1 text-xs">{acc.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>}
      </div>
      {acctErr && <p className={errBox}>{acctErr}</p>}
      {selectedAcct && (!selectedAcct.ok || selectedAcct.hasFunding === false) && (
        <section className="space-y-2 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-amber-950">
          <p className="flex items-center gap-2 text-sm font-bold"><CreditCard className="h-4 w-4" /> {selectedAcct.hasFunding === false ? (hi ? "पहले पैसे देने का तरीका जोड़ें" : "Add a way to pay first") : (hi ? "यह ad account अभी चालू नहीं है" : "This ad account is not active yet")}</p>
          <p className="text-xs">{selectedAcct.hasFunding === false
            ? (hi ? "Facebook ad का पैसा सीधे आपके ad account से लेता है। इस account में अभी UPI / card नहीं जुड़ा — ad बन तो जाएगी, पर चलेगी नहीं। 2 minute:" : "Facebook takes the ad money straight from your ad account. This account has no UPI / card yet — the ad can be saved, but it will not run. Two minutes:")
            : (hi ? "पैसे देने का तरीका या Facebook की जाँच बाकी है। नीचे खोलकर ठीक करें, फिर 'फिर से देखें'।" : "A way to pay or a Facebook check is still pending. Open it below and fix it, then 'Check again'.")}</p>
          {selectedAcct.hasFunding === false && <ol className="space-y-1 text-xs">{(hi ? ["नीचे 'Payment settings' खोलें → Add payment method।", "UPI चुनें (prepaid — पहले ₹500–1,000 डालें) या card।", "वापस आकर 'फिर से देखें'।"] : ["Open 'Payment settings' below → Add payment method.", "Choose UPI (prepaid — put in ₹500–1,000 first) or a card.", "Come back and tap 'Check again'."]).map((t, i) => <li key={i} className="flex gap-2"><span className="font-bold">{i + 1}.</span><span>{t}</span></li>)}</ol>}
          <div className="flex flex-wrap gap-2">
            <a href={selectedAcct.billingUrl || managerUrl(selectedAcct.id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white">{hi ? "Payment settings खोलें" : "Open Payment settings"} <ExternalLink className="h-3.5 w-3.5" /></a>
            <button type="button" onClick={loadAccounts} className="inline-flex items-center gap-1 rounded-xl border border-amber-400 px-3 py-2 text-xs font-semibold"><RefreshCw className="h-3.5 w-3.5" /> {hi ? "फिर से देखें" : "Check again"}</button>
          </div>
        </section>
      )}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
      <div className="space-y-4">
      {/* steps */}
      <div className="grid grid-cols-5 gap-1">{STEPS.map((t, i) => <button key={t} type="button" disabled={i > step} onClick={() => i <= step && goStep(i)} className={`h-9 rounded-lg text-xs font-bold ${i === step ? "grad-brand text-white" : i < step ? "bg-brand-soft text-brand-ink" : "bg-surface2 text-muted"}`}>{i + 1}</button>)}</div>
      <p className="text-sm font-semibold">{step + 1}/5 · {STEPS[step]}</p>

      {step === 0 && (
        <section className="space-y-4">
          <Guide hi="वही poster या video चुनें जो आप लोगों को दिखाना चाहते हैं। Product की अपनी photo या कोई नई photo भी चलेगी।" en="Pick the poster or video you want people to see. A product photo or a new photo also works." />
          {posters.length > 0 && <div><p className="mb-1.5 text-xs font-semibold text-muted">{hi ? "मेरे posters" : "My posters"}</p><div className="flex gap-2 overflow-x-auto pb-1">{posters.map((p) => <button key={p.id} type="button" onClick={() => pickCreative({ kind: "image", url: p.url, label: p.title })} className={`h-28 w-[88px] shrink-0 overflow-hidden rounded-xl border-2 ${creative?.url === p.url ? "border-brand" : "border-border"}`}>{/* eslint-disable-line @next/next/no-img-element */}<img src={p.url} alt={p.title} className="h-full w-full object-cover" /></button>)}</div></div>}
          {products.some((p) => p.photo_url) && <div><p className="mb-1.5 text-xs font-semibold text-muted">{hi ? "Product की photos" : "Product photos"}</p><div className="flex gap-2 overflow-x-auto pb-1">{products.filter((p) => p.photo_url).map((p) => <button key={p.id} type="button" onClick={() => pickCreative({ kind: "image", url: p.photo_url!, label: p.name }, p.id)} className={`h-24 w-24 shrink-0 overflow-hidden rounded-xl border-2 bg-white ${creative?.url === p.photo_url ? "border-brand" : "border-border"}`}>{/* eslint-disable-line @next/next/no-img-element */}<img src={p.photo_url!} alt={p.name} className="h-full w-full object-contain" /></button>)}</div></div>}
          {uploads.length > 0 && <div><p className="mb-1.5 text-xs font-semibold text-muted">{hi ? "मेरी चढ़ाई हुई videos" : "My uploaded videos"}</p><div className="flex gap-2 overflow-x-auto pb-1">{uploads.map((v) => <button key={v.url} type="button" onClick={() => pickUploaded(v)} className={`relative h-28 w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-black ${creative?.url === v.url ? "border-brand" : "border-transparent"}`}>{v.thumbUrl ? /* eslint-disable-line @next/next/no-img-element */ <img src={v.thumbUrl} alt="" className="h-full w-full object-cover" /> : <video src={videoFrameSrc(v.url)} muted playsInline preload="metadata" className="h-full w-full object-cover" />}<span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[9px] text-white">{new Date(v.at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span></button>)}</div></div>}
          {videos.length > 0 && <div><p className="mb-1.5 text-xs font-semibold text-muted">{hi ? "मेरी videos" : "My videos"}</p><div className="flex gap-2 overflow-x-auto pb-1">{videos.map((j) => <button key={j.id} type="button" onClick={() => pickCreative({ kind: "video", url: j.output_url!, thumbUrl: profile?.logo_url ?? undefined, label: j.input?.title || j.input?.product || "Video" })} className={`relative h-28 w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-black text-white ${creative?.url === j.output_url ? "border-brand" : "border-transparent"}`}><video src={videoFrameSrc(j.output_url!)} muted playsInline preload="metadata" className="h-full w-full object-cover" /><span className="absolute inset-x-0 bottom-0 line-clamp-2 bg-black/60 px-1 py-0.5 text-[9px] leading-tight">{j.input?.title || j.input?.product || new Date(j.created_at).toLocaleDateString("en-IN")}</span></button>)}</div></div>}
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border p-3 text-sm">{busy === "up" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5 text-brand" />} {hi ? "अपनी photo डालें (1080×1080 या 1080×1350 सबसे अच्छी)" : "Add your own photo (1080×1080 or 1080×1350 is best)"}<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ""; upload(f); }} /></label>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border p-3 text-sm">{busy === "upv" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Film className="h-5 w-5 text-brand" />} {busy === "upv" ? `${hi ? "Video चढ़ रही है" : "Uploading video"} ${vidPct}%` : (hi ? "अपनी video डालें (MP4/MOV, 60 MB तक, 9:16 या 1:1 सबसे अच्छी)" : "Add your own video (MP4/MOV, up to 60 MB, 9:16 or 1:1 is best)")}<input type="file" accept="video/mp4,video/quicktime,.mp4,.mov" className="hidden" onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ""; void uploadVid(f); }} /></label>
          {upErr && <p className={errBox}>{upErr}</p>}
          {creative && <p className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-good" /> {creative.kind === "video" ? <Film className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />} {creative.label}</p>}
          {!posters.length && !products.length && !videos.length && <p className="text-xs text-muted">{hi ? "अभी कोई poster या video नहीं है — पहले Home पर आज का poster बनाएँ, या ऊपर photo डालें।" : "You have no poster or video yet. Make today's poster on Home first, or add a photo above."}</p>}
        </section>
      )}

      {step === 1 && (
        <section className="space-y-3">
          <Guide hi="Ad का button क्या करे? ज़्यादातर दुकान और services के लिए WhatsApp सबसे अच्छा रहता है।" en="What should the button do? For most shops and services, WhatsApp works best." />
          {GOALS.map((g) => { const I = g.key === "whatsapp" ? MessageCircle : g.key === "calls" ? Phone : Globe; return (
            <button key={g.key} type="button" onClick={() => setGoal(g.key)} className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left ${goal === g.key ? "border-brand bg-brand-soft/40" : "border-border"}`}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"><I className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{hi ? g.hi : g.en}</span><span className="block text-xs text-muted">{hi ? g.subHi : g.sub}</span></span>
              {goal === g.key && <Check className="h-5 w-5 text-brand" />}
            </button>
          ); })}
          {goal !== "website" && <label className="block text-sm font-semibold">{goal === "whatsapp" ? "WhatsApp number" : (hi ? "Phone number" : "Phone number")}<input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="98765 43210" readOnly={phoneLocked} className={`${field} ${phoneLocked ? "bg-black/[.04] text-muted" : ""}`} />{phoneLocked && <button type="button" onClick={() => setPhoneLocked(false)} className="mt-1 text-xs font-semibold text-brand-ink">{hi ? "इस ad के लिए दूसरा number डालें" : "Use a different number for this ad"}</button>}
            {goal === "whatsapp" && acc?.pageWhatsapp && (phone.replace(/\D/g, "").slice(-10) === acc.pageWhatsapp
              ? <span className="mt-1 block text-xs font-normal text-muted">{hi ? `✓ यह नंबर आपके Facebook Page से जुड़ा है — ad के messages इसी पर आएँगे।` : `✓ This number is linked to your Facebook Page — the ad's messages come here.`}</span>
              : <span className="mt-1 block rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs font-normal text-ink">{hi ? `WhatsApp ad सिर्फ़ उसी नंबर पर खुलता है जो Facebook Page से जुड़ा हो (Page का मुख्य नंबर: +91 ${acc.pageWhatsapp})। यह नंबर Page की Settings → Linked accounts → WhatsApp में जुड़ा हो, तभी ad बनेगा — या ` : `A WhatsApp ad opens only a number linked to your Facebook Page (main number: +91 ${acc.pageWhatsapp}). Link this number in Page Settings → Linked accounts → WhatsApp first — or `}<button type="button" onClick={() => { setPhone(acc.pageWhatsapp ?? ""); setPhoneLocked(true); }} className="font-semibold text-brand-ink underline">{hi ? "मुख्य नंबर लगाएँ" : "use the main number"}</button>.</span>)}
            {goal === "whatsapp" && acc?.connected && acc.permission === "ok" && acc.pageWhatsapp === "" && <span className="mt-1 block rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs font-normal text-ink">{hi ? "आपके Facebook Page से कोई WhatsApp नंबर जुड़ा नहीं दिख रहा। WhatsApp ad के लिए पहले Page की Settings → Linked accounts → WhatsApp में यही नंबर जोड़ें।" : "No WhatsApp number seems linked to your Facebook Page. For a WhatsApp ad, link this number first in Page Settings → Linked accounts → WhatsApp."}</span>}</label>}
          {goal === "website" && <label className="block text-sm font-semibold">{hi ? "कौन-सा link खुले" : "Which link should open"}<input value={link} onChange={(e) => setLink(e.target.value.trim())} inputMode="url" placeholder="https://shubhora.com/c/…" className={field} /><span className="mt-1 block text-xs font-normal text-muted">{hi ? "खाली छोड़ें तो आपके card या website का link लगेगा।" : "Leave it empty to use your card or website link."}</span></label>}
          {products.length > 0 && <div><p className="text-xs font-semibold text-muted mb-1.5">{hi ? "Ad किस product की है? (ज़रूरी नहीं)" : "Which product is the ad for? (optional)"}</p><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setProductId("")} className={chip(!productId)}>{hi ? "पूरा business" : "Whole business"}</button>{products.map((p) => <button key={p.id} type="button" onClick={() => setProductId(p.id)} className={chip(productId === p.id)}>{p.name}</button>)}</div></div>}
          <label className="block text-sm font-semibold">{hi ? "Offer (ज़रूरी नहीं)" : "Offer (optional)"}<input value={offer} onChange={(e) => setOffer(e.target.value)} maxLength={80} placeholder={hi ? "जैसे: इस हफ़्ते 10% छूट" : "e.g. 10% off this week"} className={field} /></label>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <Guide hi="अपने शहर के आस-पास के लोगों को दिखाएँ — पास वाली ads सबसे सस्ती और असरदार होती हैं। 'लोगों की पसंद' भरना ज़रूरी नहीं।" en="Show your ad to people near your town. Nearby ads cost less and work best. You do not have to fill in 'What they like'." />
          <div>
            <p className="text-sm font-semibold flex items-center gap-1.5"><MapPin className="h-4 w-4 text-brand" /> {hi ? "कहाँ" : "Where"}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {/* "All India" is a chip of its own (owner, 21 Oct 2026): one tap clears the towns; adding a town narrows it again. */}
              <button type="button" onClick={() => setTargeting({ ...targeting, cities: [] })} className={chip(targeting.cities.length === 0)}>{hi ? "पूरा India" : "All India"}</button>
              {targeting.cities.map((c) => (
                <span key={c.key} className="inline-flex items-center gap-1 rounded-full border border-brand bg-brand-soft px-3 py-1.5 text-sm">
                  {c.name}{c.type !== "region" && <> · <select value={c.radius} onChange={(e) => setTargeting({ ...targeting, cities: targeting.cities.map((x) => (x.key === c.key ? { ...x, radius: Number(e.target.value) } : x)) })} className="bg-transparent text-sm">{[10, 15, 25, 40, 60, 80].map((r) => <option key={r} value={r}>{r} km</option>)}</select></>}
                  <button type="button" onClick={() => setTargeting({ ...targeting, cities: targeting.cities.filter((x) => x.key !== c.key) })} aria-label={hi ? "हटाएँ" : "Remove"}><X className="h-3.5 w-3.5" /></button>
                </span>
              ))}
              {!targeting.cities.length && <span className="rounded-full border border-brand bg-brand-soft px-3 py-1.5 text-sm">{hi ? "पूरा भारत" : "All India"}</span>}
            </div>
            <div className="relative mt-2">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={hi ? "शहर या ज़िला जोड़ें, जैसे: Rewari" : "Add a town or district, e.g. Rewari"} className={`${field} mt-0`} />
              {hits.length > 0 && <div className="absolute z-10 mt-1 w-full rounded-xl border border-border bg-surface shadow-float">{hits.map((h) => <button key={h.key} type="button" onClick={() => { if (!targeting.cities.some((c) => c.key === h.key)) setTargeting({ ...targeting, cities: [...targeting.cities, { key: h.key, name: h.name, radius: 25, type: h.type === "region" ? "region" : "city" }] }); setQ(""); setHits([]); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-surface2">{h.name}<span className="text-muted"> · {h.region || (h.type === "region" ? (hi ? "राज्य" : "state") : "")}</span></button>)}</div>}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold">{hi ? "उम्र" : "Age"} <span className="font-normal text-muted">{targeting.ageMin}–{targeting.ageMax}</span></p>
            <div className="mt-1 grid grid-cols-2 gap-3">
              <label className="text-xs text-muted">{hi ? "से" : "From"}<input type="range" min={18} max={64} value={targeting.ageMin} onChange={(e) => setTargeting({ ...targeting, ageMin: Math.min(Number(e.target.value), targeting.ageMax - 1) })} className="w-full" /></label>
              <label className="text-xs text-muted">{hi ? "तक" : "To"}<input type="range" min={19} max={65} value={targeting.ageMax} onChange={(e) => setTargeting({ ...targeting, ageMax: Math.max(Number(e.target.value), targeting.ageMin + 1) })} className="w-full" /></label>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold">{hi ? "कौन" : "Who"}</p>
            <div className="mt-1.5 flex gap-2">{([["all", hi ? "सब" : "Everyone"], ["men", hi ? "पुरुष" : "Men"], ["women", hi ? "महिला" : "Women"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setTargeting({ ...targeting, gender: k })} className={chip(targeting.gender === k)}>{l}</button>)}</div>
          </div>
          <div>
            <p className="text-sm font-semibold">{hi ? "लोगों की पसंद (ज़रूरी नहीं)" : "What they like (optional)"}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">{targeting.interests.map((i) => <span key={i.id} className="inline-flex items-center gap-1 rounded-full border border-brand bg-brand-soft px-3 py-1.5 text-sm">{i.name}<button type="button" onClick={() => setTargeting({ ...targeting, interests: targeting.interests.filter((x) => x.id !== i.id) })}><X className="h-3.5 w-3.5" /></button></span>)}</div>
            <div className="relative mt-2">
              <input value={iq} onChange={(e) => setIq(e.target.value)} placeholder={hi ? "जैसे: jewellery, fitness, property" : "e.g. jewellery, fitness, property"} className={`${field} mt-0`} />
              {ihits.length > 0 && <div className="absolute z-10 mt-1 w-full rounded-xl border border-border bg-surface shadow-float">{ihits.map((h) => <button key={h.id} type="button" onClick={() => { if (!targeting.interests.some((c) => c.id === h.id)) setTargeting({ ...targeting, interests: [...targeting.interests, { id: h.id, name: h.name }] }); setIq(""); setIhits([]); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-surface2">{h.name}{h.size ? <span className="text-muted"> · {Math.round(h.size / 100000) / 10} {hi ? "करोड़" : "crore"}</span> : null}</button>)}</div>}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold">{hi ? "कहाँ दिखे" : "Where it shows"}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">{([["auto", hi ? "Facebook + Instagram (अपने-आप)" : "Facebook + Instagram (automatic)"], ["feeds", hi ? "सिर्फ़ feed" : "Feed only"], ["stories", hi ? "Stories और Reels" : "Stories and Reels"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setPlacements(k)} className={chip(placements === k)}>{l}</button>)}</div>
          </div>
          {est && est.monthlyHigh > 0 && <p className="rounded-lg bg-surface2 px-3 py-2 text-xs">{hi ? "इस group में Facebook पर लगभग" : "Facebook says about"} <b>{est.monthlyLow.toLocaleString("en-IN")}–{est.monthlyHigh.toLocaleString("en-IN")}</b> {hi ? "लोग हैं।" : "people are in this group."}</p>}
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          <Guide hi="खर्च रोज़ का है और दिन तय हैं — इससे ज़्यादा Facebook कभी नहीं लेगा। छोटे से शुरू करें, नतीजे देखकर बढ़ाएँ।" en="You choose how much to spend each day and for how many days. Facebook will never take more than this. Start small. Spend more once you see results." />
          <div>
            <p className="text-sm font-semibold">{hi ? "रोज़ का खर्च" : "Spend each day"} <span className="font-normal text-muted">{inr(daily)}/{hi ? "दिन" : "day"}</span></p>
            <div className="mt-1.5 flex flex-wrap gap-2">{[100, 200, 300, 500, 1000].map((v) => <button key={v} type="button" onClick={() => setDaily(v)} className={chip(daily === v)}>{inr(v)}</button>)}</div>
            <input type="number" min={AD_BUDGET.minDaily} max={AD_BUDGET.maxDaily} value={daily} onChange={(e) => setDaily(Math.min(AD_BUDGET.maxDaily, Math.max(0, Number(e.target.value) || 0)))} className={`${field} max-w-[10rem]`} />
          </div>
          <div>
            <p className="text-sm font-semibold">{hi ? "कितने दिन" : "How many days"} <span className="font-normal text-muted">{days}</span></p>
            <div className="mt-1.5 flex flex-wrap gap-2">{[3, 5, 7, 14, 30].map((v) => <button key={v} type="button" onClick={() => setDays(v)} className={chip(days === v)}>{v} {hi ? "दिन" : "days"}</button>)}</div>
          </div>
          <div>
            <p className="text-sm font-semibold flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-brand" /> {hi ? "कब से" : "From when"}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setStartDate("")} className={chip(!startDate)}>{hi ? "जैसे ही शुरू करें" : "As soon as I start it"}</button>
              <button type="button" onClick={() => setStartDate(plusDays(1))} className={chip(startDate === plusDays(1))}>{hi ? "कल सुबह 10 बजे" : "Tomorrow 10 am"}</button>
              <input type="date" min={plusDays(1)} max={plusDays(60)} value={startDate && startDate !== plusDays(1) ? startDate : ""} onChange={(e) => setStartDate(e.target.value)} className={`${field} mt-0 w-auto`} aria-label={hi ? "तारीख चुनें" : "Pick a date"} />
            </div>
            {startDate && <p className="mt-1 text-xs text-muted">{hi ? `${dayText(`${startDate}T10:00:00+05:30`)} सुबह 10 बजे शुरू, ${days} दिन चलेगी — Facebook तब तक पैसा नहीं लेगा।` : `Starts ${dayText(`${startDate}T10:00:00+05:30`)} at 10 am and runs ${days} days — Facebook takes nothing until then.`}</p>}
          </div>
          <div className="rounded-2xl border border-border p-4">
            <p className="text-xs text-muted">{hi ? "कुल खर्च (ज़्यादा से ज़्यादा)" : "Total you can spend (at most)"}</p>
            <p className="text-2xl font-bold">{inr(daily * days)}</p>
            <p className="mt-1 text-sm text-muted">{hi ? "अंदाज़ा:" : "Rough guess:"} <b>{rough.low}–{rough.high}</b> {hi ? (goal === "whatsapp" ? "WhatsApp message" : goal === "calls" ? "call" : "visit") : rough.unit}{est?.daily ? ` · ${hi ? "रोज़ लगभग" : "about"} ${est.daily.toLocaleString("en-IN")} ${hi ? "लोगों तक पहुँच" : "people reached a day"}` : ""}</p>
            <p className="mt-1 text-[11px] text-muted">{hi ? "यह सिर्फ़ अंदाज़ा है — असली नतीजे आपकी ad, offer और इलाके के हिसाब से अलग होंगे। Facebook आपके ad account (card या UPI) से पैसा लेता है, Shubhora के credits से नहीं।" : "This is only a guess. Real results depend on your ad, your offer and your area. Facebook takes the money from your ad account (card or UPI), not from Shubhora credits."}</p>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="space-y-4">
          <Guide hi="AI आपकी दी हुई जानकारी से ad के शब्द लिखता है — पढ़कर अपनी भाषा में ठीक कर लें। नीचे वैसा ही दिखेगा जैसा Facebook पर दिखेगा।" en="The AI writes the ad's words from the details you gave. Read them and change them into your own words. Below is how the ad will look on Facebook." />
          {!copy.primaryText && !busy && <button type="button" onClick={writeWords} className="inline-flex items-center gap-2 rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white"><Sparkles className="h-4 w-4" /> {hi ? "AI से शब्द लिखवाएँ" : "Write the words with AI"}</button>}
          {!copy.primaryText && copyErr && <p className={errBox}>{copyErr}</p>}
          {busy === "copy" && <p className="inline-flex items-center gap-2 text-sm text-muted"><LoaderCircle className="h-4 w-4 animate-spin" /> {hi ? "लिख रहा है…" : "Writing…"}</p>}
          {(copy.primaryText || copy.headline) && (
            <>
              <label className="block text-sm font-semibold">{hi ? "Ad का text" : "Ad text"}<textarea value={copy.primaryText} onChange={(e) => setCopy({ ...copy, primaryText: e.target.value })} rows={5} maxLength={1500} className={field} /></label>
              <div className="grid grid-cols-[1.4fr_1fr] gap-2">
                <label className="block text-sm font-semibold">{hi ? "हेडिंग" : "Heading"}<input value={copy.headline} onChange={(e) => setCopy({ ...copy, headline: e.target.value })} maxLength={40} className={field} /></label>
                <label className="block text-sm font-semibold">{hi ? "छोटी लाइन" : "Short line"}<input value={copy.description} onChange={(e) => setCopy({ ...copy, description: e.target.value })} maxLength={30} className={field} /></label>
              </div>
              <button type="button" onClick={writeWords} disabled={busy === "copy"} className="inline-flex items-center gap-1 text-sm font-medium text-brand-ink disabled:opacity-60"><RefreshCw className="h-4 w-4" /> {hi ? "फिर से लिखवाएँ" : "Write again"}</button>
              {copyErr && <p className={errBox}>{copyErr}</p>}
              {/* the ad as Facebook shows it */}
              <div className="mx-auto max-w-sm overflow-hidden rounded-2xl border border-border bg-white text-[#050505] shadow-card">
                <div className="flex items-center gap-2 px-3 pt-3">{acc.picture ? /* eslint-disable-line @next/next/no-img-element */ <img src={acc.picture} alt="" className="h-9 w-9 rounded-full" /> : <span className="h-9 w-9 rounded-full bg-gray-200" />}<div className="leading-tight"><p className="text-sm font-semibold">{acc.page}</p><p className="text-[11px] text-gray-500">Sponsored · 🌐</p></div></div>
                <p className="whitespace-pre-line px-3 py-2 text-sm">{copy.primaryText}</p>
                {creative?.kind === "video" ? <div className={`grid ${placements === "stories" ? "aspect-[9/16]" : "aspect-square"} place-items-center bg-black text-white`}><Play className="h-12 w-12" /></div> : creative && (
                  <div className={`relative w-full overflow-hidden ${placements === "stories" ? "aspect-[9/16]" : "aspect-square"}`} style={{ backgroundImage: `url(${creative.url})`, backgroundSize: "cover", backgroundPosition: "center" }}>
                    <div className="absolute inset-0 backdrop-blur-xl bg-black/15" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={creative.url} alt="" className="relative h-full w-full object-contain" />
                  </div>
                )}
                <div className="flex items-center gap-3 bg-gray-100 px-3 py-2.5"><div className="min-w-0 flex-1"><p className="truncate text-[11px] uppercase text-gray-500">{goal === "whatsapp" ? "wa.me" : (link || "shubhora.com").replace(/^https?:\/\//, "").split("/")[0]}</p><p className="truncate text-sm font-semibold">{copy.headline}</p>{copy.description && <p className="truncate text-xs text-gray-500">{copy.description}</p>}</div><span className="shrink-0 rounded-md bg-gray-200 px-3 py-1.5 text-sm font-semibold">{goal === "whatsapp" ? "WhatsApp" : goal === "calls" ? "Call now" : "Learn more"}</span></div>
              </div>
              <div className="rounded-2xl border border-border p-3 text-sm space-y-1">
                <p><b>{hi ? "मक़सद:" : "Goal:"}</b> {hi ? goalMeta.hi : goalMeta.en}{goal !== "website" ? ` · ${phone}` : ""}</p>
                <p><b>{hi ? "कौन देखे:" : "Who sees it:"}</b> {audienceLine}</p>
                <p><b>{hi ? "खर्च:" : "Spending:"}</b> {inr(daily)}/{hi ? "दिन" : "day"} × {days} {hi ? "दिन" : "days"} = {hi ? "ज़्यादा से ज़्यादा" : "at most"} {inr(daily * days)}</p>
                <p><b>{hi ? "कब:" : "When:"}</b> {startDate ? `${dayText(`${startDate}T10:00:00+05:30`)} 10 am` : (hi ? "शुरू करते ही" : "as soon as it is started")} · {placements === "stories" ? (hi ? "Stories / Reels (9:16)" : "Stories / Reels (9:16)") : placements === "feeds" ? "Feed (1:1)" : (hi ? "Facebook + Instagram (1:1)" : "Facebook + Instagram (1:1)")}</p>
              </div>
            </>
          )}
          {createErr && <p ref={createErrRef} className={errBox}>{createErr}</p>}
        </section>
      )}

      </div>
      {/* On a computer (Ads v2): what the ad is so far, always in view on the right. */}
      <aside className="hidden lg:block sticky top-4 space-y-3">
        <div className="rounded-2xl border border-border bg-surface p-3 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">{hi ? "आपकी ad" : "Your ad"}</p>
          {step === 4 ? null : creative ? (creative.kind === "video"
            ? <div className={`grid ${placements === "stories" ? "aspect-[9/16] max-h-72 mx-auto" : "aspect-square"} w-full place-items-center overflow-hidden rounded-xl bg-black text-white`}>{creative.thumbUrl ? /* eslint-disable-line @next/next/no-img-element */ <img src={creative.thumbUrl} alt="" className="h-full w-full object-cover opacity-80" /> : <Play className="h-10 w-10" />}</div>
            : <div className={`relative overflow-hidden rounded-xl ${placements === "stories" ? "aspect-[9/16] max-h-80 mx-auto" : "aspect-square"}`} style={{ backgroundImage: `url(${creative.url})`, backgroundSize: "cover", backgroundPosition: "center" }}><div className="absolute inset-0 backdrop-blur-xl bg-black/15" />{/* eslint-disable-line @next/next/no-img-element */}<img src={creative.url} alt="" className="relative h-full w-full object-contain" /></div>)
            : <div className="grid aspect-square place-items-center rounded-xl border border-dashed border-border text-xs text-muted">{hi ? "पहले photo या video चुनें" : "Pick a photo or video first"}</div>}
          <dl className="space-y-1 text-xs">
            <div className="flex justify-between gap-2"><dt className="text-muted">{hi ? "Button" : "Button"}</dt><dd className="text-right font-semibold">{hi ? goalMeta.hi : goalMeta.en}{goal !== "website" && phone ? ` · ${phone}` : ""}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted">{hi ? "कौन देखे" : "Who sees it"}</dt><dd className="text-right font-semibold">{audienceLine}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted">{hi ? "खर्च" : "Spending"}</dt><dd className="text-right font-semibold">{inr(daily)}/{hi ? "दिन" : "day"} × {days} = {inr(daily * days)}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted">{hi ? "कब" : "When"}</dt><dd className="text-right font-semibold">{startDate ? `${dayText(`${startDate}T10:00:00+05:30`)} 10 am` : (hi ? "शुरू करते ही" : "when started")}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted">{hi ? "कहाँ" : "Where"}</dt><dd className="text-right font-semibold">{placements === "stories" ? "Stories / Reels · 9:16" : placements === "feeds" ? "Feed · 1:1" : "FB + IG · 1:1"}</dd></div>
            {est?.daily ? <div className="flex justify-between gap-2"><dt className="text-muted">{hi ? "पहुँच / दिन" : "Reach / day"}</dt><dd className="text-right font-semibold">~{est.daily.toLocaleString("en-IN")}</dd></div> : null}
          </dl>
          {copy.headline && <p className="rounded-lg bg-surface2 px-2 py-1.5 text-xs"><b>{copy.headline}</b>{copy.description ? ` · ${copy.description}` : ""}</p>}
        </div>
        <p className="px-1 text-[11px] text-muted">{hi ? "पैसा Facebook आपके ad account से लेता है; हम बनाते, चलाते और रोकते हैं। Ad बनने के बाद भी पैसे / दिन बदल सकते हैं।" : "Facebook takes the money from your ad account; we make, run and pause. Money and days can be changed after the ad is made too."}</p>
      </aside>
      </div>

      {/* footer buttons */}
      <div className="app-bar app-bar-up fixed bottom-[64px] left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
        <div className="lg:max-w-[calc(100%-364px)]">{/* under the left column on a computer; the summary sits to the right */}
        {whyNot && <p className="mb-2 text-xs font-semibold text-danger">{whyNot}</p>}
        {step < 4 ? (
          <div className="flex gap-2">
            <button type="button" onClick={back} className="inline-flex items-center gap-1 rounded-xl border border-border px-4 py-3 text-sm font-semibold"><ChevronLeft className="h-4 w-4" /> {hi ? "पीछे" : "Back"}</button>
            <button type="button" disabled={!canNext} onClick={() => { goStep(step + 1); if (step === 3 && !copy.primaryText) writeWords(); }} className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">{hi ? "आगे" : "Next"} <ChevronRight className="h-4 w-4" /></button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={() => goStep(3)} aria-label={hi ? "पीछे" : "Back"} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-3 text-sm font-semibold"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" disabled={!canNext || busy === "create"} onClick={() => create(false)} className="flex-1 rounded-xl border border-brand px-3 py-3 text-sm font-semibold text-brand-ink disabled:opacity-40">{busy === "create" ? "…" : (hi ? "सेव करें, शुरू न करें" : "Save, do not start")}</button>
            <button type="button" disabled={!canNext || busy === "create"} onClick={() => create(true)} className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl grad-brand px-3 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy === "create" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {startDate ? (hi ? "तय करें" : "Schedule it") : (hi ? "अभी शुरू करें" : "Start now")}</button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
