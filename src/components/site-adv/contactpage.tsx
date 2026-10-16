"use client";
// The advanced site's way to reach the business (owner, 16 Oct 2026: "a Rs 5,999 site cannot end in a bare form"):
//   - ContactPage    the Contact page: masthead, the number set huge, a real enquiry form, a map card with directions, live timings
//   - VisitContactDesk  the same desk as a home-page "visit" variant ("contact-desk")
//   - CtaCallback    a closing band with a short "call me back" form ("callback")
// An enquiry is a lead like any other (submitLead, src/lib/cloud.ts -> /api/leads/submit); the answer shows next to the button, never
// in a pop-up. Without a connected backend (the editor's preview) the send is acknowledged and nothing is stored, as the card's form does.
// Colours, radii and fonts come from the spec's tokens (shared.tsx); the class prefixes here are cd- (desk), ef- (form), cb- (callback).
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, Copy, Mail, Send } from "lucide-react";
import type { CardBlock, CardPage } from "@/lib/types";
import { Icon } from "@/components/site-icons";
import { LinkIcon, linkHref } from "@/components/link-icon";
import { AppointmentBlock } from "@/components/card-view";
import { Btn, Head, Sec, type AdvCtx, type SiteContent, type VariantProps } from "@/components/site-adv/shared";
import type { AdvCtxPlus, AdvPageEntry, Chrome } from "@/components/site-adv/nav";
import { AdvForm, Masthead } from "@/components/site-adv/page-parts";
import { MapArt, OpenPill, prettyPhone, SOCIAL_NAME, daysOf, socialHref, ctaLede, mainAction, useIst } from "@/components/site-adv/close";
import type { SectionKey, AdvancedSpec } from "@/lib/site-advanced";

type Slot = (k: SectionKey, index: number) => ReactNode;

