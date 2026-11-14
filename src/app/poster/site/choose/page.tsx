"use client";
// /poster/site/choose — the delivered website's one screen, the same for Standard and Premium (owner, 14 Nov 2026: "dono ke steps same
// hone chahiye — easy and professional"):
//   1. Select any one from 6   six designs, a live preview of the one tapped, "Use this design" (the website is already live with one of
//                              them: choosing never holds it back)
//   2. Check your details      what the website says about the business, and the way to change it
//   3. Share your website      the link, Copy, WhatsApp
//   Not happy? Tell us         a line or two to the team (the first change is free)
// Standard: the six looks of the website (lib/site-looks.ts), put live by a normal publish. Premium: the design made for the order plus
// five from the design library (api/card/advanced { more }), put live by { acceptSeed } — no AI run for a choice.
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, LoaderCircle, MessageCircle, Pencil, Share2 } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { fetchMyCardsStrict, publishCard } from "@/lib/cloud";
import { useT } from "@/lib/poster-i18n";
import { cardHomeShown } from "@/lib/site-url";
import { applyLook, threeLooks, type Look } from "@/lib/site-looks";
import { wearAdvanced, type AdvPreview } from "@/lib/adv-preview";
import type { Card } from "@/lib/types";

const PREVIEW_KEY = "site-choose";
type Design = AdvPreview & { spec?: { seed?: string; archetype?: string } };
type Option = { id: string; name: string; sub: string; card: Card; on: boolean; look?: Look; seed?: string };

