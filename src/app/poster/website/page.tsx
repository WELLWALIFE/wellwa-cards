"use client";
// "My website": the same link as the V-Card, shown as a full website on computers. Publishing the V-Card already
// turned it on, so this screen is mostly "have a look and say it's fine" — everything else sits under More settings.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, ChevronLeft, Globe, Smartphone, ExternalLink, Pencil, Check, RefreshCw, Paintbrush } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { Guide } from "@/components/poster/guide";
import { SiteBuilderOptions } from "@/components/poster/site-builder-options";
import { DomainConnect } from "@/components/domain-connect";
import { usePlan } from "@/lib/plan";
import { Lock } from "lucide-react";

type Hero = { headline?: string; sub?: string; ctaLabel?: string; imageUrl?: string };
type Status = { hasCard: false } | { hasCard: true; cards: { id: string; username: string; name: string }[]; cardId: string; username: string; url: string; customDomain: string; knowledge?: string; site: { enabled: boolean; hidden?: string[]; hideProfile?: boolean; logoUrl?: string; hero?: Hero; generatedAt?: string; templateKey?: string; style?: { palette?: string; font?: string }; reference?: { url: string } } | null; pages: { slug: string; label: string; blocks: number }[]; images: { label: string; url: string }[]; defaults: { headline: string; sub: string; jobTitle: string } };

