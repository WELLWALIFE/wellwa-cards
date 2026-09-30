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
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const [boost, setBoost] = useState<{ open: boolean; daily: number; days: number; msg: string; url?: string }>({ open: false, daily: 200, days: 3, msg: "" });
  const [posts, setPosts] = useState<{ id: string; provider: string; status: string; error: string | null; created_at: string }[]>([]);

  const load = useCallback(async () => {
    const r = await api<{ configured?: boolean; accounts?: Acct[]; status_trial?: { free: boolean; until: string | null; active: boolean; days_left: number } | null }>("/api/social/accounts");
    setList(r.data.accounts ?? []); setConfigured(!!r.data.configured); setTrial(r.data.status_trial ?? null);
    const h = await api<{ posts?: typeof posts }>("/api/social/history");
    setPosts(h.data.posts ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      if (!(await isLoggedIn())) { router.push("/login?next=/poster/social"); return; }
      const s = sp.get("social");
      if (s === "error") { const r = sp.get("reason") ?? ""; setMsg(r === "noinstagram" ? t.igNone : r === "nopages" ? t.fbNone : t.connectFail(r)); }
      invalidateSocialAccounts(); load();
    })();
  }, [router, sp, load, t]);

  const mine = (list ?? []).filter((a) => a.provider === tab);
  const active = mine.find((a) => a.is_active);
  const candidates = mine.filter((a) => !a.is_active);

  async function connect() { setBusy("connect"); setMsg(""); const e = await startConnect("/poster/social", t.connectErr, tab === "instagram" ? "instagram" : "facebook"); if (e) { setMsg(e); setBusy(""); } }
  async function activate(id: string) { setBusy(id); await api("/api/social/accounts", { method: "PATCH", json: { id, action: "activate" } }); invalidateSocialAccounts(); await load(); setBusy(""); }
  async function remove(id: string) { if (!confirm(t.removeAcct)) return; await api("/api/social/accounts", { method: "DELETE", json: { id } }); invalidateSocialAccounts(); load(); }
  async function toggleAuto(a: Acct) {
    const pr = await api<{ profiles: Profile[] }>("/api/poster/profiles");
    const list = pr.data.profiles ?? []; const p = list.find((x) => x.id === currentProfileId()) ?? list.find((x) => x.is_default) ?? list[0];
    await api("/api/social/accounts", { method: "PATCH", json: { id: a.id, action: "auto_post", value: !a.auto_post, profile_id: p?.id } });
    invalidateSocialAccounts(); load();
  }
  async function postNow(a: Acct) {
    setBusy("post"); setMsg("");
    const pr = await api<{ profiles: Profile[] }>("/api/poster/profiles");
    const plist = pr.data.profiles ?? []; const p = plist.find((x) => x.id === currentProfileId()) ?? plist.find((x) => x.is_default) ?? plist[0];
    if (!p) { router.push("/poster/onboard"); return; }
    const td = await api<{ poster?: Poster; theme?: { hi: string } }>(`/api/poster/today?profile=${p.id}`);
    if (!td.data.poster) { setMsg(td.data && (td.data as { message?: string }).message || t.error); setBusy(""); return; }
    const r = await api<{ ok: boolean; results: { ok: boolean; error?: string }[] }>("/api/social/post", { method: "POST", json: { poster_id: td.data.poster.id, caption: `${td.data.theme?.hi ?? ""} — ${p.name}`, account_ids: [a.id] } });
    setMsg(r.data.ok ? t.posted : (r.data.results?.[0]?.error ?? t.postFailed)); setBusy(""); load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-lg font-bold">{t.socialTitle2}</h1><Link href="/poster/report" className="text-xs rounded-full border border-border px-2.5 py-1 font-semibold">📊 Report</Link></div>
      <Guide hi="एक बार अपना Facebook Page / Instagram / WhatsApp जोड़ दें — फिर रोज़ का poster सुबह 4 बजे अपने-आप post होगा।" en="Connect your Facebook Page / Instagram / WhatsApp once — then the daily poster posts itself at 4 AM." />
      <div className="grid grid-cols-5 rounded-xl border border-border p-1 bg-surface text-xs font-semibold">
        {TABS.map((k) => (
          <button key={k} type="button" onClick={() => { setTab(k); setMsg(""); }} className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 ${tab === k ? "bg-brand-soft text-brand-ink" : "text-muted"}`}>
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
            ? <p className="rounded-lg bg-good/10 px-3 py-2 text-xs font-semibold text-good">{en ? `Free for 14 days on the free plan${trial.until ? ` — ${trial.days_left} day${trial.days_left === 1 ? "" : "s"} left` : ""}: the AI poster + voice video on your Status every morning.` : `Free plan में भी 14 दिन फ़्री${trial.until ? ` — ${trial.days_left} दिन बाकी` : ""}: रोज़ सुबह AI poster + voice video आपके Status पर।`}</p>
            : <Link href="/poster/plan" className="block rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs font-semibold">{en ? "Your 14 free days of WhatsApp Status are over — continue with the Growth plan →" : "आपके 14 फ़्री दिन पूरे हुए — रोज़ का Status जारी रखने के लिए Growth plan लें →"}</Link>)}
          <label className="flex items-center justify-between rounded-lg bg-surface2 px-3 py-2.5">
            <span className="text-sm font-medium">{t.waStatusOn}</span>
            <input type="checkbox" className="h-5 w-5" checked={!!mine.find((a) => a.auto_post)} onChange={async (e) => { await api("/api/social/accounts", { method: "PATCH", json: { action: "wa_enable", value: e.target.checked } }); invalidateSocialAccounts(); load(); }} />
          </label>
          <Link href="/poster/d/whatsapp" className="block text-sm text-brand-ink">WhatsApp AI connect / status →</Link>
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
                <button type="button" onClick={() => remove(active.id)} className="text-muted p-1" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
              </div>
              <label className="flex items-center justify-between rounded-lg bg-surface2 px-3 py-2.5">
                <span><span className="text-sm font-medium block">{t.autoPost}</span><span className="text-[11px] text-muted">{t.autoPostHint}</span></span>
                <input type="checkbox" className="h-5 w-5 accent-[var(--brand)]" checked={active.auto_post} onChange={() => toggleAuto(active)} />
              </label>
              {active.provider !== "whatsapp" && (
                <div className="space-y-1.5 rounded-lg border border-brand/40 bg-brand-soft/30 p-3">
                  <label className="flex items-center justify-between">
                    <span><span className="block text-sm font-semibold">Weekly content plan</span><span className="text-[11px] text-muted">Business posts only — greetings stay on WhatsApp Status</span></span>
                    <input type="checkbox" className="h-5 w-5 accent-[var(--brand)]" checked={active.plan_on !== false} onChange={async (e) => { await api("/api/social/accounts", { method: "PATCH", json: { id: active.id, action: "plan_on", value: e.target.checked } }); invalidateSocialAccounts(); load(); }} />
                  </label>
                  <ul className="space-y-0.5 text-[11px] text-muted">
                    <li>• <b>Every day</b> — Story: your product poster as a short video with music</li>
                    <li>• <b>Mon, Wed, Fri, Sun</b> — post: product poster with caption and your offer</li>
                    <li>• <b>Tue, Thu, Sat</b> — Reel: your own ad if you made one this week, otherwise a photo reel</li>
                  </ul>
                </div>
              )}
              <button type="button" onClick={() => postNow(active)} disabled={busy === "post" || active.status !== "ok"} className="w-full inline-flex items-center justify-center gap-2 rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                {busy === "post" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {t.postNow}
              </button>
              {active.provider === "facebook" && (
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <button type="button" onClick={() => setBoost({ ...boost, open: !boost.open })} className="w-full text-left text-sm font-semibold">🚀 {t.tabMore === "और" ? "Boost — Facebook/Instagram पर paid ad (PAUSED बनेगा, आप Start करें)" : "Boost — paid FB/IG ad (created PAUSED, you press Start)"}</button>
                  {boost.open && (
                    <div className="space-y-2 text-sm">
                      <label className="flex items-center justify-between">₹/{t.tabMore === "और" ? "दिन" : "day"}<input type="number" min={100} max={5000} value={boost.daily} onChange={(e) => setBoost({ ...boost, daily: Number(e.target.value) })} className="w-24 rounded-lg border border-border px-2 py-1 text-right" /></label>
                      <label className="flex items-center justify-between">{t.tabMore === "और" ? "दिन" : "Days"}<input type="number" min={1} max={30} value={boost.days} onChange={(e) => setBoost({ ...boost, days: Number(e.target.value) })} className="w-24 rounded-lg border border-border px-2 py-1 text-right" /></label>
                      <button type="button" disabled={busy === "boost"} onClick={async () => {
                        setBusy("boost"); setBoost({ ...boost, msg: "" });
                        const pr = await api<{ profiles: Profile[] }>("/api/poster/profiles"); const plist = pr.data.profiles ?? []; const p = plist.find((x) => x.id === currentProfileId()) ?? plist.find((x) => x.is_default) ?? plist[0];
                        const td = p ? await api<{ poster?: Poster }>(`/api/poster/today?profile=${p.id}`) : null;
                        if (!td?.data.poster) { setBoost({ ...boost, msg: t.error }); setBusy(""); return; }
                        const r = await api<{ ok?: boolean; managerUrl?: string; error?: string }>("/api/social/boost", { method: "POST", json: { poster_id: td.data.poster.id, daily_rupees: boost.daily, days: boost.days } });
                        setBoost({ ...boost, msg: r.ok ? (t.tabMore === "और" ? "✅ Ad PAUSED बन गया — Ads Manager में Start करें" : "✅ Ad created PAUSED — start it in Ads Manager") : (r.data.error ?? t.error), url: r.data.managerUrl }); setBusy("");
                      }} className="w-full rounded-lg bg-[#1877F2] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy === "boost" ? "…" : (t.tabMore === "और" ? "PAUSED ad बनाओ (₹0 अभी)" : "Create PAUSED ad (₹0 now)")}</button>
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
              <Link href={`/poster/guide/${tab}`} className="block text-xs text-brand-ink">{tab === "facebook" ? (t.fbTab + " Page " + (t.tabMore === "और" ? "कैसे बनाएँ?" : "— how to create?")) : (t.tabMore === "और" ? "Instagram Professional कैसे करें?" : "How to make Instagram professional?")} →</Link>
            </section>
          )}
          {msg && <p className="text-sm text-ink rounded-lg bg-surface2 px-3 py-2">{msg}</p>}

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
