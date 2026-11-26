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
  local?: { rank: number | null; total: number; ahead: Candidate[] }; profile?: { label: string; ok: boolean }[]; issues?: Fix[]; trade?: string; sitePending?: boolean;
};
type Fix = { title: string; why: string; plan: "website" | "growth"; hi?: string };
/** The partner whose website sent the visitor: the report's buttons open their WhatsApp. */
type Partner = { name: string; wa: string; card?: string; join?: string };
/** Join Shubhora from the check (owner, 26 Nov 2026: "maksad hai wo hamare saath jude"): the sign-up, under the partner who sent the
 *  visitor (their account username as the sponsor), then the set-up filled from what Google shows about the business (?gc=). */
const joinHref = (join: string, placeId?: string) =>
  `/signup?${join ? `by=${encodeURIComponent(join)}&` : ""}${placeId ? `next=${encodeURIComponent(`/poster/onboard?gc=${placeId}`)}` : ""}`.replace(/[?&]$/, "");

const post = async (body: unknown) => {
  const r = await fetch("/api/google-check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({})); if (!r.ok || !j.ok) throw new Error(j.error || "Something went wrong. Try again.");
  return j;
};
const Stars = ({ r }: { r: number }) => <span className="inline-flex items-center gap-1 font-semibold"><Star className="h-4 w-4 fill-amber-400 text-amber-400" />{r ? r.toFixed(1) : "—"}</span>;

export function GoogleCheck() {
  const [q, setQ] = useState(""); const [city, setCity] = useState("");
  // Local or all-India (owner, 26 Nov 2026: "local me city puche aur India level me India apne se likh de").
  const [reach, setReach] = useState<"local" | "india">("local");
  const where = reach === "india" ? "India" : city.trim();
  const [places, setPlaces] = useState<Candidate[] | null>(null); const [pick, setPick] = useState<Candidate | null>(null);
  const [phone, setPhone] = useState(""); const [name, setName] = useState(""); const [sells, setSells] = useState("");
  const [busy, setBusy] = useState<"" | "find" | "report" | "ask">(""); const [error, setError] = useState("");
  // Nothing found on Google: the visitor can ask for a profile to be made (a lead); `asked` once it is sent.
  const [asked, setAsked] = useState(false);
  // Google always offers something close (live, 26 Nov 2026: a made-up name in Jaipur listed four other shops): "none of these".
  const [none, setNone] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [join, setJoin] = useState("");

  async function find(e: React.FormEvent) {
    e.preventDefault(); setError(""); setBusy("find"); setPlaces(null); setPick(null); setReport(null); setAsked(false); setNone(false);
    try { const j = await post({ step: "find", q, city: where }); setPlaces(j.places); }
    catch (err) { setError((err as Error).message); } finally { setBusy(""); }
  }
  async function run(e: React.FormEvent) {
    e.preventDefault(); if (!pick) return; setError(""); setBusy("report");
    // The partner whose website sent the visitor here (?by=<card>): the lead is theirs.
    let by = ""; try { by = new URLSearchParams(window.location.search).get("by") ?? ""; } catch { /* old browser */ }
    try { const j = await post({ step: "report", placeId: pick.id, phone, name, q: `${q} ${where}`.trim(), ...(sells.trim() ? { sells: sells.trim() } : {}), ...(by ? { by } : {}) }); setPartner(j.partner ?? null); setJoin(j.join ?? ""); setReport(j.report);
      // The website's speed comes a little later and is put into the report shown.
      if (j.report?.sitePending) void post({ step: "speed", placeId: pick.id }).then((s) => { if (s.report) setReport((cur) => (cur && cur.place.id === s.report.place.id ? s.report : cur)); }).catch(() => setReport((cur) => (cur ? { ...cur, sitePending: false } : cur)));
    }
    catch (err) { setError((err as Error).message); } finally { setBusy(""); }
  }

  async function askProfile(e: React.FormEvent) {
    e.preventDefault(); setError(""); setBusy("ask");
    let by = ""; try { by = new URLSearchParams(window.location.search).get("by") ?? ""; } catch { /* old browser */ }
    try { const j = await post({ step: "noprofile", q, city: where, phone, name, ...(by ? { by } : {}) }); setPartner(j.partner ?? null); setJoin(j.join ?? ""); setAsked(true); }
    catch (err) { setError((err as Error).message); } finally { setBusy(""); }
  }

  if (report) return <ReportView r={report} partner={partner} join={join} onReset={() => { setReport(null); setPlaces(null); setPick(null); }} />;

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 md:p-7">
      <p className="mb-2 text-sm font-semibold text-ink">Where do you serve customers?</p>
      <div className="mb-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Business reach">
        {([["local", "In one city", "A shop, clinic or service in your city"], ["india", "Across India", "A brand or business serving all of India"]] as const).map(([k, en, hi]) => (
          <button key={k} type="button" role="radio" aria-checked={reach === k} onClick={() => setReach(k)} className={`rounded-xl border px-3 py-2.5 text-left text-sm ${reach === k ? "border-brand bg-brand-soft font-semibold text-brand-ink" : "border-border text-ink"}`}>
            {en}<span className="block text-xs font-normal text-muted">{hi}</span>
          </button>
        ))}
      </div>
      <form onSubmit={find} className={`grid gap-3 ${reach === "local" ? "sm:grid-cols-[1.4fr_1fr_auto]" : "sm:grid-cols-[1fr_auto]"}`}>
        <input value={q} onChange={(e) => setQ(e.target.value)} required minLength={2} placeholder="Business name (e.g. Gupta Sweets)" className="rounded-xl border border-border bg-bg px-4 py-3 text-base" />
        {reach === "local" && <input value={city} onChange={(e) => setCity(e.target.value)} required minLength={2} placeholder="City (e.g. Jaipur)" className="rounded-xl border border-border bg-bg px-4 py-3 text-base" />}
        <button disabled={busy === "find"} className="inline-flex items-center justify-center gap-2 rounded-xl grad-brand px-5 py-3 text-base font-semibold text-white shadow-glow disabled:opacity-60">
          {busy === "find" ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Check <ArrowRight className="h-5 w-5" /></>}
        </button>
        <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      </form>

      {places && places.length > 0 && !pick && !none && (
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
            <button type="button" onClick={() => setNone(true)} className="rounded-xl border border-dashed border-border p-4 text-left text-base font-semibold text-muted hover:border-brand hover:text-ink">None of these is my business</button>
          </div>
        </div>
      )}

      {places && (places.length === 0 || none) && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-ink md:p-5 dark:bg-amber-950/30">
          <p className="text-base font-semibold">We could not find “{q}” on Google{reach === "local" && city.trim() ? ` in ${city.trim()}` : ""}.</p>
          <p className="mt-1 text-sm">Without a Google Business Profile, customers searching nearby cannot find you on Google Search or Maps. It is the single most important listing for a local business.</p>
          <p className="mt-1 text-xs text-muted">Listed under a different spelling? Search again above{reach === "india" ? ", or choose “In one city” and add the city" : ""}.</p>
          {asked ? (
            <div className="mt-4 rounded-lg bg-white/70 p-3 text-sm dark:bg-black/20">
              <p className="font-semibold text-good">✅ Thank you. Our team will contact you on WhatsApp shortly.</p>
              <a href={joinHref(join)} className="mt-2 mr-2 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 font-semibold text-white">Get started with Shubhora <ArrowRight className="h-4 w-4" /></a>
              {partner && <a href={`https://wa.me/${partner.wa}?text=${encodeURIComponent(`Hi ${partner.name}, please make a Google profile for ${q}${city.trim() ? ` (${city.trim()})` : ""}.`)}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 font-semibold text-white">Talk to {partner.name} on WhatsApp <ArrowRight className="h-4 w-4" /></a>}
            </div>
          ) : (
            <form onSubmit={askProfile} className="mt-4">
              <p className="text-sm font-semibold">Let us create and set up your Google Business Profile for you.</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="rounded-xl border border-border bg-bg px-4 py-3 text-base" />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" placeholder="WhatsApp number" className="rounded-xl border border-border bg-bg px-4 py-3 text-base" />
                <button disabled={busy === "ask"} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-base font-semibold text-white disabled:opacity-60">{busy === "ask" ? <Loader2 className="h-5 w-5 animate-spin" /> : "Set up my profile"}</button>
              </div>
            </form>
          )}
        </div>
      )}

      {pick && (
        <form onSubmit={run} className="mt-6 rounded-xl border border-brand/40 bg-brand-soft p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-base font-semibold">{pick.name}</p><p className="text-sm text-muted">{pick.address}</p></div>
            <button type="button" onClick={() => setPick(null)} className="text-muted hover:text-ink" aria-label="Change"><X className="h-5 w-5" /></button>
          </div>
          {/* Used to find the competitors when Google has no category for the business. */}
          <input value={sells} onChange={(e) => setSells(e.target.value.slice(0, 40))} placeholder="What do you sell? (e.g. water purifier, sweets, salon)" className="mt-4 w-full rounded-xl border border-border bg-bg px-4 py-3 text-base" />
          <p className="mt-1 text-xs text-muted">So we can show which businesses like yours rank above you.</p>
          <p className="mt-4 text-sm text-muted">Your WhatsApp number — we send the full report there too.</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="rounded-xl border border-border bg-bg px-4 py-3 text-base" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" placeholder="WhatsApp number" className="rounded-xl border border-border bg-bg px-4 py-3 text-base" />
            <button disabled={busy === "report"} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-base font-semibold text-white disabled:opacity-60">
              {busy === "report" ? <><Loader2 className="h-5 w-5 animate-spin" /> Checking…</> : "See my score"}
            </button>
          </div>
          {busy === "report" && <p className="mt-3 text-sm text-muted">Checking your Google profile and who ranks above you — a few seconds.</p>}
        </form>
      )}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  );
}

/** The report, drawn as a story (25 Nov 2026, after the owner put a competitor's report beside ours): who is ahead of you on Google,
 *  how complete your profile is, every issue found, and how Shubhora fixes them. Only what Google really shows us from outside. */
function ReportView({ r, partner, join, onReset }: { r: Report; partner: Partner | null; join: string; onReset: () => void }) {
  // English only (owner, 26 Nov 2026: the site is in English, so is this page). T keeps the second text only as a note.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const T = (en: string, _hi?: string) => en;
  const issues = r.issues?.length ? r.issues : r.fixes;
  const ahead = r.local?.ahead ?? [];
  const more = r.local && r.local.rank === null ? "+" : "";
  const prof = r.profile ?? [];
  const trade = r.trade || r.place.category;
  const PLAN = { growth: "Growth Plan", website: "Website" } as const;
  const pct = prof.length ? Math.round((prof.filter((x) => x.ok).length / prof.length) * 100) : null;
  const pctTone = pct === null ? "" : pct >= 85 ? "text-good" : pct >= 60 ? "text-amber-600" : "text-red-600";
  const scoreTone = r.score >= 75 ? "text-good" : r.score >= 45 ? "text-amber-600" : "text-red-600";
  const needsWebsite = !r.place.website || issues.some((f) => f.plan === "website");
  const ask = `Hi${partner?.name ? ` ${partner.name}` : " Shubhora"}, my Google report for ${r.place.name} (${r.city}): score ${r.score}/100, ${issues.length} issues${ahead.length ? `, ${ahead.length}${more} businesses ahead of me` : ""}. Please fix my Google profile.`;
  const pic = `${typeof window === "undefined" ? "" : window.location.origin}/api/google-check/card?p=${encodeURIComponent(r.place.id)}${partner?.card ? `&by=${encodeURIComponent(partner.card)}` : ""}`;
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
            ? T(`${ahead.length}${more} nearby businesses appear ahead of ${r.place.name} on Google.`, `${r.place.name} Google par ${ahead.length}${more} competitors ko customers kho raha hai.`)
            : r.score >= 75 ? T(`${r.place.name} stands strong on Google.`, `${r.place.name} Google par strong hai.`)
            : T(`${r.place.name} can win more customers from Google.`, `${r.place.name} ki Google profile customers chhod rahi hai.`)}
        </p>
        {ahead.length > 0 && <p className="mx-auto mt-3 max-w-xl text-base text-muted">{T(`Right now, when people search "${trade}" in ${r.city}, these businesses show before you.`, `Abhi - jab log ${r.city} mein "${trade}" search karte hain, ye businesses aapse pehle dikhte hain.`)} <span className="font-semibold text-brand">{T("Most of it can be fixed within a few days.", "Aap 24 hours mein ise fix karna start kar sakte hain.")}</span></p>}
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          {ahead.length > 0
            ? <div className="rounded-2xl border border-border bg-bg p-3"><p className="text-3xl font-extrabold tabular-nums text-red-600">{ahead.length}{more}</p><p className="mt-1 text-xs text-muted">{T("Competitors ranking above you", "Competitors jo upar rank kar rahe hain")}</p></div>
            : <div className="rounded-2xl border border-border bg-bg p-3"><p className={`text-3xl font-extrabold tabular-nums ${scoreTone}`}>{r.score}</p><p className="mt-1 text-xs text-muted">{T("Google score out of 100", "Google score, 100 mein se")}</p></div>}
          <div className="rounded-2xl border border-border bg-bg p-3"><p className="text-3xl font-extrabold tabular-nums text-red-600">{issues.length}</p><p className="mt-1 text-xs text-muted">{T("Issues affecting your visibility", "Issues jo ranking ko hurt kar rahe hain")}</p></div>
          {pct !== null
            ? <div className="rounded-2xl border border-border bg-bg p-3"><p className={`text-3xl font-extrabold tabular-nums ${pctTone}`}>{pct}%</p><p className="mt-1 text-xs text-muted">{T("Profile complete", "Profile complete")}</p></div>
            : <div className="rounded-2xl border border-border bg-bg p-3"><p className="text-3xl font-extrabold tabular-nums">{r.place.reviews}</p><p className="mt-1 text-xs text-muted">Reviews</p></div>}
        </div>
        <a href={wa} target="_blank" rel="noopener noreferrer" className={`${cta} mt-5`}>{T("Fix my Google profile", "Fix My Google profile")} <ArrowRight className="h-5 w-5" /></a>
        {/* The report as one picture: to keep, or to send on WhatsApp. */}
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <a href={pic} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold hover:border-brand">🖼️ {T("Report as a picture", "Report ki photo")}</a>
          <a href={`https://wa.me/?text=${encodeURIComponent(`${r.place.name} - Google report: score ${r.score}/100, ${issues.length} issues.\n${pic}`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold hover:border-brand">📤 {T("Share on WhatsApp", "WhatsApp par share karein")}</a>
        </div>
      </div>

      {r.sitePending && <p className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> {T("Checking your website's speed on a phone - it joins the report in a moment.", "Aapki website ki phone par speed check ho rahi hai - thodi der mein report mein jud jayegi.")}</p>}

      {/* ---- who is ahead ---- */}
      {ahead.length > 0 && (
        <div className={card}>
          {head("🏆", T("Who is ahead of you on Google", "Google par kaun aapse aage hai"))}
          <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-[#b91c1c] to-[#7f1d1d] p-5 text-white">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-white/15 text-3xl" aria-hidden>🎯</span>
            <div><p className="text-2xl font-extrabold leading-tight">{T(`${ahead.length}${more} businesses near you`, `Aapke paas ${ahead.length}${more} businesses`)}</p><p className="mt-1 text-base text-white/90">{T("appear above you when customers search on Google.", "Google par upar rank karte hain - aur aapke customers le rahe hain.")}</p></div>
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
          <p className="mt-3 text-xs text-muted">{T(`The order Google gives for "${trade} in ${r.city}" around your address. An estimate: it moves a little with where the searcher stands.`, `"${trade} in ${r.city}" search par aapke address ke aas-paas Google ka order. Ye estimate hai: search karne wale ki jagah ke hisaab se thoda badalta hai.`)}</p>
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
          {head("⚠️", T(`What is holding ${r.place.name} back on Google`, `${r.place.name} rank kyun nahi kar raha?`))}
          <p className="mb-3 inline-block rounded-full bg-red-50 px-3.5 py-1 text-base font-semibold text-red-600">{T(`${issues.length} issues found`, `${issues.length} issues mile`)}</p>
          <ul className="space-y-3.5">
            {issues.map((f) => (
              <li key={f.title} className="flex gap-3 text-base leading-snug">
                <X className="mt-0.5 h-5 w-5 shrink-0 text-red-500" strokeWidth={3} />
                <span className="min-w-0 flex-1"><><b>{f.title}</b> — {f.why}</>
                  {/* Which Shubhora plan fixes this one. */}
                  <span className="ml-2 inline-block whitespace-nowrap rounded-full bg-brand-soft px-2 py-0.5 align-middle text-[11px] font-bold text-brand-ink">{T("Fixed by", "Theek karta hai")}: {PLAN[f.plan]}</span></span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ---- review replies: Google does not show an owner's replies to outsiders, so no number is claimed; what is true is said ---- */}
      <div className={card}>
        {head("💬", T("Are you replying to your reviews?", "Kya aap reviews ka jawab de rahe hain?"))}
        <p className="text-base leading-relaxed">
          {r.place.reviews === 0
            ? T("You have no reviews yet, so there is nothing to reply to. Businesses that ask every customer and reply to every review move up fastest.", "Abhi aapke paas koi review nahi hai, isliye jawab dene ko kuch nahi hai. Jo businesses har customer se review maangte hain aur har review ka jawab dete hain, wo sabse tez upar aate hain.")
            : T(`You have ${r.place.reviews} reviews. Google itself advises owners to reply to reviews - aim to answer at least 8 of every 10. Unanswered reviews tell future customers that no one is listening.`, `Aapke paas ${r.place.reviews} reviews hain. Google khud owners ko reviews ka jawab dene ki salah deta hai - har 10 mein se kam se kam 8 ka jawab dein. Har bina jawab wala review ek customer hai jise lagta hai koi sun nahi raha.`)}
        </p>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-bg p-4"><p className="text-sm text-muted">{T("A good target", "Achha target")}</p><p className="text-2xl font-extrabold text-good">80%+</p></div>
          <div className="rounded-2xl border border-border bg-bg p-4"><p className="text-sm text-muted">{T("With Shubhora", "Shubhora ke saath")}</p><p className="text-base font-bold leading-snug">{T("Every review gets a reply, automatically", "Har review ka jawab, apne-aap")}</p></div>
        </div>
        <p className="mt-3 text-xs text-muted">{T("Your exact reply rate shows once your Google Business is connected to Shubhora - Google does not share it publicly.", "Aapka exact reply rate tab dikhega jab aapka Google Business Shubhora se connect hoga - Google ise publicly share nahi karta.")}</p>
        <a href={wa} target="_blank" rel="noopener noreferrer" className={`${cta} mt-5`}>{T("Start auto-replies to my reviews", "Mere reviews ke auto-reply shuru karein")} <ArrowRight className="h-5 w-5" /></a>
      </div>

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
          <a href={joinHref(join, r.place.id)} className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-base font-semibold text-[#171447] hover:opacity-90">{T("Join Shubhora — fix my Google", "Shubhora se judein — Google theek karein")} <ArrowRight className="h-5 w-5" /></a>
          <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 text-base font-semibold text-white hover:opacity-90">{partner?.name ? T(`Talk to ${partner.name} on WhatsApp`, `${partner.name} se WhatsApp par baat karein`) : T("Talk on WhatsApp", "WhatsApp par baat karein")} <ArrowRight className="h-5 w-5" /></a>
          <a href="/pricing" className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-5 py-3 text-base font-semibold text-white hover:bg-white/10">{T("See plans", "Plans dekhein")}</a>
        </div>
        <p className="mt-4 text-sm text-white/80">{T("Already use Shubhora?", "Pehle se Shubhora use karte hain?")} <a href="/poster/social?tab=google" className="font-semibold text-white underline">{T("Connect your Google profile", "Apni Google profile connect karein")}</a> {T("and answer reviews and post from the app.", "aur app se reviews ke jawab aur post karein.")}</p>
      </div>

      <details className="rounded-3xl border border-border bg-surface p-6"><summary className="cursor-pointer font-semibold">{T(`Google score ${r.score}/100 - how it is made`, `Google score ${r.score}/100 - kaise bana`)}</summary>
        <div className="mt-3 divide-y divide-border text-sm">{r.breakdown.map((b) => <div key={b.label} className="flex justify-between py-1.5"><span>{b.label}</span><span className="tabular-nums">{b.got} / {b.max}</span></div>)}</div>
        {r.rankChecked && <div className="mt-4 divide-y divide-border text-sm">{r.ranks.map((k) => <div key={k.keyword} className="flex items-center justify-between gap-3 py-1.5"><span>“{k.keyword}”</span><span className="font-semibold">{k.rank ? `#${k.rank}` : "Not in top 20"}</span></div>)}</div>}
      </details>
      <button onClick={onReset} className="text-sm text-muted underline hover:text-ink">{T("Check another business", "Doosra business check karein")}</button>
    </div>
  );
}
