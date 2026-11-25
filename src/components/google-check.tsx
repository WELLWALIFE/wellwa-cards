"use client";
// The Google Health Check screen (owner, 4 Nov 2026): name → pick your business → WhatsApp number → report with score, fixes and
// the plan that fixes them. Big type on purpose: shop owners read this on a phone, often with a partner standing next to them.
import { Fragment, useState } from "react";
import { ArrowRight, Check, Loader2, MapPin, Star, X } from "lucide-react";
import { waLink } from "@/lib/site-brand";

type Candidate = { id: string; name: string; address: string; rating: number; reviews: number };
type Report = {
  place: Candidate & { category: string; website: string; phone: string; photos: number; hoursSet: boolean; mapsUrl: string };
  city: string; ranks: { keyword: string; rank: number | null; top: { name: string; rating: number; reviews: number }[] }[]; rankChecked: boolean;
  site: { performance: number; seo: number; checked: boolean }; rivals: Candidate[];
  score: number; breakdown: { label: string; got: number; max: number }[]; fixes: Fix[];
  local?: { rank: number | null; total: number; ahead: Candidate[] }; profile?: { label: string; ok: boolean }[]; issues?: Fix[];
};
type Fix = { title: string; why: string; plan: "website" | "growth"; hi?: string };
/** The partner whose website sent the visitor: the report's buttons open their WhatsApp. */
type Partner = { name: string; wa: string };

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
  const [partner, setPartner] = useState<Partner | null>(null);

  async function find(e: React.FormEvent) {
    e.preventDefault(); setError(""); setBusy("find"); setPlaces(null); setPick(null); setReport(null);
    try { const j = await post({ step: "find", q, city }); setPlaces(j.places); if (!j.places.length) setError("No business found on Google with that name. Check the spelling, or add the city."); }
    catch (err) { setError((err as Error).message); } finally { setBusy(""); }
  }
  async function run(e: React.FormEvent) {
    e.preventDefault(); if (!pick) return; setError(""); setBusy("report");
    // The partner whose website sent the visitor here (?by=<card>): the lead is theirs.
    let by = ""; try { by = new URLSearchParams(window.location.search).get("by") ?? ""; } catch { /* old browser */ }
    try { const j = await post({ step: "report", placeId: pick.id, phone, name, q: `${q} ${city}`.trim(), ...(by ? { by } : {}) }); setPartner(j.partner ?? null); setReport(j.report); }
    catch (err) { setError((err as Error).message); } finally { setBusy(""); }
  }

  if (report) return <ReportView r={report} partner={partner} onReset={() => { setReport(null); setPlaces(null); setPick(null); }} />;

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
                {/* The search is the cheap one (no rating): the report has it. */}
                {(p.rating > 0 || p.reviews > 0) && <span className="text-sm"><Stars r={p.rating} /> <span className="text-muted">({p.reviews})</span></span>}
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

/** The report, drawn as a story (25 Nov 2026, after the owner put a competitor's report beside ours): who is ahead of you on Google,
 *  how complete your profile is, every issue found, and how Shubhora fixes them. Only what Google really shows us from outside. */
