"use client";
// Your web address — one page for both ways to change it (owner, 15 Oct 2026: after "Congratulations", "Change the end of this
// link" and "Use my own domain" must show only those two options, not the website again):
//   1 · the end of the Shubhora link (shubhora.com/c/…) — checked free, then put live at once;
//   2 · your own domain (www.yourshop.com) — the Growth plan's, set up step by step by <DomainConnect>.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Copy, ExternalLink, Globe, Link2, LoaderCircle } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { checkUsername, cleanUsername, fetchCardDomain, fetchMyCardsStrict, publishCard, type UsernameCheck } from "@/lib/cloud";
import { linkOptions, setLinkPref } from "@/lib/link-pref";
import { useT } from "@/lib/poster-i18n";
import { SITE_HOST } from "@/lib/site-url";
import { DomainConnect } from "@/components/domain-connect";
import type { Card } from "@/lib/types";

const box = "rounded-xl border border-border bg-surface px-3.5 py-3 text-[15px]";

export default function WebAddressPage() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const [card, setCard] = useState<Card | null>(null);
  const [none, setNone] = useState(false);
  const [domain, setDomain] = useState("");
  const [tier, setTier] = useState<string | null>(null);
  const [opts, setOpts] = useState<{ name: string | null; business: string | null }>({ name: null, business: null });
  const [val, setVal] = useState("");
  const [check, setCheck] = useState<UsernameCheck>({ state: "idle" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const domainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    (async () => {
      if (!(await isLoggedIn())) { router.push("/login?next=/poster/site/link"); return; }
      try {
        const cs = await fetchMyCardsStrict();
        const mine = cs[0];                           // one account = one website and one card
        if (!mine) { setNone(true); return; }
        setCard(mine); setVal(mine.username);
        fetchCardDomain(mine.id).then((d) => setDomain(d?.domain ?? "")).catch(() => undefined);
        linkOptions(mine.name || "", mine.company || "", mine.id).then(setOpts).catch(() => undefined);
      } catch { setErr(T("No internet — please try again.", "Internet नहीं है — दोबारा try करें।")); }
    })();
    api<{ tier?: string | null }>("/api/poster/plan").then((r) => { if (r.ok) setTier(r.data.tier ?? null); }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // "Put it on your own domain" from the congratulations page lands on the second box.
  useEffect(() => {
    if (!card) return;
    try {
      if (new URLSearchParams(window.location.search).get("open") === "domain") setTimeout(() => domainRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
    } catch { /* ignore */ }
  }, [card]);

  // The link being typed: free, or why not.
  useEffect(() => {
    if (!card) return;
    const v = cleanUsername(val);
    if (v === card.username) { setCheck({ state: "idle" }); return; }
    if (v.length < 3) { setCheck({ state: "bad", reason: T("At least 3 characters.", "कम से कम 3 अक्षर।") }); return; }
    setCheck({ state: "checking" });
    const t = setTimeout(async () => {
      try { setCheck(await checkUsername(v, card.id)); } catch { setCheck({ state: "idle" }); }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [val, card?.id, card?.username]);

  const typed = cleanUsername(val);
  const changed = !!card && typed !== card.username;
  const canSave = changed && check.state === "ok" && !busy;
  const growth = tier === "growth" || tier === "pro";
  const liveAddress = domain ? domain : card ? `${SITE_HOST}/c/${card.username}` : "";

  async function save() {
    if (!card || !canSave) return;
    setBusy(true); setErr(""); setMsg("");
    const r = await publishCard({ ...card, username: typed });
    setBusy(false);
    if (!r.ok) { setErr(r.error || T("Could not save. Please try again.", "Save नहीं हुआ। दोबारा try करें।")); return; }
    setCard({ ...card, username: r.username });
    setVal(r.username);
    setMsg(T("Done. Your website and card now open at the new link.", "हो गया। आपकी website और card अब नए link पर खुलेंगे।"));
  }
  async function copy() {
    try { await navigator.clipboard.writeText(`https://${liveAddress}`); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  }

  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => (window.history.length > 1 ? router.back() : router.push("/poster/site"))} className="text-muted" aria-label={T("Back", "पीछे")}><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="flex-1 text-lg font-bold">{T("Your web address", "आपका web address")}</h1>
      </div>

      {none ? (
        <section className="space-y-3 rounded-xl border border-border p-4 text-center">
          <p className="text-sm text-muted">{T("Make your website first.", "पहले अपनी website बनाएँ।")}</p>
          <Link href="/poster/card/build" className="inline-block rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white">{T("Make my website →", "मेरी website बनाएँ →")}</Link>
        </section>
      ) : !card ? (
        err ? <p className="text-sm font-semibold text-danger">{err}</p> : <div className="py-16 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>
      ) : (
        <>
          <section className="space-y-1.5 rounded-2xl border border-border bg-surface p-3.5">
            <p className="text-xs text-muted">{T("People open your website and card here", "लोग आपकी website और card यहाँ खोलते हैं")}</p>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 shrink-0 text-brand" />
              <span className="min-w-0 flex-1 truncate text-sm font-bold">{liveAddress}</span>
              <button type="button" onClick={copy} aria-label={T("Copy link", "Link copy करें")} className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted">{copied ? <Check className="h-4 w-4 text-good" /> : <Copy className="h-4 w-4" />}</button>
              <a href={`https://${liveAddress}`} target="_blank" rel="noreferrer" aria-label={T("Open", "खोलें")} className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted"><ExternalLink className="h-4 w-4" /></a>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-start gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">1</span>
              <div className="min-w-0">
                <p className="text-base font-bold leading-tight">{T("Change the end of your link", "अपने link का आख़िरी हिस्सा बदलें")}</p>
                <p className="text-xs text-muted">{T("Pick a short name people can remember.", "एक छोटा नाम चुनें जो लोगों को याद रहे।")}</p>
              </div>
            </div>
            {opts.name && opts.business && (
              <div className="grid grid-cols-2 gap-2">
                {([["business", opts.business, T("From business name", "Business के नाम से")], ["name", opts.name, T("From your name", "आपके नाम से")]] as const).map(([k, slug, label]) => {
                  const on = typed === slug;
                  return (
                    <button key={k} type="button" onClick={() => { setVal(slug); setMsg(""); void setLinkPref(k); }} className={`rounded-xl border-2 px-2.5 py-2 text-left ${on ? "border-brand bg-brand-soft" : "border-border"}`}>
                      <span className="flex items-center gap-1 text-[11px] text-muted">{on && <Check className="h-3 w-3 text-brand" />}{label}</span>
                      <span className="block truncate text-xs font-semibold">/c/{slug}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted">{SITE_HOST}/c/</span>
              <input value={val} onChange={(e) => { setVal(e.target.value); setMsg(""); setErr(""); }} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="your-shop-name" className={`${box} w-full`} />
            </label>
            {check.state === "checking" && <p className="text-xs text-muted">{T("Checking…", "देख रहे हैं…")}</p>}
            {check.state === "ok" && <p className="text-xs font-semibold text-good">✓ {SITE_HOST}/c/{typed} {T("is free", "खाली है")}</p>}
            {check.state === "bad" && <p className="text-xs font-semibold text-danger">{check.reason}</p>}
            {changed && <p className="rounded-lg bg-amber/10 px-3 py-2 text-xs text-ink">{T("Your old link will stop opening. Send the new link to your customers.", "आपका पुराना link खुलना बंद हो जाएगा। नया link अपने ग्राहकों को भेज दें।")}</p>}
            {err && <p className="text-xs font-semibold text-danger">{err}</p>}
            {msg && <p className="rounded-xl border border-good/40 bg-good/10 px-3 py-2 text-sm font-semibold text-good">✓ {msg}</p>}
            <button type="button" onClick={save} disabled={!canSave} className="inline-flex w-full items-center justify-center gap-2 rounded-xl grad-brand py-3 text-base font-semibold text-white disabled:opacity-50">
              {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} {T("Save new link", "नया link save करें")}
            </button>
          </section>

          <section ref={domainRef} className="space-y-3 rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-start gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">2</span>
              <div className="min-w-0">
                <p className="text-base font-bold leading-tight">{T("Open it on your own domain", "अपने domain पर खोलें")}</p>
                <p className="text-xs text-muted">{T("Use www.yourshop.com instead of the Shubhora link.", "Shubhora link की जगह www.yourshop.com इस्तेमाल करें।")}</p>
              </div>
            </div>
            {growth || domain ? (
              <DomainConnect cardId={card.id} username={card.username} initialDomain={domain || undefined} onChange={(d) => setDomain(d)} />
            ) : (
              <div className="space-y-2 rounded-xl bg-brand-soft/50 p-3">
                <p className="flex items-start gap-2 text-sm"><Link2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {T("Your own domain comes with the Growth plan.", "अपना domain Growth plan के साथ आता है।")}</p>
                <Link href="/poster/plan" className="inline-flex w-full items-center justify-center rounded-xl border border-brand py-2.5 text-sm font-semibold text-brand-ink">{T("See plans", "Plans देखें")}</Link>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
