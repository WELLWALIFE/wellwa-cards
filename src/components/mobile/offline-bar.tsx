"use client";
// The strip that says "no internet" and shows bills waiting to go to the server; it sends them when the network is back.
import { useCallback, useEffect, useState } from "react";
import { CloudOff, CloudUpload, LoaderCircle } from "lucide-react";
import { useT } from "@/lib/poster-i18n";
import { inr } from "@/lib/jewellery";
import { dropQueued, queued, syncQueue, type Queued } from "@/lib/mobile-offline";

export function OfflineBar({ as, onSynced, tick = 0 }: { as: string | null; onSynced?: () => void; tick?: number }) {
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const [online, setOnline] = useState(true);
  const [list, setList] = useState<Queued[]>([]);
  const [busy, setBusy] = useState(false);
  const mine = useCallback((q: Queued) => ((q.body.as as string | undefined) ?? null) === (as ?? null), [as]);
  const sync = useCallback(async () => {
    if (!queued().some((q) => !q.error)) { setList(queued()); return; }
    setBusy(true);
    const r = await syncQueue().catch(() => ({ sent: 0, left: 0 }));
    setBusy(false); setList(queued());
    if (r.sent) onSynced?.();
  }, [onSynced]);
  // Keep the Mobile Shop screens on this phone (public/sw.js), once a day, so they open with no network.
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !navigator.onLine) return;
    try { if (Date.now() - Number(localStorage.getItem("ms.warm") || 0) < 20 * 3600_000) return; } catch { return; }
    let live = true;
    void (async () => {
      try {
        if (!(await navigator.serviceWorker.getRegistration("/"))) await navigator.serviceWorker.register("/sw.js");
        const reg = await navigator.serviceWorker.ready;
        if (!live || !reg.active) return;
        reg.active.postMessage({ type: "ms-warm", paths: ["/poster/mobile", "/poster/mobile/bill"] });
        localStorage.setItem("ms.warm", String(Date.now()));
      } catch { /* a browser without service workers: bills still queue while the page stays open */ }
    })();
    return () => { live = false; };
  }, []);
  useEffect(() => {
    const t = setTimeout(() => { setOnline(navigator.onLine); setList(queued()); if (navigator.onLine) void sync(); }, 0);
    const on = () => { setOnline(true); void sync(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { clearTimeout(t); window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [sync, tick]);
  const show = list.filter(mine);
  if (online && !show.length) return null;
  return (
    <div className="space-y-1.5 rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-900 print:hidden">
      {!online && <p className="flex items-center gap-1.5 font-semibold"><CloudOff className="h-4 w-4" /> {T("No internet. You can still make bills — they are kept on this phone and go up when the network is back.", "इंटरनेट नहीं है। बिल फिर भी बनते रहेंगे — इसी फ़ोन में रखे जाएँगे और नेटवर्क आते ही चढ़ जाएँगे।")}</p>}
      {show.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 font-semibold">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />} {show.length} {T("bill(s) waiting on this phone", "बिल इस फ़ोन में रुके हैं")}
            {online && !busy && <button type="button" onClick={() => void sync()} className="ml-auto rounded-lg border border-amber-400 bg-white px-2 py-0.5 text-xs font-semibold">{T("Send now", "अभी भेजें")}</button>}</p>
          <ul className="mt-1 space-y-0.5">{show.map((q) => (
            <li key={q.client_id} className="flex flex-wrap items-center justify-between gap-x-2">
              <span>{new Date(q.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · {q.name || T("Walk-in", "नकद ग्राहक")} · <b>{inr(q.total)}</b></span>
              {q.error && <span className="text-danger">{T("Not saved", "Save नहीं हुआ")}: {q.error} <button type="button" onClick={() => { dropQueued(q.client_id); setList(queued()); }} className="underline">{T("Remove", "हटाएँ")}</button></span>}
            </li>))}</ul>
        </div>
      )}
    </div>
  );
}