const dirOf = (v: NonNullable<SiteContent["visit"]>) => v.mapUrl || (v.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.address)}` : "");
const digitsOf = (s: string) => (s ?? "").replace(/\D/g, "");
/* ================= the enquiry form ================= */

type Fields = { name: string; phone: string; msg: string; pick: string; hp: string };
const EMPTY: Fields = { name: "", phone: "", msg: "", pick: "", hp: "" };

/** Name, phone, what it is about (the business's own items as chips, or a list in the compact form) and a message. */
export function EnquiryForm({ c, x, compact = false, className = "" }: { c: SiteContent; x: AdvCtx; compact?: boolean; className?: string }) {
  const uid = useId();
  const [f, setF] = useState<Fields>(EMPTY);
  const [state, setState] = useState<"idle" | "busy" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");
  const [bad, setBad] = useState<"" | "name" | "phone">("");
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const items = [...new Set((c.offerings?.items ?? []).map((o) => o.name))].slice(0, compact ? 14 : 6);
  const set = (k: keyof Fields, v: string) => { setF((o) => ({ ...o, [k]: v })); if (state === "err" || state === "ok") { setState("idle"); setMsg(""); } if (bad === k) setBad(""); };
  const waText = () => {
    const lines = [f.pick && (x.hi ? `मुझे "${f.pick}" के बारे में जानना है।` : `I'd like to know about "${f.pick}".`), f.msg.trim(), f.name.trim() && `- ${f.name.trim()}`].filter(Boolean);
    return lines.length ? [x.hi ? `नमस्ते ${c.name},` : `Hi ${c.name},`, ...lines].join("\n") : undefined;
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "busy") return;
    const nm = f.name.trim(), ph = digitsOf(f.phone);
    if (nm.length < 2) { setBad("name"); setState("err"); setMsg(x.ui("Please tell us your name.", "कृपया अपना नाम बताइए।")); nameRef.current?.focus(); return; }
    if (ph.length < 10 || ph.length > 13) { setBad("phone"); setState("err"); setMsg(x.ui("Please enter a 10-digit phone number.", "कृपया 10 अंकों का फ़ोन नंबर लिखिए।")); phoneRef.current?.focus(); return; }
    // A bot fills every field; a person never sees this one.
    if (f.hp) { setState("ok"); setMsg(x.ui("Thank you.", "धन्यवाद।")); return; }
    setState("busy"); setMsg(""); setBad("");
    const message = [f.pick && `${x.ui("Interested in", "रुचि")}: ${f.pick}`, f.msg.trim()].filter(Boolean).join("\n");
    try {
      const { submitLead } = await import("@/lib/cloud");
      const res = await submitLead(x.card.username, { name: nm, phone: f.phone.trim(), email: "", message, source: "form" });
      if (res.ok || res.error === "demo") {
        x.track("form-sent");
        setState("ok"); setMsg(x.hi ? `धन्यवाद ${nm.split(" ")[0]}! हम जल्दी ही आपको कॉल या WhatsApp करेंगे।` : `Thank you, ${nm.split(" ")[0]}! We will call or WhatsApp you soon.`);
        setF(EMPTY);
        return;
      }
      // The server's own wording ("Card not found") means nothing to a customer: one plain line, and the ways that always work are beside it.
      setState("err"); setMsg(x.ui("That did not go through. Please try WhatsApp or call us.", "यह नहीं जा पाया। कृपया WhatsApp करें या कॉल करें।"));
    } catch {
      setState("err"); setMsg(x.ui("No connection. Please try WhatsApp or call.", "कनेक्शन नहीं है। कृपया WhatsApp या कॉल करें।"));
    }
  }

  const id = (k: string) => `${uid}-${k}`;
  return (
    <form className={`ef ${compact ? "ef-compact" : ""} ${className}`} onSubmit={submit} noValidate>
      <div className="ef-row">
        <div className="ef-f" data-bad={bad === "name" ? "" : undefined}>
          <label htmlFor={id("n")}>{x.ui("Your name", "आपका नाम")}</label>
          <input ref={nameRef} id={id("n")} name="name" autoComplete="name" value={f.name} onChange={(e) => set("name", e.target.value)} aria-invalid={bad === "name" || undefined} aria-describedby={bad === "name" ? id("m") : undefined} />
        </div>
        <div className="ef-f" data-bad={bad === "phone" ? "" : undefined}>
          <label htmlFor={id("p")}>{x.ui("Phone / WhatsApp", "फ़ोन / WhatsApp")}</label>
          <input ref={phoneRef} id={id("p")} name="phone" type="tel" inputMode="tel" autoComplete="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} aria-invalid={bad === "phone" || undefined} aria-describedby={bad === "phone" ? id("m") : undefined} />
        </div>
      </div>
      {items.length > 1 && (compact ? (
        <div className="ef-f">
          <label htmlFor={id("s")}>{x.ui("About", "किस बारे में")}</label>
          <select id={id("s")} value={f.pick} onChange={(e) => set("pick", e.target.value)}>
            <option value="">{x.ui("Just a general question", "बस एक सामान्य सवाल")}</option>
            {items.map((n) => <option key={n} value={n}>{x.t(n)}</option>)}
          </select>
        </div>
      ) : (
        <fieldset className="ef-f ef-pick">
          <legend>{x.ui("What are you interested in?", "आपको क्या चाहिए?")} <small>{x.ui("optional", "वैकल्पिक")}</small></legend>
          <div>
            {items.map((n) => <button key={n} type="button" aria-pressed={f.pick === n} onClick={() => set("pick", f.pick === n ? "" : n)}>{x.t(n)}</button>)}
          </div>
        </fieldset>
      ))}
      {!compact && (
        <div className="ef-f">
          <label htmlFor={id("t")}>{x.ui("Message", "संदेश")} <small>{x.ui("optional", "वैकल्पिक")}</small></label>
          <textarea id={id("t")} name="message" rows={4} value={f.msg} onChange={(e) => set("msg", e.target.value)} />
        </div>
      )}
      <div className="ef-hp" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={f.hp} onChange={(e) => set("hp", e.target.value)} /></label></div>
      <div className="ef-act">
        <button type="submit" className="btn-primary ef-go" disabled={state === "busy"} data-state={state}>
          {state === "ok" ? <Check size={16} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
          {state === "busy" ? x.ui("Sending…", "भेज रहे हैं…") : state === "ok" ? x.ui("Sent", "भेज दिया") : compact ? x.ui("Request a call back", "कॉल बैक पाएँ") : x.ui("Send enquiry", "पूछताछ भेजें")}
        </button>
        <p id={id("m")} className="ef-status" data-state={state} role={state === "err" ? "alert" : "status"} aria-live="polite">{msg}</p>
      </div>
      {x.wa && !compact && (
        <p className="ef-alt">{x.ui("Rather chat?", "चैट करना चाहेंगे?")} <a href={x.waHref(waText())} target="_blank" rel="noreferrer" onClick={() => x.track("form-whatsapp")}><Icon name="whatsapp" size={15} /> {x.ui("Send this on WhatsApp", "यही WhatsApp पर भेजें")}</a></p>
      )}
    </form>
  );
}

