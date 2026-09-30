"use client";
// Business — the partner side of the one Shubhora account, inside the app. The numbers come from the partner panel;
// every detail page (team tree, wallet, income, KYC…) opens the panel itself with this same login (no second password).
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Award, BadgeIndianRupee, CalendarClock, Check, ChevronRight, Copy, Download, FileCheck2, Handshake, Headphones, House, LoaderCircle, Network, Share2, Wallet,
} from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { ClaimUsername } from "@/components/poster/claim-username";

type Team = { left: number; right: number; leftGreen: number; rightGreen: number; directs: number; directsGreen: number };
type Partner = {
  code: string; username: string | null; status: "red" | "green"; blocked: boolean; subValidUntil: string | null; sponsor: string | null;
  team: Team; walletPaise: number; pendingWithdrawPaise: number;
  income: { totalPaise: number; lastPaise: number; lastClosing: string | null };
  subscription: { state: "none" | "active" | "due soon" | "lapsed"; validTill: string | null; daysLeft: number | null };
  kyc: string | null; rank: { current: string | null; next: string | null }; renewalsDue: number;
  recentTeam: { handle: string; status: string; side: string; joined: string }[];
  recentIncome: { kind: string; paise: number; day: string }[];
  menu: Record<"team" | "income" | "wallet" | "rank" | "subscription" | "kyc" | "downloads" | "support" | "grow", boolean>;
};
type Res = { username: string | null; cardSlug: string | null; link: string | null; cardLink: string | null; partner: Partner | null; linked: boolean; error?: string };

const rupee = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
const day = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "");
const PANEL = (next: string) => `/api/partner-panel?next=${encodeURIComponent(next)}`;
const KIND: Record<string, string> = { direct: "Direct sale", match_new: "Pair (new)", match_renewal: "Pair (renewal)", sponsor: "Sponsor", rank_reward: "Rank reward" };

export default function BusinessPage() {
  return <Suspense fallback={<div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}><BusinessInner /></Suspense>;
}

