"use client";
// The templates gallery: search, one chip per line of work, and the cards 24 at a time.
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Eye, Search } from "lucide-react";
import { countBy, type TemplateLite } from "@/lib/template-lite";

const PAGE = 24;

export function TemplateBrowser({ items, initial = "" }: { items: TemplateLite[]; initial?: string }) {
  const groups = useMemo(() => countBy(items, "group"), [items]);
  const [trade, setTrade] = useState(items.some((t) => t.trade === initial) ? initial : "");
  const [group, setGroup] = useState(items.find((t) => t.trade === initial)?.group ?? (groups.some((g) => g.name === initial) ? initial : ""));
  const trades = useMemo(() => countBy(items.filter((t) => t.group === group), "trade"), [items, group]);
  const [q, setQ] = useState("");
  const [more, setMore] = useState(PAGE);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((t) => (!group || t.group === group) && (!trade || t.trade === trade) && (!s || `${t.name} ${t.category} ${t.description}`.toLowerCase().includes(s)));
  }, [items, group, trade, q]);
  const chip = (on: boolean) => `shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${on ? "border-brand bg-brand text-white" : "border-border bg-surface text-muted hover:text-ink"}`;
  return (
    <div>
      <div className="relative mx-auto mt-8 max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input value={q} onChange={(e) => { setQ(e.target.value); setMore(PAGE); }} placeholder="Search your work: salon, doctor, shop…" aria-label="Search templates"
          className="w-full rounded-full border border-border bg-surface py-2.5 pl-10 pr-4 text-sm outline-none focus:border-brand" />
      </div>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => { setGroup(""); setTrade(""); setMore(PAGE); }} className={chip(!group)}>All <span className="opacity-70">{items.length}</span></button>
        {groups.map((g) => (
          <button key={g.name} type="button" onClick={() => { setGroup(g.name); setTrade(""); setMore(PAGE); }} className={chip(group === g.name)}>{g.name} <span className="opacity-70">{g.count}</span></button>
        ))}
      </div>
      {group && (
        <div className="mt-3 flex flex-wrap justify-center gap-2 rounded-2xl bg-surface2 p-3">
          <button type="button" onClick={() => { setTrade(""); setMore(PAGE); }} className={chip(!trade)}>All {group}</button>
          {trades.map((c) => <button key={c.name} type="button" onClick={() => { setTrade(c.name); setMore(PAGE); }} className={chip(trade === c.name)}>{c.name}</button>)}
        </div>
      )}
      <p className="mt-6 text-center text-xs text-faint">{list.length} template{list.length === 1 ? "" : "s"}</p>
      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {list.slice(0, more).map((t) => (
          <Link key={t.key} href={`/templates/${t.key}`} className="group overflow-hidden rounded-2xl border border-border bg-surface shadow-card transition-all hover:-translate-y-0.5 hover:shadow-float">
            <div className="relative h-28 overflow-hidden" style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.accent}bb)` }}>
              {t.cover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.cover} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
              )}
              <span className="absolute -bottom-5 left-5 grid h-12 w-12 place-items-center rounded-xl bg-surface text-2xl shadow-card ring-4 ring-surface">{t.emoji}</span>
            </div>
            <div className="p-5 pt-8">
              <h2 className="font-semibold">{t.name}</h2>
              <p className="mono text-[11px] text-muted">{t.trade === t.name ? t.category : t.category.split(" · ")[1] ?? t.category}</p>
              <p className="mt-2 line-clamp-2 text-sm text-muted">{t.description}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="mono text-[11px] text-faint">{t.pages} pages · {t.blocks} sections</span>
                <span className="inline-flex items-center gap-1 text-sm font-medium" style={{ color: t.accent }}><Eye className="h-3.5 w-3.5" /> Preview <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      {list.length > more && <div className="mt-8 text-center"><button type="button" onClick={() => setMore((m) => m + PAGE)} className="rounded-full border border-border bg-surface px-6 py-2.5 text-sm font-semibold hover:shadow-card">Show more</button></div>}
      {!list.length && <p className="mt-10 text-center text-sm text-muted">Nothing found. Try another word, or <button type="button" className="font-semibold text-brand-ink" onClick={() => { setQ(""); setGroup(""); setTrade(""); }}>see all</button>.</p>}
    </div>
  );
}
