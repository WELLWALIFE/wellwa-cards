"use client";
// The Google Health Check screen (owner, 4 Nov 2026): name → pick your business → WhatsApp number → report with score, fixes and
// the plan that fixes them. Big type on purpose: shop owners read this on a phone, often with a partner standing next to them.
import { useState } from "react";
import { ArrowRight, Check, Loader2, MapPin, Star, X } from "lucide-react";
import { waLink } from "@/lib/site-brand";

type Candidate = { id: string; name: string; address: string; rating: number; reviews: number };
type Report = {
  place: Candidate & { category: string; website: string; phone: string; photos: number; hoursSet: boolean; mapsUrl: string };
  city: string; ranks: { keyword: string; rank: number | null; top: { name: string; rating: number; reviews: number }[] }[]; rankChecked: boolean;
  site: { performance: number; seo: number; checked: boolean }; rivals: Candidate[];
  score: number; breakdown: { label: string; got: number; max: number }[]; fixes: { title: string; why: string; plan: "website" | "growth" }[];
};

const post = async (body: unknown) => {
  const r = await fetch("/api/google-check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({})); if (!r.ok || !j.ok) throw new Error(j.error || "Something went wrong. Try again.");
  return j;
};
const Stars = ({ r }: { r: number }) => <span className="inline-flex items-center gap-1 font-semibold"><Star className="h-4 w-4 fill-amber-400 text-amber-400" />{r ? r.toFixed(1) : "—"}</span>;

export function GoogleCheck() {
  const [q, setQ] = useState(""); const [city, setCity] = useState("");
  const [places, setPlaces] = useState<Candidate[] | null>(null); const [pick, setPick] = useState<Candidate | null>(null);
  const [phone, setPhone] = useState(""); const [name, setName] = useState("");
  const [busy, setBusy] = useState<"" | "find" | "report">(""); const [error, setError] = useState("");
  const [report, setReport] = useState<Report | null>(null);

  async function find(e: React.FormEvent) {
    e.preventDefault(); setError(""); setBusy("find"); setPlaces(null); setPick(null); setReport(null);
    try { const j = await post({ step: "find", q, city }); setPlaces(j.places); if (!j.places.length) setError("No business found on Google with that name. Check the spelling, or add the city."); }
    catch (err) { setError((err as Error).message); } finally { setBusy(""); }
  }
  async function run(e: React.FormEvent) {
    e.preventDefault(); if (!pick) return; setError(""); setBusy("report");
    try { const j = await post({ step: "report", placeId: pick.id, phone, name, q: `${q} ${city}`.trim() }); setReport(j.report); }
    catch (err) { setError((err as Error).message); } finally { setBusy(""); }
  }

  if (report) return <ReportView r={report} onReset={() => { setReport(null); setPlaces(null); setPick(null); }} />;

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 md:p-7">
      <form onSubmit={find} className="grid gap-3 sm:grid-cols-[1.4fr_1fr_auto]">
        <input value={q} onChange={(e) => setQ(e.target.value)} required minLength={2} placeholder="Business name (e.g. Gupta Sweets)" className="rounded-xl border border-border bg-bg px-4 py-3 text-base" />
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City (e.g. Jaipur)" className="rounded-xl border border-border bg-bg px-4 py-3 text-base" />
        <button disabled={busy === "find"} className="inline-flex items-center justify-center gap-2 rounded-xl grad-brand px-5 py-3 text-base font-semibold text-white shadow-glow disabled:opacity-60">
          {busy === "find" ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Check <ArrowRight className="h-5 w-5" /></>}
        </button>
        <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      </form>

      {places && places.length > 0 && !pick && (
        <div className="mt-6">
          <p className="text-sm font-semibold text-muted">Which one is yours?</p>
          <div className="mt-2 grid gap-2">
            {places.map((p) => (
              <button key={p.id} onClick={() => setPick(p)} className="flex items-start gap-3 rounded-xl border border-border bg-bg p-4 text-left hover:border-brand">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                <span className="flex-1"><span className="block text-base font-semibold">{p.name}</span><span className="block text-sm text-muted">{p.address}</span></span>
                <span className="text-sm"><Stars r={p.rating} /> <span className="text-muted">({p.reviews})</span></span>
              </button>
            ))}
          </div>
        </div>
      )}

      {pick && (
        <form onSubmit={run} className="mt-6 rounded-xl border border-brand/40 bg-brand-soft p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-base font-semibold">{pick.name}</p><p className="text-sm text-muted">{pick.address}</p></div>
            <button type="button" onClick={() => setPick(null)} className="text-muted hover:text-ink" aria-label="Change"><X className="h-5 w-5" /></button>
          </div>
          <p className="mt-4 text-sm text-muted">Your WhatsApp number — we send the full report there too.</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="rounded-xl border border-border bg-bg px-4 py-3 text-base" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" placeholder="WhatsApp number" className="rounded-xl border border-border bg-bg px-4 py-3 text-base" />
            <button disabled={busy === "report"} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-base font-semibold text-white disabled:opacity-60">
              {busy === "report" ? <><Loader2 className="h-5 w-5 animate-spin" /> Checking…</> : "See my score"}
            </button>
          </div>
          {busy === "report" && <p className="mt-3 text-sm text-muted">Checking Google, Maps rank and your website — about 30 seconds.</p>}
        </form>
      )}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function ReportView({ r, onReset }: { r: Report; onReset: () => void }) {
  const tone = r.score >= 75 ? "text-good" : r.score >= 45 ? "text-amber-600" : "text-red-600";
  const verdict = r.score >= 75 ? "Strong. Keep it up." : r.score >= 45 ? "Average. Easy to improve." : "Weak. Customers are going elsewhere.";
  const needsWebsite = !r.place.website || r.fixes.some((f) => f.plan === "website");
  const wa = waLink(`Hi Shubhora, my Google score for ${r.place.name} (${r.city}) is ${r.score}/100. Please tell me how to improve it.`);
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-surface p-6 text-center md:p-8">
        <p className="text-sm text-muted">{r.place.name} · {r.city}</p>
        <p className={`mt-2 text-7xl font-semibold tracking-tight tabular-nums ${tone}`}>{r.score}<span className="text-2xl text-muted">/100</span></p>
        <p className="mt-2 text-lg font-semibold">{verdict}</p>
        <div className="mt-5 grid grid-cols-2 gap-3 text-left sm:grid-cols-4">
          {[["Rating", r.place.rating ? r.place.rating.toFixed(1) : "—"], ["Reviews", String(r.place.reviews)], ["Photos", String(r.place.photos)], ["Website", r.place.website ? (r.site.checked ? `${r.site.performance}/100 speed` : "Yes") : "None"]].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-border bg-bg p-3"><p className="text-xs text-muted">{k}</p><p className="text-xl font-semibold">{v}</p></div>
          ))}
        </div>
      </div>

      {r.fixes.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold">Fix these first</h2>
          <ol className="mt-3 space-y-3">
            {r.fixes.map((f, i) => (
              <li key={f.title} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{i + 1}</span><div><p className="text-base font-semibold">{f.title}</p><p className="text-sm text-muted">{f.why}</p></div></li>
            ))}
          </ol>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold">Google Maps rank</h2>
        {!r.rankChecked && <p className="mt-2 text-sm text-muted">Rank check is not available right now.</p>}
        <div className="mt-3 divide-y divide-border">
          {r.ranks.map((k) => (
            <div key={k.keyword} className="flex items-center justify-between gap-3 py-2.5"><span className="text-base">“{k.keyword}”</span><span className={`text-base font-semibold ${k.rank && k.rank <= 3 ? "text-good" : k.rank ? "text-amber-600" : "text-red-600"}`}>{k.rank ? `#${k.rank}` : r.rankChecked ? "Not in top 20" : "—"}</span></div>
          ))}
        </div>
      </div>

      {r.rivals.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold">Nearby competitors</h2>
          <div className="mt-3 divide-y divide-border">
            <div className="flex items-center justify-between py-2.5 font-semibold text-brand-ink"><span>{r.place.name} (you)</span><span><Stars r={r.place.rating} /> · {r.place.reviews} reviews</span></div>
            {r.rivals.map((c) => <div key={c.id} className="flex items-center justify-between gap-3 py-2.5"><span className="truncate">{c.name}</span><span className="shrink-0 text-muted"><Stars r={c.rating} /> · {c.reviews} reviews</span></div>)}
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-[#171447] p-6 text-white md:p-8">
        <h2 className="text-xl font-semibold">{needsWebsite ? "Fix it with a Shubhora website + Growth Plan" : "Fix it with the Growth Plan"}</h2>
        <ul className="mt-3 space-y-1.5 text-base text-white/90">
          {needsWebsite && <li className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-[#a9c8ff]" /> Website Standard ₹2,999 / year · Premium ₹5,999 / year (SEO + AI-search ready)</li>}
          <li className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-[#a9c8ff]" /> Growth Plan ₹2,999 / month: Google profile &amp; review replies, daily posters, WhatsApp AI, CRM</li>
          <li className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-[#a9c8ff]" /> 1st month of Growth free with every website plan</li>
        </ul>
        <div className="mt-5 flex flex-wrap gap-3">
          <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 text-base font-semibold text-white hover:opacity-90">Talk on WhatsApp <ArrowRight className="h-5 w-5" /></a>
          <a href="/pricing" className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-5 py-3 text-base font-semibold text-white hover:bg-white/10">See plans</a>
        </div>
      </div>

      <details className="rounded-2xl border border-border bg-surface p-6"><summary className="cursor-pointer font-semibold">How the score is made</summary>
        <div className="mt-3 divide-y divide-border text-sm">{r.breakdown.map((b) => <div key={b.label} className="flex justify-between py-1.5"><span>{b.label}</span><span className="tabular-nums">{b.got} / {b.max}</span></div>)}</div>
      </details>
      <button onClick={onReset} className="text-sm text-muted underline hover:text-ink">Check another business</button>
    </div>
  );
}
