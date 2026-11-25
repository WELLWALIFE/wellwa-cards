"use client";
// Social → Google: the weekly Google + website check (lib/google-health.ts). Score and its change since last week, where the business
// comes among nearby ones, whether the website opens and how fast it is, and every fix — runs every Monday, or now on a tap.
import { useEffect, useState } from "react";
import { LoaderCircle, RefreshCw, TrendingUp, TrendingDown, Globe, MapPin, AlertTriangle, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/poster-client";

type Issue = { title: string; hi: string; why: string };
type Health = {
  at: string; score: number; place: string; mapsUrl: string;
  rank: { rank: number | null; total: number; trade: string } | null;
  profile: { label: string; ok: boolean }[];
  website: { url: string; opens: boolean | null; speed: number | null; seo: number | null; https: boolean | null } | null;
  replies: { of: number; answered: number } | null; lastPostDays: number | null; issues: Issue[];
};
type Data = { health: Health | null; hist: { d: string; s: number }[]; error?: string };

export function GoogleHealth({ hi }: { hi: boolean }) {
  const [d, setD] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [all, setAll] = useState(false);
  const T = (en: string, h: string) => (hi ? h : en);
  useEffect(() => { api<Data>("/api/google/health").then((r) => setD(r.ok ? r.data : { health: null, hist: [] })); }, []);
  async function run() {
    setBusy(true); setErr("");
    const r = await api<Data>("/api/google/health", { method: "POST" });
    setBusy(false);
    if (!r.ok) { setErr(r.data?.error ?? T("Could not finish the check.", "जाँच पूरी नहीं हुई।")); return; }
    setD(r.data);
  }
  if (!d) return null;
  const h = d.health;
  const prev = d.hist.length > 1 ? d.hist[d.hist.length - 2].s : null;
  const delta = h && prev !== null ? h.score - prev : 0;
  const when = h ? new Date(h.at).toLocaleDateString(hi ? "hi-IN" : "en-IN", { day: "numeric", month: "short" }) : "";
  const tone = !h ? "" : h.score >= 80 ? "text-good" : h.score >= 60 ? "text-[#b7791f]" : "text-danger";
  const shown = h ? (all ? h.issues : h.issues.slice(0, 4)) : [];

  return (
    <section className="rounded-xl border border-border p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-ink">{T("Google & website check", "Google और website की जाँच")}</div>
          <div className="text-[11px] text-muted">{h ? T(`Every Monday · last ${when}`, `हर सोमवार · पिछली ${when}`) : T("Runs every Monday by itself. Nothing is changed — it only lists what to fix.", "हर सोमवार अपने-आप चलती है। कुछ बदलती नहीं — सिर्फ बताती है कि क्या ठीक करना है।")}</div>
        </div>
        <button type="button" onClick={run} disabled={busy} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-ink disabled:opacity-60">
          {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}{busy ? T("Checking… (up to a minute)", "जाँच हो रही है… (1 मिनट तक)") : T("Check now", "अभी जाँचें")}
        </button>
      </div>
      {err && <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">{err}</p>}
      {h && (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-surface2/60 py-2">
              <div className={`text-xl font-bold ${tone}`}>{h.score}<span className="text-xs font-normal text-muted">/100</span></div>
              <div className="flex items-center justify-center gap-0.5 text-[10px] text-muted">{delta > 0 ? <><TrendingUp className="h-3 w-3 text-good" />+{delta}</> : delta < 0 ? <><TrendingDown className="h-3 w-3 text-danger" />{delta}</> : T("Score", "Score")}</div>
            </div>
            <div className="rounded-lg bg-surface2/60 py-2">
              <div className="text-xl font-bold text-ink">{h.rank ? (h.rank.rank ? `#${h.rank.rank}` : `${h.rank.total}+`) : "—"}</div>
              <div className="flex items-center justify-center gap-0.5 text-[10px] text-muted"><MapPin className="h-3 w-3" />{h.rank ? (h.rank.rank ? T(`of ${h.rank.total} nearby`, `${h.rank.total} में से`) : T("not in top list", "ऊपर की list में नहीं")) : T("Nearby rank", "आस-पास rank")}</div>
            </div>
            <div className="rounded-lg bg-surface2/60 py-2">
              <div className={`text-xl font-bold ${h.website?.opens === false ? "text-danger" : "text-ink"}`}>{!h.website ? "—" : h.website.opens === false ? "✕" : h.website.speed ?? "…"}</div>
              <div className="flex items-center justify-center gap-0.5 text-[10px] text-muted"><Globe className="h-3 w-3" />{!h.website ? T("No website", "Website नहीं") : h.website.opens === false ? T("Not opening", "नहीं खुल रही") : T("Site speed", "Site speed")}</div>
            </div>
          </div>
          {h.rank && <p className="text-[11px] text-muted">{T(`Nearby rank: Google's own list for “${h.rank.trade}” around you, from one search — an estimate.`, `आस-पास rank: आपके आस-पास “${h.rank.trade}” की Google list, एक search से — अंदाज़ा।`)}</p>}
          {h.issues.length === 0 ? (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-good"><CheckCircle2 className="h-4 w-4" />{T("Nothing to fix this week.", "इस हफ्ते कुछ ठीक करने को नहीं।")}</p>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-ink">{T(`${h.issues.length} thing${h.issues.length > 1 ? "s" : ""} to fix`, `${h.issues.length} चीज़ें ठीक करनी हैं`)}</div>
              {shown.map((x) => (
                <div key={x.title} className="flex gap-2 rounded-lg bg-surface2/60 px-3 py-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#b7791f]" />
                  <div><div className="text-sm font-medium text-ink">{hi ? x.hi : x.title}</div><div className="text-[11px] text-muted">{x.why}</div></div>
                </div>
              ))}
              {h.issues.length > 4 && <button type="button" onClick={() => setAll(!all)} className="text-xs font-semibold text-brand-ink">{all ? T("Show less", "कम दिखाएँ") : T(`Show all ${h.issues.length}`, `सभी ${h.issues.length} देखें`)}</button>}
            </div>
          )}
        </>
      )}
    </section>
  );
}
