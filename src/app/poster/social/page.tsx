"use client";
// Social tab: Facebook | Instagram. One account per provider, picker after
// OAuth, auto-post toggle, post-now, history.
import { ConnectConsent } from "@/components/poster/connect-consent";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, Plus, Trash2, Send, Check } from "lucide-react";
import { api, isLoggedIn, currentProfileId, type Profile, type Poster } from "@/lib/poster-client";
import { ProviderIcon, startConnect, invalidateSocialAccounts, type SocialAccount } from "@/components/poster/social-connect";
import { GooglePanel } from "@/components/poster/google-panel";
import { ReviewsPanel } from "@/components/poster/reviews-panel";
import { VideoPost, type VideoAccount } from "@/components/poster/video-post";
import { useT } from "@/lib/poster-i18n";
import { Guide } from "@/components/poster/guide";


// eslint-disable-next-line @next/next/no-img-element
const Img = (p: { src: string; alt: string; className?: string }) => <img src={p.src} alt={p.alt} className={p.className} />;

type Acct = SocialAccount & { is_active: boolean; auto_post: boolean; auto_post_profile: string | null; plan_on?: boolean };
type Prov = "facebook" | "instagram" | "whatsapp";
type Tab = Prov | "google" | "reviews";
const TABS: Tab[] = ["facebook", "instagram", "whatsapp", "google", "reviews"];

function SocialTabInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const { t, lang } = useT(); const en = lang === "en";
  const [tab, setTab] = useState<Tab>(() => { const q = sp.get("tab"); return (TABS as string[]).includes(q ?? "") ? (q as Tab) : "facebook"; });
  const [list, setList] = useState<Acct[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [trial, setTrial] = useState<{ free: boolean; until: string | null; active: boolean; days_left: number } | null>(null);
  // One message at a time, shown NEXT TO the control that caused it (msgAt = which spot), not in a page-level line.
  const [msg, setMsg] = useState("");
  const [msgAt, setMsgAt] = useState("");
  const [msgOk, setMsgOk] = useState(false);
  const say = (at: string, text: string, ok = false) => { setMsgAt(at); setMsg(text); setMsgOk(ok); };
  const [busy, setBusy] = useState("");
  const [boost, setBoost] = useState<{ open: boolean; daily: number; days: number; msg: string; url?: string }>({ open: false, daily: 200, days: 3, msg: "" });
  const [posts, setPosts] = useState<{ id: string; provider: string; status: string; error: string | null; created_at: string }[]>([]);

  const load = useCallback(async () => {
    try {
      const r = await api<{ configured?: boolean; accounts?: Acct[]; status_trial?: { free: boolean; until: string | null; active: boolean; days_left: number } | null }>("/api/social/accounts");
      setList(r.data.accounts ?? []); setConfigured(!!r.data.configured); setTrial(r.data.status_trial ?? null);
      const h = await api<{ posts?: typeof posts }>("/api/social/history");
      setPosts(h.data.posts ?? []);
    } catch {
      // Offline: never an endless spinner — show the screen and say so where the connect button is.
      setList((l) => l ?? []);
      setMsgAt("connect"); setMsg(lang === "en" ? "No internet right now. Check your connection and try again." : "अभी internet नहीं है। Connection देखकर फिर कोशिश करें।"); setMsgOk(false);
    }
  }, [lang]);

  useEffect(() => {
    (async () => {
      // replace, not push: Back from the login screen must not land here and bounce straight back to it.
      if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(`/poster/social${window.location.search}`)}`); return; }
      const s = sp.get("social");
      if (s === "error") { const r = sp.get("reason") ?? ""; setMsgAt("connect"); setMsgOk(false); setMsg(r === "noinstagram" ? t.igNone : r === "nopages" ? t.fbNone : t.connectFail(r)); }
      invalidateSocialAccounts(); load();
    })();
  }, [router, sp, load, t]);

  const mine = (list ?? []).filter((a) => a.provider === tab);
  const active = mine.find((a) => a.is_active);
  const candidates = mine.filter((a) => !a.is_active);

  // Every action below clears the old message first and, if it fails, says so at ITS OWN spot (see `note`).
  async function connect() { setBusy("connect"); say("", ""); const e = await startConnect("/poster/social", t.connectErr, tab === "instagram" ? "instagram" : "facebook"); if (e) { say("connect", e); setBusy(""); } }
  async function activate(id: string) {
    setBusy(id); say("", "");
    try {
      const r = await api<{ error?: string }>("/api/social/accounts", { method: "PATCH", json: { id, action: "activate" } });
      if (!r.ok) { say("pick", r.data.error || t.error); return; }
      invalidateSocialAccounts(); await load();
    } catch { say("pick", t.error); } finally { setBusy(""); }
  }
  async function remove(id: string) {
    if (!confirm(t.removeAcct)) return;
    say("", "");
    try {
      const r = await api<{ error?: string }>("/api/social/accounts", { method: "DELETE", json: { id } });
      if (!r.ok) { say("head", r.data.error || t.error); return; }
      invalidateSocialAccounts(); load();
    } catch { say("head", t.error); }
  }
  async function toggleAuto(a: Acct) {
    say("", "");
    try {
      const pr = await api<{ profiles: Profile[] }>("/api/poster/profiles");
      const list = pr.data.profiles ?? []; const p = list.find((x) => x.id === currentProfileId()) ?? list.find((x) => x.is_default) ?? list[0];
      const r = await api<{ error?: string }>("/api/social/accounts", { method: "PATCH", json: { id: a.id, action: "auto_post", value: !a.auto_post, profile_id: p?.id } });
      if (!r.ok) { say("auto", r.data.error || t.error); return; }
      invalidateSocialAccounts(); load();
    } catch { say("auto", t.error); }
  }
  async function togglePlan(a: Acct, value: boolean) {
    say("", "");
    try {
      const r = await api<{ error?: string }>("/api/social/accounts", { method: "PATCH", json: { id: a.id, action: "plan_on", value } });
      if (!r.ok) { say("plan", r.data.error || t.error); return; }
      invalidateSocialAccounts(); load();
    } catch { say("plan", t.error); }
  }
  async function toggleWaStatus(value: boolean) {
    say("", "");
    try {
      const r = await api<{ error?: string }>("/api/social/accounts", { method: "PATCH", json: { action: "wa_enable", value } });
      if (!r.ok) { say("wa", r.data.error || t.error); return; }
      invalidateSocialAccounts(); load();
    } catch { say("wa", t.error); }
  }
  async function postNow(a: Acct) {
    setBusy("post"); say("", "");
    try {
      const pr = await api<{ profiles: Profile[] }>("/api/poster/profiles");
      const plist = pr.data.profiles ?? []; const p = plist.find((x) => x.id === currentProfileId()) ?? plist.find((x) => x.is_default) ?? plist[0];
      if (!p) { router.push("/poster/onboard"); return; }
      const td = await api<{ poster?: Poster; theme?: { hi: string } }>(`/api/poster/today?profile=${p.id}`);
      if (!td.data.poster) { say("post", td.data && (td.data as { message?: string }).message || t.error); return; }
      const r = await api<{ ok: boolean; results: { ok: boolean; error?: string }[] }>("/api/social/post", { method: "POST", json: { poster_id: td.data.poster.id, caption: `${td.data.theme?.hi ?? ""} — ${p.name}`, account_ids: [a.id] } });
      say("post", r.data.ok ? t.posted : (r.data.results?.[0]?.error ?? t.postFailed), !!r.data.ok);
      load();
    } catch { say("post", t.error); } finally { setBusy(""); }
  }
  // The one place a message can show. `connect` lands next to whichever connect / change-account button is on screen.
  const connectAt = active ? "head" : candidates.length > 0 ? "pick" : "empty";
  const spot = msgAt === "connect" ? connectAt : msgAt;
  const note = (at: string) => (msg && spot === at
    ? <p role="status" className={`rounded-lg border px-3 py-2 text-sm ${msgOk ? "border-good/40 bg-good/10 text-good" : "border-danger/40 bg-danger/10 text-danger"}`}>{msg}</p>
    : null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-lg font-bold">{t.socialTitle2}</h1><Link href="/poster/report" className="text-xs rounded-full border border-border px-2.5 py-1 font-semibold">📊 {en ? "Report" : "रिपोर्ट"}</Link></div>
      <Guide hi="एक बार अपना Facebook Page / Instagram / WhatsApp जोड़ दें — फिर रोज़ का poster सुबह 4 बजे अपने-आप post होगा।" en="Connect your Facebook Page / Instagram / WhatsApp once — then the daily poster posts itself at 4 AM." />
      <div className="grid grid-cols-5 rounded-xl border border-border p-1 bg-surface text-xs font-semibold">
        {TABS.map((k) => (
          <button key={k} type="button" onClick={() => { setTab(k); say("", ""); }} className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 ${tab === k ? "bg-brand-soft text-brand-ink" : "text-muted"}`}>
            {k === "whatsapp" ? <span className="h-4 w-4 rounded-full bg-[#25D366] inline-block" /> : k === "google" ? <span className="h-4 w-4 rounded-full bg-white border border-border grid place-items-center text-[9px] font-black text-[#4285F4]">G</span> : k === "reviews" ? <span className="text-sm leading-4">⭐</span> : <ProviderIcon provider={k} className="h-4 w-4" />}
            <span>{k === "facebook" ? "FB" : k === "instagram" ? "IG" : k === "whatsapp" ? "Status" : k === "google" ? "Google" : "Reviews"}</span>
          </button>
        ))}
      </div>

      {tab === "google" && <GooglePanel onReviews={() => setTab("reviews")} />}
      {tab === "reviews" && <ReviewsPanel />}

      {tab === "whatsapp" && list !== null && (
        <section className="rounded-xl border border-border p-3 space-y-3">
          <p className="text-sm font-semibold">{t.waStatusTab}</p>
          <p className="text-xs text-muted">{t.waStatusHint}</p>
          {trial?.free && (trial.active
            ? <p className="rounded-lg bg-good/10 px-3 py-2 text-xs font-semibold text-good">{en ? `Free for 14 days on the free plan${trial.until ? ` — ${trial.days_left} day${trial.days_left === 1 ? "" : "s"} left` : ""}. Every morning, an AI poster and a voice video go on your Status.` : `Free plan में भी 14 दिन फ़्री${trial.until ? ` — ${trial.days_left} दिन बाकी` : ""}। रोज़ सुबह AI का poster और आवाज़ वाली video आपके Status पर लगेगी।`}</p>
            : <Link href="/poster/plan" className="block rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs font-semibold">{en ? "Your 14 free days of WhatsApp Status are over — continue with the Standard plan →" : "आपके 14 फ़्री दिन पूरे हुए — रोज़ का Status जारी रखने के लिए Standard plan लें →"}</Link>)}
          <label className="flex items-center justify-between rounded-lg bg-surface2 px-3 py-2.5">
            <span className="text-sm font-medium">{t.waStatusOn}</span>
            <input type="checkbox" className="h-5 w-5" checked={!!mine.find((a) => a.auto_post)} onChange={(e) => void toggleWaStatus(e.target.checked)} />
          </label>
          {note("wa")}
          <Link href="/poster/d/whatsapp" className="block text-sm text-brand-ink">{en ? "Connect WhatsApp AI / see how it is doing →" : "WhatsApp AI जोड़ें / हाल देखें →"}</Link>
        </section>
      )}
      {(tab === "facebook" || tab === "instagram") && (list === null ? <LoaderCircle className="h-5 w-5 animate-spin text-muted" /> : (
        <>
          {candidates.length > 0 && (
            <section className="rounded-xl border border-brand bg-brand-soft p-3 space-y-2">
              <p className="text-sm font-semibold">{t.pickOne}</p>
              {candidates.map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded-lg bg-surface px-2.5 py-2">
                  {a.picture ? <Img src={a.picture} alt="" className="h-8 w-8 rounded-full object-cover" /> : <ProviderIcon provider={a.provider} className="h-8 w-8" />}
                  <p className="text-sm font-medium flex-1 truncate">{a.name}{a.username ? ` (@${a.username})` : ""}</p>
                  <button type="button" onClick={() => activate(a.id)} disabled={busy === a.id} className="rounded-lg grad-brand px-3 py-1.5 text-xs font-semibold text-white">{busy === a.id ? "…" : t.choose}</button>
                </div>
              ))}
              {note("pick")}
            </section>
          )}

          {active ? (
            <section className="rounded-xl border border-border p-3 space-y-3">
              <div className="flex items-center gap-2.5">
                {active.picture ? <Img src={active.picture} alt="" className="h-10 w-10 rounded-full object-cover" /> : <ProviderIcon provider={active.provider} className="h-10 w-10" />}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate flex items-center gap-1.5">{active.name} <Check className="h-4 w-4 text-good" /></p>
                  <p className="text-[11px] text-muted">{active.provider === "instagram" ? `@${active.username}` : t.fbPage}{active.status === "reconnect" ? ` · ${t.reconnect}` : ""}</p>
                </div>
                <button type="button" onClick={connect} className="text-xs text-brand-ink font-medium">{t.changeAcct}</button>
                <button type="button" onClick={() => remove(active.id)} className="text-muted p-1" aria-label={en ? "Remove" : "हटाएँ"}><Trash2 className="h-4 w-4" /></button>
              </div>
              {note("head")}
              <label className="flex items-center justify-between rounded-lg bg-surface2 px-3 py-2.5">
                <span><span className="text-sm font-medium block">{t.autoPost}</span><span className="text-[11px] text-muted">{t.autoPostHint}</span></span>
                <input type="checkbox" className="h-5 w-5 accent-[var(--brand)]" checked={active.auto_post} onChange={() => toggleAuto(active)} />
              </label>
              {note("auto")}
              {active.provider !== "whatsapp" && (
                <div className="space-y-1.5 rounded-lg border border-brand/40 bg-brand-soft/30 p-3">
                  <label className="flex items-center justify-between">
                    <span><span className="block text-sm font-semibold">{en ? "Weekly posting plan" : "हफ़्ते का posting plan"}</span><span className="text-[11px] text-muted">{en ? "Only business posts here. Greetings go on WhatsApp Status." : "यहाँ सिर्फ़ business के posts। शुभकामनाएँ WhatsApp Status पर जाएँगी।"}</span></span>
                    <input type="checkbox" className="h-5 w-5 accent-[var(--brand)]" checked={active.plan_on !== false} onChange={(e) => void togglePlan(active, e.target.checked)} />
                  </label>
                  <ul className="space-y-0.5 text-[11px] text-muted">
                    <li>• <b>{en ? "Every day" : "रोज़"}</b> — {en ? "Story: your product poster as a short video with music" : "Story: आपके product का poster, music के साथ छोटी video बनकर"}</li>
                    <li>• <b>{en ? "Mon, Wed, Fri, Sun" : "सोम, बुध, शुक्र, रवि"}</b> — {en ? "Post: your product poster with a few lines of text and your offer" : "Post: आपके product का poster, कुछ शब्दों और आपके ऑफ़र के साथ"}</li>
                    <li>• <b>{en ? "Tue, Thu, Sat" : "मंगल, गुरु, शनि"}</b> — {en ? "Reel: your own video ad if you made one this week, or else a reel of your photos" : "Reel: इस हफ़्ते बनाई आपकी अपनी video ad, नहीं तो आपकी photos की reel"}</li>
                  </ul>
                  {note("plan")}
                </div>
              )}
              <button type="button" onClick={() => postNow(active)} disabled={busy === "post" || active.status !== "ok"} className="w-full inline-flex items-center justify-center gap-2 rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                {busy === "post" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {t.postNow}
              </button>
              {/* Why the button does nothing: the account needs to be connected again first. */}
              {active.status !== "ok" && <p className="text-xs font-semibold text-danger">{en ? `Reconnect your account first (tap “${t.changeAcct}” above), then post.` : `पहले अपना account दोबारा जोड़ें (ऊपर “${t.changeAcct}” दबाएँ), फिर post करें।`}</p>}
              {note("post")}
              {/* Apni video (owner, 21 Oct 2026): a video from the phone to this Page / Instagram, Facebook + Instagram in one go. */}
              {active.provider !== "whatsapp" && (
                <VideoPost en={en} current={active.id} onPosted={load}
                  accounts={(list ?? []).filter((a): a is Acct & { provider: "facebook" | "instagram" } => a.is_active && (a.provider === "facebook" || a.provider === "instagram")).map((a): VideoAccount => ({ id: a.id, provider: a.provider, name: a.name, status: a.status }))} />
              )}
              {active.provider === "facebook" && (
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <button type="button" onClick={() => setBoost({ ...boost, open: !boost.open })} className="w-full text-left text-sm font-semibold">🚀 {t.tabMore === "और" ? "Boost — Facebook / Instagram पर ad चलवाएँ (पहले बनेगी पर चलेगी नहीं, आप Start दबाएँ)" : "Boost — pay to show this on Facebook / Instagram (it is made but does not run until you press Start)"}</button>
                  {boost.open && (
                    <div className="space-y-2 text-sm">
                      <label className="flex items-center justify-between">₹/{t.tabMore === "और" ? "दिन" : "day"}<input type="number" min={100} max={5000} value={boost.daily} onChange={(e) => setBoost({ ...boost, daily: Number(e.target.value) })} className="w-24 rounded-lg border border-border px-2 py-1 text-right" /></label>
                      <label className="flex items-center justify-between">{t.tabMore === "और" ? "दिन" : "Days"}<input type="number" min={1} max={30} value={boost.days} onChange={(e) => setBoost({ ...boost, days: Number(e.target.value) })} className="w-24 rounded-lg border border-border px-2 py-1 text-right" /></label>
                      <button type="button" disabled={busy === "boost"} onClick={async () => {
                        setBusy("boost"); setBoost({ ...boost, msg: "" });
                        try {
                        const pr = await api<{ profiles: Profile[] }>("/api/poster/profiles"); const plist = pr.data.profiles ?? []; const p = plist.find((x) => x.id === currentProfileId()) ?? plist.find((x) => x.is_default) ?? plist[0];
                        const td = p ? await api<{ poster?: Poster }>(`/api/poster/today?profile=${p.id}`) : null;
                        if (!td?.data.poster) { setBoost({ ...boost, msg: t.error }); return; }
                        const r = await api<{ ok?: boolean; managerUrl?: string; error?: string }>("/api/social/boost", { method: "POST", json: { poster_id: td.data.poster.id, daily_rupees: boost.daily, days: boost.days } });
                        setBoost({ ...boost, msg: r.ok ? (t.tabMore === "और" ? "✅ Ad बन गई, अभी चल नहीं रही — Ads Manager में Start दबाएँ" : "✅ Ad made, but not running yet. Press Start in Ads Manager.") : (r.data.error ?? t.error), url: r.data.managerUrl });
                        } catch { setBoost({ ...boost, msg: t.error }); } finally { setBusy(""); }
                      }} className="w-full rounded-lg bg-[#1877F2] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy === "boost" ? "…" : (t.tabMore === "और" ? "Ad बनाओ — अभी शुरू नहीं होगी (₹0 अभी)" : "Make the ad (it will not start yet, ₹0 now)")}</button>
                      {boost.msg && <p className="text-xs">{boost.msg} {boost.url && <a href={boost.url} target="_blank" rel="noreferrer" className="text-brand-ink underline">Ads Manager →</a>}</p>}
                    </div>
                  )}
                </div>
              )}
            </section>
          ) : candidates.length === 0 && (
            <section className="rounded-xl border border-border p-4 text-center space-y-3">
              <ProviderIcon provider={tab} className="h-12 w-12 mx-auto" />
              <p className="text-sm text-muted">{t.notConnected}</p>
              <ConnectConsent kind={tab === "instagram" ? "instagram" : "facebook"} />
              <button type="button" onClick={connect} disabled={busy === "connect" || !configured} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#1877F2] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                {busy === "connect" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {tab === "facebook" ? t.connectFb : t.connectIg}
              </button>
              {!configured && <p className="text-[11px] text-faint">{t.socialSoon}</p>}
              {note("empty")}
              <Link href={`/poster/guide/${tab}`} className="block text-xs text-brand-ink">{tab === "facebook" ? (t.fbTab + " Page " + (t.tabMore === "और" ? "कैसे बनाएँ?" : "— how to make one?")) : (t.tabMore === "और" ? "Instagram को Professional account कैसे बनाएँ?" : "How to switch Instagram to a Professional account?")} →</Link>
            </section>
          )}

          <section className="space-y-1.5">
            <p className="text-sm font-semibold">{t.postHistory}</p>
            {posts.filter((p) => p.provider === tab).length === 0 && <p className="text-xs text-muted">{t.noPosts}</p>}
            {posts.filter((p) => p.provider === tab).slice(0, 10).map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-xs rounded-lg border border-border px-3 py-2">
                <span className={p.status === "ok" ? "text-good" : "text-danger"}>{p.status === "ok" ? "✓" : "✕"}</span>
                <span className="flex-1 truncate">{new Date(p.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}{p.error ? ` · ${p.error}` : ""}</span>
              </div>
            ))}
          </section>
        </>
      ))}
    </div>
  );
}

export default function SocialTab() {
  return <Suspense fallback={<div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}><SocialTabInner /></Suspense>;
}
