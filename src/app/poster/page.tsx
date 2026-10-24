"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SubscribeButton } from "@/components/subscribe-button";
import { usePlan } from "@/lib/plan";
import { LoaderCircle, ChevronDown, Sparkles, WifiOff, RotateCw } from "lucide-react";
import { BusinessStrip } from "@/components/poster/business-strip";
import { ShareLinks } from "@/components/poster/share-links";
import { api, isLoggedIn, currentProfileId, setCurrentProfileId, captureRef, PERSONAS, type Profile, type Poster, type Quota } from "@/lib/poster-client";
import { PosterCard } from "@/components/poster/poster-card";
import { PremiumCard } from "@/components/poster/premium-lock";
import { PremiumUpgrade } from "@/components/poster/premium-upgrade";
import { PremiumLine } from "@/components/poster/premium-line";
import { CardRenewBanner } from "@/components/poster/card-renew-banner";
import { HomeHeader, TodayWork, QuickGrid } from "@/components/poster/home-parts";
import { FinishBar } from "@/components/poster/site-finish";

import { useT } from "@/lib/poster-i18n";

type TodayResp = { poster?: Poster; date?: string; theme?: { hi: string; en: string; greet: string }; quota?: Quota; style?: string; error?: string; message?: string; overrides?: { title?: string; custom?: string; accent?: string } | null; card_url?: string; join_url?: string };

/** What goes with a shared poster: the day's written caption (about the product / plan), always with the owner's
 *  V-Card link — on WhatsApp and Facebook the link opens with one tap (owner's call, 25 Sep 2026). */
