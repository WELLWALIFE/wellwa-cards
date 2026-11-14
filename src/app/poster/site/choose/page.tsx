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
import { Check, Copy, ExternalLink, LoaderCircle, MessageCircle, Pencil, Share2 } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { fetchMyCardsStrict, publishCard } from "@/lib/cloud";
import { useT } from "@/lib/poster-i18n";
import { cardHomeShown } from "@/lib/site-url";
import { applyLook, threeLooks, type Look } from "@/lib/site-looks";
import { wearAdvanced, type AdvPreview } from "@/lib/adv-preview";
import type { Card } from "@/lib/types";
import type { OrderState } from "@/lib/site-order";

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
  const [pending, setPending] = useState(false);   // the Premium design is still being made
  const [tick, setTick] = useState(0);

  useEffect(() => { (async () => {
    if (!(await isLoggedIn())) { router.replace("/login?next=/poster/site/choose"); return; }
    const cards = await fetchMyCardsStrict().catch(() => []);
    const c = cards[0];
    if (!c?.site?.enabled) { router.replace("/poster/site/order"); return; }
    // A Premium order whose design is not on the website yet: it is started (again) and this page waits for it — a Premium customer is
    // never shown the Standard looks to choose from.
    if (!c.site.advanced) {
      const o = await api<OrderState>("/api/site/order", { method: "POST", json: { op: "start" } }).catch(() => null);
      if (o?.ok && o.data.premiumPending) { setPending(true); setTimeout(() => setTick((n) => n + 1), 15_000); return; }
    }
    setPending(false);
    setCard(c);
    if (c.site.advanced) {
      // Premium: the designs kept for this card, filled up to six from the library.
      const r = await api<{ designs?: Design[] }>("/api/card/advanced", { method: "POST", json: { cardId: c.id, more: true } }).catch(() => null);
      setDesigns(r?.ok && r.data.designs?.length ? r.data.designs.slice(0, 6) : []);
    }
  })(); }, [router, tick]);

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
  /** A design has been picked or confirmed by the owner (until then the app keeps opening on this screen). */
  const confirmed = !!(card?.site as { designChosenAt?: string } | undefined)?.designChosenAt;

  // The preview frame shows the design that is tapped (the real website renderer reads it from this phone's storage).
  useEffect(() => {
    if (!chosen) return;
    try { localStorage.setItem(PREVIEW_KEY, JSON.stringify({ ...chosen.card, username: "__preview" })); } catch { /* full or private */ }
    try { frame.current?.contentWindow?.postMessage(`preview:${PREVIEW_KEY}`, window.location.origin); } catch { /* ignore */ }
  }, [chosen]);

  /** One design, full size, in its own tab: the real website renderer reads that design from this phone's storage. */
  function openFull(o: Option, i: number) {
    const key = `${PREVIEW_KEY}-${i + 1}`;
    try { localStorage.setItem(key, JSON.stringify({ ...o.card, username: "__preview" })); } catch { /* full or private */ }
    window.open(`/preview/site?k=${key}`, "_blank", "noopener");
  }

  async function useDesign() {
    if (!card || !chosen || (chosen.on && confirmed)) return;
    setBusy(true); setErr(""); setMsg("");
    try {
      if (chosen.look) {
        // The design already on the website is only confirmed (nothing redrawn); another one is put on. Either way the choice is recorded.
        const worn = chosen.on ? card : applyLook(card, chosen.look);
        const next = { ...worn, site: { ...worn.site!, designChosenAt: new Date().toISOString() } as Card["site"] } as Card;
        const r = await publishCard(next);
        if (!r.ok) { setErr(r.error); return; }
        setCard(next);
      } else {
        const r = await api<{ ok?: boolean; error?: string }>("/api/card/advanced", { method: "POST", json: { cardId: card.id, accept: "choose", acceptSeed: chosen.seed } });
        if (!r.ok || !r.data.ok) { setErr(r.data?.error || T("Could not change the design now. Please try again.", "Design अभी नहीं बदल पाया। दोबारा try करें।")); return; }
        const fresh = (await fetchMyCardsStrict().catch(() => [])).find((x) => x.id === card.id);
        if (fresh) setCard(fresh);
      }
      setPick(""); setMsg(T("Done. This design is final on your website. You can still change it here any time.", "हो गया। यही design आपकी website पर final है। यहाँ से कभी भी बदल सकते हैं।"));
    } finally { setBusy(false); }
  }

  /** The six designs as six links on WhatsApp — to the customer, a partner, anyone: each opens that design on any phone (14 days). */
  const [linking, setLinking] = useState(false);
  const [linkErr, setLinkErr] = useState("");
  async function sendLinks() {
    if (!card || !options.length || linking) return;
    setLinking(true); setLinkErr("");
    // WhatsApp opens in a window made NOW (a tap), filled in when the links are ready: a window opened after the wait is taken for a pop-up.
    const win = window.open("", "_blank");
    try {
      const json = designs
        ? { card, designs: designs.map((d, i) => ({ name: `Design ${i + 1}`, adv: { spec: d.spec, copy: d.copy, slides: d.slides } })) }
        : { card, looks: options.map((o) => o.look) };
      const r = await api<{ token?: string; keys?: string[]; error?: string }>("/api/card/test-links", { method: "POST", json });
      if (!r.ok || !r.data.token) throw new Error(r.data?.error || "x");
      const keys = designs ? r.data.keys ?? [] : options.map((o) => o.look!.key);
      const lines = keys.map((k, i) => `Design ${i + 1}: ${window.location.origin}/t/${r.data.token}/${k}`);
      const who = (card.company || card.name || "").trim();
      const text = `${who ? `${who} — ` : ""}${T("website designs", "website के designs")}\n${T("Open each link to see that design, and tell me the number you like:", "हर link खोलकर design देखें, और जो पसंद हो उसका number बताएँ:")}\n\n${lines.join("\n")}`;
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      if (win) win.location.href = url; else window.location.href = url;
    } catch {
      win?.close();
      setLinkErr(T("Could not make the links now. Please try again.", "Links अभी नहीं बन पाए। दोबारा try करें।"));
    } finally { setLinking(false); }
  }

  async function ask() {
    setSent("busy"); setAskErr("");
    const r = await api<{ ok?: boolean; free?: boolean; error?: string }>("/api/site/order", { method: "POST", json: { op: "change", note } }).catch(() => null);
    if (r?.ok && r.data.ok) { setSent(r.data.free ? "free" : "quote"); setNote(""); return; }
    setSent(""); setAskErr(r?.data?.error || T("Could not send it now. Please try again.", "अभी नहीं भेज पाए। दोबारा try करें।"));
  }

  if (pending) return (
    <div className="mx-auto max-w-md space-y-3 px-4 py-24 text-center">
      <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-brand" />
      <p className="text-base font-bold">{T("Your Premium designs are being prepared", "आपके Premium design तैयार हो रहे हैं")}</p>
      <p className="text-sm text-muted">{T("This takes two or three minutes. The page opens by itself; you can also come back later.", "इसमें दो-तीन मिनट लगते हैं। Page अपने-आप खुल जाएगा; बाद में भी आ सकते हैं।")}</p>
    </div>
  );
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
        {head(1, T("Select any one from 6", "6 में से कोई एक चुनें"), confirmed ? T("Tap a design to see it below. Your website has the ticked one.", "Design दबाएँ, नीचे दिखेगा। आपकी website पर ✓ वाला design है।") : T("Tap a design to see it below, then make one final. Until then this page opens every time.", "Design दबाएँ, नीचे दिखेगा, फिर एक को final करें। तब तक हर बार यही page खुलेगा।"))}
        {options.length ? (
          <>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {options.map((o, i) => {
                const sel = chosen?.id === o.id;
                return (
                  <div key={o.id} className={`relative overflow-visible rounded-2xl border-2 text-center ${sel ? "border-brand bg-brand-soft" : "border-border bg-surface"}`}>
                    {o.on && <span className="absolute -right-1.5 -top-1.5 z-10 grid h-5 w-5 place-items-center rounded-full bg-good text-white ring-2 ring-surface"><Check className="h-3 w-3" strokeWidth={3} /></span>}
                    <button type="button" aria-pressed={sel} onClick={() => { setPick(o.id); setMsg(""); setErr(""); }} className="block w-full px-2 pb-1.5 pt-3">
                      <span className="block text-sm font-bold">{o.name}</span>
                      <span className="block truncate text-[10px] capitalize text-muted">{o.sub}</span>
                    </button>
                    {/* The whole website in this design, full size, in a new tab (owner, 14 Nov 2026). */}
                    <button type="button" onClick={() => openFull(o, i)} aria-label={T(`Open ${o.name} in a new tab`, `${o.name} नए tab में खोलें`)} title={T("Open in a new tab", "नए tab में खोलें")}
                      className="inline-flex w-full items-center justify-center gap-1 border-t border-border/70 py-1.5 text-[11px] font-semibold text-brand-ink">
                      <ExternalLink className="h-3.5 w-3.5" /> {T("Open", "खोलें")}
                    </button>
                  </div>
                );
              })}
            </div>
            {/* Right under the tiles: tapping a design only shows it; this button puts it on the website (owner, 14 Nov 2026: "click kar raha hu, select nahi ho raha" — the button was below the preview, out of sight). */}
            <button type="button" onClick={() => void useDesign()} disabled={busy || !chosen || (chosen.on && confirmed)} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl grad-brand py-3.5 text-base font-semibold text-white disabled:opacity-60">
              {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {chosen?.on ? (confirmed ? T("This design is on your website", "यही design आपकी website पर है") : T(`Keep ${chosen.name} — final`, `${chosen.name} ही रखें — final`)) : T(`Use ${chosen?.name ?? "this design"}`, `${chosen?.name ?? "यह design"} लगाएँ`)}
            </button>
            <div className="overflow-hidden rounded-2xl border border-border bg-surface2">
              <iframe ref={frame} title={T("Website preview", "Website का preview")} src={`/preview/site?k=${PREVIEW_KEY}&shot=1`} className="h-[30rem] w-full" />
            </div>
            <button type="button" onClick={() => void sendLinks()} disabled={linking} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#25d366] bg-surface py-3 text-sm font-semibold text-[#128c4a] disabled:opacity-60">
              {linking ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} {T("Send all 6 designs on WhatsApp", "सभी 6 design WhatsApp पर भेजें")}
            </button>
            <p className="text-center text-[11px] text-muted">{T("Six links, one for each design. Anyone can open them, for 14 days.", "छह links, हर design का एक। कोई भी खोल सकता है, 14 दिन तक।")}</p>
            {linkErr && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{linkErr}</p>}
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
        <Link href="/poster" onClick={() => { try { sessionStorage.setItem("shubhora.choose-seen", "1"); } catch { /* */ } }} className="block text-center text-sm font-semibold text-muted underline underline-offset-2">{T("Done — go to the app", "हो गया — app खोलें")}</Link>
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
