"use client";
// Customer messaging on the CRM tab (phase 2, owner's call 8 Oct 2026): festival wishes on/off, the review ask on/off,
// and "send an offer to everyone" — all from the owner's own linked WhatsApp.
import { useEffect, useState } from "react";
import { Gift, Megaphone, Star } from "lucide-react";
import { api } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onClick} className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "grad-brand" : "bg-surface2 border border-border"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

type Info = { customers: number; linked: boolean; prefs: { festival_wishes: boolean; review_ask: boolean }; nextFestivals: { date: string; en: string; hi: string }[] };

export function CustomerTools() {
  const { lang } = useT();
  const hi = lang === "hi";
  const T = (h: string, e: string) => (hi ? h : e);
  const [info, setInfo] = useState<Info | null>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { api<Info>("/api/crm/customers").then((r) => { if (r.ok) setInfo(r.data); }); }, []);
  async function toggle(k: "festival_wishes" | "review_ask") {
    if (!info) return;
    const next = { ...info.prefs, [k]: !info.prefs[k] };
    setInfo({ ...info, prefs: next });
    const r = await api<{ prefs?: Info["prefs"]; error?: string }>("/api/crm/customers", { method: "PATCH", json: { [k]: next[k] } });
    if (!r.ok) { setMsg(r.data.error || T("सेव नहीं हुआ।", "Could not save.")); setInfo({ ...info }); }
  }
  async function send() {
    setBusy(true); setMsg("");
    const r = await api<{ ok?: boolean; planned?: number; error?: string }>("/api/crm/customers", { method: "POST", json: { text } });
    setBusy(false);
    if (!r.ok) { setMsg(r.data.error || T("भेज नहीं पाया।", "Could not send.")); return; }
    setMsg(T(`✅ ${r.data.planned} ग्राहकों को जा रहा है — धीरे-धीरे, आपके नंबर से।`, `✅ Going to ${r.data.planned} customers — paced, from your number.`));
    setText(""); setOpen(false);
  }
  if (!info) return null;
  const fest = info.nextFestivals[0];
  const festWhen = fest ? new Date(`${fest.date}T00:00:00+05:30`).toLocaleDateString(hi ? "hi-IN" : "en-IN", { day: "numeric", month: "short" }) : "";
  const row = "flex items-center justify-between gap-3 py-2";
  return (
    <div className="rounded-2xl border border-border bg-surface px-3 py-1 text-sm">
      <div className={row}>
        <div className="flex items-center gap-2 min-w-0"><Gift className="h-4 w-4 text-brand-ink shrink-0" /><div className="min-w-0"><p className="font-semibold leading-tight">{T("त्योहार की शुभकामनाएँ अपने-आप", "Festival wishes, automatic")}</p><p className="text-[11px] text-muted truncate">{fest ? T(`अगला: ${fest.hi}, ${festWhen} · ${info.customers} ग्राहकों को आपके नाम से`, `Next: ${fest.en}, ${festWhen} · to ${info.customers} customers in your name`) : T(`${info.customers} ग्राहकों को आपके नाम से`, `to ${info.customers} customers in your name`)}</p></div></div>
        <Switch on={info.prefs.festival_wishes} onClick={() => toggle("festival_wishes")} />
      </div>
      <div className={`${row} border-t border-border`}>
        <div className="flex items-center gap-2 min-w-0"><Star className="h-4 w-4 text-brand-ink shrink-0" /><div className="min-w-0"><p className="font-semibold leading-tight">{T("बिकने के बाद Google रिव्यू माँगो", "Ask for a Google review after a sale")}</p><p className="text-[11px] text-muted truncate">{T("बुकिंग 'हो गया' या lead converted होते ही धन्यवाद + रिव्यू लिंक", "Thank-you + review link when a booking is done or a lead converts")}</p></div></div>
        <Switch on={info.prefs.review_ask} onClick={() => toggle("review_ask")} />
      </div>
      <div className={`${row} border-t border-border`}>
        <div className="flex items-center gap-2 min-w-0"><Megaphone className="h-4 w-4 text-brand-ink shrink-0" /><div className="min-w-0"><p className="font-semibold leading-tight">{T("सबको ऑफ़र भेजो", "Send an offer to everyone")}</p><p className="text-[11px] text-muted truncate">{T("एक मैसेज, सारे ग्राहक, आपके नंबर से · दिन में 3 बार तक", "One message, every customer, from your number · up to 3 a day")}</p></div></div>
        <button type="button" onClick={() => setOpen((v) => !v)} className="shrink-0 rounded-full border border-border px-3 py-1 text-xs font-semibold">{open ? T("बंद", "Close") : T("लिखें", "Write")}</button>
      </div>
      {open && (
        <div className="pb-3 space-y-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={900} className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-brand" placeholder={T("नमस्ते {name} जी 🙏 इस हफ़्ते 20% छूट — कोड DIWALI20। आज ही ऑर्डर करें: ", "Hi {name} 🙏 20% off this week — code DIWALI20. Order today: ")} />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted">{info.linked ? T("{name} की जगह ग्राहक का नाम आएगा।", "{name} becomes the customer's first name.") : T("पहले WhatsApp लिंक करें (WhatsApp टैब)।", "Link your WhatsApp first (WhatsApp tab).")}</p>
            <button type="button" disabled={busy || !info.linked || text.trim().length < 10} onClick={send} className="rounded-full grad-brand px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{busy ? "…" : T(`${info.customers} को भेजें`, `Send to ${info.customers}`)}</button>
          </div>
        </div>
      )}
      {msg && <p className="pb-2 text-xs font-medium text-brand-ink">{msg}</p>}
    </div>
  );
}