export default function ChooseDesignPage() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const [card, setCard] = useState<Card | null>(null);
  const [designs, setDesigns] = useState<Design[] | null>(null);   // Premium: the six; null = a Standard website
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState<"" | "busy" | "free" | "quote">("");
  const [askErr, setAskErr] = useState("");
  const frame = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => { (async () => {
    if (!(await isLoggedIn())) { router.replace("/login?next=/poster/site/choose"); return; }
    const cards = await fetchMyCardsStrict().catch(() => []);
    const c = cards[0];
    if (!c?.site?.enabled) { router.replace("/poster/site/order"); return; }
    setCard(c);
    if (c.site.advanced) {
      // Premium: the designs kept for this card, filled up to six from the library.
      const r = await api<{ designs?: Design[] }>("/api/card/advanced", { method: "POST", json: { cardId: c.id, more: true } }).catch(() => null);
      setDesigns(r?.ok && r.data.designs?.length ? r.data.designs.slice(0, 6) : []);
    }
  })(); }, [router]);

  const options = useMemo<Option[]>(() => {
    if (!card?.site) return [];
    if (designs) {
      const live = (card.site.advanced as { seed?: string } | undefined)?.seed;
      return designs.map((d, i) => ({
        id: `p${i}`, seed: d.spec?.seed, name: T(`Design ${i + 1}`, `Design ${i + 1}`), sub: String(d.spec?.archetype ?? "").replace(/-/g, " "),
        card: wearAdvanced(card, d), on: (card.site as { advancedOn?: boolean } | undefined)?.advancedOn !== false && !!live && d.spec?.seed === live,
      }));
    }
    const cur = card.site.style?.blueprint;
    return threeLooks(card, card.site.style).slice(0, 6).map((l, i) => ({
      id: `s${l.key}`, look: l, name: T(`Design ${i + 1}`, `Design ${i + 1}`), sub: hi ? l.hi : l.name,
      // The look the website wears now keeps its own colours and choices; the others are drawn from it.
      card: l.key === cur ? card : applyLook(card, l), on: l.key === cur,
    }));
  }, [card, designs, hi]); // eslint-disable-line react-hooks/exhaustive-deps
  const chosen = options.find((o) => o.id === pick) ?? options.find((o) => o.on) ?? options[0];

  // The preview frame shows the design that is tapped (the real website renderer reads it from this phone's storage).
  useEffect(() => {
    if (!chosen) return;
    try { localStorage.setItem(PREVIEW_KEY, JSON.stringify({ ...chosen.card, username: "__preview" })); } catch { /* full or private */ }
    try { frame.current?.contentWindow?.postMessage(`preview:${PREVIEW_KEY}`, window.location.origin); } catch { /* ignore */ }
  }, [chosen]);

  async function useDesign() {
    if (!card || !chosen || chosen.on) return;
    setBusy(true); setErr(""); setMsg("");
    try {
      if (chosen.look) {
        const next = applyLook(card, chosen.look);
        const r = await publishCard(next);
        if (!r.ok) { setErr(r.error); return; }
        setCard(next);
      } else {
        const r = await api<{ ok?: boolean; error?: string }>("/api/card/advanced", { method: "POST", json: { cardId: card.id, accept: "choose", acceptSeed: chosen.seed } });
        if (!r.ok || !r.data.ok) { setErr(r.data?.error || T("Could not change the design now. Please try again.", "Design अभी नहीं बदल पाया। दोबारा try करें।")); return; }
        const fresh = (await fetchMyCardsStrict().catch(() => [])).find((x) => x.id === card.id);
        if (fresh) setCard(fresh);
      }
      setPick(""); setMsg(T("Done. Your website now has this design.", "हो गया। आपकी website पर अब यही design है।"));
    } finally { setBusy(false); }
  }

  async function ask() {
    setSent("busy"); setAskErr("");
    const r = await api<{ ok?: boolean; free?: boolean; error?: string }>("/api/site/order", { method: "POST", json: { op: "change", note } }).catch(() => null);
    if (r?.ok && r.data.ok) { setSent(r.data.free ? "free" : "quote"); setNote(""); return; }
    setSent(""); setAskErr(r?.data?.error || T("Could not send it now. Please try again.", "अभी नहीं भेज पाए। दोबारा try करें।"));
  }

  if (!card || (card.site?.advanced && !designs)) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const link = `https://${cardHomeShown(card.username, card.customDomain)}`;
  const box = "space-y-3 rounded-3xl border border-border bg-surface p-4 shadow-card";
  const head = (n: number, t: string, s: string) => (
    <div className="flex items-start gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full grad-brand text-sm font-bold text-white">{n}</span>
      <div className="min-w-0"><p className="text-base font-bold leading-tight">{t}</p><p className="text-xs text-muted">{s}</p></div>
    </div>
  );
  const details = [
    [T("Name", "नाम"), card.name], [T("Business", "Business"), card.company], [T("Line", "Line"), card.tagline],
  ].filter(([, v]) => (v ?? "").trim());
  const waText = encodeURIComponent(`${card.company || card.name}\n${link}`);
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-10 pt-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{T("Your website is ready", "आपकी website तैयार है")}</h1>
        <p className="mt-1 text-sm text-muted">{T("Three small steps. You can come back and change any of them later.", "तीन छोटे steps। बाद में कभी भी वापस आकर बदल सकते हैं।")}</p>
      </div>

      <section className={box}>
        {head(1, T("Select any one from 6", "6 में से कोई एक चुनें"), T("Tap a design to see it below. Your website is already live with the ticked one.", "Design दबाएँ, नीचे दिखेगा। आपकी website अभी ✓ वाले design के साथ live है।"))}
        {options.length ? (
          <>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {options.map((o) => {
                const sel = chosen?.id === o.id;
                return (
                  <button key={o.id} type="button" aria-pressed={sel} onClick={() => { setPick(o.id); setMsg(""); setErr(""); }}
                    className={`relative rounded-2xl border-2 px-2 py-3 text-center ${sel ? "border-brand bg-brand-soft" : "border-border bg-surface"}`}>
                    {o.on && <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-good text-white ring-2 ring-surface"><Check className="h-3 w-3" strokeWidth={3} /></span>}
                    <span className="block text-sm font-bold">{o.name}</span>
                    <span className="block truncate text-[10px] capitalize text-muted">{o.sub}</span>
                  </button>
                );
              })}
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-surface2">
              <iframe ref={frame} title={T("Website preview", "Website का preview")} src={`/preview/site?k=${PREVIEW_KEY}&shot=1`} className="h-[30rem] w-full" />
            </div>
            <button type="button" onClick={() => void useDesign()} disabled={busy || !chosen || chosen.on} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl grad-brand py-3.5 text-base font-semibold text-white disabled:opacity-60">
              {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {chosen?.on ? T("This design is on your website", "यही design आपकी website पर है") : T(`Use ${chosen?.name ?? "this design"}`, `${chosen?.name ?? "यह design"} लगाएँ`)}
            </button>
            {msg && <p role="status" className="rounded-xl border border-good/40 bg-good/10 px-3 py-2 text-sm font-medium">{msg}</p>}
            {err && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{err}</p>}
          </>
        ) : <p className="text-sm text-muted">{T("The designs could not be loaded. Please open this page again.", "Designs नहीं खुल पाए। यह page दोबारा खोलें।")}</p>}
      </section>

      <section className={box}>
        {head(2, T("Check your details", "अपनी details देख लें"), T("This is what your website says. Change anything that is not right.", "आपकी website यही बताती है। जो ठीक न हो, बदल दें।"))}
        <dl className="divide-y divide-border text-sm">
          {details.map(([k, v]) => <div key={k} className="flex justify-between gap-3 py-2"><dt className="shrink-0 text-muted">{k}</dt><dd className="min-w-0 truncate text-right font-medium">{v}</dd></div>)}
        </dl>
        <Link href="/poster/site/next" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-3 text-sm font-semibold"><Pencil className="h-4 w-4" /> {T("Change photos, words or products", "फ़ोटो, शब्द या products बदलें")}</Link>
      </section>

      <section className={box}>
        {head(3, T("Share your website", "अपनी website share करें"), T("Send this link to your customers.", "यह link अपने ग्राहकों को भेजें।"))}
        <p className="truncate rounded-xl bg-surface2 px-3 py-2.5 text-sm font-semibold">{link}</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => { void navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => undefined); }} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-3 text-sm font-semibold"><Copy className="h-4 w-4" /> {copied ? T("Copied", "Copy हो गया") : T("Copy link", "Link copy करें")}</button>
          <a href={`https://wa.me/?text=${waText}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#25d366] py-3 text-sm font-semibold text-white"><Share2 className="h-4 w-4" /> WhatsApp</a>
        </div>
        <Link href="/poster" className="block text-center text-sm font-semibold text-muted underline underline-offset-2">{T("Done — go to the app", "हो गया — app खोलें")}</Link>
      </section>

      <section className={box}>
        <div className="flex items-start gap-3">
          <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
          <div className="min-w-0"><p className="text-base font-bold leading-tight">{T("Not happy? Tell us", "पसंद नहीं आई? हमें बताएँ")}</p><p className="text-xs text-muted">{T("Write what you want changed. Our team makes the first change free.", "लिखें क्या बदलना है। पहला बदलाव हमारी team free करती है।")}</p></div>
        </div>
        {sent === "free" || sent === "quote" ? (
          <p role="status" className="rounded-xl border border-good/40 bg-good/10 px-3 py-2 text-sm font-medium">{sent === "free"
            ? T("Sent. Our team will make the change and tell you on WhatsApp.", "भेज दिया। हमारी team बदलाव करके WhatsApp पर बताएगी।")
            : T("Sent. Your free change is already used, so our team will tell you the charge for this one first.", "भेज दिया। Free बदलाव पहले हो चुका है, इसलिए team पहले इसका charge बताएगी।")}</p>
        ) : (
          <>
            <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 600))} rows={3} placeholder={T("e.g. I want a darker colour and my shop photo on top", "जैसे: रंग गहरा चाहिए और ऊपर मेरी दुकान की फ़ोटो")} className="w-full rounded-2xl border border-border bg-surface px-3 py-2.5 text-sm" />
            <button type="button" onClick={() => void ask()} disabled={sent === "busy" || note.trim().length < 5} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-brand/50 bg-brand-soft py-3 text-sm font-semibold text-brand-ink disabled:opacity-60">{sent === "busy" && <LoaderCircle className="h-4 w-4 animate-spin" />}{T("Send to the team", "Team को भेजें")}</button>
            {askErr && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{askErr}</p>}
          </>
        )}
      </section>
    </div>
  );
}
