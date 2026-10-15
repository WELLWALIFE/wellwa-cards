"use client";
// Bot learning: approve the answers you typed by hand so the bot uses them next time.
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoaderCircle, Check, X, ChevronLeft, GraduationCap } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { goBack } from "@/lib/nav-back";
type Item = { id: string; question: string; answer: string; created_at: string };
export default function LearnPage() {
  const router = useRouter(); const { lang } = useT(); const hi = lang !== "en";
  // The Leads tab "Teach bot" shows this same screen inside Leads: there it is a tab (no arrow, Leads has its own Back); only /poster/learn itself has one.
  const standalone = usePathname() === "/poster/learn";
  const [items, setItems] = useState<Item[] | null>(null);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const T = (en: string, h: string) => (hi ? h : en);
  // A failed Teach / Skip says so under THAT answer's buttons (never a silent no-op); a failed first load says so with a retry.
  const [busyId, setBusyId] = useState("");
  const [rowErr, setRowErr] = useState<{ id: string; text: string } | null>(null);
  const [loadErr, setLoadErr] = useState("");
  async function load() {
    setLoadErr("");
    try {
      const r = await api<{ items: Item[] }>("/api/poster/learn");
      if (!r.ok) { setLoadErr(T("Could not open this list. Please try again.", "यह list नहीं खुली। फिर से कोशिश करें।")); return; }
      setItems(r.data.items ?? []);
    } catch { setLoadErr(T("No internet right now. Check your connection and try again.", "अभी internet नहीं है। Connection देखकर फिर कोशिश करें।")); }
  }
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.replace("/login?next=/poster/learn"); return; } load(); })(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);
  async function act(id: string, action: "approve" | "reject") {
    setRowErr(null); setBusyId(id);
    try {
      const r = await api<{ error?: string }>("/api/poster/learn", { method: "POST", json: { id, action, answer: edit[id] } });
      if (!r.ok) { setRowErr({ id, text: r.data.error || T("Could not save. Please try again.", "Save नहीं हुआ। फिर से कोशिश करें।") }); return; }
    } catch { setRowErr({ id, text: T("No internet right now. Check your connection and try again.", "अभी internet नहीं है। Connection देखकर फिर कोशिश करें।") }); return; }
    finally { setBusyId(""); }
    void load();
  }
  // The arrow is drawn while loading too (this page is in BackBar's OWN_BACK list, so a slow or offline phone would have no Back at all).
  const backBtn = standalone ? <button type="button" onClick={() => goBack(router, "/poster/leads?tab=learn")} className="text-muted" aria-label={hi ? "पीछे" : "Back"}><ChevronLeft className="h-5 w-5" /></button> : null;
  if (items === null) return <div className="space-y-4">{backBtn && <div className="flex items-center gap-2">{backBtn}</div>}{loadErr
    ? <div className="py-16 text-center space-y-3"><p className="text-sm text-danger">{loadErr}</p><button type="button" onClick={() => void load()} className="rounded-xl grad-brand px-5 py-2.5 text-sm font-semibold text-white">{T("Try again", "फिर से कोशिश करें")}</button></div>
    : <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}</div>;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">{backBtn}<h1 className="text-lg font-bold flex items-center gap-1.5"><GraduationCap className="h-5 w-5 text-brand" /> {hi ? "Bot को सिखाएँ" : "Teach the bot"}</h1></div>
      <p className="text-xs text-muted">{hi ? "जब आप WhatsApp पर किसी को खुद जवाब देते हैं, वो यहाँ आता है। Approve करें — अगली बार bot वही जवाब देगा।" : "When you answer a customer yourself on WhatsApp it shows up here. Approve it and the bot will answer the same way next time."}</p>
      {items.length === 0 && <p className="text-sm text-muted">{hi ? "अभी कुछ नहीं। जैसे ही आप WhatsApp पर जवाब देंगे, यहाँ दिखेगा।" : "Nothing yet — reply to a customer on WhatsApp and it will appear here."}</p>}
      {items.map((it) => (
        <div key={it.id} className="rounded-xl border border-border p-3 space-y-2">
          <p className="text-xs text-muted">{hi ? "ग्राहक" : "Customer"}: <span className="text-ink">{it.question}</span></p>
          <textarea className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" rows={3} value={edit[it.id] ?? it.answer} onChange={(e) => { setEdit({ ...edit, [it.id]: e.target.value }); if (rowErr?.id === it.id) setRowErr(null); }} />
          <div className="flex gap-2">
            <button type="button" onClick={() => act(it.id, "reject")} disabled={busyId === it.id} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-60"><X className="h-4 w-4" /> {hi ? "हटाएँ" : "Skip"}</button>
            <button type="button" onClick={() => act(it.id, "approve")} disabled={busyId === it.id} className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg grad-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"><Check className="h-4 w-4" /> {hi ? "Bot को सिखाओ" : "Teach bot"}</button>
          </div>
          {rowErr?.id === it.id && <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{rowErr.text}</p>}
        </div>
      ))}
    </div>
  );
}
