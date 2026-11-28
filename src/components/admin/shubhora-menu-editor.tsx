"use client";

// Super Admin → Shubhora AI → Menu (owner, 28 Nov 2026). The numbered menu every Shubhora partner's assistant sends and the
// fixed answer to each number, plus the PDF and videos it shares. Saved once here, read live by every partner (WhatsApp within
// 5 minutes, the card chat at once). A text equal to the built-in one is stored as empty, so a later built-in update still
// reaches it; a partner's own change to an item (AI Training) wins for that item only.
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Link2, ListOrdered, Loader2, RotateCcw } from "lucide-react";
import { getAdminSupabase } from "@/lib/supabase/admin-browser";
import { savePlatformSettings } from "@/lib/admin-client";
import { MENU_ITEMS, MENU_LINKS, cleanMenuConfig, resolveMenu } from "../../../bridge/shubhora-menu.mjs";
import { agentLinks, menuText, optionReply } from "../../../bridge/shubhora-agent.mjs";

type Lang = "hi" | "en";
type ItemText = { title: Record<Lang, string>; reply: Record<Lang, string> };
type Draft = { items: Record<string, ItemText>; links: Record<string, string> };

const BUILT: Draft = {
  items: Object.fromEntries(MENU_ITEMS.map((i) => [i.id, { title: { ...i.title }, reply: { ...i.reply } }])),
  links: Object.fromEntries(MENU_LINKS.map((l) => [l.key, l.def])),
};
const SAMPLE = agentLinks({ site: "https://shubhora.com", cardUrl: "https://shubhora.com/c/partner", ownerUsername: "partner" });

/** The editor's full text (saved value, else built-in) from what is stored. */
function fromStored(stored: unknown): Draft {
  const r = resolveMenu(stored as Record<string, unknown>, {}, "https://shubhora.com");
  const linkDef = Object.fromEntries(MENU_LINKS.map((l) => [l.key, l.def]));
  return {
    items: Object.fromEntries(r.items.map((i: { id: string; title: Record<Lang, string>; reply: Record<Lang, string> }) => [i.id, { title: { ...i.title }, reply: { ...i.reply } }])),
    links: Object.fromEntries(MENU_LINKS.map((l) => [l.key, r.linkSrc[l.key] === "built-in" ? linkDef[l.key] : r.links[l.key]])),
  };
}

/** Only what differs from the built-in text is stored. */
function toStored(d: Draft) {
  const items: Record<string, { title?: Partial<Record<Lang, string>>; reply?: Partial<Record<Lang, string>> }> = {};
  for (const i of MENU_ITEMS) {
    const cur = d.items[i.id];
    for (const part of ["title", "reply"] as const) for (const lang of ["hi", "en"] as const) {
      const v = (cur?.[part]?.[lang] ?? "").trim();
      if (v && v !== String(i[part][lang]).trim()) ((items[i.id] ??= {})[part] ??= {})[lang] = v;
    }
  }
  const links: Record<string, string> = {};
  for (const l of MENU_LINKS) { const v = (d.links[l.key] ?? "").trim(); if (v && v !== l.def) links[l.key] = v; }
  return cleanMenuConfig({ items, links });
}