function BusinessInner() {
  const params = useSearchParams();
  const { lang } = useT();
  const en = lang === "en";
  const [res, setRes] = useState<Res | null>(null);
  const [state, setState] = useState<"loading" | "out" | "ready" | "error">("loading");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const r = await api<Res>("/api/partner/dashboard");
    if (r.ok) { setRes(r.data); setState("ready"); } else setState("error");
  }, []);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { setState("out"); return; } load(); })(); }, [load]);

  async function copy() { if (!res?.link) return; try { await navigator.clipboard.writeText(res.link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ } }
  async function share() {
    if (!res?.link) return;
    const text = en ? `Get your own Shubhora — digital card, website, daily posters, WhatsApp AI. Free to start: ${res.link}` : `अपना Shubhora लें — digital card, website, रोज़ के poster, WhatsApp AI. Free में शुरू: ${res.link}`;
    try { if (navigator.share) { await navigator.share({ text, url: res.link }); return; } } catch { /* cancelled */ }
    copy();
  }

  if (state === "loading") return <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  if (state === "out") return (
    <div className="py-10 text-center space-y-3">
      <Handshake className="mx-auto h-10 w-10 text-brand" />
      <h1 className="text-lg font-bold">Business</h1>
      <p className="text-sm text-muted">{en ? "Your partner ID, team and earnings live here. Log in to see them." : "आपकी partner ID, team और कमाई यहाँ है। देखने के लिए login करें।"}</p>
      <Link href="/login?next=/poster/business" className="inline-block rounded-xl grad-brand px-5 py-2.5 text-sm font-semibold text-white">{en ? "Log in" : "Login करें"}</Link>
    </div>
  );

  const p = res?.partner ?? null;
  const green = p?.status === "green";
  const unavailable = params.get("panel") === "unavailable" || state === "error" || (!p && res?.username);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Business</h1>
        {p && <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${green ? "bg-good/15 text-good" : "bg-danger/10 text-danger"}`}>{green ? "Green ID" : "Red ID"}</span>}
      </div>

      {/* No username yet (a Google sign-up that skipped it, or a very old account): the partner ID needs one. */}
      {res && !res.username && (
        <section className="rounded-2xl border border-border bg-surface p-4 space-y-2">
          <p className="text-sm font-semibold">{en ? "Choose your username to switch on your Business account" : "Business account चालू करने के लिए अपना username चुनें"}</p>
          <ClaimUsername onDone={load} />
        </section>
      )}

      {/* The ID card */}
      <section className="rounded-2xl bg-[#12144a] p-4 text-white">
        <div className="flex items-center gap-2">
          <Handshake className="h-4 w-4 opacity-80" />
          <span className="flex-1 text-base font-bold">{res?.username ?? (en ? "Business account" : "Business account")}</span>
        </div>
        {p ? (
          <>
            <p className="mt-1 text-xs text-white/70">{p.sponsor ? `${en ? "Introduced by" : "Introducer"} ${p.sponsor}` : en ? "Your Business account" : "आपका Business account"}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[[String(p.team.left + p.team.right), en ? "Team" : "Team", `L ${p.team.left} · R ${p.team.right}`], [rupee(p.walletPaise), "Wallet", p.pendingWithdrawPaise ? `${rupee(p.pendingWithdrawPaise)} ${en ? "on the way" : "आ रहा"}` : en ? "available" : "उपलब्ध"], [rupee(p.income.totalPaise), en ? "Income" : "कमाई", p.income.lastClosing ? `${en ? "last" : "पिछली"} ${rupee(p.income.lastPaise)}` : en ? "total" : "कुल"]].map(([v, l, h]) => (
                <div key={l} className="rounded-xl bg-white/10 p-2.5"><p className="text-lg font-bold leading-tight">{v}</p><p className="text-[11px] text-white/70">{l}</p><p className="text-[10px] text-white/50">{h}</p></div>
              ))}
            </div>
            {green
              ? <p className="mt-3 text-xs text-white/75">{en ? "Active" : "Active"}{p.subscription.validTill ? ` · ${en ? "till" : "तक"} ${day(p.subscription.validTill)}` : ""}{p.subscription.state === "due soon" ? ` · ${en ? "renew soon" : "जल्द renew करें"}` : ""}{p.renewalsDue ? ` · ${p.renewalsDue} ${en ? "team renewals due this week" : "team renewals इस हफ़्ते"}` : ""}</p>
              : (() => { const n = p.team.left + p.team.right; return (
                <div className="mt-3 rounded-xl bg-white/10 p-3 text-xs text-white/85">
                  <p className="font-semibold text-white">{n > 0
                    ? (en ? `${n} ${n === 1 ? "person is" : "people are"} in your team — your income is ₹0 because your ID is Red.` : `आपकी team में ${n} ${n === 1 ? "व्यक्ति" : "लोग"} — कमाई ₹0, क्योंकि आपकी ID Red है।`)
                    : (en ? "Your ID is Red — income starts the day it turns Green." : "आपकी ID Red है — Green होते ही कमाई शुरू।")}</p>
                  <p className="mt-1">{en ? "Green = a Growth ₹2,999 subscription. Every joining under you then counts, from the first one." : "Green = Growth ₹2,999 subscription। फिर आपके नीचे की हर joining गिनी जाएगी, पहली से ही।"}</p>
                  <Link href="/poster/plan" className="mt-2 inline-block rounded-lg bg-white px-3 py-1.5 font-semibold text-[#12144a]">{en ? "Turn Green" : "Green करें"}</Link>
                </div>); })()}
            <a href={PANEL("/dashboard")} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 text-sm font-semibold text-[#12144a]">{en ? "Open User Panel" : "User Panel खोलें"} <ChevronRight className="h-4 w-4" /></a>
          </>
        ) : (
          <p className="mt-2 text-xs text-white/75">
            {!res?.username ? (en ? "Choose your username above — your partner ID is made the moment you do." : "ऊपर username चुनें — उसी पल आपकी partner ID बन जाएगी।")
              : unavailable ? (en ? "The Business section is not reachable right now. Please try again in a minute." : "Business section अभी नहीं खुल रहा। एक मिनट बाद फिर try करें।")
              : (en ? "Setting up your partner ID…" : "आपकी partner ID तैयार हो रही है…")}
          </p>
        )}
      </section>

      {/* My link */}
      {res?.link && (
        <section className="rounded-2xl border border-border bg-surface p-4 space-y-3">
          <p className="text-sm font-semibold">{en ? "My referral link" : "मेरा referral link"}</p>
          <p className="truncate rounded-lg bg-surface2 px-3 py-2 text-sm font-medium">{res.link.replace(/^https?:\/\//, "")}</p>
          <div className="flex gap-2">
            <button type="button" onClick={copy} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-sm font-semibold">{copied ? <Check className="h-4 w-4 text-good" /> : <Copy className="h-4 w-4" />} {copied ? (en ? "Copied" : "Copy हुआ") : (en ? "Copy" : "Copy")}</button>
            <button type="button" onClick={share} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl grad-brand py-2.5 text-sm font-semibold text-white"><Share2 className="h-4 w-4" /> {en ? "Share" : "Share करें"}</button>
          </div>
          <p className="text-[11px] text-muted">{en ? `Whoever creates a Shubhora account from this link joins your team — placed automatically on the side with fewer IDs. Sponsor is always you, shown as ${res.username ?? "your username"}. Your digital card carries the same button at the bottom.` : `इस link से जो Shubhora account बनाएगा, वो आपकी team में आएगा — कम ID वाली side में अपने-आप। Sponsor हमेशा आप, नाम की जगह ${res.username ?? "आपका username"}। आपके digital card के नीचे भी यही button है।`}</p>
          {res.cardLink && <p className="text-[11px] text-faint">{en ? "Your card" : "आपका card"}: {res.cardLink.replace(/^https?:\/\//, "")} — <Link href="/poster/card" className="font-semibold text-brand-ink">{en ? "open" : "खोलें"}</Link></p>}
        </section>
      )}

      {/* Everything else opens the panel page with this same login */}
      {p && (
        <section className="space-y-2">
          <p className="text-sm font-semibold">{en ? "Business menu" : "Business menu"}</p>
          <div className="grid grid-cols-3 gap-2">
            {([
              ["/dashboard", en ? "Dashboard" : "Dashboard", House, true],
              ["/team", "Team", Network, p.menu.team],
              ["/income", en ? "Income" : "कमाई", BadgeIndianRupee, p.menu.income],
              ["/wallet", "Wallet", Wallet, p.menu.wallet],
              ["/rank", "Rank", Award, p.menu.rank],
              ["/subscription", "Subscription", CalendarClock, p.menu.subscription],
              ["/kyc", `KYC${p.kyc ? ` · ${p.kyc}` : ""}`, FileCheck2, p.menu.kyc],
              ["/downloads", "Downloads", Download, p.menu.downloads],
              ["/support", "Support", Headphones, p.menu.support],
            ] as const).filter((x) => x[3]).map(([href, label, Icon]) => (
              <a key={href} href={PANEL(href)} className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-surface p-3 text-center text-xs font-semibold"><Icon className="h-5 w-5 text-brand" />{label}</a>
            ))}
          </div>
          <p className="text-[11px] text-faint">{en ? "These pages open in the Business section — same login, the App button brings you back." : "ये pages Business section में खुलते हैं — same login, App button से वापस।"}</p>
        </section>
      )}

      {/* Latest */}
      {p && (p.recentTeam.length > 0 || p.recentIncome.length > 0) && (
        <section className="grid gap-3">
          {p.recentTeam.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-sm font-semibold">{en ? "Latest in your team" : "Team में नए"}</p>
              <ul className="mt-2 divide-y divide-border text-sm">
                {p.recentTeam.map((t) => (
                  <li key={`${t.handle}-${t.joined}`} className="flex items-center justify-between py-1.5"><span className="font-semibold">{t.handle}</span><span className="text-xs text-muted">{t.side === "L" ? "Left" : "Right"} · {t.status === "green" ? "Green" : "Red"} · {day(t.joined)}</span></li>
                ))}
              </ul>
            </div>
          )}
          {p.recentIncome.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-sm font-semibold">{en ? "Latest income" : "ताज़ा कमाई"}</p>
              <ul className="mt-2 divide-y divide-border text-sm">
                {p.recentIncome.map((i, k) => (
                  <li key={k} className="flex items-center justify-between py-1.5"><span>{KIND[i.kind] ?? i.kind}</span><span className="font-semibold">{rupee(i.paise)} <span className="text-xs font-normal text-muted">· {day(i.day)}</span></span></li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
