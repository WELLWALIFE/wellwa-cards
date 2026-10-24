"use client";
// "Select your domain" — the screen right after the website is final, before "Congratulations" (owner, 24 Oct 2026):
//   1 · Free domain: the business-name link, the own-name link, or one typed by hand (checked free) — all on this page;
//   2 · Your own domain: tap it and the set-up opens right here (the Growth plan's; others see the plan).
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Globe, LoaderCircle, Pencil } from "lucide-react";
import { api } from "@/lib/poster-client";
import { checkUsername, cleanUsername, fetchCardDomain, fetchMyCardsStrict, publishCard, type UsernameCheck } from "@/lib/cloud";
import { linkOptions, setLinkPref, type LinkBy } from "@/lib/link-pref";
import { SITE_HOST } from "@/lib/site-url";
import { DomainConnect } from "@/components/domain-connect";

const field = "w-full min-w-0 rounded-xl border border-border bg-surface px-3 py-2.5 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";

export function DomainPick({ current, cardOnly, hi, beforeChange, onChanged }: {
  current: string; cardOnly?: boolean; hi: boolean;
  /** Anything still being saved on the page goes live first, so the link change does not race it. */
  beforeChange?: () => Promise<void>;
  onChanged: (username: string) => void;
}) {
  const T = (en: string, h: string) => (hi ? h : en);
  const [cardId, setCardId] = useState("");
  const [opts, setOpts] = useState<{ name: string | null; business: string | null } | null>(null);
  const [busy, setBusy] = useState<LinkBy | "own" | "">("");
  const [err, setErr] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [val, setVal] = useState("");
  const [check, setCheck] = useState<UsernameCheck>({ state: "idle" });
  const [ownOpen, setOwnOpen] = useState(false);
  const [domain, setDomain] = useState("");
  const [tier, setTier] = useState<string | null>(null);

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const row = (await fetchMyCardsStrict())[0];
        if (!row || off) return;
        setCardId(row.id);
        fetchCardDomain(row.id).then((d) => { if (!off) { setDomain(d?.domain ?? ""); if (d?.domain) setOwnOpen(true); } }).catch(() => undefined);
        const o = await linkOptions(row.name || "", row.company || "", row.id);
        if (!off) setOpts(o);
      } catch { /* the current link still shows */ }
    })();
    api<{ tier?: string | null }>("/api/poster/plan").then((r) => { if (r.ok && !off) setTier(r.data.tier ?? null); }).catch(() => undefined);
    return () => { off = true; };
  }, []);

  // The typed link: free, or why not.
  useEffect(() => {
    if (!editOpen) return;
    const v = cleanUsername(val);
    if (!v || v === current) { setCheck({ state: "idle" }); return; }
    if (v.length < 3) { setCheck({ state: "bad", reason: T("At least 3 letters.", "कम से कम 3 अक्षर।") }); return; }
    setCheck({ state: "checking" });
    const t = setTimeout(async () => { try { setCheck(await checkUsername(v, cardId || undefined)); } catch { setCheck({ state: "idle" }); } }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [val, editOpen, current, cardId]);

  async function goLive(slug: string, k: LinkBy | "own") {
    if (busy || !slug || slug === current) return;
    setBusy(k); setErr("");
    try {
      await beforeChange?.();
      const row = (await fetchMyCardsStrict())[0];
      if (!row) throw new Error("");
      const r = await publishCard({ ...row, username: slug });
      if (!r.ok) { setErr(r.error || T("Could not change it. Please try again.", "बदल नहीं पाया। दोबारा try करें।")); return; }
      if (k !== "own") void setLinkPref(k);
      onChanged(r.username || slug);
      setEditOpen(false); setVal("");
    } catch {
      setErr(T("No internet — please try again.", "Internet नहीं है — दोबारा try करें।"));
    } finally { setBusy(""); }
  }

  const rows: { k: LinkBy; slug: string; label: string }[] = [];
  if (opts?.business || (!opts && current)) rows.push({ k: "business", slug: opts?.business ?? current, label: T("From business name", "Business के नाम से") });
  if (opts?.name && opts.name !== opts.business) rows.push({ k: "name", slug: opts.name, label: T("From your name", "आपके नाम से") });
  if (current && !rows.some((r) => r.slug === current)) rows.unshift({ k: "business", slug: current, label: T("Now", "अभी") });
  const typed = cleanUsername(val);
  const growth = tier === "growth" || tier === "pro";
  const head = (n: number, title: string, sub: string, grad: string) => (
    <div className={`flex items-center gap-3 px-4 py-3 text-white ${grad}`}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/25 text-sm font-extrabold">{n}</span>
      <div className="min-w-0"><p className="text-base font-bold leading-tight">{title}</p><p className="text-[11px] text-white/85">{sub}</p></div>
    </div>
  );

  return (
    <div className="space-y-3">
      <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
        {head(1, T("Free domain", "Free domain"), T("Tap one — it goes live at once", "एक दबाएँ — तुरंत live"), "bg-gradient-to-r from-[#1fb956] to-[#25D366]")}
        <div className="space-y-2 p-3">
          {rows.map((r) => {
            const on = r.slug === current && !domain;
            const sel = r.slug === current;
            return (
              <button key={`${r.k}-${r.slug}`} type="button" onClick={() => void goLive(r.slug, r.k)} disabled={!!busy} aria-pressed={sel}
                className={`flex w-full items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left transition disabled:opacity-70 ${sel ? "border-brand bg-brand-soft/50" : "border-border"}`}>
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${sel ? "border-brand bg-brand text-white" : "border-border-strong"}`}>{sel && <Check className="h-3 w-3" strokeWidth={3} />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] text-muted">{r.label}{on ? ` · ${T("live", "live")}` : ""}</span>
                  <span className="block truncate text-sm font-semibold">{SITE_HOST}/c/{r.slug}</span>
                </span>
                {busy === r.k && <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-muted" />}
              </button>
            );
          })}
          {/* Edit on this page (owner, 24 Oct 2026: "ishi page per edit ka option"). */}
          <div className={`rounded-xl border-2 transition ${editOpen ? "border-brand/50 bg-brand-soft/20" : "border-dashed border-border"}`}>
            <button type="button" onClick={() => { setEditOpen((o) => !o); setErr(""); if (!val) setVal(current); }} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-semibold">
              <Pencil className="h-4 w-4 shrink-0 text-brand" /> <span className="flex-1">{T("Write my own", "खुद लिखें")}</span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition ${editOpen ? "rotate-180" : ""}`} />
            </button>
            {editOpen && (
              <div className="space-y-2 px-3 pb-3">
                <div className="flex items-center gap-1.5">
                  <span className="shrink-0 text-xs font-semibold text-muted">{SITE_HOST}/c/</span>
                  <input autoFocus value={val} onChange={(e) => { setVal(e.target.value); setErr(""); }} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="your-shop" className={field} />
                </div>
                {check.state === "checking" && <p className="text-xs text-muted">{T("Checking…", "देख रहे हैं…")}</p>}
                {check.state === "ok" && <p className="text-xs font-semibold text-good">✓ {T("Free", "खाली है")}</p>}
                {check.state === "bad" && <p className="text-xs font-semibold text-danger">{check.reason}</p>}
                <button type="button" onClick={() => void goLive(typed, "own")} disabled={check.state !== "ok" || !!busy}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl grad-brand py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                  {busy === "own" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {T("Use this link", "यही link लगाएँ")}
                </button>
              </div>
            )}
          </div>
          {err && <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger">{err}</p>}
        </div>
      </section>

      {!cardOnly && (
        <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
          <button type="button" onClick={() => setOwnOpen((o) => !o)} aria-expanded={ownOpen} className="block w-full text-left">
            {head(2, T("Your own domain", "आपका अपना domain"), domain || T("e.g. www.yourshop.com", "जैसे www.yourshop.com"), "bg-gradient-to-r from-[#8b3dff] to-[#c04ee8]")}
          </button>
          {ownOpen ? (
            <div className="p-3">
              {growth || domain ? (
                cardId ? <DomainConnect cardId={cardId} username={current} initialDomain={domain || undefined} onChange={(d) => setDomain(d)} /> : <div className="grid place-items-center py-6"><LoaderCircle className="h-5 w-5 animate-spin text-muted" /></div>
              ) : (
                <div className="space-y-2 rounded-2xl bg-brand-soft/40 p-3">
                  <p className="flex items-start gap-2 text-sm"><Globe className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {T("Own domain comes with the Standard plan.", "अपना domain Standard plan के साथ आता है।")}</p>
                  <Link href="/poster/plan" className="inline-flex w-full items-center justify-center rounded-xl border border-brand py-2.5 text-sm font-semibold text-brand-ink">{T("See plans", "Plans देखें")}</Link>
                </div>
              )}
            </div>
          ) : (
            <button type="button" onClick={() => setOwnOpen(true)} className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-semibold">
              <Globe className="h-4 w-4 shrink-0 text-[#8b3dff]" /> <span className="flex-1">{domain ? T("Manage", "देखें / बदलें") : T("Connect my domain", "मेरा domain जोड़ें")}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
            </button>
          )}
        </section>
      )}
    </div>
  );
}