/* ================= the desk: number, map, timings, form ================= */

function CopyAddress({ text, x }: { text: string; x: AdvCtx }) {
  const [done, setDone] = useState(false);
  useEffect(() => { if (!done) return; const t = window.setTimeout(() => setDone(false), 2200); return () => window.clearTimeout(t); }, [done]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setDone(true); x.track("contact-copy"); } catch { /* clipboard blocked: the address stays on screen to copy by hand */ }
  };
  return (
    <button type="button" className="btn-link cd-copy" onClick={copy}>
      {done ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
      <span aria-live="polite">{done ? x.ui("Copied", "कॉपी हो गया") : x.ui("Copy address", "पता कॉपी करें")}</span>
    </button>
  );
}

/** The number as the headline of the section, with the one-tap actions and any other ways to reach (email, social). */
function Hotline({ x }: { x: AdvCtx }) {
  const links = x.card.links.filter((l) => l.value.trim());
  const num = x.phone?.value ?? x.wa?.value ?? "";
  const email = links.find((l) => l.type === "email");
  const same = !!x.wa && !!x.phone && digitsOf(x.wa.value).slice(-10) === digitsOf(x.phone.value).slice(-10);
  const social = links.flatMap((l) => (SOCIAL_NAME[l.type] && l.type !== "website" ? [{ l, href: socialHref(l.type, l.value) }] : [])).filter((s) => s.href);
  const web = links.find((l) => l.type === "website");
  if (!num && !email && !social.length) return null;
  return (
    <div className="cd-hot">
      {num && <p className="kicker">{same ? x.ui("Call or WhatsApp", "कॉल या WhatsApp") : x.phone ? x.ui("Call us", "कॉल करें") : x.ui("WhatsApp us", "WhatsApp करें")}</p>}
      {num && <a className="cd-num" href={x.phone ? linkHref(x.phone.type, x.phone.value) : x.waHref()} {...(x.phone ? {} : { target: "_blank", rel: "noreferrer" })} onClick={() => x.track("contact-number")}>{prettyPhone(num)}</a>}
      <div className="adv-btn-row cd-btns">
        {x.wa && <Btn href={x.waHref()} external data-kind="whatsapp" onClick={() => x.track("contact-whatsapp")}><Icon name="whatsapp" /> {x.ui("WhatsApp us", "WhatsApp करें")}</Btn>}
        {x.phone && <Btn kind="ghost" href={linkHref(x.phone.type, x.phone.value)} onClick={() => x.track("contact-call")}><Icon name="phone" /> {x.ui("Call now", "अभी कॉल करें")}</Btn>}
        {email && <Btn kind="ghost" href={linkHref("email", email.value)} onClick={() => x.track("contact-email")}><Mail size={16} aria-hidden="true" /> {x.ui("Email", "ईमेल")}</Btn>}
      </div>
      {(social.length > 0 || web) && (
        <ul className="cd-soc" aria-label={x.ui("Find us online", "ऑनलाइन हमें खोजें")}>
          {social.map(({ l, href }) => <li key={l.id}><a href={href} target="_blank" rel="noreferrer noopener" onClick={() => x.track(`contact-${l.type}`)}><LinkIcon type={l.type} className="h-4 w-4" /><span>{SOCIAL_NAME[l.type]}</span></a></li>)}
          {web && <li><a href={/^https?:\/\//i.test(web.value) ? web.value : `https://${web.value}`} target="_blank" rel="noreferrer noopener"><LinkIcon type="website" className="h-4 w-4" /><span>{web.value.replace(/^https?:\/\//i, "").replace(/\/$/, "")}</span></a></li>}
        </ul>
      )}
    </div>
  );
}

function MapCard({ c, x }: { c: SiteContent; x: AdvCtx }) {
  const v = c.visit;
  if (!v) return null;
  const dir = dirOf(v);
  if (!v.address && !dir) return null;
  return (
    <div className="cd-map">
      <span className="cd-map-art" aria-hidden="true"><MapArt /><span className="cd-pin"><Icon name="pin" size={26} strokeWidth={1.8} /></span></span>
      <div className="cd-map-body">
        <p className="kicker">{x.ui("Find us", "यहाँ आइए")}</p>
        {v.address ? <address>{x.t(v.address)}</address> : <p className="cd-map-city">{c.city || x.ui("Open the map for the exact spot.", "सही जगह के लिए नक्शा खोलें।")}</p>}
        <div className="adv-btn-row">
          {dir && <Btn href={dir} external onClick={() => x.track("contact-directions")}><Icon name="directions" /> {x.ui("Get directions", "रास्ता देखें")}</Btn>}
          {v.address && <CopyAddress text={v.address} x={x} />}
        </div>
      </div>
    </div>
  );
}

function HoursCard({ c, x }: { c: SiteContent; x: AdvCtx }) {
  const rows = c.visit?.hours ?? [];
  const today = useIst()?.day ?? null;
  if (!rows.length) return null;
  // Same reading of "Mon-Sat" labels as the live pill; today's row is marked when its label can be read.
  const at = today === null ? -1 : rows.findIndex((r) => daysOf(r.day)?.includes(today));
  return (
    <div className="cd-hours">
      <div className="cd-hours-head"><p className="kicker">{x.ui("Opening hours", "खुलने का समय")}</p><OpenPill rows={rows} x={x} /></div>
      <table>
        <caption className="sr-only">{x.ui("Opening hours", "खुलने का समय")}</caption>
        <tbody>
          {rows.map((r, i) => <tr key={i} data-today={i === at ? "" : undefined}><th scope="row">{x.t(r.day)}{i === at && <em>{x.ui("Today", "आज")}</em>}</th><td>{x.t(r.time)}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

/** The body of both the page and the variant: info on the left, the form on the right (sticky on a wide screen). */
function Desk({ c, x, formBlock, appt }: { c: SiteContent; x: AdvCtx; formBlock?: Extract<CardBlock, { kind: "form" }>; appt?: Extract<CardBlock, { kind: "appointment" }> }) {
  const own = !!formBlock?.fields.some((f) => f.label);
  return (
    <div className="cd-grid">
      <div className="cd-info">
        <Hotline x={x} />
        <MapCard c={c} x={x} />
        <HoursCard c={c} x={x} />
        {appt && (appt.note || appt.url) && (
          <div className="cd-card"><p className="kicker">{x.t(appt.title)}</p>{appt.url ? <AppointmentBlock block={appt} username={x.card.username} theme="var(--accent)" /> : <p className="cd-note">{x.t(appt.note)}</p>}</div>
        )}
      </div>
      <div className="cd-form">
        <div className="cd-formcard">
          <p className="kicker">{x.ui("Write to us", "हमें लिखिए")}</p>
          <h2 className="cd-h">{own ? x.t(formBlock!.title) : x.ui("Tell us what you need", "बताइए, आपको क्या चाहिए")}</h2>
          <p className="cd-sub">{x.ui("We reply on WhatsApp or phone, whichever you leave.", "हम WhatsApp या फ़ोन पर जवाब देंगे।")}</p>
          {/* The owner's own form (their fields, their button) wins over ours: it is what they set up in the editor. */}
          {own ? <AdvForm x={x as AdvCtxPlus} title={formBlock!.title} fields={formBlock!.fields} button={formBlock!.button} note={formBlock!.note} interest={c.offerings?.items.map((o) => o.name).slice(0, 14)} /> : <EnquiryForm c={c} x={x} />}
        </div>
      </div>
    </div>
  );
}

/* ================= the Contact page ================= */

type PageProps = { c: SiteContent; spec: AdvancedSpec; x: AdvCtxPlus; chrome: Chrome; slot: Slot; has: (k: SectionKey) => boolean };
export function ContactPage({ c, x, chrome, slot, has, entry, page }: PageProps & { entry: AdvPageEntry; page?: CardPage }) {
  const blocks = page?.blocks ?? [];
  const formBlock = blocks.find((b): b is Extract<CardBlock, { kind: "form" }> => b.kind === "form" && b.fields.some((f) => f.label));
  const note = blocks.find((b): b is Extract<CardBlock, { kind: "contact" }> => b.kind === "contact")?.note ?? "";
  const appt = blocks.find((b): b is Extract<CardBlock, { kind: "appointment" }> => b.kind === "appointment");
  const hours = c.visit?.hours ?? [];
  let i = 1;
  return (
    <>
      <Masthead x={x} chrome={chrome} name={c.name} kicker={x.t(c.trade)} title={x.t(entry.label)} image={c.hm.photo?.src ?? c.photos[0]}
        lede={x.t(note || (c.city ? x.ui(`Come and see us in ${c.city}, or write to us here.`, `${c.city} में आइए, या यहीं लिखिए।`) : x.ui("Come and see us, or write to us here.", "आइए, या यहीं लिखिए।")))}
        aside={hours.length ? <OpenPill rows={hours} x={x} /> : undefined}
        trail={[{ label: x.t(entry.label) }]} />
      <Sec k="visit" tone="paper" wide label={x.t(entry.label)}>
        <Desk c={c} x={x} formBlock={formBlock} appt={appt} />
      </Sec>
      {has("faq") && slot("faq", i++)}
      {has("cta") && slot("cta", i++)}
    </>
  );
}

/* ---------- visit variant "contact-desk": the same desk on the home page ---------- */
export function VisitContactDesk({ c, x, index }: VariantProps) {
  if (!c.visit && !(x.wa || x.phone)) return null;
  return (
    <Sec k="visit" tone={index % 2 ? "alt" : "paper"} wide>
      <Head eyebrow={x.ui("Visit us", "हमसे मिलें")} title={c.city ? (x.hi ? `${c.city} में हमसे मिलें` : `Find us in ${c.city}`) : x.ui("Come and see us", "आइए, मिलिए")} />
      <Desk c={c} x={x} />
    </Sec>
  );
}

/* ---------- cta variant "callback": a closing band with a short call-back form ---------- */
export function CtaCallback({ c, x }: VariantProps) {
  const act = mainAction(c, x);
  return (
    <Sec k="cta" tone="ink" wide>
      <div className="cb">
        <div className="cb-words">
          <p className="kicker">{x.ui("Get in touch", "संपर्क करें")}</p>
          <h2 className="adv-display">{x.ui("Want a call back?", "कॉल बैक चाहिए?")}</h2>
          <p className="adv-lede">{ctaLede(x)}</p>
          {act && (
            <div className="adv-btn-row">
              <Btn kind="ghost" href={act.href} {...(act.ext ? { external: true } : {})} data-kind={act.id} onClick={() => x.track(`cta-${act.id}`)}><Icon name={act.icon} /> {act.label}</Btn>
              {x.wa && x.phone && <Btn kind="link" href={linkHref(x.phone.type, x.phone.value)} onClick={() => x.track("cta-phone")}><Icon name="phone" /> {prettyPhone(x.phone.value)}</Btn>}
            </div>
          )}
        </div>
        <div className="cb-card"><EnquiryForm c={c} x={x} compact /></div>
      </div>
    </Sec>
  );
}

export const CONTACT_CSS = `
/* ---- enquiry form ---- */
.ef{display:grid;gap:var(--s4)}
.ef-row{display:grid;gap:var(--s4)}
.ef-f{display:grid;gap:6px;min-width:0;margin:0;padding:0;border:0}
.ef-f label,.ef-f legend{padding:0;font-size:13.5px;font-weight:600;color:var(--ink)}
.ef-f small{font-weight:400;color:var(--muted)}
.ef-f input,.ef-f textarea,.ef-f select{width:100%;min-height:52px;padding:.8em 1em;font:inherit;font-size:16px;font-weight:400;color:var(--ink);background:var(--paper);border:1px solid var(--line);border-radius:var(--r-ctl);outline:none;transition:border-color .2s,box-shadow .2s;-webkit-appearance:none;appearance:none}
.ef-f select{background-image:linear-gradient(45deg,transparent 50%,currentColor 50%),linear-gradient(135deg,currentColor 50%,transparent 50%);background-position:calc(100% - 20px) 50%,calc(100% - 15px) 50%;background-size:5px 5px;background-repeat:no-repeat;padding-right:2.6em}
.ef-f textarea{resize:vertical;min-height:112px}
.ef-f input:hover,.ef-f textarea:hover,.ef-f select:hover{border-color:color-mix(in srgb,var(--ink) 35%,transparent)}
.ef-f input:focus-visible,.ef-f textarea:focus-visible,.ef-f select:focus-visible{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 24%,transparent)}
.ef-f[data-bad] input{border-color:#c4443a;box-shadow:0 0 0 3px color-mix(in srgb,#c4443a 18%,transparent)}
.ef-pick>div{display:flex;flex-wrap:wrap;gap:var(--s2);margin-top:var(--s1)}
.ef-pick button{min-height:44px;padding:.5em 1.05em;border:1px solid var(--line);border-radius:var(--r-pill);background:var(--paper);color:var(--ink);font:inherit;font-size:14px;font-weight:500;cursor:pointer;transition:background .2s,color .2s,border-color .2s}
.ef-pick button:hover{border-color:var(--ink)}
.ef-pick button[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.ef-hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.ef-act{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s3) var(--s4)}
.ef-go{display:inline-flex;align-items:center;justify-content:center;gap:.55em;border:0;cursor:pointer;flex:0 0 auto}
.ef-go:disabled{opacity:.65;cursor:progress}
.ef-status{margin:0;flex:1 1 14rem;min-width:0;font-size:14px;line-height:1.45;color:var(--muted)}
.ef-status:empty{display:none}
.ef-status[data-state=ok]{color:var(--ink);font-weight:600}
.ef-status[data-state=ok]::before{content:"";display:inline-block;width:8px;height:8px;margin-right:.6em;border-radius:50%;background:var(--wa)}
.ef-status[data-state=err]{color:#b3261e;font-weight:600}
.cb-card .ef-status[data-state=err]{color:#ff9a90}
.ef-alt{margin:0;font-size:var(--t-meta);color:var(--muted)}
.ef-alt a{display:inline-flex;align-items:center;gap:.35em;color:var(--ink);font-weight:600;text-underline-offset:.2em}
@media (min-width:560px){.ef-row{grid-template-columns:1fr 1fr}}

/* ---- contact desk ---- */
.cd-grid{display:grid;gap:clamp(1.5rem,4vw,3.5rem);align-items:start}
.cd-info{display:grid;gap:var(--s5);min-width:0}
.cd-hot{display:flex;flex-direction:column;align-items:flex-start;gap:var(--s4);min-width:0;padding-bottom:var(--s5);border-bottom:1px solid var(--line)}
.cd-num{display:block;max-width:100%;font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(2rem,6.4vw,4.4rem);line-height:1.04;letter-spacing:-.01em;font-variant-numeric:lining-nums;color:var(--ink);text-decoration:none;overflow-wrap:anywhere;background:linear-gradient(var(--accent),var(--accent)) 0 100%/0 .05em no-repeat;transition:background-size .5s cubic-bezier(.2,.7,.2,1),color .2s}
.cd-num:hover{background-size:100% .05em}
.cd-soc{display:flex;flex-wrap:wrap;gap:var(--s2);margin:0;padding:0;list-style:none}
.cd-soc a{display:inline-flex;align-items:center;gap:.5em;min-height:40px;padding:0 1em;border:1px solid var(--line);border-radius:var(--r-pill);color:var(--ink);font-size:13.5px;font-weight:500;text-decoration:none;transition:background .2s,border-color .2s}
.cd-soc a:hover{background:var(--accent-soft);border-color:var(--accent)}
.cd-map{display:grid;overflow:hidden;border:1px solid var(--line);border-radius:var(--r-tile);background:var(--paper)}
.cd-map-art{position:relative;display:block;aspect-ratio:16/8;min-height:170px;overflow:hidden;background:var(--accent-soft)}
.cd-map-art .vz-map{position:absolute;inset:0;width:100%;height:100%}
.cd-map-art .vz-map .bg{fill:var(--accent-soft)}
.cd-map-art .vz-map .bl rect{fill:var(--accent);opacity:.09}
.cd-map-art .vz-map .rd path{fill:none;stroke:var(--paper);stroke-linecap:round}
.cd-pin{position:absolute;left:50%;top:50%;display:grid;place-items:center;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;background:var(--accent);color:var(--on-accent);box-shadow:0 10px 24px color-mix(in srgb,var(--accent) 42%,transparent)}
.cd-pin::after{content:"";position:absolute;inset:0;border-radius:50%;border:2px solid var(--accent);animation:vz-ping 2.6s cubic-bezier(.2,.7,.2,1) infinite}
.cd-map-body{display:grid;gap:var(--s3);padding:var(--s5)}
.cd-map-body .kicker{margin:0}
.cd-map-body address,.cd-map-city{margin:0;font-style:normal;font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.25rem,2.3vw,1.7rem);line-height:1.3;letter-spacing:var(--display-tr);text-wrap:balance}
.site:lang(hi) .cd-map-body address,.site:lang(hi) .cd-map-city{font-weight:var(--display-w-hi);letter-spacing:0;line-height:1.5}
.cd-copy{display:inline-flex;align-items:center;gap:.4em;min-height:44px;border:0;background:none;cursor:pointer;font:inherit;font-size:14px;font-weight:600;color:var(--ink)}
.cd-hours{padding:var(--s5) var(--s6);border:1px solid var(--line);border-radius:var(--r-tile);background:var(--paper)}
.cd-hours-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--s3);margin-bottom:var(--s3)}
.cd-hours-head .kicker{margin:0}
.cd-hours table{width:100%;border-collapse:collapse;font-size:var(--t-body);font-variant-numeric:tabular-nums lining-nums}
.cd-hours th,.cd-hours td{padding:.75em 0;border-bottom:1px solid var(--line);font-weight:500;text-align:left}
.cd-hours td{text-align:right;color:var(--muted)}
.cd-hours tr:last-child>*{border-bottom:0}
.cd-hours tr[data-today]>*{color:var(--ink);font-weight:700}
.cd-hours em{margin-left:.7em;padding:.2em .6em;border-radius:var(--r-pill);background:var(--accent);color:var(--on-accent);font-style:normal;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap}
.site:lang(hi) .cd-hours em{letter-spacing:0;text-transform:none}
.cd-card{display:grid;gap:var(--s3);justify-items:start;padding:var(--s5) var(--s6);border-radius:var(--r-tile);background:var(--paper-2)}
.cd-card .kicker{margin:0}.cd-note{margin:0;color:var(--muted)}
.cd-formcard{padding:clamp(1.5rem,3.2vw,2.75rem);border:1px solid var(--line);border-radius:var(--r-tile);background:var(--paper-2);box-shadow:var(--e-1)}
.adv-sec[data-tone=alt] .cd-formcard{background:var(--paper)}
.cd-formcard .kicker{margin:0 0 var(--s2)}
.cd-h{font-size:clamp(1.8rem,3.4vw,2.6rem);line-height:1.08;letter-spacing:var(--display-tr);text-wrap:balance}
.site:lang(hi) .cd-h{line-height:1.3;letter-spacing:0;font-weight:var(--display-w-hi)}
.cd-sub{margin:var(--s2) 0 var(--s5);color:var(--muted)}
@media (min-width:960px){.cd-grid{grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr)}.cd-form{position:sticky;top:88px}}

/* ---- cta: callback ---- */
.adv-sec:has(>.adv-wrap>.cb){background-image:radial-gradient(60% 90% at 88% 0%,color-mix(in srgb,var(--accent) 34%,transparent),transparent 70%),radial-gradient(40% 60% at 0% 100%,color-mix(in srgb,var(--accent) 16%,transparent),transparent 70%)}
.cb{display:grid;gap:clamp(2rem,5vw,4rem);align-items:center}
.cb-words .adv-display{margin-top:var(--s4)}
.cb-words .adv-lede{margin-bottom:var(--s5)}
.cb-card{padding:clamp(1.25rem,3vw,2.25rem);border:1px solid var(--line);border-radius:var(--r-tile);background:color-mix(in srgb,var(--paper) 100%,transparent)}
.cb-card .ef-f input,.cb-card .ef-f select{background:color-mix(in srgb,var(--ink) 6%,transparent)}
.cb-card .ef-go{width:100%}
.cb-card .ef-status{flex:1 1 100%}
@media (min-width:640px){.cb-card .ef-go{width:auto}}
@media (min-width:900px){.cb{grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr)}}
`;
