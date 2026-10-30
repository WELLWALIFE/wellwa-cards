"use client";
// Me — the account in one screen: who you are (name, username, your one link), your plan, your partner account,
// your business, help. Every Shubhora account is a partner account, so the partner strip is always here.
import { useAccountKind, showsPartnerUi } from "@/lib/use-account-kind";
import { initials } from "@/lib/initials";
import { SITE_URL, SITE_HOST } from "@/lib/site-url";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { InstallAppButton } from "@/components/install-app";
import { useRouter } from "next/navigation";
import { LogOut, Copy, Check, ChevronRight, Share2, LoaderCircle, Handshake, Link2 } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { api, authHeaders, isLoggedIn, type Profile } from "@/lib/poster-client";
import { AddCredits } from "@/components/poster/add-credits";
import { useT, LangToggle } from "@/lib/poster-i18n";
import { endPartnerSession } from "@/lib/logout";
import { SAAS_PLANS, type SaasTier } from "@/lib/billing";
import { usernameOk, INTRODUCER_KEY, INTRODUCER_LEG_KEY } from "@/lib/username";
import { ClaimUsername } from "@/components/poster/claim-username";
import { AdvancedFeatures } from "@/components/poster/advanced-features";

type Partner = { code: string; username: string | null; status: "red" | "green"; subValidUntil: string | null; team: number; teamGreen: number; directs: number; walletPaise: number | null; renewalsDue: number };
type Account = { username: string | null; referralCode: string | null; cardSlug?: string | null; partner: Partner | null };
type PlanRes = {
  given?: { plan: string; expires_at: string | null } | null; tier: SaasTier | null; state: "none" | "active" | "grace" | "expired"; expires_at: string | null; credits?: { total: number };
  card?: { state: "included" | "active" | "grace" | "paused"; until: string | null; pause_on: string | null; renewed: boolean } | null;
};

const rupee = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
const day = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "");
const dayY = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");

