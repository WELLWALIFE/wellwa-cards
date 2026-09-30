"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Sparkles, AlertTriangle } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Day = {
  date: string;
  occasion: { slug: string; title: string; hi: string; greet: string; verify: boolean } | null;
  banner: string | null;
  generatedAt: string | null;
};

async function adminHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = { "content-type": "application/json" };
  try { h["x-admin-key"] = sessionStorage.getItem("ne-admin-key") ?? ""; } catch { /* ignore */ }
  try {
    const sb = getBrowserSupabase();
    const { data } = (await sb?.auth.getSession()) ?? { data: { session: null } };
    if (data.session?.access_token) h["x-owner-token"] = data.session.access_token;
  } catch { /* ignore */ }
  return h;
}

export default function BannersAdmin() {
  const [days, setDays] = useState<Day[]>([]);
  const [today, setToday] = useState("");
  const [busy, setBusy] = useState<string>("");
  const [msg, setMsg] = useState<{ date: string; text: string; ok: boolean } | null>(null);
  const [bust, setBust] = useState(0);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/banners", { headers: await adminHeaders(), cache: "no-store" });
    if (r.ok) { const j = await r.json(); setDays(j.days); setToday(j.today); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function generate(date: string, force: boolean) {
    setBusy(date); setMsg(null);
    const r = await fetch("/api/admin/banners", { method: "POST", headers: await adminHeaders(), body: JSON.stringify({ date, force }) });
    const j = await r.json().catch(() => ({}));
    setBusy("");
    setMsg({ date, ok: !!j.ok, text: j.ok ? "Generated." : (j.error || "Failed.") });
    setBust(Date.now());
    load();
  }

  const upcoming = days.filter((d) => d.occasion);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Daily banners</h1>
        <p className="text-sm text-muted mt-1">
          On festival and special days the WhatsApp follow-up goes out with a fresh AI banner (one image for all distributors,
          each copy carries the distributor&apos;s name and number). Generated automatically at 5:00 AM IST; regenerate here if you
          don&apos;t like one. Days without an occasion use the evergreen set.
        </p>
      </div>

      {upcoming.length === 0 && <p className="text-sm text-faint">No occasions in the next three weeks.</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {upcoming.map((d) => (
          <div key={d.date} className="rounded-2xl border border-border bg-surface overflow-hidden">
            <div className="aspect-video bg-surface2 grid place-items-center">
              {d.banner ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${d.banner}?t=${bust}`} alt={d.occasion?.title} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-faint">Not generated yet</span>
              )}
            </div>
            <div className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{d.occasion?.title}</p>
                  <p className="text-xs text-muted">{d.occasion?.hi}</p>
                </div>
                <span className={`text-[11px] mono rounded-full px-2 py-0.5 ${d.date === today ? "bg-brand-soft text-brand-ink" : "bg-surface2 text-muted"}`}>
                  {d.date === today ? "today" : d.date}
                </span>
              </div>
              {d.occasion?.verify && (
                <p className="text-[11px] text-amber-700 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Lunar date — confirm with the panchang before the day.</p>
              )}
              <div className="flex items-center gap-2 pt-1">
                <button type="button" disabled={busy === d.date} onClick={() => generate(d.date, !!d.banner)}
                  className="inline-flex items-center gap-1.5 rounded-lg grad-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                  {busy === d.date ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : d.banner ? <RefreshCw className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {d.banner ? "Regenerate" : "Generate now"}
                </button>
                {d.generatedAt && <span className="text-[11px] text-faint">made {new Date(d.generatedAt).toLocaleString("en-IN")}</span>}
              </div>
              {msg?.date === d.date && (
                <p className={`text-xs ${msg.ok ? "text-good" : "text-danger"}`}>{msg.text}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-faint">
        Calendar lives in <span className="mono">bridge/occasions.json</span> — fixed dates repeat every year; lunar festivals carry a year and need updating annually.
        Cost: about ₹3–4 per generated banner.
      </p>
    </div>
  );
}