function shareCaption(today: TodayResp | null, profile: Profile | null): string {
  const url = today?.card_url ?? "";
  const pen = profile?.lang === "en";
  const linkLine = url ? `👉 ${pen ? "My digital card" : profile?.lang === "hinglish" ? "Mera digital card" : "मेरा digital card"}: ${url}` : "";
  const written = today?.poster?.caption?.trim();
  let out: string;
  if (written) {
    const base = url.split("?")[0]; // a caption written before 25 Sep 2026 carries the plain link (a website on a computer)
    out = !url || written.includes(url) ? written : written.includes(base) ? written.split(base).join(url) : `${written}\n\n${linkLine}`;
  } else {
    out = [
      `${(pen ? today?.theme?.en : today?.theme?.hi) ?? ""} — ${profile?.name ?? ""}`,
      profile?.phone ? `📞 Call/WhatsApp: ${profile.phone}` : "",
      linkLine,
    ].filter(Boolean).join("\n");
  }
  // Shared from the app = WhatsApp: no hashtags, and the owner's joining link under the card link
  // (owner's call, 29 Sep 2026: "mera card" + "make your free card" on every status).
  out = out.replace(/(^|\s)#[\p{L}\p{M}\p{N}_]+/gu, "$1").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const join = today?.join_url ?? "";
  if (join && !out.includes("/signup?by=")) out += `${/(^|\n)(📞|👉)[^\n]*$/.test(out) ? "\n" : "\n\n"}✨ ${pen ? "Make your free digital card" : profile?.lang === "hinglish" ? "Apna free digital card banayein" : "अपना free digital card बनाएँ"}: ${join}`;
  return out;
}


type Kind = "loading" | "free" | "standard" | "premium";
/** What the signed-in person has: nothing paid (free), a running Standard plan, or Premium. A visitor who is not signed in is "free". */
function usePlanKind(): Kind {
  const { plan, loading } = usePlan();
  const [r, setR] = useState<{ premium?: boolean; state?: string } | null>(null);
  useEffect(() => { api<{ premium?: boolean; state?: string }>("/api/poster/plan").then((x) => setR(x.ok ? x.data : {})).catch(() => setR({})); }, []);
  if (loading || r === null) return "loading";
  if (r.premium) return "premium";
  return plan !== "free" || r.state === "active" || r.state === "grace" ? "standard" : "free";
}

/** The first screen for someone who has not made anything yet: what they are about to make depends on what they have. */
function firstRun(kind: Kind, en: boolean) {
  if (kind === "standard" || kind === "premium") {
    const premium = kind === "premium";
    return {
      title: en ? "Make your website and digital card\nin 5 minutes." : "अपनी website और digital card\n5 मिनट में बनाएँ।",
      sub: en ? "Answer a few simple questions. We make your website and your card for you, together, on one link." : "कुछ आसान सवालों के जवाब दें। आपकी website और card हम साथ में, एक ही link पर बना देंगे।",
      bullets: premium
        ? (en ? ["Your website and digital card on one link", "Then your Premium website: many pages, made for your business, with Google SEO", "A new poster every day, ready to share"] : ["आपकी website और digital card — एक ही link पर", "फिर आपकी Premium website: कई pages, आपके business के लिए, Google SEO के साथ", "रोज़ नया poster, share करने के लिए तैयार"])
        : (en ? ["Your website (up to 5 pages) and digital card on one link", "A new poster every day, ready to share", "Add products and photos afterwards, whenever you like"] : ["आपकी website (5 pages तक) और digital card — एक ही link पर", "रोज़ नया poster, share करने के लिए तैयार", "products और photos बाद में, जब चाहें जोड़ें"]),
      button: en ? "Make my website & card" : "मेरी website और card बनाएँ",
      note: premium ? (en ? "Your Premium website is one tap away once the first one is made." : "पहली website बनते ही आपकी Premium website बस एक tap दूर है।") : "",
    };
  }
  return null;
}

export default function TodayPage() {
  const router = useRouter();
  const kind = usePlanKind();
  const [phase, setPhase] = useState<"loading" | "welcome" | "noprofile" | "ready" | "offline">("loading");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [today, setToday] = useState<TodayResp | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const { t, lang } = useT();

  const [style, setStyle] = useState<string>("");
  const [restyling, setRestyling] = useState(false);
  const [day, setDay] = useState<"today" | "tomorrow">("today");
  const [tomorrow] = useState(() => new Date(Date.now() + 5.5 * 3600e3 + 86400e3).toISOString().slice(0, 10));
  // Only the latest request may fill the screen: tapping Today → Tomorrow (or another profile) while the first poster is
  // still being made used to let the slower, older answer land last and show the wrong day's poster.
  const loadSeq = useRef(0);
  const loadPoster = useCallback(async (p: Profile, force = false, st?: string, which: "today" | "tomorrow" = day) => {
    const seq = ++loadSeq.current;
    if (st) setRestyling(true); else setBusy(true);
    setErr("");
    let r: { ok: boolean; status: number; data: TodayResp };
    try {
      r = await api<TodayResp>(`/api/poster/today?profile=${p.id}${which === "tomorrow" ? `&date=${tomorrow}` : ""}${force ? "&force=1" : ""}${st ? `&style=${st}` : ""}`);
      if (seq !== loadSeq.current) return;
    } catch {
      if (seq !== loadSeq.current) return;
      // The connection dropped (phone switching Wi-Fi / mobile data): say so, with a retry — never an endless spinner.
      setBusy(false); setRestyling(false);
      setErr(lang === "en" ? "No internet right now. Check your connection and tap Try again." : "अभी internet नहीं है। Connection देखकर Try again दबाएँ।");
      return;
    }
    setBusy(false); setRestyling(false);
    if (r.ok && r.data.style) setStyle(r.data.style);
    if (r.status === 402) { setToday(r.data); return; }
    if (!r.ok) { setErr(r.data.message || r.data.error || t.error); return; }
    setToday(r.data);
  }, [t, day, tomorrow, lang]);

  const boot = useCallback(async () => {
    setPhase("loading");
    try {
      if (!(await isLoggedIn())) { setPhase("welcome"); return; }
      const r = await api<{ profiles: Profile[] }>("/api/poster/profiles");
      if (r.status === 401) { setPhase("welcome"); return; }
      if (!r.ok) { setPhase("offline"); return; }
      const list = r.data.profiles ?? [];
      setProfiles(list);
      if (!list.length) { setPhase("noprofile"); return; }
      const want = currentProfileId();
      const p = list.find((x) => x.id === want) ?? list.find((x) => x.is_default) ?? list[0];
      setProfile(p); setCurrentProfileId(p.id); setPhase("ready");
      loadPoster(p);
    } catch { setPhase("offline"); }
  }, [loadPoster]);
  const booted = useRef(false);
  useEffect(() => {
    // Once per visit: loadPoster changes with the Today/Tomorrow tab, and running this again asked for the same poster twice.
    if (booted.current) return;
    booted.current = true;
    captureRef();
    boot();
  }, [boot]);

  if (phase === "loading" || ((phase === "noprofile" || phase === "welcome") && kind === "loading")) return <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  if (phase === "offline") return (
    <div className="py-20 text-center space-y-3">
      <WifiOff className="h-8 w-8 text-muted mx-auto" />
      <p className="font-semibold">{lang === "en" ? "Could not load your posters" : "आपके posters load नहीं हुए"}</p>
      <p className="text-sm text-muted">{lang === "en" ? "Check your internet connection and try again." : "Internet connection देखकर फिर से कोशिश करें।"}</p>
      <button type="button" onClick={() => boot()} className="inline-flex items-center gap-1.5 rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white"><RotateCw className="h-4 w-4" /> {lang === "en" ? "Try again" : "फिर से कोशिश करें"}</button>
    </div>
  );

  if (phase === "welcome" || phase === "noprofile") {
    const fr = firstRun(kind, lang === "en");
    const en = lang === "en";
    // Free (or not signed in yet): the paid plans lead, the free card is a small way in at the bottom (owner, 18 Oct 2026).
    if (!fr) {
      const go = () => router.push("/poster/onboard");
      const li = (t: string) => <li key={t} className="flex items-start gap-2"><span className="mt-0.5 text-[#ffd54a]">✔</span><span>{t}</span></li>;
      const lj = (t: string) => <li key={t} className="flex items-start gap-2"><span className="mt-0.5 text-good">✔</span><span>{t}</span></li>;
      return (
        <div className="space-y-4 py-6">
          <div className="px-1">
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight">{en ? "Get your business online" : "अपना business online लाएँ"}</h1>
            <p className="mt-1 text-sm text-muted">{en ? "Choose a plan. You are live in about 5 minutes." : "एक plan चुनिए। करीब 5 मिनट में आप live हैं।"}</p>
          </div>

          {/* Premium: the one to take */}
          <div className="relative overflow-hidden rounded-3xl bg-[#12144a] p-5 text-white shadow-float">
            <span className="absolute right-4 top-4 rounded-full bg-[#ffd54a] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[#12144a]">{en ? "Most popular" : "सबसे ज़्यादा चुना गया"}</span>
            <p className="text-sm font-semibold text-white/70">Premium</p>
            <p className="mt-1 flex items-baseline gap-2"><span className="text-4xl font-extrabold tracking-tight">₹5,999</span><span className="text-sm text-white/80">{en ? "first month only" : "सिर्फ़ पहला महीना"}</span></p>
            <p className="mt-0.5 text-sm text-white/80">{en ? "then ₹2,999 a month · GST included" : "फिर ₹2,999 / महीना · GST शामिल"}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {(en
                ? ["A bigger multi-page website: a page for every product and service", "Google SEO, so customers find you", "A new poster every day on Facebook, Instagram and WhatsApp", "A WhatsApp AI that answers your customers, and Meta Ads"]
                : ["बड़ी multi-page website: हर product और service का अपना page", "Google SEO, ताकि ग्राहक आपको ढूँढ लें", "Facebook, Instagram और WhatsApp पर रोज़ नया poster", "WhatsApp AI जो ग्राहकों को जवाब देता है, और Meta Ads"]).map(li)}
            </ul>
            <SubscribeButton tier="growth" premium onDone={go} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#ffd54a] px-4 py-3.5 text-base font-bold text-[#12144a] hover:opacity-95">
              {en ? "Start with Premium" : "Premium से शुरू करें"}
            </SubscribeButton>
            <p className="mt-2 text-center text-[11px] text-white/60">{en ? "You can stop it any time from your UPI app." : "आप इसे कभी भी अपने UPI app से बंद कर सकते हैं।"}</p>
          </div>

          {/* Standard */}
          <div className="rounded-3xl border-2 border-brand/40 bg-surface p-5">
            <p className="text-sm font-semibold text-muted">Standard</p>
            <p className="mt-1 flex items-baseline gap-2"><span className="text-3xl font-extrabold tracking-tight">₹2,999</span><span className="text-sm text-muted">{en ? "/ month · GST included" : "/ महीना · GST शामिल"}</span></p>
            <ul className="mt-3 space-y-2 text-sm">
              {(en
                ? ["Your own website (up to 5 pages) and digital card", "A new poster every day, ready to share", "A WhatsApp AI that answers your customers", "Meta Ads for Facebook and Instagram"]
                : ["आपकी अपनी website (5 pages तक) और digital card", "रोज़ नया poster, share करने के लिए तैयार", "WhatsApp AI जो ग्राहकों को जवाब देता है", "Facebook और Instagram के लिए Meta Ads"]).map(lj)}
            </ul>
            <SubscribeButton tier="growth" onDone={go} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl grad-brand px-4 py-3 text-base font-semibold text-white">
              {en ? "Start with Standard" : "Standard से शुरू करें"}
            </SubscribeButton>
          </div>

          {/* Free: small, at the bottom */}
          <div className="space-y-1.5 px-1 pt-1 text-center">
            <p className="text-xs text-muted">{en ? "Only need a card? Free for 1 year: a digital card, no website." : "सिर्फ़ card चाहिए? 1 साल free: digital card, website नहीं।"}</p>
            <Link href={phase === "welcome" ? "/signup" : "/poster/onboard"} className="text-sm font-semibold text-brand-ink underline">{en ? "Make a free digital card" : "Free digital card बनाएँ"}</Link>
          </div>
          {phase === "welcome" && (
            <p className="text-center text-xs text-muted">{t.haveAccount} <Link href="/login?next=/poster" className="font-medium text-brand-ink">{t.login}</Link></p>
          )}
        </div>
      );
    }
    return (
      <div className="py-8 space-y-6">
        <div className="rounded-3xl overflow-hidden grad-brand p-6 text-white">
          <p className="text-xs font-semibold tracking-widest opacity-80">SHUBHORA</p>
          <h1 className="text-3xl font-bold mt-2 leading-tight whitespace-pre-line">{fr?.title ?? t.heroTitle}</h1>
          <p className="mt-3 text-sm opacity-90">{fr?.sub ?? t.heroSub}</p>
        </div>
        <ul className="space-y-2 text-sm">
          {(fr?.bullets ?? [t.f1, t.f2, t.f3]).map((b) => <li key={b} className="flex gap-2"><span>✅</span><span>{b}</span></li>)}
        </ul>
        {/* Someone not signed in has no account yet: Sign up first (it opens the Welcome screen and the set-up). Log in is the line below. */}
        <Link href={phase === "welcome" ? "/signup" : "/poster/onboard"} className="block w-full text-center rounded-xl grad-brand px-4 py-3.5 text-base font-semibold text-white">
          {phase === "welcome" ? t.startFree : fr?.button ?? t.makeProfile}
        </Link>
        {fr?.note && <p className="text-center text-xs text-muted">{fr.note}</p>}
        {phase === "welcome" && (
          <p className="text-center text-xs text-muted">{t.haveAccount} <Link href="/login?next=/poster" className="text-brand-ink font-medium">{t.login}</Link></p>
        )}
      </div>
    );
  }

  const persona = PERSONAS.find((p) => p.key === profile?.persona);
  const quota = today?.quota;
  const hi = lang !== "en";
  // Home, redesigned (owner, 24 Oct 2026: "jo zaroori cheez honi chahiye wo add karo, professional interface"): who and when with the
  // card link on top, today's work from the CRM, the website still to finish, today's poster, every door in one grid, the share links.
  return (
    <div className="space-y-4 pb-2">
      {/* The V-Card's year: shows only in its last 30 days, the 7-day grace and while paused. */}
      <CardRenewBanner />
      <HomeHeader name={profile?.name ?? ""} hi={hi} />
      {/* A partner's team, one dark line (opens Business). */}
      <BusinessStrip />
      <TodayWork hi={hi} />
      <FinishBar hi={hi} />
      {/* Premium, visible from the first day (owner's call, 3 Oct 2026: "subscription ka button kahin nahi tha"). */}
      {quota?.plan === "free" && <PremiumCard compact />}
      <PremiumUpgrade />

      {/* Today's poster */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{day === "tomorrow" ? (hi ? "कल का poster" : "Tomorrow's poster") : (hi ? "आज का poster" : "Today's poster")}</p>
            <h2 className="truncate text-lg font-bold leading-tight">{(hi ? today?.theme?.hi : today?.theme?.en) ?? (day === "tomorrow" ? (hi ? "कल का पोस्टर" : "Tomorrow's poster") : t.todayPoster)}</h2>
          </div>
          <div className="inline-flex shrink-0 rounded-full border border-border bg-surface p-0.5 text-xs font-semibold">
            {(["today", "tomorrow"] as const).map((k) => (
              <button key={k} type="button" onClick={() => { if (day === k || !profile) return; setDay(k); setToday(null); setStyle(""); loadPoster(profile, false, undefined, k); }} className={`rounded-full px-3 py-1.5 ${day === k ? "grad-brand text-white" : "text-muted"}`}>{k === "today" ? (hi ? "आज" : "Today") : (hi ? "कल" : "Tomorrow")}</button>
            ))}
          </div>
        </div>
        {profiles.length > 1 && (
          <div className="relative">
            <select value={profile?.id} onChange={(e) => { const p = profiles.find((x) => x.id === e.target.value)!; setProfile(p); setCurrentProfileId(p.id); setToday(null); loadPoster(p, false, undefined, day); }}
              className="w-full appearance-none rounded-xl border border-border bg-surface py-2 pl-3 pr-8 text-sm font-medium">
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-muted" />
          </div>
        )}
        {day === "tomorrow" && <p className="text-[11px] text-muted">{hi ? "सुबह 4 बजे अपने-आप post होगा। बदलना हो तो poster पर “Edit” दबाएँ।" : "Posts by itself at 4 AM. Tap Edit on the poster to change it."}</p>}

        {busy && !today?.poster && (
          <div className="grid aspect-[4/5] place-items-center rounded-3xl border border-border bg-surface2">
            <div className="text-center">
              <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-brand" />
              <p className="mt-3 text-sm text-muted">{t.making}</p>
            </div>
          </div>
        )}

        {today?.poster && (
          <PosterCard poster={today.poster} date={today.date ?? ""} caption={shareCaption(today, profile)}
            profile={profile} style={style || profile?.style || "classic"} restyling={restyling} plan={quota?.plan} dayOverrides={today.overrides ?? null}
            onStyle={async (st) => { if (!profile) return; await loadPoster(profile, false, st, day); api("/api/poster/profiles", { method: "POST", json: { ...profile, style: st, layout: { ...(profile.layout ?? {}), look: st.startsWith("signature") ? (st === "signature-classic" ? "classic" : "vibrant") : "old" } } }).then((r) => { const np = (r.data as { profile?: Profile }).profile; if (np) setProfile(np); }).catch(() => {}); }}
            onEdited={async () => { if (!profile) return; const r = await api<{ profiles: Profile[] }>("/api/poster/profiles").catch(() => null); const np = (r?.data?.profiles ?? []).find((x) => x.id === profile.id) ?? profile; setProfile(np); await loadPoster(np, true, style || np.style, day); }} />
        )}

        {today?.error === "plan" && (
          <div className="rounded-3xl border border-brand/40 bg-brand-soft p-4 shadow-card">
            <p className="flex items-center gap-1.5 font-semibold text-brand-ink"><Sparkles className="h-4 w-4" /> {hi ? "रोज़ का poster Standard plan में मिलता है" : "Daily posters are part of Standard"}</p>
            <p className="mt-1 text-sm text-ink">{hi ? "हर सुबह नया poster, Facebook, Instagram और WhatsApp Status पर अपने-आप।" : "A fresh poster every morning, posted to Facebook, Instagram and WhatsApp Status by itself."}</p>
            <Link href="/poster/plan" className="mt-3 inline-block rounded-xl grad-brand px-4 py-2 text-sm font-semibold text-white">{hi ? "Plans देखें" : "See plans"}</Link>
          </div>
        )}
        {today?.error === "quota" && (
          <div className="rounded-3xl border border-border bg-brand-soft p-4 shadow-card">
            <p className="flex items-center gap-1.5 font-semibold text-brand-ink"><Sparkles className="h-4 w-4" /> {t.quotaTitle}</p>
            <p className="mt-1 text-sm text-ink">{t.quotaSub}</p>
            <Link href="/poster/plan" className="mt-3 inline-block rounded-xl grad-brand px-4 py-2 text-sm font-semibold text-white">{t.seePlans}</Link>
          </div>
        )}
        {err && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-danger/30 bg-danger/5 px-3 py-2.5">
            <p className="text-sm text-danger">{err}</p>
            {profile && <button type="button" onClick={() => loadPoster(profile, false, undefined, day)} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold"><RotateCw className="h-3.5 w-3.5" /> {hi ? "फिर से" : "Try again"}</button>}
          </div>
        )}
        {today?.poster && <PremiumLine plan={quota?.plan} used={quota?.used} limit={quota?.limit ?? null} />}
      </section>

      <QuickGrid hi={hi} />
      {/* The three links people share most — card, LEFT join, RIGHT join — one WhatsApp tap each. */}
      <ShareLinks compact allHref="/poster/share" />
      <p className="text-center text-xs text-faint"><span className="mr-1">{persona?.emoji}</span>{persona ? t.personas[persona.key][0] : ""} · {profile?.name}</p>
    </div>
  );
}
