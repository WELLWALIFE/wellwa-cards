"use client";
// The Premium owner's Google SEO checklist (owner, 19 Oct 2026): what the app does by itself, and the few things the owner does. Premium only.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ChevronLeft, Circle, Copy, LoaderCircle } from "lucide-react";
import { api } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { goBack } from "@/lib/nav-back";

type Item = { key: string; ok: boolean; optional?: boolean; en: string; hi: string; href: string };
type Status = { premium: boolean; sitemap?: string; home?: string; items?: Item[] };

export default function SeoChecklistPage() {
  const router = useRouter();
  const { lang } = useT();
  const T = (en: string, hi: string) => (lang === "en" ? en : hi);
  const [st, setSt] = useState<Status | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  useEffect(() => { api<Status>("/api/seo/status").then((r) => setSt(r.ok ? r.data : null)).catch(() => setSt(null)); }, []);
  const back = <button type="button" onClick={() => goBack(router, "/poster/site")} className="text-muted" aria-label={T("Back", "पीछे")}><ChevronLeft className="h-6 w-6" /></button>;

  if (st === undefined) return <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  if (st === null) return <div className="py-10 space-y-3"><div className="flex items-center gap-2">{back}<h1 className="text-xl font-bold">{T("Google SEO", "Google SEO")}</h1></div><p className="text-sm text-muted">{T("Could not load. Please log in and try again.", "खुल नहीं पाया। login करके दोबारा कोशिश करें।")}</p></div>;
  if (!st.premium) return (
    <div className="py-6 space-y-4">
      <div className="flex items-center gap-2">{back}<h1 className="text-xl font-bold">Google SEO</h1></div>
      <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
        <p className="text-base font-semibold">{T("Google search is part of the Premium website.", "Google search Premium website का हिस्सा है।")}</p>
        <p className="text-sm text-muted">{T("Every page and every product of your Premium website goes on Google, with a sitemap and search-ready details. Your Standard website and your card stay online and shareable, but are not listed on Google.", "आपकी Premium website का हर page और हर product Google पर आता है, sitemap और search के लिए ज़रूरी details के साथ। Standard website और card online रहते हैं और share हो सकते हैं, पर Google पर नहीं आते।")}</p>
        <Link href="/poster/site/advanced" className="inline-flex items-center justify-center rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white">{T("See Premium", "Premium देखें")}</Link>
      </div>
    </div>
  );
  const items = st.items ?? [];
  const must = items.filter((i) => !i.optional), done = must.filter((i) => i.ok).length;
  const copy = async () => { try { await navigator.clipboard.writeText(st.sitemap ?? ""); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ } };
  return (
    <div className="py-6 space-y-5">
      <div className="flex items-center gap-2">{back}<h1 className="text-xl font-bold">{T("Google SEO checklist", "Google SEO checklist")}</h1></div>
      <div className="rounded-2xl bg-[#12144a] p-5 text-white">
        <p className="text-3xl font-extrabold">{done}<span className="text-lg font-semibold text-white/70"> / {must.length}</span></p>
        <p className="mt-1 text-sm text-white/80">{done === must.length ? T("All set. Your website has what Google looks for.", "सब तैयार। आपकी website में वो सब है जो Google देखता है।") : T("Fill the rest so Google understands your business.", "बाक़ी भर दें, ताकि Google आपका business समझ सके।")}</p>
      </div>
      <ul className="space-y-2">
        {items.map((i) => (
          <li key={i.key} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-3">
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${i.ok ? "bg-good text-white" : "border-2 border-border text-muted"}`}>{i.ok ? <Check className="h-4 w-4" /> : <Circle className="h-3 w-3" />}</span>
            <span className="min-w-0 flex-1 text-sm font-medium">{T(i.en, i.hi)}{i.optional && <span className="ml-1.5 rounded-full bg-surface2 px-2 py-0.5 text-[10px] font-semibold text-muted">{T("optional", "ज़रूरी नहीं")}</span>}</span>
            {!i.ok && <Link href={i.href} className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-brand-ink">{T("Fix", "ठीक करें")}</Link>}
          </li>
        ))}
      </ul>
      <div className="rounded-2xl border border-border bg-surface p-4 space-y-2 text-sm">
        <p className="font-semibold">{T("What we do for you, by ourselves", "जो हम अपने आप करते हैं")}</p>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>{T("A title and description for every page and product.", "हर page और product का title और description।")}</li>
          <li>{T("Search-ready details (schema) and a sitemap of all your pages.", "search के लिए ज़रूरी details (schema) और आपके सारे pages का sitemap।")}</li>
          <li>{T("A page for every product and service.", "हर product और service का अपना page।")}</li>
          <li>{T("When you change your website, we tell Bing and other search engines at once.", "website बदलते ही हम Bing और दूसरे search engines को तुरंत बता देते हैं।")}</li>
        </ul>
        <p className="font-semibold pt-1">{T("For Google, one step is yours (optional, but faster)", "Google के लिए एक कदम आपका (ज़रूरी नहीं, पर जल्दी होता है)")}</p>
        <p className="text-muted">{T("Google finds your sitemap by itself, but may take days. Open Google Search Console, add your website, and submit this sitemap:", "Google आपका sitemap ख़ुद ढूँढ लेता है, पर कुछ दिन लग सकते हैं। Google Search Console खोलें, अपनी website जोड़ें और ये sitemap दें:")}</p>
        <button type="button" onClick={() => void copy()} className="inline-flex max-w-full items-center gap-2 rounded-lg bg-surface2 px-3 py-2 text-left text-xs font-medium"><Copy className="h-4 w-4 shrink-0" /><span className="truncate">{st.sitemap}</span><span className="shrink-0 font-semibold text-brand-ink">{copied ? T("Copied", "copy हुआ") : T("Copy", "Copy")}</span></button>
      </div>
    </div>
  );
}
