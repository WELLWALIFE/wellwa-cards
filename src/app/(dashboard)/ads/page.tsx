"use client";
import { SITE_URL, SITE_HOST } from "@/lib/site-url";

// Ads — laid out as the seven steps of actually running a campaign.
//
// Part 1 is done once (connect Facebook and Google). Part 2 repeats for every
// ad. Earlier versions scattered these pieces around the page and hid the setup
// in a collapsed panel, so nobody could tell what to do first. The order on
// screen is now the order you do them in.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Megaphone, LoaderCircle, Check, Copy, Link2, TrendingUp,
  MessageCircle, Phone, Mail, CalendarClock, Download, ShoppingBag,
  Sparkles, ImageIcon, Lightbulb, Clock, Rocket, CircleCheck,
} from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { fetchMyCards } from "@/lib/cloud";
import { Gate } from "@/lib/plan";
import type { Card } from "@/lib/types";
import { AD_FIELDS, guessField, type ReadyAd } from "@/lib/ad-templates";

const SITE = SITE_URL;

/* Which card action reports as which conversion. Shown so the owner knows what
 * the ad platform is being taught to optimise towards. */
const EVENTS = [
  { icon: MessageCircle, label: "WhatsApp tap", fb: "Lead", note: "Your strongest buying signal" },
  { icon: Phone, label: "Call button", fb: "Contact", note: "" },
  { icon: Mail, label: "Contact form", fb: "Lead", note: "" },
  { icon: CalendarClock, label: "Appointment booked", fb: "Schedule", note: "" },
  { icon: Download, label: "Save contact", fb: "CompleteRegistration", note: "" },
  { icon: ShoppingBag, label: "Product viewed", fb: "ViewContent", note: "" },
];

export default function AdsPage() {
  return (
    <Gate feature="analytics">
      <AdsInner />
    </Gate>
  );
}

/* ---------------- layout pieces ---------------- */

function PartHeader({ n, title, time }: { n: string; title: string; time: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-2">
      <h2 className="text-lg font-semibold">{n} — {title}</h2>
      <span className="text-xs text-muted inline-flex items-center gap-1">
        <Clock className="h-3.5 w-3.5" /> {time}
      </span>
    </div>
  );
}

/** One numbered step. `where` names the site you do it on, if it isn't here. */
function Step({ n, title, where, children }: {
  n: number; title: string; where?: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-card">
      <div className="flex gap-3">
        <span className="shrink-0 h-7 w-7 rounded-full grad-brand text-white text-sm font-bold grid place-items-center tabular-nums">
          {n}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-7">{title}</h3>
          {where && <p className="text-xs mono text-faint mt-0.5">on {where}</p>}
          <div className="mt-3">{children}</div>
        </div>
      </div>
    </section>
  );
}

/** Numbered click-path for something done on someone else's website. */
function Clicks({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-1.5">
      {steps.map((st, i) => (
        <li key={st} className="flex gap-2.5 text-sm">
          <span className="shrink-0 h-5 w-5 rounded-full bg-surface2 text-[11px] font-semibold grid place-items-center tabular-nums">
            {i + 1}
          </span>
          <span className="text-muted">{st}</span>
        </li>
      ))}
    </ol>
  );
}

function Field({ label, placeholder, value, onChange, hint }: {
  label: string; placeholder: string; value: string;
  onChange: (v: string) => void; hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium mb-1 block text-muted">{label}</span>
      <input className="ed-input mono" placeholder={placeholder} value={value}
        onChange={(e) => onChange(e.target.value.trim())} />
      {hint && <span className="text-[11px] text-faint mt-1 block">{hint}</span>}
    </label>
  );
}

/* ---------------- page ---------------- */