export default function SettingsPage() {
  const router = useRouter();
  const [me, setMe] = useState<{ email?: string; name: string; photo: string | null } | null>(null);
  const [acct, setAcct] = useState<Account | null>(null);
  const kind = useAccountKind();
  // Back from "Edit name / mobile" (About you → Save): say it worked, once.
  const [saved, setSaved] = useState<"" | "all" | "np">("");
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const v = q.get("saved");
      if (v !== "details" && v !== "details-np") return;
      setSaved(v === "details" ? "all" : "np");
      q.delete("saved");
      window.history.replaceState(null, "", window.location.pathname + (q.toString() ? `?${q}` : ""));
    } catch { /* ignore */ }
  }, []);
  const [plan, setPlan] = useState<PlanRes | null>(null);
  const [copied, setCopied] = useState(false);
  // A failed copy / account load says so right where the buttons are (never a silent no-op).
  const [copyErr, setCopyErr] = useState("");
  const [acctErr, setAcctErr] = useState(false);
  const { t, lang } = useT();
  const en = lang === "en";

  const loadAccount = useCallback(async () => {
    setAcctErr(false);
    try {
      const r = await api<Account>("/api/account");
      if (r.ok) { setAcct(r.data); return r.data; }
    } catch { /* offline: say so below */ }
    setAcctErr(true);
    return null;
  }, []);

  useEffect(() => {
    (async () => {
      // replace, not push: Back from the login screen must not land here and bounce straight back to it.
      if (!(await isLoggedIn())) { router.replace("/login?next=/poster/settings"); return; }
      const sb = getBrowserSupabase();
      const { data } = (await sb?.auth.getUser()) ?? { data: { user: null } };
      const md = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
      // Offline here used to reject the whole start-up, so the account line spun forever with no Try again.
      const profs = await api<{ profiles?: Profile[] }>("/api/poster/profiles").catch(() => null);
      const list = profs?.data?.profiles ?? [];
      const p = list.find((x) => x.is_default) ?? list[0];
      setMe({ email: data.user?.email, name: String(md.display_name ?? md.full_name ?? p?.name ?? "").trim() || (p?.name ?? ""), photo: (md.photo_url as string) || p?.photo_url || null });
      api<PlanRes>("/api/poster/plan").then((r) => { if (r.ok) setPlan(r.data); }).catch(() => {});
      const a = await loadAccount();
      // Signed up with Google or confirmed by email: the username chosen at sign-up is claimed on the first visit.
      if (a && !a.username && typeof md.wanted_username === "string" && usernameOk(md.wanted_username)) {
        let by = typeof md.introduced_by === "string" ? md.introduced_by : "";
        let leg = typeof md.introduced_leg === "string" ? md.introduced_leg : "";
        try { by = by || localStorage.getItem(INTRODUCER_KEY) || ""; leg = leg || localStorage.getItem(INTRODUCER_LEG_KEY) || ""; } catch { /* ignore */ }
        const h = await authHeaders();
        const r = await fetch("/api/account", { method: "POST", headers: h, body: JSON.stringify({ username: md.wanted_username, by: by || undefined, leg: leg === "L" || leg === "R" ? leg : undefined }) }).catch(() => null);
        if (r?.ok) { try { localStorage.removeItem(INTRODUCER_KEY); localStorage.removeItem(INTRODUCER_LEG_KEY); } catch { /* ignore */ } await loadAccount(); }
      }
    })();
  }, [router, loadAccount]);

  async function logout() {
    // One logout: the app session and the Business section's (partner panel) session on this browser.
    try { await getBrowserSupabase()?.auth.signOut(); } catch { /* already out */ }
    await endPartnerSession();
    // replace: after logging out, Back must not return into the signed-in Me screen.
    router.replace("/login");
  }

  // One link to share. With a card: the card (its last button brings people in under this account).
  // Before the card exists: the short invite link, which opens the sign-up with this username as the introducer.
  // Me shows the card link (the person's own address). The referral link lives on the Business tab.
  const hasCard = !!acct?.cardSlug;
  const path = hasCard ? `/c/${acct?.cardSlug}` : "";
  const link = path ? `${SITE_URL}${path}` : "";
  async function copy() {
    setCopyErr("");
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setCopyErr(en ? "Could not copy the link. Please try again." : "Link copy नहीं हो पाया। फिर से कोशिश करें।"); }
  }
  async function share() {
    const text = `${me?.name || "Shubhora"} — ${link}`;
    try { if (navigator.share) { await navigator.share({ text, url: link }); return; } } catch { /* cancelled */ }
    copy();
  }

  const tier = plan?.tier && plan.state !== "none" && plan.state !== "expired" ? SAAS_PLANS[plan.tier] : null;
  // The V-Card's year on the free plan (Standard includes the card, so nothing to say then).
  const cy = !tier && !plan?.given ? plan?.card ?? null : null;
  const cardLine = !cy || cy.state === "included" ? null
    : cy.state === "paused" ? { cls: "text-danger font-semibold", text: en ? "V-Card is paused — tap to renew" : "V-Card रुका हुआ है — renew करने के लिए दबाएँ" }
    : cy.state === "grace" ? { cls: "text-amber font-semibold", text: en ? `V-Card year is over — renew by ${day(cy.pause_on)}` : `V-Card का साल पूरा हो गया — ${day(cy.pause_on)} तक renew करें` }
    : cy.until ? { cls: "", text: en ? `V-Card ${cy.renewed ? "active" : "free"} till ${dayY(cy.until)}` : `V-Card ${dayY(cy.until)} तक ${cy.renewed ? "चालू" : "free"}` }
    : null;
  const partner = acct?.partner ?? null;

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold">{en ? "Me" : "मैं"}</h1>

      {/* Who you are: name, username, one link. */}
      <section className="rounded-2xl border border-border bg-surface p-4 space-y-3">
        {saved === "all" && <p className="rounded-xl bg-good/10 px-3 py-2 text-xs font-semibold text-good">✅ {en ? "Saved — your V-Card, posters, login and partner ID now show the new details." : "Save हो गया — V-Card, poster, login और partner ID में नई जानकारी आ गई।"}</p>}
        {saved === "np" && <p className="rounded-xl bg-amber/10 px-3 py-2 text-xs font-semibold text-amber">{en ? "Your partner ID could not be changed. Please message support on WhatsApp. Your V-Card, posters and login have the new details." : "आपकी partner ID नहीं बदल पाई। कृपया WhatsApp पर support को message करें। V-Card, poster और login में नई जानकारी आ गई है।"}</p>}
        <div className="flex items-center gap-3">
          {me?.photo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={me.photo} alt="" className="h-12 w-12 rounded-full object-cover" />
            : <span className="grid h-12 w-12 place-items-center rounded-full bg-[#12144a] text-lg font-bold text-white">{initials(me?.name || me?.email)}</span>}
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold">{me?.name || (en ? "Your account" : "आपका account")}</p>
            {acct?.username
              ? <p className="truncate text-sm text-muted"><span className="font-semibold tracking-wide text-ink">{acct.username}</span>{hasCard ? ` · ${SITE_HOST}${path}` : ""}</p>
              : acct === null
                ? (acctErr ? null : <p className="mt-1 h-3.5 w-40 animate-pulse rounded bg-surface2" aria-label="Loading" />)
                : <p className="text-sm text-muted">{en ? "No username yet" : "अभी कोई username नहीं है"}</p>}
          </div>
        </div>
        {/* One place to change the name / mobile / photo — Save there updates the card, posters, login and partner ID. */}
        <Link href="/poster/onboard?step=you&back=/poster/more" className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-brand-ink">
          ✏️ {en ? "Change name / mobile" : "नाम / मोबाइल बदलें"}
        </Link>
        {acct?.username ? (
          <>
            {hasCard && <div className="flex gap-2">
              <button type="button" onClick={copy} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-sm font-semibold">{copied ? <Check className="h-4 w-4 text-good" /> : <Copy className="h-4 w-4" />} {copied ? (en ? "Copied" : "Copy हो गया") : (en ? "Copy link" : "Link copy करें")}</button>
              <button type="button" onClick={share} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl grad-brand py-2.5 text-sm font-semibold text-white"><Share2 className="h-4 w-4" /> {en ? "Share my card" : "Card share करें"}</button>
            </div>}
            {copyErr && <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">{copyErr}</p>}
            {hasCard
              ? <p className="text-[11px] text-muted">{en ? "This is your card link. The link to invite others is in the Business tab." : "यह आपके card का link है। दूसरों को जोड़ने का link Business tab में है।"}</p>
              : <Link href="/poster/card/build" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-ink">{en ? "Create your digital card" : "अपना digital card बनाएँ"} <ChevronRight className="h-3.5 w-3.5" /></Link>}
          </>
        ) : acct ? <ClaimUsername onDone={loadAccount} /> : acctErr
          ? <div className="flex items-center justify-between gap-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2"><p role="alert" className="text-xs font-semibold text-danger">{en ? "Could not load your account. Check your internet." : "आपका account load नहीं हुआ। Internet देखें।"}</p><button type="button" onClick={() => void loadAccount()} className="shrink-0 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold">{en ? "Try again" : "फिर से"}</button></div>
          : <p className="text-xs text-muted inline-flex items-center gap-1.5"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> …</p>}
      </section>

      {/* Plan */}
      <Link href="/poster/plan" className="flex items-center justify-between rounded-2xl border border-brand/40 bg-brand-soft/30 p-4">
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted">{en ? "Your plan" : "आपका plan"}</span>
          <span className="block text-base font-bold">{tier ? tier.label : plan?.given ? (plan.given.plan === "team" ? "Team" : "Pro") : "Free"}</span>
          {cardLine && <span className={`block text-xs ${cardLine.cls}`}>{cardLine.text}</span>}
          <span className="block text-xs text-muted">
            {tier && plan?.expires_at ? (en ? `Active till ${day(plan.expires_at)} — then renew` : `${day(plan.expires_at)} तक चालू — फिर renew करें`) : plan?.given ? (plan.given.expires_at ? (en ? `Active till ${day(plan.given.expires_at)}` : `${day(plan.given.expires_at)} तक चालू`) : en ? "Active" : "चालू") : en ? "Free · Standard ₹2,999 · Premium · Custom Solutions — see plans" : "Free · Standard ₹2,999 · Premium · Custom Solutions — plans देखें"}
            {plan?.credits ? ` · ${plan.credits.total} credits` : ""}
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
      </Link>
      <p className="-mt-3 text-[11px] text-faint">{t.payFallback} <a className="text-brand-ink" href="https://wa.me/917665669888?text=Shubhora%20plan%20chahiye">+91 76656 69888</a></p>

      {/* Install the app (PWA) — shown only in the browser, hidden once installed. */}
      <InstallAppButton variant="card" />

      {/* Share — card + LEFT / RIGHT join links. */}
      <Link href="/poster/share" className="flex items-center justify-between rounded-2xl bg-[#25D366]/10 border border-[#25D366]/40 p-4">
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-base font-bold"><Share2 className="h-4 w-4 text-good" /> {en ? "Share my links" : "मेरे links share करें"}</span>
          <span className="block text-xs text-muted">{en ? "Your card link, Left join link and Right join link — send on WhatsApp, copy, or show a QR" : "आपका card link, Left join link और Right join link — WhatsApp पर भेजें, copy करें या QR दिखाएँ"}</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
      </Link>

      {/* Connections — every outside account (WhatsApp, Facebook, Instagram, Google, domain) in one place. */}
      <Link href="/poster/connect" className="flex items-center justify-between rounded-2xl border border-border bg-surface p-4">
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-base font-bold"><Link2 className="h-4 w-4 text-brand" /> {en ? "Connections" : "Connections — सब जोड़ें"}</span>
          <span className="block text-xs text-muted">WhatsApp AI · Facebook · Instagram · Google · {en ? "your own web address" : "अपना web address"}</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
      </Link>

      {/* Business — the partner side of this same account. The Business tab has the full picture. */}
      {showsPartnerUi(kind) && (
      <Link href="/poster/business" className="block rounded-2xl bg-[#12144a] p-4 text-white">
        <div className="flex items-center gap-2">
          <Handshake className="h-4 w-4 opacity-80" />
          <span className="flex-1 text-base font-bold">Business{acct?.username ? <span className="ml-2 text-xs font-normal opacity-80">{acct.username}</span> : null}</span>
          {partner && <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${partner.status === "green" ? "bg-[#7fe3b0] text-[#12144a]" : "bg-[#ffb4a2] text-[#12144a]"}`}>{partner.status === "green" ? "Green" : "Red"}</span>}
          <ChevronRight className="h-5 w-5 opacity-70" />
        </div>
        {partner ? (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[[String(partner.team), "Team"], [partner.walletPaise == null ? "••••" : rupee(partner.walletPaise), "Wallet"], [String(partner.renewalsDue), "Renewals due"]].map(([v, l]) => (
              <div key={l} className="rounded-xl bg-white/10 p-2.5"><p className="text-lg font-bold leading-tight">{v}</p><p className="text-[11px] text-white/70">{l}</p></div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-white/75">{acct?.username ? (en ? "See your partner ID, team and earnings." : "अपनी partner ID, team और कमाई देखें।") : (en ? "Pick your username above and this turns on." : "ऊपर username चुनते ही यह चालू हो जाएगा।")}</p>
        )}
        {partner && partner.status === "red" && <p className="mt-2 text-[11px] text-white/70">{en ? "Earnings are available only with Standard." : "कमाई Standard plan के साथ ही चालू होती है।"}</p>}
      </Link>
      )}

      <AddCredits />

      <AdvancedFeatures hi={!en} />
      <section className="space-y-2 text-sm">
        <p className="text-sm font-semibold">{en ? "My business" : "मेरा business"}</p>
        <Link href="/poster/profiles" className="block rounded-xl border border-border p-3">👤 {t.profilesLang} <span className="block text-[11px] text-muted">{en ? "Name, photo, number, kind of poster and language" : "नाम, फ़ोटो, नंबर, poster की किस्म और भाषा"}</span></Link>
        <Link href="/poster/products" className="block rounded-xl border border-border p-3">📦 {t.productsTitle} <span className="block text-[11px] text-muted">{en ? "Products shown on your daily posters" : "जो product रोज़ के poster पर आएँगे"}</span></Link>
        <Link href="/poster/social" className="block rounded-xl border border-border p-3">📣 {en ? "Posting on social media" : "Social media पर post करना"} <span className="block text-[11px] text-muted">{en ? "Facebook, Instagram, WhatsApp Status — posts go out by themselves, and you can see how they did" : "Facebook, Instagram, WhatsApp Status — post अपने-आप जाते हैं, और कैसा चला यह भी देख सकते हैं"}</span></Link>
        <Link href="/poster/setup" className="block rounded-xl border border-border p-3">✅ {en ? "Setup checklist" : "Setup की list"} <span className="block text-[11px] text-muted">{en ? "See what is still left to do" : "देखें अभी क्या-क्या करना बाकी है"}</span></Link>
        <Link href="/poster/history" className="block rounded-xl border border-border p-3">🖼️ {t.oldPosters}</Link>
      </section>

      <section className="space-y-2 text-sm">
        <p className="text-sm font-semibold">{en ? "Help" : "मदद"}</p>
        <Link href="/poster/guide/facebook" className="block rounded-xl border border-border p-3">📘 {en ? "How to create a Facebook Page" : "Facebook Page कैसे बनाएँ"}</Link>
        <Link href="/poster/guide/instagram" className="block rounded-xl border border-border p-3">📸 {en ? "Switch Instagram to a professional account and link it to your Page" : "Instagram को professional account बनाएँ और Page से जोड़ें"}</Link>
        <Link href="/poster/guide/whatsapp" className="block rounded-xl border border-border p-3">💬 {en ? "How to turn on WhatsApp AI" : "WhatsApp AI कैसे चालू करें"}</Link>
        <a href="https://wa.me/917665669888?text=Shubhora%20help" className="block rounded-xl border border-border p-3">🆘 {en ? "Talk to support on WhatsApp" : "Support से WhatsApp पर बात करें"}</a>
        <Link href="/dashboard" className="block rounded-xl border border-border p-3 text-muted">🖥️ {en ? "More tools (for a computer)" : "और tools (computer के लिए)"}</Link>
        <div className="flex items-center justify-between rounded-xl border border-border p-3"><span className="font-semibold">{t.uiLang}</span><LangToggle /></div>
        <button type="button" onClick={logout} className="w-full text-left rounded-xl border border-border p-3 inline-flex items-center gap-2 text-danger"><LogOut className="h-4 w-4" /> {t.logout} {me?.email ? <span className="text-faint text-xs">({me.email.includes("@phone.") ? "mobile" : me.email})</span> : null}</button>
      </section>
      <p className="text-[11px] text-faint text-center">Shubhora · <Link href="/privacy">{t.privacy}</Link></p>
    </div>
  );
}
