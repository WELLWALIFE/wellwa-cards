"use client";
// "AI bot: my own website" on the Card & Website page itself (owner's call, 10 Oct 2026: "isko chhupa ke kyon rakha").
// The owner names their own website; the bot then sends customers THAT link instead of the card page and answers from
// what the site says (read into the card's knowledge base here, saved to the live card at once).
import { useEffect, useState } from "react";
import { Bot, Check, LoaderCircle } from "lucide-react";
import { publishCard } from "@/lib/cloud";
import { useT } from "@/lib/poster-i18n";
import type { Card } from "@/lib/types";

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
      {msg && <p className="mt-2 text-xs font-medium text-good">{msg}</p>}
      {err && <p className="mt-2 text-xs font-medium text-danger">{err}</p>}
    </section>
  );
}