function AdsInner() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [cardId, setCardId] = useState("");
  const [form, setForm] = useState({ fbPixelId: "", ga4Id: "", googleAdsId: "", googleAdsLabel: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    fetchMyCards().then((cs) => {
      setCards(cs);
      if (cs[0]) selectCard(cs[0]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectCard(c: Card) {
    setCardId(c.id);
    setForm({
      fbPixelId: c.fbPixelId ?? "", ga4Id: c.ga4Id ?? "",
      googleAdsId: c.googleAdsId ?? "", googleAdsLabel: c.googleAdsLabel ?? "",
    });
    setSaved(false);
  }

  const card = (cards ?? []).find((c) => c.id === cardId) ?? null;
  const cardUrl = card ? `${SITE}/c/${card.username}` : "";
  const connected = Boolean(form.fbPixelId || form.googleAdsId || form.ga4Id);

  async function save() {
    const sb = getBrowserSupabase();
    if (!sb || !card) return;
    setSaving(true); setErr(""); setSaved(false);
    // Merge into the stored document — writing the whole object would drop
    // every other edit the owner has made to this card.
    const { data: row } = await sb.from("cards").select("data").eq("id", card.id).maybeSingle();
    const next = { ...(row?.data as Card), ...form };
    const { error } = await sb.from("cards").update({ data: next }).eq("id", card.id);
    setSaving(false);
    if (error) return setErr(error.message);
    setSaved(true);
    setCards((cs) => (cs ?? []).map((c) => (c.id === card.id ? { ...c, ...form } : c)));
  }

  if (!cards) {
    return <div className="p-10 grid place-items-center"><LoaderCircle className="h-5 w-5 animate-spin text-muted" /></div>;
  }

  if (cards.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-10 text-center shadow-card">
        <Megaphone className="h-6 w-6 mx-auto text-faint" />
        <p className="font-medium mt-2">Create a card first</p>
        <p className="text-sm text-muted mt-1">Ads point at a published card.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ads</h1>
        <p className="text-muted mt-1">
          Seven steps, in order. Part 1 is done once; part 2 repeats for every ad you run.
        </p>
      </div>

      {cards.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {cards.map((c) => (
            <button key={c.id} onClick={() => selectCard(c)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium border ${
                c.id === cardId ? "bg-ink text-bg border-ink" : "border-border text-muted hover:bg-surface2"}`}>
              /{c.username}
            </button>
          ))}
        </div>
      )}

      {/* ============ PART 1 ============ */}
      <PartHeader n="Part 1" title="One-time setup" time="about 30 minutes" />
      <p className="text-sm text-muted">
        This is what teaches Facebook and Google who actually contacts you. You can skip all of
        part 1 and still run ads — you just won&apos;t get the cheaper, smarter targeting later.
      </p>

      <Step n={1} title="Create a Facebook Pixel" where="business.facebook.com">
        <Clicks steps={[
          "Open business.facebook.com and create a free Business account",
          "Menu → Events Manager",
          "Connect data sources → Web → Next",
          "Name the pixel (e.g. \"My Card\") → Create",
          "A 15–16 digit number appears at the top — that is your Pixel ID",
        ]} />
        <div className="mt-3">
          <Field label="Facebook Pixel ID" placeholder="1234567890123456"
            value={form.fbPixelId} onChange={(v) => setForm({ ...form, fbPixelId: v })} />
        </div>
      </Step>

      <Step n={2} title="Create a Google Ads conversion" where="ads.google.com">
        <Clicks steps={[
          "Open ads.google.com and create an account (free to create)",
          "Goals → Conversions → New conversion action",
          "Choose Website → paste your card link (below)",
          "Name it \"WhatsApp Contact\", leave Value blank, Count: One",
          "Once saved: Tag setup → Install manually",
          "Copy the two values there — AW-123456789 and the label after it",
        ]} />

        {card && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-surface2/50 px-3 py-2">
            <span className="mono text-xs truncate flex-1">{cardUrl}</span>
            <button
              onClick={() => { navigator.clipboard.writeText(cardUrl); setCopiedUrl(true); setTimeout(() => setCopiedUrl(false), 1600); }}
              className="ed-icon shrink-0" aria-label="Copy card link">
              {copiedUrl ? <Check className="h-4 w-4 text-good" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        )}

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Google Ads ID" placeholder="AW-123456789"
            value={form.googleAdsId} onChange={(v) => setForm({ ...form, googleAdsId: v })} />
          <Field label="Conversion label" placeholder="abcDEF12ghIJK"
            value={form.googleAdsLabel} onChange={(v) => setForm({ ...form, googleAdsLabel: v })} />
        </div>

        <details className="mt-3">
          <summary className="text-xs text-muted cursor-pointer">Also using Google Analytics?</summary>
          <div className="mt-2">
            <Clicks steps={[
              "analytics.google.com → Admin",
              "Data streams → Web → your website",
              "Copy the Measurement ID (top right)",
            ]} />
            <div className="mt-2">
              <Field label="Google Analytics 4 ID" placeholder="G-XXXXXXX"
                value={form.ga4Id} onChange={(v) => setForm({ ...form, ga4Id: v })} />
            </div>
          </div>
        </details>
      </Step>

      <Step n={3} title="Save them here">
        <p className="text-sm text-muted">
          Leave anything you don&apos;t use blank — a card with no IDs loads no tracking at all.
        </p>
        {err && <p className="text-sm text-danger mt-2">{err}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button onClick={save} disabled={saving}
            className="rounded-lg grad-brand text-white px-4 py-2 text-sm font-semibold disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
          {saved && <span className="text-sm text-good inline-flex items-center gap-1"><Check className="h-4 w-4" /> Saved</span>}
          {connected && !saved && (
            <span className="text-xs text-muted inline-flex items-center gap-1">
              <CircleCheck className="h-3.5 w-3.5 text-good" /> Connected
            </span>
          )}
        </div>

        <div className="mt-4 rounded-lg border border-border bg-surface2/50 p-3">
          <p className="text-sm font-medium">Check it worked</p>
          <Clicks steps={[
            "Open your card link on your phone",
            "Tap the WhatsApp button",
            "Facebook → Events Manager → Test Events — a Lead event should appear in seconds",
          ]} />
        </div>

        <details className="mt-3">
          <summary className="text-xs text-muted cursor-pointer">What gets reported as a conversion?</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {EVENTS.map(({ icon: Icon, label, fb, note }) => (
              <div key={label} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                <Icon className="h-4 w-4 text-muted shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{label}</p>
                  {note && <p className="text-[11px] text-faint">{note}</p>}
                </div>
                <span className="mono text-[10px] font-bold uppercase rounded px-1.5 py-0.5 bg-brand-soft text-brand-ink shrink-0">
                  {fb}
                </span>
              </div>
            ))}
          </div>
        </details>
      </Step>

      {/* ============ PART 2 ============ */}
      <PartHeader n="Part 2" title="For every ad you run" time="about 5 minutes" />

      {card && <StepFour card={card} />}
      {card && <StepFive card={card} />}

      <Step n={6} title="Wait 3–4 days">
        <p className="text-sm text-muted">
          Don&apos;t judge it on day one. Facebook spends the first couple of days working out who
          responds, and results swing wildly until it settles. Changing the ad daily resets that
          learning and wastes the money you already spent.
        </p>
      </Step>

      <StepSeven />
    </div>
  );
}

/* ---------------- step 4: the ad link ---------------- */

/**
 * Builds the link that goes in the ad.
 *
 * Without the tags nothing can be attributed — every visitor looks like
 * "direct" and step 7 stays empty. Making it copy-paste means the owner can't
 * forget.
 */
function StepFour({ card }: { card: Card }) {
  const [source, setSource] = useState("facebook");
  const [campaign, setCampaign] = useState("");
  const [copied, setCopied] = useState(false);

  const url = useMemo(() => {
    const q = new URLSearchParams({ utm_source: source, utm_medium: "cpc" });
    q.set("utm_campaign", campaign.trim().toLowerCase().replace(/\s+/g, "-") || "my-first-ad");
    return `${SITE}/c/${card.username}?${q.toString()}`;
  }, [card.username, source, campaign]);

  return (
    <Step n={4} title="Build the link for this ad">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="text-[13px] font-medium mb-1 block text-muted">Where is the ad?</span>
          <select className="ed-input" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
            <option value="google">Google</option>
            <option value="youtube">YouTube</option>
            <option value="whatsapp">WhatsApp broadcast</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[13px] font-medium mb-1 block text-muted">Name this ad</span>
          <input className="ed-input" placeholder="diwali-offer" value={campaign}
            onChange={(e) => setCampaign(e.target.value)} />
        </label>
      </div>

      <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-surface2/50 px-3 py-2">
        <span className="mono text-xs truncate flex-1">{url}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); }}
          className="ed-icon shrink-0" aria-label="Copy link">
          {copied ? <Check className="h-4 w-4 text-good" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
      <p className="mt-2 text-xs text-danger">
        Put <b>this</b> link in the ad, not your plain card link — otherwise nothing is tracked.
      </p>
      <p className="mt-1 text-[11px] text-faint">
        Give every ad its own name, or you won&apos;t be able to tell them apart in step 7.
      </p>
    </Step>
  );
}

/* ---------------- step 5: run it ---------------- */

function StepFive({ card }: { card: Card }) {
  const [fieldKey, setFieldKey] = useState(
    () => guessField([card.company, card.tagline, card.jobTitle, card.about].filter(Boolean).join(" ")).key,
  );
  const [picked, setPicked] = useState<ReadyAd | null>(null);
  type AdCopy = { headline: string; primary: string; cta: string; audience: string; budget: string };
  const [ad, setAd] = useState<AdCopy | null>(null);
  const [busy, setBusy] = useState(false);
  const field = AD_FIELDS.find((f) => f.key === fieldKey) ?? AD_FIELDS[0];

  async function writeAd() {
    setBusy(true);
    try {
      const r = await fetch("/api/ai/write", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          task: "ad",
          input: [card.tagline, card.about].filter(Boolean).join(". "),
          role: card.jobTitle, company: card.company,
        }),
      }).then((x) => x.json());
      const text: string = r.text ?? "";
      const grab = (k: string) =>
        text.match(new RegExp(`${k}:\\s*([\\s\\S]*?)(?=\\n[A-Z]+:|$)`))?.[1]?.trim() ?? "";
      setPicked(null);
      setAd({
        headline: grab("HEADLINE"), primary: grab("PRIMARY"), cta: grab("CTA"),
        audience: grab("AUDIENCE"), budget: grab("BUDGET"),
      });
    } finally { setBusy(false); }
  }

  /**
   * Draws a square ad creative to download and post.
   *
   * Not having a picture is the most common reason an ad never gets made, so
   * this builds one from the card itself.
   */
  function makeImage(headline: string, cta: string) {
    const S = 1080;
    const c = document.createElement("canvas");
    c.width = S; c.height = S;
    const x = c.getContext("2d");
    if (!x) return;

    const g = x.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, card.themeColor);
    g.addColorStop(0.55, card.themeColor + "dd");
    g.addColorStop(1, "#0b1214");
    x.fillStyle = g; x.fillRect(0, 0, S, S);

    const r = x.createRadialGradient(S * 0.25, S * 0.2, 0, S * 0.25, S * 0.2, S * 0.8);
    r.addColorStop(0, "rgba(255,255,255,0.28)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = r; x.fillRect(0, 0, S, S);

    x.fillStyle = "#ffffff";
    x.font = "600 34px system-ui, -apple-system, Segoe UI, sans-serif";
    x.globalAlpha = 0.85;
    x.fillText((card.company || card.name).slice(0, 30), 80, 130);
    x.globalAlpha = 1;

    x.font = "bold 76px system-ui, -apple-system, Segoe UI, sans-serif";
    const words = (headline || card.tagline || card.name).split(" ");
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (x.measureText(test).width > S - 160 && line) { lines.push(line); line = w; }
      else line = test;
    }
    if (line) lines.push(line);
    lines.slice(0, 4).forEach((l, i) => x.fillText(l, 80, 380 + i * 92));

    const label = (cta || "Message on WhatsApp").slice(0, 28);
    x.font = "600 40px system-ui, -apple-system, Segoe UI, sans-serif";
    const w = x.measureText(label).width + 80;
    x.fillStyle = "#ffffff";
    x.beginPath();
    if (typeof x.roundRect === "function") x.roundRect(80, S - 260, w, 96, 48);
    else x.rect(80, S - 260, w, 96);
    x.fill();
    x.fillStyle = card.themeColor;
    x.fillText(label, 120, S - 196);

    x.fillStyle = "#ffffff";
    x.globalAlpha = 0.75;
    x.font = "32px ui-monospace, SFMono-Regular, Menlo, monospace";
    x.fillText(`${SITE_HOST}/c/${card.username}`, 80, S - 90);

    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `${card.username}-ad.png`;
    a.click();
  }

  const chosen = picked
    ? { headline: picked.headline, primary: picked.primary, cta: picked.cta, audience: picked.audience, budget: picked.budget }
    : ad;

  return (
    <Step n={5} title="Write the ad and run it" where="Facebook / Instagram">
      <p className="text-sm text-muted">Pick one that&apos;s already written, or have AI write a fresh one.</p>

      <select className="ed-input mt-2 text-sm" value={field.key}
        onChange={(e) => { setFieldKey(e.target.value); setPicked(null); setAd(null); }}>
        {AD_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
      </select>

      <div className="mt-2 space-y-2">
        {field.ads.map((a) => (
          <button key={a.campaign} onClick={() => { setPicked(a); setAd(null); }}
            className={`w-full text-left rounded-lg border p-3 transition-colors ${
              picked?.campaign === a.campaign ? "border-brand bg-brand-soft/40" : "border-border hover:bg-surface2"}`}>
            <p className="text-sm font-medium">{a.headline}</p>
            <p className="text-[11px] text-faint mt-0.5">{a.angle}</p>
          </button>
        ))}
      </div>

      <button onClick={writeAd} disabled={busy}
        className="mt-2 rounded-lg bg-ai text-white px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">
        {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        Write a fresh one with AI
      </button>

      {chosen && <ChosenAd ad={chosen} onImage={() => makeImage(chosen.headline, chosen.cta)} />}

      <div className="mt-4 rounded-lg border border-border bg-surface2/50 p-3">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <Rocket className="h-4 w-4 text-brand" /> Now put it live
        </p>
        <Clicks steps={[
          "Facebook or Instagram app → post the picture with the ad text",
          "Tap Boost post (or Ads Manager → Create on desktop)",
          "Goal: More website visits — paste the link from step 4",
          "Budget ₹200–300/day for 5 days",
          "Target your city, 15–20 km, plus the age and interests shown above",
        ]} />
      </div>
    </Step>
  );
}

/** The chosen ad, with each part copyable on its own. */
function ChosenAd({ ad, onImage }: {
  ad: { headline: string; primary: string; cta: string; audience: string; budget: string };
  onImage: () => void;
}) {
  const [copied, setCopied] = useState("");
  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 1600);
  };
  const rows: [string, string][] = [
    ["Headline", ad.headline], ["Ad text", ad.primary], ["Button", ad.cta],
    ["Who to target", ad.audience], ["Budget", ad.budget],
  ];
  return (
    <div className="mt-3 rounded-lg border border-brand/30 bg-surface2/50 p-3 space-y-2">
      {rows.filter(([, v]) => v).map(([k, v]) => (
        <div key={k}>
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-faint flex-1">{k}</p>
            <button onClick={() => copy(k, v)} className="text-[11px] font-medium text-brand-ink hover:underline">
              {copied === k ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-sm whitespace-pre-line">{v}</p>
        </div>
      ))}
      <div className="flex flex-wrap gap-3 pt-1">
        <button onClick={() => copy("all", `${ad.headline}\n\n${ad.primary}`)}
          className="text-xs font-medium text-brand-ink hover:underline">
          {copied === "all" ? "Copied headline + text" : "Copy headline + text"}
        </button>
        <button onClick={onImage}
          className="text-xs font-medium text-brand-ink hover:underline inline-flex items-center gap-1">
          <ImageIcon className="h-3.5 w-3.5" /> Download the ad picture
        </button>
      </div>
    </div>
  );
}

/* ---------------- step 7: results ---------------- */

function StepSeven() {
  const [rows, setRows] = useState<{ label: string; views: number; actions: number }[] | null>(null);

  const load = useCallback(async () => {
    const sb = getBrowserSupabase();
    if (!sb) return setRows([]);
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) return setRows([]);
    const { data: cards } = await sb.from("cards").select("username").eq("owner_id", auth.user.id);
    const names = (cards ?? []).map((c: { username: string }) => c.username);
    if (!names.length) return setRows([]);

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await sb
      .from("card_events")
      .select("kind, target, utm_campaign")
      .in("username", names)
      .gte("created_at", since)
      .limit(5000);

    const MONEY = new Set(["whatsapp", "call", "phone", "form", "appointment"]);
    const acc: Record<string, { views: number; actions: number }> = {};
    for (const e of (data ?? []) as { kind: string; target: string; utm_campaign: string | null }[]) {
      if (!e.utm_campaign) continue;
      acc[e.utm_campaign] ??= { views: 0, actions: 0 };
      if (e.kind === "view") acc[e.utm_campaign].views++;
      else if (MONEY.has(e.target)) acc[e.utm_campaign].actions++;
    }
    setRows(Object.entries(acc).map(([label, v]) => ({ label, ...v })).sort((a, b) => b.views - a.views));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <Step n={7} title="See what worked, then decide">
      <p className="text-sm text-muted">
        Last 30 days. <b className="text-ink">Contacts</b> means someone tapped WhatsApp, called,
        filled the form or booked — not just visited.
      </p>

      {rows === null ? (
        <div className="py-8 grid place-items-center"><LoaderCircle className="h-5 w-5 animate-spin text-muted" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted mt-3">
          Nothing yet. Once an ad using your step-4 link starts running, results appear here
          within a day.
        </p>
      ) : (
        <>
          <AdAdvice rows={rows} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead>
                <tr className="text-left text-faint mono text-xs uppercase border-b border-border">
                  <th className="py-2 font-semibold">Ad</th>
                  <th className="py-2 font-semibold text-right">Visits</th>
                  <th className="py-2 font-semibold text-right">Contacts</th>
                  <th className="py-2 font-semibold text-right">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((c) => (
                  <tr key={c.label}>
                    <td className="py-2 pr-3 font-medium truncate max-w-[220px]">{c.label}</td>
                    <td className="py-2 text-right tabular-nums text-muted">{c.views}</td>
                    <td className="py-2 text-right tabular-nums font-medium">{c.actions}</td>
                    <td className="py-2 text-right tabular-nums"
                      style={{ color: c.actions ? "var(--good)" : "var(--faint)" }}>
                      {c.views ? Math.round((c.actions / c.views) * 100) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="mt-4 rounded-lg border border-border bg-surface2/50 p-3 text-sm text-muted space-y-1">
        <p><b className="text-ink">Above 5%</b> — working. Raise the budget slowly.</p>
        <p><b className="text-ink">2–5%</b> — average. Try a different headline or picture.</p>
        <p><b className="text-ink">Below 2%</b> — stop it and put the money on a better ad.</p>
        <p className="text-xs pt-1">
          Under 30 visits it&apos;s too early to judge either way.
        </p>
      </div>
    </Step>
  );
}

/**
 * Turns the table into an instruction.
 *
 * The numbers are only half the job — most owners can't tell whether 3% is good
 * or bad, so this says plainly which ad to grow, fix, or switch off.
 */
function AdAdvice({ rows }: { rows: { label: string; views: number; actions: number }[] }) {
  const [advice, setAdvice] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask() {
    setBusy(true);
    try {
      const summary = rows
        .map((r) => `${r.label}: ${r.views} visits, ${r.actions} contacts (${r.views ? Math.round((r.actions / r.views) * 100) : 0}%)`)
        .join("\n");
      const r = await fetch("/api/ai/write", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ task: "ad-advice", input: summary }),
      }).then((x) => x.json());
      setAdvice(r.text ?? "");
    } finally { setBusy(false); }
  }

  return (
    <div className="my-3 rounded-lg border border-ai/30 bg-ai-soft/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Lightbulb className="h-4 w-4 text-ai shrink-0" />
        <p className="text-sm font-medium flex-1">Not sure what these numbers mean?</p>
        <button onClick={ask} disabled={busy}
          className="rounded-lg bg-ai text-white px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">
          {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Tell me what to do
        </button>
      </div>
      {advice && <p className="mt-2 text-sm whitespace-pre-line">{advice}</p>}
    </div>
  );
}