function ReportView({ r, partner, onReset }: { r: Report; partner: Partner | null; onReset: () => void }) {
  const [lang, setLang] = useState<"hi" | "en">("hi");
  const T = (en: string, hi: string) => (lang === "hi" ? hi : en);
  const issues = r.issues?.length ? r.issues : r.fixes;
  const ahead = r.local?.ahead ?? [];
  const more = r.local && r.local.rank === null ? "+" : "";
  const prof = r.profile ?? [];
  const pct = prof.length ? Math.round((prof.filter((x) => x.ok).length / prof.length) * 100) : null;
  const pctTone = pct === null ? "" : pct >= 85 ? "text-good" : pct >= 60 ? "text-amber-600" : "text-red-600";
  const scoreTone = r.score >= 75 ? "text-good" : r.score >= 45 ? "text-amber-600" : "text-red-600";
  const needsWebsite = !r.place.website || issues.some((f) => f.plan === "website");
  const ask = `Hi${partner?.name ? ` ${partner.name}` : " Shubhora"}, my Google report for ${r.place.name} (${r.city}): score ${r.score}/100, ${issues.length} issues${ahead.length ? `, ${ahead.length}${more} businesses ahead of me` : ""}. Please fix my Google profile.`;
  const wa = partner ? `https://wa.me/${partner.wa}?text=${encodeURIComponent(ask)}` : waLink(ask);
  const card = "rounded-3xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05),0_14px_30px_-14px_rgba(16,24,40,0.18)] md:p-7";
  const cta = "flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#6d28d9] via-[#2563eb] to-[#06b6d4] px-5 py-4 text-center text-lg font-bold text-white shadow-lg hover:opacity-95";
  const head = (icon: string, title: string) => (
    <div className="mb-4 flex items-center gap-3 border-b border-border pb-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-bg text-2xl" aria-hidden>{icon}</span><h2 className="text-xl font-bold leading-tight">{title}</h2></div>
  );
  return (
    <div className="space-y-5 text-left">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">{T("Your profile report", "Aapki Profile Report")}</h2>
        <div className="flex items-center gap-3">
          <div className="inline-flex overflow-hidden rounded-full border border-border text-sm font-semibold" role="group" aria-label="Language">
            {(["hi", "en"] as const).map((k) => <button key={k} type="button" aria-pressed={lang === k} onClick={() => setLang(k)} className={`px-3 py-1.5 ${lang === k ? "bg-brand text-white" : "bg-surface text-ink"}`}>{k === "hi" ? "Hinglish" : "English"}</button>)}
          </div>
          <button type="button" onClick={onReset} className="text-sm font-semibold text-brand hover:underline">{T("Change business", "Business badlein")}</button>
        </div>
      </div>

      {/* ---- the headline: who you are, where you stand ---- */}
      <div className={`${card} text-center`}>
        <div className="text-left">
          <p className="text-2xl font-bold leading-tight">{r.place.name}</p>
          <p className="mt-0.5 text-base text-muted">{r.city}</p>
          <p className="mt-1 text-base"><Stars r={r.place.rating} /> <span className="text-muted">({r.place.reviews} reviews)</span></p>
        </div>
        <p className="mx-auto mt-5 inline-block rounded-full bg-red-50 px-4 py-1.5 text-base font-semibold text-red-600">{T(`Report ready · ${issues.length} issues found`, `Report ready · ${issues.length} issues mile`)}</p>
        <p className="mt-4 text-balance text-2xl font-extrabold leading-snug md:text-3xl">
          {ahead.length > 0
            ? T(`${r.place.name} is losing customers to ${ahead.length}${more} competitors on Google.`, `${r.place.name} Google par ${ahead.length}${more} competitors ko customers kho raha hai.`)
            : r.score >= 75 ? T(`${r.place.name} stands strong on Google.`, `${r.place.name} Google par strong hai.`)
            : T(`${r.place.name}'s Google profile is leaving customers on the table.`, `${r.place.name} ki Google profile customers chhod rahi hai.`)}
        </p>
        {ahead.length > 0 && <p className="mx-auto mt-3 max-w-xl text-base text-muted">{T(`Right now, when people search "${r.place.category}" in ${r.city}, these businesses show before you.`, `Abhi - jab log ${r.city} mein "${r.place.category}" search karte hain, ye businesses aapse pehle dikhte hain.`)} <span className="font-semibold text-brand">{T("You can start fixing this within 24 hours.", "Aap 24 hours mein ise fix karna start kar sakte hain.")}</span></p>}
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          {ahead.length > 0
            ? <div className="rounded-2xl border border-border bg-bg p-3"><p className="text-3xl font-extrabold tabular-nums text-red-600">{ahead.length}{more}</p><p className="mt-1 text-xs text-muted">{T("Competitors ranking above you", "Competitors jo upar rank kar rahe hain")}</p></div>
            : <div className="rounded-2xl border border-border bg-bg p-3"><p className={`text-3xl font-extrabold tabular-nums ${scoreTone}`}>{r.score}</p><p className="mt-1 text-xs text-muted">{T("Google score out of 100", "Google score, 100 mein se")}</p></div>}
          <div className="rounded-2xl border border-border bg-bg p-3"><p className="text-3xl font-extrabold tabular-nums text-red-600">{issues.length}</p><p className="mt-1 text-xs text-muted">{T("Issues hurting your ranking", "Issues jo ranking ko hurt kar rahe hain")}</p></div>
          {pct !== null
            ? <div className="rounded-2xl border border-border bg-bg p-3"><p className={`text-3xl font-extrabold tabular-nums ${pctTone}`}>{pct}%</p><p className="mt-1 text-xs text-muted">{T("Profile complete", "Profile complete")}</p></div>
            : <div className="rounded-2xl border border-border bg-bg p-3"><p className="text-3xl font-extrabold tabular-nums">{r.place.reviews}</p><p className="mt-1 text-xs text-muted">Reviews</p></div>}
        </div>
        <a href={wa} target="_blank" rel="noopener noreferrer" className={`${cta} mt-5`}>{T("Fix my Google profile", "Fix My Google profile")} <ArrowRight className="h-5 w-5" /></a>
      </div>

      {/* ---- who is ahead ---- */}
      {ahead.length > 0 && (
        <div className={card}>
          {head("🏆", T("Who is ahead of you on Google", "Google par kaun aapse aage hai"))}
          <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-[#b91c1c] to-[#7f1d1d] p-5 text-white">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-white/15 text-3xl" aria-hidden>🎯</span>
            <div><p className="text-2xl font-extrabold leading-tight">{T(`${ahead.length}${more} businesses near you`, `Aapke paas ${ahead.length}${more} businesses`)}</p><p className="mt-1 text-base text-white/90">{T("rank above you on Google - and are taking your customers.", "Google par upar rank karte hain - aur aapke customers le rahe hain.")}</p></div>
          </div>
          <div className="mt-4 grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 text-base">
            <span className="border-b border-border pb-2 text-xs font-bold uppercase tracking-wide text-muted">Business</span>
            <span className="border-b border-border pb-2 text-right text-xs font-bold uppercase tracking-wide text-muted">Rating</span>
            <span className="border-b border-border pb-2 text-right text-xs font-bold uppercase tracking-wide text-muted">Reviews</span>
            <span className="border-b border-border pb-2 text-right text-xs font-bold uppercase tracking-wide text-muted">Rank</span>
            {ahead.slice(0, 5).map((c, i) => (
              <Fragment key={c.id}>
                <span className="min-w-0 border-b border-border py-3 font-semibold [overflow-wrap:anywhere]">{c.name}</span>
                <span className="border-b border-border py-3 text-right tabular-nums"><Star className="mr-1 inline h-4 w-4 fill-amber-400 text-amber-400" />{c.rating ? c.rating.toFixed(1) : "–"}</span>
                <span className="border-b border-border py-3 text-right font-semibold tabular-nums text-good">{c.reviews}</span>
                <span className="border-b border-border py-3 text-right"><span className="inline-block min-w-[2.6rem] rounded-lg bg-green-50 px-2 py-1 text-center text-sm font-bold tabular-nums text-good">{i + 1}</span></span>
              </Fragment>
            ))}
          </div>
          {ahead.length > 5 && <p className="py-3 text-center text-base italic text-muted">{T(`${ahead.length - 5}${more} more ahead of you...`, `${ahead.length - 5}${more} aur aapse aage...`)}</p>}
          <div className="mt-2 grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 rounded-2xl border-2 border-brand px-3 py-3 text-base">
            <span className="min-w-0 font-bold text-brand [overflow-wrap:anywhere]">▸ {r.place.name}</span>
            <span className="text-right tabular-nums"><Star className="mr-1 inline h-4 w-4 fill-amber-400 text-amber-400" />{r.place.rating ? r.place.rating.toFixed(1) : "0.0"}</span>
            <span className={`text-right font-semibold tabular-nums ${ahead.some((c) => c.reviews > r.place.reviews) ? "text-red-600" : "text-good"}`}>{r.place.reviews}</span>
            <span className="text-right"><span className="inline-block min-w-[2.6rem] rounded-lg bg-red-600 px-2 py-1 text-center text-sm font-bold tabular-nums text-white">{r.local?.rank ?? `${r.local?.total ?? 20}+`}</span></span>
          </div>
          <p className="mt-3 text-xs text-muted">{T(`The order Google gives for "${r.place.category} in ${r.city}" around your address. An estimate: it moves a little with where the searcher stands.`, `"${r.place.category} in ${r.city}" search par aapke address ke aas-paas Google ka order. Ye estimate hai: search karne wale ki jagah ke hisaab se thoda badalta hai.`)}</p>
        </div>
      )}

      {/* ---- profile completion ---- */}
      {pct !== null && (
        <div className={card}>
          {head("📋", "Profile completion")}
          <div className="rounded-2xl bg-bg p-6 text-center">
            <p className={`text-6xl font-extrabold tabular-nums ${pct >= 85 ? "text-good" : "text-brand"}`}>{pct}<span className="text-2xl">%</span></p>
            <p className="mt-1 text-base">{T(`of ${r.place.name}'s profile is filled in`, `${r.place.name} ki profile filled in hai`)}</p>
            <div className="mx-auto mt-4 h-3 max-w-md overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-gradient-to-r from-[#6d28d9] via-[#2563eb] to-[#06b6d4]" style={{ width: `${pct}%` }} /></div>
          </div>
          <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3.5">
            {[...prof.filter((x) => x.ok), ...prof.filter((x) => !x.ok)].map((x) => (
              <li key={x.label} className="flex items-center gap-2.5 text-base">
                {x.ok ? <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-good text-white"><Check className="h-4 w-4" strokeWidth={3} /></span>
                  : <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-red-500 text-red-500"><X className="h-3.5 w-3.5" strokeWidth={3} /></span>}
                <span className={x.ok ? "text-muted" : "font-bold"}>{x.label}</span>
              </li>
            ))}
          </ul>
          {pct < 100 && <a href={wa} target="_blank" rel="noopener noreferrer" className={`${cta} mt-6`}>{T("Complete my profile", "Meri profile complete karein")} <ArrowRight className="h-5 w-5" /></a>}
        </div>
      )}

      {/* ---- every issue ---- */}
      {issues.length > 0 && (
        <div className={card}>
          {head("⚠️", T(`Why is ${r.place.name} not ranking?`, `${r.place.name} rank kyun nahi kar raha?`))}
          <p className="mb-3 inline-block rounded-full bg-red-50 px-3.5 py-1 text-base font-semibold text-red-600">{T(`${issues.length} issues found`, `${issues.length} issues mile`)}</p>
          <ul className="space-y-3.5">
            {issues.map((f) => (
              <li key={f.title} className="flex gap-3 text-base leading-snug">
                <X className="mt-0.5 h-5 w-5 shrink-0 text-red-500" strokeWidth={3} />
                <span>{lang === "hi" && f.hi ? f.hi : <><b>{f.title}</b> - {f.why}</>}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ---- how Shubhora fixes it ---- */}
      <div className="rounded-3xl bg-[#171447] p-6 text-white md:p-8">
        <h2 className="text-2xl font-bold">{T("How Shubhora fixes these", "Shubhora in problems ko kaise theek karta hai")}</h2>
        <ul className="mt-4 grid gap-3 text-base text-white/90 sm:grid-cols-2">
          {[
            ["🏪", T("Keeps your Google profile complete and SEO-ready", "Google profile ko complete aur SEO-ready rakhta hai")],
            ["⭐", T("Sends customers your review link on WhatsApp", "Customers ko WhatsApp par review link bhejta hai")],
            ["💬", T("Replies to your Google reviews", "Google reviews ke reply karta hai")],
            ["📰", T("Posts on Google regularly", "Google par regular post karta hai")],
            ["🌐", T("A fast website Google can read", "Fast website jo Google padh sake")],
            ["🖼️", T("Daily posters, WhatsApp AI and CRM", "Daily posters, WhatsApp AI aur CRM")],
          ].map(([ic, t]) => <li key={t} className="flex items-start gap-2.5"><span aria-hidden>{ic}</span><span>{t}</span></li>)}
        </ul>
        <div className="mt-5 space-y-1.5 text-sm text-white/80">
          {needsWebsite && <p className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#a9c8ff]" /> Website Standard ₹2,999 / year · Premium ₹5,999 / year</p>}
          <p className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#a9c8ff]" /> Growth Plan ₹2,999 / month: Google posts &amp; review replies, daily posters, WhatsApp AI, CRM</p>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 text-base font-semibold text-white hover:opacity-90">{partner?.name ? T(`Talk to ${partner.name} on WhatsApp`, `${partner.name} se WhatsApp par baat karein`) : T("Talk on WhatsApp", "WhatsApp par baat karein")} <ArrowRight className="h-5 w-5" /></a>
          <a href="/pricing" className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-5 py-3 text-base font-semibold text-white hover:bg-white/10">{T("See plans", "Plans dekhein")}</a>
        </div>
      </div>

      <details className="rounded-3xl border border-border bg-surface p-6"><summary className="cursor-pointer font-semibold">{T(`Google score ${r.score}/100 - how it is made`, `Google score ${r.score}/100 - kaise bana`)}</summary>
        <div className="mt-3 divide-y divide-border text-sm">{r.breakdown.map((b) => <div key={b.label} className="flex justify-between py-1.5"><span>{b.label}</span><span className="tabular-nums">{b.got} / {b.max}</span></div>)}</div>
        {r.rankChecked && <div className="mt-4 divide-y divide-border text-sm">{r.ranks.map((k) => <div key={k.keyword} className="flex items-center justify-between gap-3 py-1.5"><span>“{k.keyword}”</span><span className="font-semibold">{k.rank ? `#${k.rank}` : "Not in top 20"}</span></div>)}</div>}
      </details>
      <button onClick={onReset} className="text-sm text-muted underline hover:text-ink">{T("Check another business", "Doosra business check karein")}</button>
    </div>
  );
}
