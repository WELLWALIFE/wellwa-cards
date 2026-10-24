"use client";
// "Live करें" on the finished screen (owner, 24 Oct 2026: the sub domain is no longer asked during set-up — "web site final hone ke
// baad" the owner picks it here): the business-name link, the own-name link, or their own domain.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Globe, LoaderCircle } from "lucide-react";
import { fetchMyCardsStrict, publishCard } from "@/lib/cloud";
import { linkOptions, setLinkPref, type LinkBy } from "@/lib/link-pref";
import { SITE_HOST } from "@/lib/site-url";

export function LiveLink({ current, cardOnly, hi, beforeChange, onChanged, bare }: {
  current: string; cardOnly?: boolean; hi: boolean;
  /** Inside a box that already has its own heading: no white card, no title. */
  bare?: boolean;
  /** Anything still being saved on the page goes live first, so the link change does not race it. */
  beforeChange?: () => Promise<void>;
  onChanged: (username: string) => void;
}) {
  const router = useRouter();
  const T = (en: string, h: string) => (hi ? h : en);
  const [opts, setOpts] = useState<{ name: string | null; business: string | null } | null>(null);
  const [busy, setBusy] = useState<LinkBy | "">("");
  const [err, setErr] = useState("");

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const row = (await fetchMyCardsStrict())[0];
        if (!row || off) return;
        const o = await linkOptions(row.name || "", row.company || "", row.id);
        if (!off) setOpts(o);
      } catch { /* the links below still show the current one */ }
    })();
    return () => { off = true; };
  }, []);

  async function pick(k: LinkBy, slug: string) {
    if (busy || slug === current) return;
    setBusy(k); setErr("");
    try {
      await beforeChange?.();
      const row = (await fetchMyCardsStrict())[0];
      if (!row) throw new Error("");
      const r = await publishCard({ ...row, username: slug });
      if (!r.ok) { setErr(r.error || T("Could not change it. Please try again.", "बदल नहीं पाया। दोबारा try करें।")); return; }
      void setLinkPref(k);
      onChanged(r.username || slug);
    } catch {
      setErr(T("No internet — please try again.", "Internet नहीं है — दोबारा try करें।"));
    } finally { setBusy(""); }
  }

  // The current link is always one of the rows, even before the two choices have come back.
  const rows: { k: LinkBy; slug: string; label: string }[] = [];
  if (opts?.business || (!opts && current)) rows.push({ k: "business", slug: opts?.business ?? current, label: T("Business name", "Business के नाम से") });
  if (opts?.name && opts.name !== opts.business) rows.push({ k: "name", slug: opts.name, label: T("Your name", "आपके नाम से") });
  if (current && !rows.some((r) => r.slug === current)) rows.unshift({ k: "business", slug: current, label: T("Now", "अभी") });

  return (
    <div className={bare ? "space-y-2" : "space-y-2 rounded-2xl bg-white p-3 text-left text-ink shadow-sm"}>
      {!bare && <p className="text-sm font-bold">{T("Choose your link", "अपना link चुनें")}</p>}
      {rows.map((r) => {
        const on = r.slug === current;
        return (
          <button key={`${r.k}-${r.slug}`} type="button" onClick={() => void pick(r.k, r.slug)} disabled={!!busy} aria-pressed={on}
            className={`flex w-full items-center gap-2.5 rounded-xl border-2 px-3 py-2 text-left transition disabled:opacity-70 ${on ? "border-brand bg-brand-soft/50" : "border-border"}`}>
            <span className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 ${on ? "border-brand bg-brand text-white" : "border-border-strong"}`}>{on && <Check className="h-3 w-3" strokeWidth={3} />}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] text-muted">{r.label}</span>
              <span className="block truncate text-sm font-semibold">{SITE_HOST}/c/{r.slug}</span>
            </span>
            {busy === r.k && <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-muted" />}
          </button>
        );
      })}
      {!cardOnly && (
        <button type="button" onClick={() => router.push("/poster/site/link?open=domain")} disabled={!!busy}
          className="flex w-full items-center gap-2.5 rounded-xl border-2 border-dashed border-brand/40 px-3 py-2 text-left disabled:opacity-70">
          <Globe className="h-[18px] w-[18px] shrink-0 text-brand" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{T("My own domain", "अपना domain")}</span>
            <span className="block text-[11px] text-muted">{T("e.g. www.yourshop.com", "जैसे www.yourshop.com")}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
        </button>
      )}
      {err && <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger">{err}</p>}
    </div>
  );
}
