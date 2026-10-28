"use client";
// "AI bot: my own website" on the Card & Website page itself (owner's call, 10 Oct 2026: "isko chhupa ke kyon rakha").
// The owner names their own website; the bot then sends customers THAT link instead of the card page and answers from
// what the site says (read into the card's knowledge base here, saved to the live card at once).
import { useEffect, useRef, useState } from "react";
import { Bot, Check, FileText, ImagePlus, Link2, LoaderCircle, PlaySquare, Trash2 } from "lucide-react";
import { fetchMyCardsStrict, publishCard } from "@/lib/cloud";
import { uploadImage, uploadPdf } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import type { Card } from "@/lib/types";

type BotFile = NonNullable<Card["botFiles"]>[number];

const SITE_BLOCK = /\n\n(?=--- From my website: )/;
const ownNotes = (k: string | undefined) => (k ?? "").split(SITE_BLOCK).filter((b) => !b.startsWith("--- From my website: ")).join("\n\n").trim();
const siteNotes = (k: string | undefined) => (k ?? "").split(SITE_BLOCK).filter((b) => b.startsWith("--- From my website: ")).join("\n\n").trim();
const strip = (u: string) => u.replace(/^https?:\/\//i, "").replace(/\/$/, "");

/** The card's Website button pointed at their own site (owner, 28 Oct 2026: "card me bhi uski website ka link ho"). */
function withWebsiteLink(card: Card, site: string): Card {
  const links = card.links ?? [];
  const i = links.findIndex((l) => l.type === "website");
  const next = i >= 0 ? links.map((l, j) => (j === i ? { ...l, value: site } : l)) : [...links, { id: `website-${Date.now().toString(36)}`, type: "website" as const, label: "Website", value: site }];
  return { ...card, links: next };
}

/** siteOnly: just the website row (the Card & Website page), without the files the bot can send. */
/** siteOnly: just the website row (Card & Website). trainOnly: just what the AI is taught and may send (AI Training page) —
 *  the website itself is set on Card & Website (owner, 28 Oct 2026: "ye to website wala lag raha hai"). */
export function BotSiteBox({ card, onChanged, siteOnly = false, trainOnly = false }: { card: Card; onChanged?: (c: Card) => void; siteOnly?: boolean; trainOnly?: boolean }) {
  const { lang } = useT();
  const hi = lang === "hi";
  const T = (h: string, e: string) => (hi ? h : e);
  const [url, setUrl] = useState(strip(card.botSite ?? ""));
  const [busy, setBusy] = useState<"" | "read" | "clear">("");
  // Website (Set / Read again / Remove) messages sit under the website row; file messages sit under the file buttons.
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [fMsg, setFMsg] = useState("");
  const [fErr, setFErr] = useState("");
  const [rowErr, setRowErr] = useState<{ url: string; text: string } | null>(null); // rename / remove — inside that file's row
  useEffect(() => { setUrl(strip(card.botSite ?? "")); }, [card.botSite]);
  const set = !!card.botSite?.trim();

  async function read() {
    const raw = url.trim();
    if (!raw) return;
    setBusy("read"); setErr(""); setMsg("");
    try {
      const r = await fetch("/api/ai/train", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: raw }) });
      const d = (await r.json().catch(() => ({}))) as { knowledge?: string; url?: string; error?: string };
      if (!r.ok || !d.knowledge) { setErr(d.error || T("वेबसाइट पढ़ नहीं पाया।", "Could not read the website.")); return; }
      const site = String(d.url || raw);
      const header = `--- From my website: ${strip(site)} ---`;
      const kept = (card.botKnowledge ?? "").split(/\n\n(?=--- From my website: )/).filter((b) => !b.startsWith("--- From my website: ")).join("\n\n").trim();
      const next: Card = { ...withWebsiteLink(card, /^https?:\/\//i.test(site) ? site : `https://${site}`), botSite: site, botKnowledge: `${kept ? kept + "\n\n" : ""}${header}\n${String(d.knowledge).trim()}` };
      const p = await publishCard(next);
      if (!p.ok) { setErr(p.error); return; }
      onChanged?.(next);
      setMsg(T(`✅ हो गया। Card पर Website button ${strip(site)} खोलेगा, और AI ग्राहकों को यही link देगा और इसी से जवाब देगा।`, `✅ Done. The card's Website button opens ${strip(site)}, and the AI sends customers this link and answers from it.`));
    } catch { setErr(T("वेबसाइट पढ़ नहीं पाया — फिर try करें।", "Could not read the website — try again.")); }
    finally { setBusy(""); }
  }
  async function clear() {
    setBusy("clear"); setErr(""); setMsg("");
    const kept = (card.botKnowledge ?? "").split(/\n\n(?=--- From my website: )/).filter((b) => !b.startsWith("--- From my website: ")).join("\n\n").trim();
    const next: Card = { ...card, botSite: undefined, botKnowledge: kept || undefined };
    const p = await publishCard(next);
    setBusy("");
    if (!p.ok) { setErr(p.error); return; }
    setUrl(""); onChanged?.(next);
    setMsg(T("बॉट अब Shubhora कार्ड का लिंक देगा।", "The bot sends your Shubhora card link again."));
  }

  /* ---- the owner's own notes for the AI (prices, specifications, business plan, FAQs) — owner, 28 Oct 2026: "AI ko train karo" ---- */
  const [notes, setNotes] = useState(ownNotes(card.botKnowledge));
  const [nBusy, setNBusy] = useState(false); const [nMsg, setNMsg] = useState(""); const [nErr, setNErr] = useState("");
  useEffect(() => { setNotes(ownNotes(card.botKnowledge)); }, [card.botKnowledge]);
  async function saveNotes() {
    setNBusy(true); setNMsg(""); setNErr("");
    const site = siteNotes(card.botKnowledge);
    const next: Card = { ...card, botKnowledge: [notes.trim(), site].filter(Boolean).join("\n\n") || undefined };
    const p = await publishCard(next);
    setNBusy(false);
    if (!p.ok) { setNErr(p.error || T("सेव नहीं हुआ — फिर try करें।", "Could not save — try again.")); return; }
    onChanged?.(next);
    setNMsg(T("✅ सेव हो गया। AI अब यही जानकारी इस्तेमाल करेगा (WhatsApp पर 5 मिनट में)।", "✅ Saved. The AI uses this now (on WhatsApp within 5 minutes)."));
  }

  /* ---- files the bot may send (brochure pages, spec sheets, price list, PDF) ---- */
  const files: BotFile[] = card.botFiles ?? [];
  const imgRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [labels, setLabels] = useState<Record<string, string>>({});
  async function saveFiles(next: BotFile[], rowUrl?: string) {
    const p = await publishCard({ ...card, botFiles: next.length ? next : undefined });
    if (!p.ok) { const text = p.error || T("सेव नहीं हुआ — फिर try करें।", "Could not save — try again."); if (rowUrl) setRowErr({ url: rowUrl, text }); else setFErr(text); return false; }
    onChanged?.({ ...card, botFiles: next.length ? next : undefined });
    return true;
  }
  async function addFile(f: File | null, kind: "image" | "pdf") {
    if (!f) return;
    setFileBusy(true); setFErr(""); setFMsg("");
    try {
      const url = kind === "pdf" ? await uploadPdf(f) : await uploadImage(f, "wide");
      if (!url) { setFErr(T("अपलोड नहीं हुआ — फिर try करें।", "Upload failed — try again.")); return; }
      const label = f.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim().slice(0, 60) || (kind === "pdf" ? "Brochure" : "Photo");
      if (await saveFiles([...files, { label, url, kind }].slice(0, 12))) setFMsg(T("✅ फ़ाइल जुड़ गई — नाम ठीक कर लें ताकि बॉट सही फ़ाइल चुने।", "✅ File added — fix its name so the bot picks the right one."));
    } finally { setFileBusy(false); if (imgRef.current) imgRef.current.value = ""; if (pdfRef.current) pdfRef.current.value = ""; }
  }
  /** Links the AI may share (owner, 28 Oct 2026): demo video, registration, plan video, product videos, Facebook / Instagram / YouTube
   *  pages… The name says when: the AI shares a link when the customer asks for what its name says. */
  const LINK_KINDS: { en: string; hi: string; name: string }[] = [
    { en: "Demo video", hi: "Demo video", name: "Demo video" },
    { en: "Registration link", hi: "Registration link", name: "Registration link" },
    { en: "Plan video", hi: "Plan video", name: "Business plan video" },
    { en: "Product video", hi: "Product video", name: "Product video" },
    { en: "Facebook page", hi: "Facebook page", name: "Facebook page" },
    { en: "Instagram", hi: "Instagram", name: "Instagram page" },
    { en: "YouTube channel", hi: "YouTube channel", name: "YouTube channel" },
    { en: "Other", hi: "दूसरा", name: "" },
  ];
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkName, setLinkName] = useState(""); const [linkUrl, setLinkUrl] = useState("");
  async function addLink() {
    setFErr(""); setFMsg("");
    const raw = linkUrl.trim(); const label = linkName.trim().slice(0, 60);
    if (!label) { setFErr(T("लिंक का नाम लिखें — जैसे Registration link, Plan video।", "Name the link — e.g. Registration link, Plan video.")); return; }
    if (!raw) { setFErr(T("लिंक डालें।", "Put the link.")); return; }
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try { new URL(url); } catch { setFErr(T("लिंक सही नहीं है।", "That link is not valid.")); return; }
    if (files.some((f) => f.url === url)) { setFErr(T("यह लिंक पहले से जुड़ा है।", "That link is already added.")); return; }
    if (await saveFiles([...files, { label, url, kind: "link" as const }].slice(0, 12))) {
      setLinkOpen(false); setLinkName(""); setLinkUrl("");
      setFMsg(T(`✅ "${label}" जुड़ गया — ग्राहक इसकी बात करेगा तो AI यही link भेजेगा।`, `✅ "${label}" added — the AI shares it when a customer asks for it.`));
    }
  }
  async function renameFile(url: string) {
    const label = (labels[url] ?? "").trim().slice(0, 60);
    setFErr(""); setFMsg(""); setRowErr(null);
    if (!label) { setLabels((l) => { const n = { ...l }; delete n[url]; return n; }); setRowErr({ url, text: T("नाम खाली नहीं हो सकता।", "The name cannot be empty.") }); return; }
    await saveFiles(files.map((f) => (f.url === url ? { ...f, label } : f)), url);
  }
  async function removeFile(url: string) {
    if (!confirm(T("यह फ़ाइल हटा दें?", "Remove this file?"))) return;
    setFErr(""); setFMsg(""); setRowErr(null);
    await saveFiles(files.filter((f) => f.url !== url), url);
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-3.5">
      {trainOnly ? (
        <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
          <Link2 className="h-3.5 w-3.5 text-brand" /> {T("AI ग्राहकों को यह link भेजता है:", "The AI sends customers:")} <b className="text-ink">{set ? strip(card.botSite ?? "") : T("आपका card", "your card")}</b>
          <a href="/poster/site" className="ml-auto font-semibold text-brand-ink underline">{T("बदलें", "Change")}</a>
        </p>
      ) : <>
      <div className="flex items-start gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ai/10 text-ai"><Bot className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{T("मेरी पहले से अपनी website है", "I already have my own website")}</p>
          <p className="mt-0.5 text-xs text-muted">{T("Link डालें — card पर Website button इसी को खोलेगा, और AI ग्राहकों को यही link भेजेगा और इसी से जवाब देगा।", "Put the link — the card's Website button opens it, and the AI sends customers this link and answers from it.")}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <input value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" autoCapitalize="none" spellCheck={false} placeholder="e.g. alkafresh.in" className="min-w-0 flex-1 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-brand" />
        <button type="button" onClick={read} disabled={!!busy || !url.trim()} className="shrink-0 rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy === "read" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : set && strip(card.botSite ?? "") === strip(url) ? T("फिर पढ़ें", "Read again") : T("सेट करें", "Set")}</button>
      </div>
      {set && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <Check className="h-3.5 w-3.5 text-good" /> {T("चालू:", "On:")} <b className="text-ink">{strip(card.botSite ?? "")}</b>
          <button type="button" onClick={clear} disabled={!!busy} className="ml-auto text-xs font-semibold text-muted underline">{busy === "clear" ? "…" : T("हटाएँ, कार्ड का लिंक दें", "Remove, send card link")}</button>
        </p>
      )}
      {msg && <p className="mt-2 text-xs font-medium text-good">{msg}</p>}
      {err && <p className="mt-2 text-xs font-medium text-danger">{err}</p>}
      </>}
      {!siteOnly && <div className={trainOnly ? "mt-3" : "mt-4 border-t border-border pt-3"}>
        <p className="text-sm font-semibold leading-tight">{T("AI को खुद सिखाएँ", "Teach the AI yourself")}</p>
        <p className="mt-0.5 text-xs text-muted">{T("Price, हर model की specification (size, plates…), business plan, आम सवाल-जवाब — जो यहाँ लिखेंगे, AI सबसे पहले यही मानेगा।", "Prices, every model's specifications (size, plates…), the business plan, common questions — the AI trusts what you write here first.")}</p>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={8} maxLength={20000} placeholder={T("जैसे: Aura Maxx — 8 plates, plate size 65 x 156 mm, customer price ₹1,50,000…", "e.g. Aura Maxx — 8 plates, plate size 65 x 156 mm, customer price ₹1,50,000…")} className="mt-2 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-brand" />
        <div className="mt-1.5 flex items-center gap-2">
          <button type="button" onClick={() => void saveNotes()} disabled={nBusy || notes.trim() === ownNotes(card.botKnowledge)} className="rounded-xl grad-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{nBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : T("सेव करें", "Save")}</button>
          <span className="text-[11px] text-muted">{notes.length.toLocaleString("en-IN")} / 20,000</span>
        </div>
        {nMsg && <p className="mt-2 text-xs font-medium text-good">{nMsg}</p>}
        {nErr && <p className="mt-2 text-xs font-medium text-danger">{nErr}</p>}
      </div>}
      {!siteOnly && <div className="mt-4 border-t border-border pt-3">
        <p className="text-sm font-semibold leading-tight">{T("AI जो फ़ाइलें और links भेज सके", "Files and links the AI can send")}</p>
        <p className="mt-0.5 text-xs text-muted">{T("Brochure, PDF, price list — ग्राहक \"details bhejo\" कहे तो AI सही फ़ाइल भेजेगा। Links भी जोड़ें: demo video, registration link, plan video, product video, Facebook / Instagram page — ग्राहक जिसकी बात करेगा, AI वही link भेजेगा। एक brochure के कई पेज हों तो नाम \"Brochure 1\", \"Brochure 2\" रखें।", "Brochure, PDF, price list — when a customer asks for details the AI sends the right file. Add links too: demo video, registration link, plan video, product video, Facebook / Instagram page — the AI shares the one the customer asks about. Name a multi-page brochure \"Brochure 1\", \"Brochure 2\".")}</p>
        {files.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {files.map((f) => (
              <li key={f.url} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-bg p-1.5">
                {f.kind === "image"
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={f.url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                  : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface2 text-muted">{f.kind === "link" ? (/youtu/i.test(f.url) ? <PlaySquare className="h-5 w-5" /> : <Link2 className="h-5 w-5" />) : <FileText className="h-5 w-5" />}</span>}
                <input value={labels[f.url] ?? f.label} onChange={(e) => setLabels({ ...labels, [f.url]: e.target.value })} onBlur={() => { if ((labels[f.url] ?? f.label) !== f.label) void renameFile(f.url); }} maxLength={60} className="min-w-0 flex-1 bg-transparent px-1 text-sm outline-none" placeholder={T("फ़ाइल का नाम, जैसे AlkaFresh 1101 specifications", "File name, e.g. AlkaFresh 1101 specifications")} />
                <button type="button" onClick={() => removeFile(f.url)} className="p-1.5 text-muted hover:text-danger" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
                {rowErr?.url === f.url && <p role="alert" className="basis-full px-1 text-xs font-medium text-danger">{rowErr.text}</p>}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" disabled={fileBusy || files.length >= 12} onClick={() => imgRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">{fileBusy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />} {T("फ़ोटो / पेज जोड़ें", "Add photo / page")}</button>
          <button type="button" disabled={fileBusy || files.length >= 12} onClick={() => pdfRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"><FileText className="h-3.5 w-3.5" /> {T("PDF जोड़ें", "Add PDF")}</button>
          <button type="button" disabled={fileBusy || files.length >= 12} onClick={() => { setLinkOpen((o) => !o); setFErr(""); }} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${linkOpen ? "border-brand bg-brand-soft text-brand-ink" : "border-border"}`}><Link2 className="h-3.5 w-3.5" /> {T("Link जोड़ें (video, registration, Facebook…)", "Add a link (video, registration, Facebook…)")}</button>
          <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={(e) => void addFile(e.target.files?.[0] ?? null, "image")} />
          <input ref={pdfRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => void addFile(e.target.files?.[0] ?? null, "pdf")} />
        </div>
        {linkOpen && (
          <div className="mt-2 space-y-2 rounded-xl border border-border bg-bg p-2.5">
            <div className="flex flex-wrap gap-1.5">
              {LINK_KINDS.map((k) => <button key={k.en} type="button" onClick={() => setLinkName(k.name)} className={`rounded-full border px-2.5 py-1 text-[11px] ${linkName === k.name && k.name ? "border-brand bg-brand-soft font-semibold text-brand-ink" : "border-border"}`}>{hi ? k.hi : k.en}</button>)}
            </div>
            <input value={linkName} onChange={(e) => setLinkName(e.target.value)} maxLength={60} placeholder={T("नाम — जैसे Aura Maxx demo video", "Name — e.g. Aura Maxx demo video")} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
            <div className="flex gap-2">
              <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} inputMode="url" autoCapitalize="none" spellCheck={false} placeholder="https://…" className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
              <button type="button" onClick={() => void addLink()} disabled={fileBusy} className="shrink-0 rounded-lg grad-brand px-4 text-sm font-semibold text-white disabled:opacity-50">{T("जोड़ें", "Add")}</button>
            </div>
            <p className="text-[11px] text-muted">{T("नाम साफ़ रखें — AI नाम देखकर तय करता है कि कब कौन-सा link भेजना है।", "Keep the name clear — the AI picks the link by its name.")}</p>
          </div>
        )}
        {fMsg && <p className="mt-2 text-xs font-medium text-good">{fMsg}</p>}
        {fErr && <p className="mt-2 text-xs font-medium text-danger">{fErr}</p>}
      </div>}
    </section>
  );
}

/** The same website row on a page that only knows the card's id (Card & Website hub): loads the card, then the box. */
/** onSite: the owner's own website (full https link, "" when none) — the hub's Share box uses it for "Website". */
export function OwnSiteByCard({ cardId, onSite }: { cardId: string; onSite?: (url: string) => void }) {
  const [card, setCard] = useState<Card | null>(null);
  useEffect(() => {
    if (!cardId) return;
    let off = false;
    fetchMyCardsStrict().then((all) => { if (!off) setCard(all.find((c) => c.id === cardId) ?? null); }).catch(() => undefined);
    return () => { off = true; };
  }, [cardId]);
  const own = (card?.botSite ?? "").trim();
  useEffect(() => { onSite?.(own ? (/^https?:\/\//i.test(own) ? own : `https://${own}`) : ""); }, [own, onSite]);
  return card ? <BotSiteBox card={card} siteOnly onChanged={setCard} /> : null;
}