export function ShubhoraMenuEditor() {
  const [d, setD] = useState<Draft>(BUILT);
  const [saved, setSaved] = useState<string>(JSON.stringify(toStored(BUILT)));
  const [open, setOpen] = useState<string>("");
  const [lang, setLang] = useState<Lang>("hi");
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const sb = getAdminSupabase();
      if (!sb) { setLoading(false); return; }
      const { data, error } = await sb.from("platform_settings").select("shubhora_menu").eq("id", 1).maybeSingle();
      if (error) setMissing(true);
      else { const next = fromStored((data as { shubhora_menu?: unknown } | null)?.shubhora_menu); setD(next); setSaved(JSON.stringify(toStored(next))); }
      setLoading(false);
    })();
  }, []);

  const stored = useMemo(() => toStored(d), [d]);
  const dirty = JSON.stringify(stored) !== saved;
  const menu = useMemo(() => resolveMenu(stored, {}, "https://shubhora.com"), [stored]);
  const links = useMemo(() => ({ ...SAMPLE, ...menu.links }), [menu]);

  async function save(next: Draft) {
    setBusy(true); setMsg("");
    const row = toStored(next);
    const err = await savePlatformSettings({ shubhora_menu: row });
    if (err) setMsg(err);
    else { setD(next); setSaved(JSON.stringify(row)); setMsg("Saved — every partner's assistant uses it within 5 minutes."); }
    setBusy(false);
  }

  const setItem = (id: string, part: "title" | "reply", v: string) =>
    setD((x) => ({ ...x, items: { ...x.items, [id]: { ...x.items[id], [part]: { ...x.items[id][part], [lang]: v } } } }));
  const resetItem = (id: string) => setD((x) => ({ ...x, items: { ...x.items, [id]: BUILT.items[id] } }));
  const isEdited = (id: string) => !!stored.items?.[id];

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold flex items-center gap-2"><ListOrdered className="h-4 w-4 text-ai" /> Menu and links</h2>
          <p className="text-xs text-muted mt-1">
            The numbered menu a new &ldquo;Hi&rdquo; gets, and the answer to each number — no AI, the same every time. Placeholders:
            <code className="mx-1">{"{join}"}</code> the partner&apos;s joining link, <code>{"{tutorial}"}</code>, <code>{"{productVideo}"}</code>,
            <code className="mx-1">{"{planVideo}"}</code>, <code>{"[MEDIA] {pdf}"}</code> sends the PDF as a file. A partner can change any item for their own number.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => save(BUILT)} disabled={busy || loading || saved === JSON.stringify(toStored(BUILT))} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:opacity-40">
            <RotateCcw className="h-4 w-4" /> Built-in
          </button>
          <button onClick={() => save(d)} disabled={busy || loading || missing || !dirty} className="inline-flex items-center gap-1.5 rounded-lg grad-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save menu
          </button>
        </div>
      </div>

      {missing && <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">Run <b>supabase/migrations/0100_shubhora_menu.sql</b> in Supabase once — until then the built-in menu is used and changes cannot be saved.</p>}
      {msg && <p className="rounded-lg border border-good/40 bg-good/10 px-3 py-2 text-sm">{msg}</p>}

      {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted" /> : (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="space-y-2">
            <div className="inline-flex rounded-lg border border-border p-0.5 text-xs font-semibold">
              {(["hi", "en"] as const).map((l) => (
                <button key={l} onClick={() => setLang(l)} className={`rounded-md px-3 py-1 ${lang === l ? "bg-brand text-white" : "text-muted"}`}>{l === "hi" ? "हिंदी" : "English"}</button>
              ))}
            </div>
            {MENU_ITEMS.map((it, n) => {
              const cur = d.items[it.id];
              const isOpen = open === it.id;
              return (
                <div key={it.id} className="rounded-xl border border-border bg-bg">
                  <button onClick={() => setOpen(isOpen ? "" : it.id)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ai/10 text-xs font-bold text-ai">{n + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{cur.title[lang]}</span>
                    {it.partner && <span className="text-[10px] text-faint">hidden when a partner turns the programme off</span>}
                    {isEdited(it.id) ? <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Edited</span> : <span className="text-[10px] text-faint">Built-in</span>}
                    <ChevronDown className={`h-4 w-4 text-muted transition ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="space-y-2 border-t border-border p-3">
                      <label className="block text-xs font-semibold">Name in the menu
                        <input value={cur.title[lang]} maxLength={60} onChange={(e) => setItem(it.id, "title", e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-normal" />
                      </label>
                      {it.call ? (
                        <p className="text-xs text-muted">This number tells the partner (an alert) and the customer gets &ldquo;I&apos;ll let them know — you&apos;ll get a call&rdquo;. On the card chat it first asks for the mobile number.</p>
                      ) : (
                        <label className="block text-xs font-semibold">Answer to this number
                          <textarea value={cur.reply[lang]} maxLength={1500} rows={10} onChange={(e) => setItem(it.id, "reply", e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs font-normal leading-relaxed" />
                          <span className="text-[11px] font-normal text-faint">{cur.reply[lang].length} / 1,500 · the line &ldquo;send another number · 0 = menu&rdquo; is added by itself</span>
                        </label>
                      )}
                      {isEdited(it.id) && <button onClick={() => resetItem(it.id)} className="text-xs font-semibold text-muted underline">Back to the built-in text for this item</button>}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="rounded-xl border border-border bg-bg p-3 space-y-2">
              <p className="text-sm font-semibold flex items-center gap-1.5"><Link2 className="h-4 w-4 text-brand" /> Links every partner&apos;s assistant sends</p>
              {MENU_LINKS.map((l) => (
                <label key={l.key} className="block text-xs font-semibold">{l.en} <code className="font-normal text-faint">{`{${l.key}}`}</code>
                  <input value={d.links[l.key] ?? ""} onChange={(e) => setD((x) => ({ ...x, links: { ...x.links, [l.key]: e.target.value } }))} inputMode="url" spellCheck={false}
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs font-normal" />
                </label>
              ))}
              <p className="text-[11px] text-muted">Full https:// links (or a path on shubhora.com starting with /). Anything else is not saved.</p>
            </div>
          </div>

          <div className="space-y-3 lg:sticky lg:top-4 self-start">
            <p className="text-xs font-semibold text-muted">Preview (WhatsApp)</p>
            <div className="rounded-2xl bg-[#e5ddd5] p-3 space-y-2">
              <div className="max-w-[95%] whitespace-pre-wrap rounded-xl bg-white px-3 py-2 text-[12px] leading-snug text-[#111] shadow-sm">
                {menuText({ lang, seller: "Partner", cardUrl: SAMPLE.card, menu })}
              </div>
              {open && !MENU_ITEMS.find((i) => i.id === open)?.call && (
                <>
                  <div className="ml-auto w-fit rounded-xl bg-[#dcf8c6] px-3 py-1.5 text-[12px] text-[#111]">{MENU_ITEMS.findIndex((i) => i.id === open) + 1}</div>
                  <div className="max-w-[95%] whitespace-pre-wrap break-words rounded-xl bg-white px-3 py-2 text-[12px] leading-snug text-[#111] shadow-sm">
                    {optionReply(MENU_ITEMS.findIndex((i) => i.id === open) + 1, { lang, seller: "Partner", links, menu }) ?? "—"}
                  </div>
                </>
              )}
            </div>
            <p className="text-[11px] text-muted">Open an item to see its answer. The partner&apos;s own joining link replaces the sample one.</p>
          </div>
        </div>
      )}
    </section>
  );
}
