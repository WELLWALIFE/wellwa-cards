// Template review board (owner, 12 Oct 2026: "pehle kuch ka website template banake dekhe"): every template of one
// trade drawn as the real website, phone-size, side by side, with a desktop link under each. ?trade=restaurant picks
// the trade (by the template's category); no param = every template with a design of its own. Never indexed.
import type { Metadata } from "next";
import Link from "next/link";
import { ALL_TEMPLATES, TEMPLATE_TRADES } from "@/lib/template-catalog";

export const metadata: Metadata = { title: "Template review", robots: { index: false, follow: false } };

export default async function TemplateReview({ searchParams }: { searchParams: Promise<{ trade?: string; lang?: string }> }) {
  const { trade, lang } = await searchParams;
  const all = ALL_TEMPLATES.filter((t) => !t.brand && t.key !== "blank");
  const list = trade ? all.filter((t) => (t.data.seo?.categoryKey ?? t.key.split("-")[0]) === trade) : [];
  const trades = TEMPLATE_TRADES.map((x) => x.trade);
  const q = lang === "hi" ? "?lang=hi" : "";
  return (
    <div className="min-h-screen px-4 py-6" style={{ background: "var(--bg)" }}>
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">Template review</span>
          {trades.map((k) => <Link key={k} href={`/templates/review?trade=${k}${lang === "hi" ? "&lang=hi" : ""}`} className={`rounded-full border px-3 py-1 ${trade === k ? "border-brand bg-brand-soft/40 font-semibold" : "border-border"}`}>{k}</Link>)}
          <Link href={`/templates/review${trade ? `?trade=${trade}` : ""}${lang === "hi" ? "" : trade ? "&lang=hi" : "?lang=hi"}`} className="ml-auto rounded-full border border-border px-3 py-1">{lang === "hi" ? "English" : "हिन्दी"}</Link>
        </div>
        <p className="mt-2 text-xs text-muted">{list.length} templates · phone view below, desktop opens in a new tab</p>
        <div className="mt-4 grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
          {list.map((t) => (
            <div key={t.key} className="rounded-2xl border border-border bg-surface p-3 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{t.emoji} {t.name}</p>
                  <p className="mono text-[10px] text-muted">{t.key} · {t.data.site?.style?.blueprint ?? "classic"} · {t.data.site?.style?.palette ?? "brand"} · {t.data.site?.style?.font ?? "look"}</p>
                </div>
                <a href={`/templates/${t.key}/site${q}`} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg border border-border px-2 py-1 text-[11px] font-medium">Desktop ↗</a>
              </div>
              <p className="mt-1 line-clamp-2 text-[11px] text-muted">{t.description}</p>
              <div className="mt-3 overflow-hidden rounded-xl border border-border" style={{ width: 300, height: 640, margin: "0 auto" }}>
                <iframe src={`/templates/${t.key}/site${q}`} title={t.name} style={{ width: 390, height: 832, border: 0, transform: "scale(0.769)", transformOrigin: "0 0" }} loading="lazy" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
