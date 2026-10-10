"use client";
// "AI bot: my own website" on the Card & Website page itself (owner's call, 10 Oct 2026: "isko chhupa ke kyon rakha").
// The owner names their own website; the bot then sends customers THAT link instead of the card page and answers from
// what the site says (read into the card's knowledge base here, saved to the live card at once).
import { useEffect, useRef, useState } from "react";
import { Bot, Check, FileText, ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { publishCard } from "@/lib/cloud";
import { uploadImage, uploadPdf } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import type { Card } from "@/lib/types";

type BotFile = NonNullable<Card["botFiles"]>[number];

const strip = (u: string) => u.replace(/^https?:\/\//i, "").replace(/\/$/, "");

export function BotSiteBox({ card, onChanged }: { card: Card; onChanged?: (c: Card) => void }) {
  const { lang } = useT();
  const hi = lang === "hi";
  const T = (h: string, e: string) => (hi ? h : e);
  const [url, setUrl] = useState(strip(card.botSite ?? ""));
  const [busy, setBusy] = useState<"" | "read" | "clear">("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
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
      const next: Card = { ...card, botSite: site, botKnowledge: `${kept ? kept + "\n\n" : ""}${header}\n${String(d.knowledge).trim()}` };
      const p = await publishCard(next);
      if (!p.ok) { setErr(p.error); return; }
      onChanged?.(next);
      setMsg(T(`✅ हो गया। बॉट अब ${strip(site)} का लिंक देगा और उसी से जवाब देगा।`, `✅ Done. The bot now sends ${strip(site)} and answers from it.`));
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

  /* ---- files the bot may send (brochure pages, spec sheets, price list, PDF) ---- */
  const files: BotFile[] = card.botFiles ?? [];
  const imgRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [labels, setLabels] = useState<Record<string, string>>({});
  async function saveFiles(next: BotFile[]) {
    const p = await publishCard({ ...card, botFiles: next.length ? next : undefined });
    if (!p.ok) { setErr(p.error); return false; }
    onChanged?.({ ...card, botFiles: next.length ? next : undefined });
    return true;
  }
  async function addFile(f: File | null, kind: "image" | "pdf") {
    if (!f) return;
    setFileBusy(true); setErr(""); setMsg("");
    try {
      const url = kind === "pdf" ? await uploadPdf(f) : await uploadImage(f, "wide");
      if (!url) { setErr(T("अपलोड नहीं हुआ — फिर try करें।", "Upload failed — try again.")); return; }
      const label = f.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim().slice(0, 60) || (kind === "pdf" ? "Brochure" : "Photo");
      if (await saveFiles([...files, { label, url, kind }].slice(0, 12))) setMsg(T("✅ फ़ाइल जुड़ गई — नाम ठीक कर लें ताकि बॉट सही फ़ाइल चुने।", "✅ File added — fix its name so the bot picks the right one."));
    } finally { setFileBusy(false); if (imgRef.current) imgRef.current.value = ""; if (pdfRef.current) pdfRef.current.value = ""; }
  }
  async function renameFile(url: string) {
    const label = (labels[url] ?? "").trim().slice(0, 60);
    if (!label) return;
    await saveFiles(files.map((f) => (f.url === url ? { ...f, label } : f)));
  }
  async function removeFile(url: string) {
    if (!confirm(T("यह फ़ाइल हटा दें?", "Remove this file?"))) return;
    await saveFiles(files.filter((f) => f.url !== url));
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-3.5">
      <div className="flex items-start gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ai/10 text-ai"><Bot className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{T("AI बॉट: मेरी अपनी वेबसाइट", "AI bot: my own website")}</p>
          <p className="mt-0.5 text-xs text-muted">{T("अपनी वेबसाइट हो तो यहाँ लिखें। बॉट ग्राहकों को यही लिंक देगा (कार्ड का नहीं) और उसी से जवाब देगा।", "Have your own website? Put it here. The bot sends customers this link (not the card) and answers from it.")}</p>
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
      <div className="mt-4 border-t border-border pt-3">
        <p className="text-sm font-semibold leading-tight">{T("बॉट जो फ़ाइलें भेज सके", "Files the bot can send")}</p>
        <p className="mt-0.5 text-xs text-muted">{T("ब्रोशर के पेज, स्पेसिफ़िकेशन, प्राइस-लिस्ट, PDF — ग्राहक \"details bhejo\" कहे तो बॉट सही फ़ाइल भेजेगा (WhatsApp पर फ़ोटो/डॉक्यूमेंट की तरह)। 4 या कम फ़ाइलें हों तो सब एक साथ जाती हैं। एक ब्रोशर के कई पेज हों तो नाम \"Brochure 1\", \"Brochure 2\" रखें — वे हमेशा साथ जाएँगे।", "Brochure pages, spec sheets, a price list, a PDF — when a customer asks for details the bot sends the right one (as a photo / document on WhatsApp). With 4 files or fewer, all go together. Name a multi-page brochure \"Brochure 1\", \"Brochure 2\" — its pages always go together.")}</p>
        {files.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {files.map((f) => (
              <li key={f.url} className="flex items-center gap-2 rounded-xl border border-border bg-bg p-1.5">
                {f.kind === "image"
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={f.url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                  : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface2 text-muted"><FileText className="h-5 w-5" /></span>}
                <input value={labels[f.url] ?? f.label} onChange={(e) => setLabels({ ...labels, [f.url]: e.target.value })} onBlur={() => { if ((labels[f.url] ?? f.label) !== f.label) void renameFile(f.url); }} maxLength={60} className="min-w-0 flex-1 bg-transparent px-1 text-sm outline-none" placeholder={T("फ़ाइल का नाम, जैसे AlkaFresh 1101 specifications", "File name, e.g. AlkaFresh 1101 specifications")} />
                <button type="button" onClick={() => removeFile(f.url)} className="p-1.5 text-muted hover:text-danger" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" disabled={fileBusy || files.length >= 12} onClick={() => imgRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">{fileBusy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />} {T("फ़ोटो / पेज जोड़ें", "Add photo / page")}</button>
          <button type="button" disabled={fileBusy || files.length >= 12} onClick={() => pdfRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"><FileText className="h-3.5 w-3.5" /> {T("PDF जोड़ें", "Add PDF")}</button>
          <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={(e) => void addFile(e.target.files?.[0] ?? null, "image")} />
          <input ref={pdfRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => void addFile(e.target.files?.[0] ?? null, "pdf")} />
        </div>
      </div>
      {msg && <p className="mt-2 text-xs font-medium text-good">{msg}</p>}
      {err && <p className="mt-2 text-xs font-medium text-danger">{err}</p>}
    </section>
  );
}