export default function WebsitePage() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const [s, setS] = useState<Status | null>(null);
  const [cardId, setCardId] = useState<string>("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const { plan, loading: planLoading } = usePlan();
  const paid = planLoading || plan !== "free";

  // api() resolves on ANY status, so a 401 (expired login) or a server error must be caught here — without
  // this check the screen keeps spinning for ever with nothing to tap.
  const load = useCallback(async (id?: string) => {
    setErr("");
    try {
      const r = await api<Status & { error?: string }>(`/api/site/status${id ? `?card=${id}` : ""}`);
      if (!r.ok) { setErr(r.data?.error || "No internet — tap to try again"); return; }
      setS(r.data);
      if (r.data.hasCard) setCardId(r.data.cardId);
    } catch {
      setErr("No internet — tap to try again");
    }
  }, []);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.push("/login?next=/poster/website"); return; } load(); })(); }, [router, load]);

  async function patch(p: { enabled?: boolean; hidden?: string[] }) {
    try { await api("/api/site/status", { method: "PATCH", json: { ...p, card_id: cardId } }); } catch { setMsg("No internet — please try again."); return; }
    load(cardId);
  }

  if (!s) return err ? (
    <div className="py-20 grid place-items-center gap-3 text-center">
      <p className="font-semibold">{err}</p>
      <button type="button" onClick={() => load(cardId || undefined)} className="inline-flex items-center gap-2 rounded-xl grad-brand px-5 py-3 text-base font-semibold text-white">
        <RefreshCw className="h-5 w-5" /> Try again
      </button>
    </div>
  ) : <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const hidden = new Set(s.hasCard ? s.site?.hidden ?? [] : []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/poster/setup" className="text-muted"><ChevronLeft className="h-5 w-5" /></Link>
        <h1 className="text-lg font-bold flex-1">{hi ? "Meri website" : "My website"}</h1>
      </div>
      <Guide hi="Your V-Card and website are one link. Computers see the website, phones see the V-Card." en="Your V-Card and website are one link. Computers see the website, phones see the V-Card." />
      {msg && <p className="text-sm rounded-lg bg-surface2 px-3 py-2">{msg}</p>}
      {err && <p className="text-sm font-semibold text-danger">{err}</p>}

      {!s.hasCard ? (
        <section className="rounded-xl border border-border p-4 text-center space-y-3">
          <p className="text-sm text-muted">{"Create your card first — the website is built from it."}</p>
          <Link href="/poster/card" className="inline-block rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white">{"Create card →"}</Link>
        </section>
      ) : (
        <>
          {s.cards.length > 1 && (
            <select value={cardId} onChange={(e) => load(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm">
              {s.cards.map((c) => <option key={c.id} value={c.id}>{c.name} — /c/{c.username}</option>)}
            </select>
          )}
          {!paid && (
            <section className="rounded-2xl bg-[#12144a] p-4 text-white space-y-2">
              <p className="flex items-center gap-2 text-base font-bold"><Lock className="h-4 w-4" /> {hi ? "Aapki website tayyar hai — Growth me live karein" : "Your website is ready — go live with Growth"}</p>
              <p className="text-xs text-white/75">{hi ? "Free plan me aapka card har jagah dikhta hai. Growth (₹2,999) me yahi link computer par poori website ban jaata hai — same data, same address." : "On the free plan visitors see your card everywhere. With Growth (₹2,999) this same link opens as a full website on computers — same data, same address."}</p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <a href={`${s.url}?view=site`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/30 px-3 py-2.5 text-sm font-semibold"><Globe className="h-4 w-4" /> {hi ? "Preview dekhein" : "See preview"}</a>
                <Link href="/poster/plan" className="inline-flex items-center justify-center rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-[#12144a]">{hi ? "Live karein" : "Go live"} →</Link>
              </div>
            </section>
          )}
          <section className="rounded-xl border border-border p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-brand" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{s.customDomain || s.url.replace(/^https?:\/\//, "")}</p>
                <p className="text-[11px] text-muted">{s.site?.enabled ? ("Website mode ON — website on computers, card on phones") : ("Website mode OFF — the card shows everywhere")}{s.site?.generatedAt ? ` · AI: ${new Date(s.site.generatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}` : ""}</p>
              </div>
              {s.site?.enabled && <Check className="h-4 w-4 text-good" />}
            </div>
            <label className="flex items-center justify-between rounded-lg bg-surface2 px-3 py-2.5">
              <span><span className="text-sm font-medium block">{hi ? "Website mode" : "Website mode"}</span><span className="text-[11px] text-muted">{"Your current pages stay as they are — they just render as a website on computers."}</span></span>
              <input type="checkbox" className="h-5 w-5" checked={!!s.site?.enabled} disabled={!paid} onChange={(e) => patch({ enabled: e.target.checked })} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <a href={`${s.url}?view=site`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-3 text-sm font-semibold"><Globe className="h-4 w-4" /> {hi ? "Website preview" : "Website preview"} <ExternalLink className="h-3.5 w-3.5 text-muted" /></a>
              <a href={`${s.url}?view=card`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-3 text-sm font-semibold"><Smartphone className="h-4 w-4" /> {hi ? "Card preview" : "Card preview"} <ExternalLink className="h-3.5 w-3.5 text-muted" /></a>
            </div>
            <Link href="/poster/website/edit" className="flex items-center gap-3 rounded-2xl border-2 border-brand/40 bg-brand-soft px-4 py-3.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl grad-brand text-white"><Paintbrush className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-brand-ink">{hi ? "Website edit karein" : "Edit website"}</span>
                <span className="block text-[11px] text-muted">{hi ? "Colours, fonts, top section, home ke sections, pages — live preview ke saath" : "Colours, fonts, the top section, home sections, pages — with a live preview"}</span>
              </span>
              <span className="text-brand-ink">→</span>
            </Link>
            <button type="button" onClick={() => router.push("/poster")} className="w-full rounded-2xl grad-brand px-4 py-4 text-base font-semibold text-white">Looks good ✓</button>
          </section>

          <SiteBuilderOptions cardId={s.cardId} knowledge={s.knowledge} templateKey={s.site?.templateKey} generatedAt={s.site?.generatedAt} onDone={(m) => { setMsg(m); load(s.cardId); }} />

          <details className="rounded-xl border border-border bg-surface/70">
            <summary className="cursor-pointer px-3 py-3 text-sm font-semibold">More settings</summary>
            <div className="space-y-4 border-t border-border p-3">
          <section className="rounded-xl border border-border p-3 space-y-2">
            <p className="text-sm font-semibold">{hi ? "Website par kaunse pages dikhein" : "Pages shown on the website"}</p>
            {s.pages.map((p) => (
              <label key={p.slug} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-sm">{p.label} <span className="text-[11px] text-muted">· {p.blocks} {hi ? "sections" : "sections"}</span></span>
                <input type="checkbox" className="h-5 w-5" checked={!hidden.has(p.slug)} onChange={(e) => { const h = new Set(hidden); if (e.target.checked) h.delete(p.slug); else h.add(p.slug); patch({ hidden: [...h] }); }} />
              </label>
            ))}
          </section>
          <section className="rounded-xl border border-border p-3 space-y-2">
            <p className="text-sm font-semibold">🌍 Put it on your own domain</p>
            <DomainConnect cardId={s.cardId} username={s.username} initialDomain={s.customDomain || undefined} />
          </section>
            </div>
          </details>
          <section className="rounded-xl border border-border p-3 space-y-2 text-sm">
            <Link href={`/poster/d/editor?id=${s.cardId}`} className="flex items-center gap-2 text-brand-ink font-medium"><Pencil className="h-4 w-4" /> {hi ? "Text/photo khud badlein (full editor)" : "Edit text/photos yourself (full editor)"} →</Link>

          </section>
        </>
      )}
    </div>
  );
}
