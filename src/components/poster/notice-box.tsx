"use client";
// "Any news or announcement?" on Card & Website (owner's call, 3 Oct 2026): one or two lines, a button, a photo,
// how it shows (bar free; pop-up Premium), till when — one tap on, one tap off, the old ones kept to re-use, and a
// WhatsApp share of the same words with the link.
import { useState } from "react";
import { Camera, Check, LoaderCircle, Megaphone, Share2, Trash2 } from "lucide-react";
import { publishCard } from "@/lib/cloud";
import { uploadImage } from "@/lib/poster-client";
import { compressToFile } from "@/lib/image-utils";
import { useT } from "@/lib/poster-i18n";
import { activeNotice, cleanNotice, untilLabel } from "@/lib/notice";
import { PremiumSheet } from "@/components/poster/premium-lock";
import type { Card, CardNotice } from "@/lib/types";

const field = "w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand";

export function NoticeBox({ card, url, locked, onChanged }: { card: Card; url: string; /** Free account: the pop-up modes open the Premium sheet. */ locked: boolean; onChanged: (c: Card) => void }) {
  const { lang } = useT();
  const hi = lang === "hi";
  const T = (en: string, h: string) => (hi ? h : en);
  const live = activeNotice(card);
  const [open, setOpen] = useState(!live);
  const [text, setText] = useState(live?.text ?? "");
  const [sub, setSub] = useState(live?.sub ?? "");
  const [label, setLabel] = useState(live?.label ?? "");
  const [link, setLink] = useState(live?.url ?? "");
  const [imageUrl, setImageUrl] = useState(live?.imageUrl ?? "");
  const [mode, setMode] = useState<CardNotice["mode"]>(live?.mode ?? "bar");
  const [form, setForm] = useState(!!live?.form);
  const [until, setUntil] = useState(live?.until ?? "");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [sheet, setSheet] = useState(false);

  const EXAMPLES = hi ? ["Admission open 2026-27", "दिवाली ऑफ़र: 20% छूट", "रविवार को बंद", "नया branch खुल गया"] : ["Admissions open 2026-27", "Diwali offer: 20% off", "Closed on Sunday", "New branch now open"];

  async function save(next: Card) {
    setBusy("save"); setErr("");
    try { const r = await publishCard(next); if (!r.ok) throw new Error(r.error); onChanged(next); }
    catch { setErr(T("Could not save. Please try again.", "save नहीं हुआ। दोबारा try करें।")); }
    finally { setBusy(""); }
  }
  async function put() {
    const n = cleanNotice({ text, sub, label, url: link || (label ? `https://wa.me/?text=${encodeURIComponent(text)}` : ""), imageUrl, mode, until, form: form && mode !== "bar" });
    if (!n) { setErr(T("Write the news first.", "पहले खबर लिखें।")); return; }
    const past = [card.notice, ...(card.pastNotices ?? [])].filter((x): x is CardNotice => !!x && x.text !== n.text).slice(0, 8);
    await save({ ...card, notice: n, pastNotices: past });
    setOpen(false);
  }
  async function clear() {
    if (!card.notice) return;
    const past = [card.notice, ...(card.pastNotices ?? [])].filter((x, i, a) => a.findIndex((y) => y.text === x.text) === i).slice(0, 8);
    await save({ ...card, notice: undefined, pastNotices: past });
    setText(""); setSub(""); setLabel(""); setLink(""); setImageUrl(""); setUntil(""); setOpen(true);
  }
  function reuse(n: CardNotice) { setText(n.text); setSub(n.sub ?? ""); setLabel(n.label ?? ""); setLink(n.url ?? ""); setImageUrl(n.imageUrl ?? ""); setMode(n.mode); setForm(!!n.form); setUntil(""); setOpen(true); }
  async function photo(f: File | null) {
    if (!f) return;
    setBusy("photo"); setErr("");
    try { const u = await uploadImage(await compressToFile(f, "notice.jpg", 1400, 0.86), "wide"); if (u) setImageUrl(u); else throw new Error("up"); }
    catch { setErr(T("Could not upload the photo.", "photo upload नहीं हुई।")); }
    finally { setBusy(""); }
  }
  const pickMode = (m: CardNotice["mode"]) => { if (locked && m !== "bar") { setSheet(true); return; } setMode(m); };
  const share = () => { const n = live; if (!n) return; window.open(`https://wa.me/?text=${encodeURIComponent(`${n.text}${n.sub ? `\n${n.sub}` : ""}${n.until ? `\n${untilLabel(n.until, hi)}` : ""}\n${url}`)}`, "_blank"); };
  const chip = (on: boolean) => `rounded-full border-2 px-3 py-1.5 text-xs font-semibold ${on ? "border-brand bg-brand-soft text-brand-ink" : "border-border bg-surface"}`;

  return (
    <section className="rounded-2xl border border-border bg-surface p-3 space-y-2">
      <p className="flex items-center gap-2 text-[15px] font-bold"><Megaphone className="h-4 w-4 text-brand" /> {T("Any news or announcement?", "कोई खबर या announcement?")}</p>
      {live && (
        <div className="rounded-xl bg-surface2 p-3">
          <p className="text-sm font-semibold">{live.text}{live.sub ? <span className="font-normal text-muted"> · {live.sub}</span> : null}</p>
          <p className="text-[11px] text-muted">{live.mode === "bar" ? T("Bar on the website and card", "website और card पर पट्टी") : live.mode === "popup" ? T("Pop-up on open", "खुलते ही pop-up") : T("Bar + pop-up", "पट्टी + pop-up")}{live.until ? ` · ${untilLabel(live.until, hi)}` : ""}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={share} className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-2 text-xs font-semibold text-white"><Share2 className="h-3.5 w-3.5" /> {T("Share on WhatsApp", "WhatsApp पर भेजें")}</button>
            <button type="button" onClick={() => setOpen((o) => !o)} className="rounded-xl border border-border px-3 py-2 text-xs font-semibold">{T("Change", "बदलें")}</button>
            <button type="button" onClick={() => void clear()} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-danger"><Trash2 className="h-3.5 w-3.5" /> {T("Remove", "हटाएँ")}</button>
          </div>
        </div>
      )}
      {open && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">{EXAMPLES.map((e) => <button key={e} type="button" onClick={() => setText(e)} className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px]">{e}</button>)}</div>
          <input value={text} onChange={(e) => setText(e.target.value.slice(0, 140))} placeholder={T("The news — one line", "खबर — एक लाइन")} className={field} />
          <input value={sub} onChange={(e) => setSub(e.target.value.slice(0, 200))} placeholder={T("A second line (optional)", "दूसरी लाइन (optional)")} className={field} />
          <div className="grid grid-cols-2 gap-2">
            <input value={label} onChange={(e) => setLabel(e.target.value.slice(0, 40))} placeholder={T("Button text (optional)", "button का नाम (optional)")} className={field} />
            <input value={link} onChange={(e) => setLink(e.target.value.trim())} placeholder={T("Button link (blank = WhatsApp)", "button का link (खाली = WhatsApp)")} className={field} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold">{T("Show as", "कैसे दिखे")}:</span>
            <button type="button" onClick={() => pickMode("bar")} className={chip(mode === "bar")}>{T("Bar", "पट्टी")}</button>
            <button type="button" onClick={() => pickMode("popup")} className={chip(mode === "popup")}>{T("Pop-up", "Pop-up")}{locked && " 🔒"}</button>
            <button type="button" onClick={() => pickMode("both")} className={chip(mode === "both")}>{T("Both", "दोनों")}{locked && " 🔒"}</button>
          </div>
          {mode !== "bar" && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 text-xs"><input type="checkbox" checked={form} onChange={(e) => setForm(e.target.checked)} /> {T("Pop-up asks name & number (a lead)", "pop-up नाम-number पूछे (lead)")}</label>
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium">{busy === "photo" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />} {imageUrl ? T("Photo added ✓", "photo लगी ✓") : T("Add a photo / poster", "photo / poster जोड़ें")}<input type="file" accept="image/*" className="hidden" onChange={(e) => void photo(e.target.files?.[0] ?? null)} /></label>
            </div>
          )}
          <label className="flex items-center gap-2 text-xs"><span className="font-semibold">{T("Till", "कब तक")}:</span><input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm" /><span className="text-muted">{T("blank = until you remove it", "खाली = जब तक हटाएँ नहीं")}</span></label>
          {err && <p className="text-sm text-danger">{err}</p>}
          <button type="button" onClick={() => void put()} disabled={busy === "save" || !text.trim()} className="w-full inline-flex items-center justify-center gap-2 rounded-xl grad-brand py-3 text-sm font-semibold text-white disabled:opacity-60">{busy === "save" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {live ? T("Update the notice", "notice बदलें") : T("Put it on my website & card", "website और card पर लगाएँ")}</button>
        </div>
      )}
      {!!card.pastNotices?.length && (
        <details className="text-xs">
          <summary className="cursor-pointer font-semibold text-muted">{T("Earlier notices", "पुरानी notices")}</summary>
          <div className="mt-1.5 flex flex-wrap gap-1.5">{card.pastNotices.map((n) => <button key={n.at + n.text} type="button" onClick={() => reuse(n)} className="rounded-full border border-border bg-surface px-2.5 py-1">{n.text}</button>)}</div>
        </details>
      )}
      {sheet && <PremiumSheet feature={T("Pop-up notice", "Pop-up notice")} onClose={() => setSheet(false)} />}
    </section>
  );
}
