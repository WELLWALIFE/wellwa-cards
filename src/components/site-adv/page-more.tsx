"use client";
// The advanced site's other pages: About, Gallery, Contact, Updates, and any other page of the card (FAQ, admissions, a custom
// page) drawn block by block. About and Contact are composed from the SAME section variants the home page uses (the spec's
// choices) plus the few sections only a page of their own needs, so a business's pages keep one character from top to bottom.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Mail } from "lucide-react";
import type { CardBlock, CardPage } from "@/lib/types";
import type { AdvancedSpec, SectionKey } from "@/lib/site-advanced";
import type { SiteUpdate } from "@/components/site-view";
import { LinkIcon, linkHref } from "@/components/link-icon";
import { AppointmentBlock } from "@/components/card-view";
import { Icon } from "@/components/site-icons";
import { Pic } from "@/components/pic";
import { Btn, Head, Photo, Sec, Stars, type SiteContent } from "@/components/site-adv/shared";
import type { AdvCtxPlus, AdvPageEntry, Chrome } from "@/components/site-adv/nav";
import { AdvForm, Masthead, ShareBtn } from "@/components/site-adv/page-parts";
import { shownValue } from "@/components/site-adv/close";

export type Slot = (k: SectionKey, index: number) => ReactNode;
type Props = { c: SiteContent; spec: AdvancedSpec; x: AdvCtxPlus; chrome: Chrome; slot: Slot; has: (k: SectionKey) => boolean };

/* ---- today's row of the timings (the owner's "Mon-Sat" / "सोम से शनि" / "Daily" labels) ---- */
const EN_DAYS = new Map<string, number>([["sun", 0], ["sunday", 0], ["mon", 1], ["monday", 1], ["tue", 2], ["tues", 2], ["tuesday", 2], ["wed", 3], ["weds", 3], ["wednesday", 3], ["thu", 4], ["thur", 4], ["thurs", 4], ["thursday", 4], ["fri", 5], ["friday", 5], ["sat", 6], ["saturday", 6]]);
const HI_DAYS: [string, number][] = [["रवि", 0], ["सोम", 1], ["मंगल", 2], ["बुध", 3], ["गुरु", 4], ["शुक्र", 5], ["शनि", 6]];
const RANGE_WORDS = new Set(["-", "–", "—", "to", "till", "through", "thru", "से", "तक"]);
const dayNo = (w: string) => EN_DAYS.get(w) ?? HI_DAYS.find(([p]) => w.startsWith(p))?.[1];
function daysOf(label: string): number[] | null {
  const s = (label ?? "").toLowerCase();
  if (/\b(daily|everyday|every day|all days|all week|7 days)\b|रोज़?|प्रतिदिन|हर दिन|सातों/.test(s)) return [0, 1, 2, 3, 4, 5, 6];
  if (/\bweekdays?\b/.test(s)) return [1, 2, 3, 4, 5];
  if (/\bweekends?\b/.test(s)) return [0, 6];
  const toks = s.match(/[a-zऀ-ॿ]+|[-–—]/g) ?? [];
  const out = new Set<number>();
  for (let i = 0; i < toks.length; i++) {
    const a = dayNo(toks[i]);
    if (a === undefined) continue;
    if (RANGE_WORDS.has(toks[i + 1] ?? "")) {
      const b = i + 2 < toks.length ? dayNo(toks[i + 2]) : undefined;
      if (b !== undefined) { for (let d = a; ; d = (d + 1) % 7) { out.add(d); if (d === b) break; } i += 2; continue; }
    }
    out.add(a);
  }
  return out.size ? [...out] : null;
}
/** Index of the timing row that covers today, -1 until mounted (the server and the first paint agree) or when no row can be read. */
function useTodayRow(rows: { day: string }[]): number {
  const [d, setD] = useState<number | null>(null);
  useEffect(() => { setD(new Date().getDay()); }, []);
  return d === null ? -1 : rows.findIndex((r) => daysOf(r.day)?.includes(d));
}

const firstSentence = (s: string, max = 170) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  const m = /^(.+?[.!?।])(\s|$)/.exec(t);
  const one = m ? m[1] : t;
  return one.length > max ? `${one.slice(0, max - 1).trimEnd()}…` : one;
};
const visibleBlocks = (p: Props): CardBlock[] => p.x.card.pages.filter((pg) => !pg.hidden).flatMap((pg) => pg.blocks);

/* ================= about ================= */

// The masthead's line is dropped when the about section follows: nearly every about variant opens with that same first sentence at
// headline size, so it read three times on the page (16 Oct 2026 QA). The masthead's picture is not the story's own photo, which sits
// right under it (the same frame twice in a row), and the gallery's masthead takes the LAST photo for the same reason (16 Oct 2026 QA).
export function AboutPage({ c, spec, x, chrome, slot, has, entry }: Props & { entry: AdvPageEntry }) {
  let i = 1;
  // Nearly every about variant already lists the highlights, so the numbered "what you can count on" list repeated the same five lines under it (16 Oct 2026 QA).
  const why = !has("about") && c.highlights.length >= 3 ? c.highlights : [];
  const photos = c.gallery.slice(0, 6);
  const gallery = x.pages.byRole("gallery");
  const person = (x.card.name ?? "").trim();
  const showOwner = !!x.card.avatarUrl && !!person && person.toLowerCase() !== c.name.toLowerCase() && spec.sections.about !== "owner-card";
  return (
    <>
      <Masthead x={x} chrome={chrome} name={c.name} kicker={x.t(c.trade)} title={x.t(entry.label)}
        lede={has("about") ? undefined : x.t(firstSentence(c.about?.paras[0] ?? c.hm.sub ?? ""))} image={[c.hm.photo?.src, ...c.photos].find((u) => u && u !== c.about?.image) ?? c.about?.image}
        trail={[{ label: x.t(entry.label) }]} />
      {has("about") && slot("about", i++)}
      {has("trust") && slot("trust", i++)}
      {why.length > 0 && (
        <Sec k="why" tone={i++ % 2 ? "alt" : "paper"} wide label={x.ui("What you can count on", "भरोसे की बातें")}>
          <Head eyebrow={x.ui("Why people choose us", "लोग हमें क्यों चुनते हैं")} title={x.ui("What you can count on", "जिन बातों पर भरोसा करें")} />
          <ul className="ab-why">
            {why.slice(0, 6).map((h, k) => (
              <li key={k}><span className="ab-n" aria-hidden="true">{String(k + 1).padStart(2, "0")}</span><p>{x.t(h)}</p></li>
            ))}
          </ul>
        </Sec>
      )}
      {showOwner && (
        <Sec k="owner" tone={i++ % 2 ? "alt" : "paper"} wide label={x.ui("The person behind it", "आपसे मिलिए")}>
          <div className="ab-owner">
            <div className="ab-owner-pic"><Photo src={x.card.avatarUrl!} alt={person} sizes="(min-width:900px) 30vw, 70vw" /></div>
            <div>
              <p className="kicker">{x.ui("The person behind it", "आपसे मिलिए")}</p>
              <h2 className="adv-h2 mt-3">{x.t(person)}</h2>
              {x.card.jobTitle && <p className="adv-lede">{x.t(x.card.jobTitle)}</p>}
              {x.wa && <div className="adv-btn-row" style={{ marginTop: "var(--s5)" }}><Btn href={x.waHref(x.hi ? `नमस्ते ${person}, ` : `Hi ${person}, `)} external onClick={() => x.track("about-owner")}><Icon name="whatsapp" /> {x.ui("Say hello", "नमस्ते कहें")}</Btn></div>}
            </div>
          </div>
        </Sec>
      )}
      {has("process") && slot("process", i++)}
      {photos.length >= 3 && (
        <Sec k="strip" tone={i++ % 2 ? "alt" : "paper"} wide label={x.ui("In pictures", "तस्वीरों में")}>
          <div className="ab-strip-head">
            <Head eyebrow={x.ui("In pictures", "तस्वीरों में")} title={x.ui("A look at our work", "हमारा काम, एक झलक में")} />
            {gallery && <Btn kind="link" href={gallery.href} onClick={() => x.goto?.(gallery.slug)}>{x.ui("See all photos", "सभी फ़ोटो देखें")} <Icon name="arrow-right" /></Btn>}
          </div>
          <ul className="ab-strip">
            {photos.map((g, k) => (
              <li key={g.url}><button type="button" onClick={() => x.zoom(photos.map((q) => q.url), k, g.label)} aria-label={g.label || `${x.ui("Photo", "फ़ोटो")} ${k + 1}`}><Photo src={g.url} sizes="(min-width:900px) 18vw, 45vw" /></button></li>
            ))}
          </ul>
        </Sec>
      )}
      {has("proof") && slot("proof", i++)}
      {has("cta") && slot("cta", i++)}
    </>
  );
}

/* ================= gallery ================= */

type Shot = { url: string; label: string; album: string };
export function shotsOf(blocks: CardBlock[]): Shot[] {
  const seen = new Set<string>();
  const gblocks = blocks.filter((b) => b.kind === "gallery");
  const out: Shot[] = [];
  for (const b of blocks) {
    if (b.kind === "gallery") for (const im of b.images) if (im.url && !seen.has(im.url)) { seen.add(im.url); out.push({ url: im.url, label: (im.label ?? "").trim(), album: (im.group ?? "").trim() || (gblocks.length > 1 ? b.title.trim() : "") }); }
    if (b.kind === "image" || b.kind === "carousel") for (const im of b.images) if (im.url && !seen.has(im.url)) { seen.add(im.url); out.push({ url: im.url, label: (im.caption ?? "").trim(), album: "" }); }
  }
  return out;
}

export function GalleryPage({ c, spec, x, chrome, slot, has, entry }: Props & { entry: AdvPageEntry }) {
  const shots = useMemo(() => shotsOf(visibleBlocks({ c, spec, x, chrome, slot, has })), [c, spec, x, chrome, slot, has]);
  const albums = useMemo(() => { const m = new Map<string, number>(); for (const s of shots) if (s.album) m.set(s.album, (m.get(s.album) ?? 0) + 1); return [...m.entries()]; }, [shots]);
  const [pick, setPick] = useState("");
  const list = pick ? shots.filter((s) => s.album === pick) : shots;
  const v = spec.sections.gallery ?? "mosaic";
  const mode = v === "filmstrip" ? "columns" : v === "lightbox-grid" || v === "album-tabs" ? "grid" : "mosaic";
  let i = 1;
  return (
    <>
      <Masthead x={x} chrome={chrome} name={c.name} kicker={x.t(c.trade)} title={x.t(entry.label)} image={(shots.length > 1 ? shots[shots.length - 1] : shots[0])?.url}
        lede={x.hi ? `${shots.length} फ़ोटो` : `${shots.length} photographs`} trail={[{ label: x.t(entry.label) }]} />
      <section className="gl" aria-label={x.t(entry.label)}>
        <div className="adv-wrap adv-wide">
          {albums.length >= 2 && (
            <div className="cg-chips gl-albums" role="group" aria-label={x.ui("Albums", "एल्बम")}>
              <button type="button" aria-pressed={!pick} onClick={() => setPick("")}>{x.ui("All", "सभी")} <small>{shots.length}</small></button>
              {albums.map(([k, n]) => <button key={k} type="button" aria-pressed={pick === k} onClick={() => setPick(pick === k ? "" : k)}>{x.t(k)} <small>{n}</small></button>)}
            </div>
          )}
          <ul className="gl-grid" data-mode={mode} data-n={list.length <= 6 || list.length % 4 !== 0 && list.length % 3 === 0 ? "3" : "4"} key={pick}>
            {list.map((s, k) => (
              <li key={s.url} style={{ ["--d" as string]: `${Math.min(k, 10) * 40}ms` }}>
                <button type="button" onClick={() => x.zoom(list.map((q) => q.url), k, s.label)} aria-label={s.label || `${x.ui("Photo", "फ़ोटो")} ${k + 1}`}>
                  <Pic src={s.url} alt={s.label} className="adv-photo" sizes="(min-width:900px) 25vw, 50vw" />
                  {s.label && <span className="gl-cap">{x.t(s.label)}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>
      {has("proof") && slot("proof", i++)}
      {has("cta") && slot("cta", i++)}
    </>
  );
}

/* ================= contact ================= */

export function ContactPage({ c, x, chrome, slot, has, entry, page }: Props & { entry: AdvPageEntry; page?: CardPage }) {
  const blocks = page?.blocks ?? [];
  const formBlock = blocks.find((b): b is Extract<CardBlock, { kind: "form" }> => b.kind === "form" && b.fields.some((f) => f.label));
  const note = blocks.find((b): b is Extract<CardBlock, { kind: "contact" }> => b.kind === "contact")?.note ?? "";
  const appt = blocks.find((b): b is Extract<CardBlock, { kind: "appointment" }> => b.kind === "appointment");
  const v = c.visit;
  const links = x.card.links.filter((l) => l.value.trim());
  const digits = (s: string) => (s ?? "").replace(/\D/g, "").slice(-10);
  const same = !!x.wa && !!x.phone && digits(x.wa.value) === digits(x.phone.value);
  const reach = links.filter((l) => !(l.type === "phone" && same) && l.type !== "location" && l.type !== "upi" && l.type !== "website");
  const web = links.find((l) => l.type === "website");
  const dir = v ? v.mapUrl || (v.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.address)}` : "") : "";
  const interest = c.offerings?.items.map((o) => o.name).slice(0, 14) ?? [];
  const todayAt = useTodayRow(v?.hours ?? []);
  const open = c.hm.trust.open;
  let i = 1;
  return (
    <>
      <Masthead x={x} chrome={chrome} name={c.name} kicker={x.t(c.trade)} title={x.t(entry.label)} image={c.hm.photo?.src ?? c.photos[0]}
        lede={x.t(note || (c.city ? x.ui(`Come and see us in ${c.city}, or write to us here.`, `${c.city} में आइए, या यहीं लिखिए।`) : x.ui("Come and see us, or write to us here.", "आइए, या यहीं लिखिए।")))}
        aside={open ? <span className="ct-open" data-state={open.state}><i className="open-dot" aria-hidden="true" />{open.state === "open" ? x.ui("Open now", "अभी खुला है") : x.ui("Closed right now", "अभी बंद है")}</span> : undefined}
        trail={[{ label: x.t(entry.label) }]} />
      <section className="ct" aria-label={x.t(entry.label)}>
        <div className="adv-wrap adv-wide ct-grid">
          <div className="ct-left">
            {reach.length > 0 && (
              <ul className="ct-reach">
                {reach.map((l) => {
                  const href = l.type === "whatsapp" ? x.waHref() : linkHref(l.type, l.value);
                  return (
                    <li key={l.id}>
                      <a href={href} target={l.type === "phone" || l.type === "email" ? undefined : "_blank"} rel="noreferrer" data-wa={l.type === "whatsapp" ? "" : undefined} onClick={() => x.track(`contact-${l.type}`)}>
                        <span className="ct-ic"><LinkIcon type={l.type} className="h-5 w-5" /></span>
                        <span className="ct-tx"><small>{l.type === "whatsapp" ? x.ui("Fastest reply", "सबसे तेज़ जवाब") : l.type === "phone" ? x.ui("Call us", "कॉल करें") : l.type === "email" ? x.ui("Email", "ईमेल") : x.t(l.label)}</small><b>{l.type === "whatsapp" ? `WhatsApp · ${shownValue(l)}` : shownValue(l)}</b></span>
                        <Icon name="arrow-up-right" />
                      </a>
                    </li>
                  );
                })}
                {web && <li><a href={web.value.startsWith("http") ? web.value : `https://${web.value}`} target="_blank" rel="noreferrer"><span className="ct-ic"><Mail size={20} /></span><span className="ct-tx"><small>{x.ui("Website", "वेबसाइट")}</small><b>{web.value.replace(/^https?:\/\//, "")}</b></span><Icon name="arrow-up-right" /></a></li>}
              </ul>
            )}
            {v && (v.address || dir) && (
              <div className="ct-card">
                <p className="kicker">{x.ui("Visit us", "हमसे मिलें")}</p>
                {v.address && <address>{x.t(v.address)}</address>}
                {dir && <Btn kind="ghost" href={dir} external onClick={() => x.track("contact-directions")}><Icon name="directions" /> {x.ui("Get directions", "रास्ता देखें")}</Btn>}
              </div>
            )}
            {v && v.hours.length > 0 && (
              <div className="ct-card">
                <p className="kicker">{x.ui("Opening hours", "खुलने का समय")}</p>
                <table className="ct-hours"><tbody>
                  {v.hours.map((r, k) => (
                    <tr key={k} data-today={k === todayAt ? "" : undefined}>
                      <th scope="row">{x.t(r.day)}{k === todayAt && <em>{x.ui("Today", "आज")}</em>}</th>
                      <td>{x.t(r.time)}</td>
                    </tr>
                  ))}
                </tbody></table>
              </div>
            )}
            {appt && (appt.note || appt.url) && (
              <div className="ct-card"><p className="kicker">{x.t(appt.title)}</p>{appt.url ? <AppointmentBlock block={appt} username={x.card.username} theme="var(--accent)" /> : <p className="ct-note">{x.t(appt.note)}</p>}</div>
            )}
          </div>
          <div className="ct-form">
            <div className="ct-formcard">
              <h2>{formBlock ? x.t(formBlock.title) : x.ui("Write to us", "हमें लिखिए")}</h2>
              <p>{x.ui("We reply on WhatsApp or phone, whichever you leave.", "हम WhatsApp या फ़ोन पर जवाब देंगे।")}</p>
              <AdvForm x={x} title={formBlock?.title || ""} fields={formBlock?.fields} button={formBlock?.button} note={formBlock?.note} interest={interest} />
            </div>
          </div>
        </div>
      </section>
      {v?.address && (
        <section className="ct-map" aria-label={x.ui("Map", "नक्शा")}>
          <div className="adv-wrap adv-wide">
            <div className="ct-mapbox">
              <iframe title={x.ui(`Map to ${c.name}`, `${c.name} का नक्शा`)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://www.google.com/maps?q=${encodeURIComponent(v.address)}&output=embed`} />
              <a className="ct-pin" href={dir} target="_blank" rel="noreferrer" onClick={() => x.track("contact-map")}><Icon name="pin" /><span>{x.t(v.address)}</span><Icon name="arrow-up-right" /></a>
            </div>
          </div>
        </section>
      )}
      {has("faq") && slot("faq", i++)}
      {has("cta") && slot("cta", i++)}
    </>
  );
}

/* ================= updates ================= */

const dateOf = (iso: string, hi: boolean) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(hi ? "hi-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric" }); };

export function UpdatesPage({ c, x, chrome, entry, updates }: Pick<Props, "c" | "x" | "chrome"> & { entry: AdvPageEntry; updates: SiteUpdate[] }) {
  return (
    <>
      <Masthead x={x} chrome={chrome} name={c.name} kicker={x.t(c.trade)} title={entry.label} image={updates[0]?.url}
        lede={x.ui("What is new with us, as we post it.", "हमारे यहाँ क्या नया है।")} trail={[{ label: entry.label }]} />
      <section className="up" aria-label={entry.label}>
        <div className="adv-wrap adv-wide">
          <ul className="up-grid">
            {updates.map((u, k) => (
              <li key={`${k}-${u.url}`} style={{ ["--d" as string]: `${Math.min(k, 8) * 50}ms` }}>
                <button type="button" className="up-pic" onClick={() => x.zoom(updates.map((q) => q.url), k, u.title)} aria-label={u.title}><Pic src={u.url} alt={u.title} className="adv-photo" sizes="(min-width:900px) 25vw, 50vw" /></button>
                <p className="kicker">{dateOf(u.date, x.hi)}</p>
                <h3>{x.t(u.title)}</h3>
                {u.caption && <p className="up-cap">{x.t(u.caption)}</p>}
                {x.wa && <a className="btn-link" href={x.waHref(x.hi ? `नमस्ते ${c.name}, इस अपडेट के बारे में: "${u.title}" ` : `Hi ${c.name}, about your update "${u.title}" `)} target="_blank" rel="noreferrer" onClick={() => x.track("update-ask")}><Icon name="whatsapp" /> {x.ui("Ask about this", "इसके बारे में पूछें")}</a>}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

/* ================= any other page of the card, block by block ================= */

function Block({ b, x, c, i }: { b: CardBlock; x: AdvCtxPlus; c: SiteContent; i: number }): ReactNode {
  const tone = i % 2 ? "alt" : "paper";
  const title = (s?: string) => (s ?? "").trim() ? x.t(s!.trim()) : "";
  switch (b.kind) {
    case "about": return <Sec k={`b${i}`} tone={tone} label={title(b.title)}><Head title={title(b.title)} /><div className="adv-body gb-prose">{(b.body ?? "").split(/\n+/).filter(Boolean).map((p, k) => <p key={k}>{x.t(p)}</p>)}</div></Sec>;
    case "highlights": return <Sec k={`b${i}`} tone={tone} label={title(b.title)}><Head title={title(b.title)} /><ul className="gb-ticks">{b.items.filter(Boolean).map((t, k) => <li key={k}><span aria-hidden="true"><Icon name="check" size={15} strokeWidth={2} /></span>{x.t(t.replace(/^[^\p{L}\p{N}]+/u, ""))}</li>)}</ul></Sec>;
    case "services": {
      const steps = /^\s*1[.)]\s/.test(b.items[0]?.name ?? "");
      return (
        <Sec k={`b${i}`} tone={tone} label={title(b.title)}>
          <Head title={title(b.title)} />
          <ol className={steps ? "gb-steps" : "gb-cards"}>
            {b.items.filter((s) => s.name?.trim()).map((s, k) => <li key={k}><b>{x.t(s.name.replace(/^\s*\d+[.)]\s*/, ""))}</b>{s.desc && <p>{x.t(s.desc)}</p>}</li>)}
          </ol>
        </Sec>
      );
    }
    case "gallery": case "image": case "carousel": {
      const imgs = b.kind === "gallery" ? b.images.filter((q) => q.url).map((q) => ({ url: q.url!, label: q.label })) : b.images.filter((q) => q.url).map((q) => ({ url: q.url, label: q.caption ?? "" }));
      if (!imgs.length) return null;
      return <Sec k={`b${i}`} tone={tone} wide label={title(b.title)}><Head title={title(b.title)} /><ul className="gl-grid" data-mode="grid">{imgs.map((g, k) => <li key={g.url}><button type="button" onClick={() => x.zoom(imgs.map((q) => q.url), k, g.label)} aria-label={g.label || `${x.ui("Photo", "फ़ोटो")} ${k + 1}`}><Pic src={g.url} alt={g.label ?? ""} className="adv-photo" sizes="(min-width:900px) 25vw, 50vw" /></button></li>)}</ul></Sec>;
    }
    case "testimonials": return <Sec k={`b${i}`} tone={tone} label={title(b.title)}><Head title={title(b.title)} /><ul className="gb-quotes">{b.items.filter((q) => q.text?.trim()).map((q, k) => <li key={k}><Stars n={q.rating} /><blockquote>{x.t(q.text)}</blockquote><cite>{q.name}</cite></li>)}</ul></Sec>;
    case "faq": return <Sec k={`b${i}`} tone={tone} label={title(b.title)}><Head title={title(b.title)} /><div className="gb-faq">{b.items.filter((q) => q.q?.trim() && q.a?.trim()).map((q, k) => <details key={k}><summary>{x.t(q.q)}</summary><p>{x.t(q.a)}</p></details>)}</div></Sec>;
    case "offer": return <Sec k={`b${i}`} tone="ink" label={title(b.title)}><Head title={title(b.title) || x.ui("Offer", "ऑफ़र")} lede={x.t(b.text)} />{b.code && <p className="gb-code">{x.ui("Use code", "कोड")} <b>{b.code}</b></p>}{x.wa && <Btn href={x.waHref(b.title || b.text)} external><Icon name="whatsapp" /> {x.ui("Get this offer", "यह ऑफ़र पाएँ")}</Btn>}</Sec>;
    case "table": return <Sec k={`b${i}`} tone={tone} label={title(b.title)}><Head title={title(b.title)} /><div className="gb-table"><table><thead><tr>{b.columns.map((col, k) => <th key={k} scope="col">{x.t(col)}</th>)}</tr></thead><tbody>{b.rows.map((r, k) => <tr key={k}>{r.map((cell, j) => <td key={j} data-hl={b.highlight === j ? "" : undefined}>{x.t(cell)}</td>)}</tr>)}</tbody></table></div>{b.note && <p className="adv-lede">{x.t(b.note)}</p>}</Sec>;
    case "form": return <Sec k={`b${i}`} tone={tone} label={title(b.title)}><div className="gb-form"><Head title={title(b.title)} /><AdvForm x={x} title={b.title} fields={b.fields} button={b.button} note={b.note} /></div></Sec>;
    case "appointment": return <Sec k={`b${i}`} tone={tone} label={title(b.title)}><Head title={title(b.title)} lede={x.t(b.note)} />{x.wa && <Btn href={x.waHref(x.hi ? `नमस्ते ${c.name}, मैं अपॉइंटमेंट लेना चाहता/चाहती हूँ। ` : `Hi ${c.name}, I'd like to book an appointment. `)} external><Icon name="calendar" /> {x.ui("Book on WhatsApp", "WhatsApp पर बुक करें")}</Btn>}</Sec>;
    case "hours": return <Sec k={`b${i}`} tone={tone} label={title(b.title)}><Head title={title(b.title)} /><table className="ct-hours gb-hours"><tbody>{b.rows.filter((r) => r.day && r.time).map((r, k) => <tr key={k}><th scope="row">{x.t(r.day)}</th><td>{x.t(r.time)}</td></tr>)}</tbody></table></Sec>;
    case "location": return <Sec k={`b${i}`} tone={tone} label={title(b.title)}><Head title={title(b.title)} />{b.address && <address className="gb-addr">{x.t(b.address)}</address>}{(b.mapUrl || b.address) && <Btn kind="ghost" href={b.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address)}`} external><Icon name="directions" /> {x.ui("Get directions", "रास्ता देखें")}</Btn>}</Sec>;
    case "compare": return <Sec k={`b${i}`} tone={tone} label={title(b.title)}><Head title={title(b.title)} /><div className="gb-table"><table><thead><tr><th scope="col" /><th scope="col">{x.t(b.leftLabel)}</th><th scope="col">{x.t(b.rightLabel)}</th></tr></thead><tbody>{b.rows.map((r, k) => <tr key={k}><th scope="row">{x.t(r.feature)}</th><td>{x.t(r.left)}</td><td>{x.t(r.right)}</td></tr>)}</tbody></table></div></Sec>;
    case "showcase": return <Sec k={`b${i}`} tone={tone} wide label={title(b.title)}><Head title={title(b.title)} /><ul className="gb-show">{b.items.filter((s) => s.imageUrl).map((s, k) => <li key={k}><div><Photo src={s.imageUrl} alt={s.label} sizes="(min-width:900px) 30vw, 90vw" /></div><b>{x.t(s.label)}</b>{s.sub && <span>{x.t(s.sub)}</span>}</li>)}</ul></Sec>;
    case "contact": return null;
    default: return null;
  }
}

export function GenericPage({ c, x, chrome, slot, has, entry, page }: Props & { entry: AdvPageEntry; page?: CardPage }) {
  const blocks = (page?.blocks ?? []).filter((b) => b.kind !== "contact");
  const lede = blocks.find((b) => b.kind === "about");
  let i = 0;
  return (
    <>
      <Masthead x={x} chrome={chrome} name={c.name} kicker={x.t(c.trade)} title={x.t(entry.label)} image={c.hm.photo?.src ?? c.photos[0]}
        lede={lede && lede.kind === "about" ? x.t(firstSentence(lede.body)) : undefined} trail={[{ label: x.t(entry.label) }]} />
      {blocks.map((b) => <Block key={b.id} b={b} x={x} c={c} i={i++} />)}
      <div className="gb-share adv-wrap adv-wide"><ShareBtn x={x} title={`${x.t(entry.label)} — ${c.name}`} /></div>
      {has("cta") && slot("cta", i++)}
    </>
  );
}

export const MORE_CSS = `
/* ---- about ---- */
.ab-why{display:grid;gap:0;margin:0;padding:0;list-style:none;border-top:1px solid var(--line)}
@media (min-width:760px){.ab-why{grid-template-columns:repeat(2,1fr);column-gap:clamp(2rem,6vw,6rem)}}
.ab-why li{display:grid;grid-template-columns:auto 1fr;gap:var(--s5);align-items:baseline;padding:clamp(1.1rem,2.4vw,1.75rem) 0;border-bottom:1px solid var(--line)}
.ab-n{font-family:var(--font-display);font-size:clamp(1.8rem,3.4vw,2.6rem);line-height:1;color:var(--accent)}
.ab-why p{margin:0;font-family:var(--font-display);font-size:clamp(1.15rem,2vw,1.55rem);line-height:1.25;font-weight:var(--display-w);text-wrap:balance}
.site:lang(hi) .ab-why p{line-height:1.45;font-weight:var(--display-w-hi)}
.ab-owner{display:grid;gap:clamp(1.5rem,4vw,4rem);align-items:center}
@media (min-width:800px){.ab-owner{grid-template-columns:minmax(0,.7fr) minmax(0,1fr)}}
.ab-owner-pic{position:relative;aspect-ratio:4/5;max-width:420px;border-radius:var(--r-tile);overflow:hidden;background:var(--accent-soft)}
.ab-strip-head{display:flex;flex-wrap:wrap;align-items:end;justify-content:space-between;gap:var(--s4)}
.ab-strip{display:flex;gap:var(--s3);margin:0;padding:0;list-style:none;overflow-x:auto;scroll-snap-type:x proximity;scrollbar-width:none}
.ab-strip::-webkit-scrollbar{display:none}
.ab-strip li{flex:none;width:clamp(180px,22vw,300px);scroll-snap-align:start}
.ab-strip button{display:block;position:relative;width:100%;aspect-ratio:3/4;padding:0;border:0;border-radius:var(--r-card);overflow:hidden;cursor:zoom-in;background:var(--accent-soft)}
.ab-strip .adv-photo{transition:transform .9s cubic-bezier(.2,.7,.2,1)}.ab-strip button:hover .adv-photo{transform:scale(1.05)}
/* ---- gallery ---- */
.gl{padding-block:clamp(1.5rem,4vw,3rem) var(--section-pad);background:var(--paper)}
.gl-albums{margin-bottom:var(--s6)}
.gl-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--s3);margin:0;padding:0;list-style:none}
.gl-grid li{position:relative;min-width:0;animation:cg-in .7s cubic-bezier(.2,.7,.2,1) both;animation-delay:var(--d,0ms)}
.gl-grid button{position:relative;display:block;width:100%;height:100%;padding:0;border:0;overflow:hidden;cursor:zoom-in;border-radius:var(--r-card);background:var(--accent-soft)}
.gl-grid .adv-photo{transition:transform 1s cubic-bezier(.2,.7,.2,1)}.gl-grid button:hover .adv-photo{transform:scale(1.06)}
.gl-cap{position:absolute;left:0;right:0;bottom:0;padding:2.2em 1em .9em;background:linear-gradient(transparent,rgba(0,0,0,.62));color:#fff;font-size:13.5px;font-weight:500;text-align:left;transform:translateY(100%);transition:transform .4s cubic-bezier(.2,.7,.2,1)}
.gl-grid button:hover .gl-cap,.gl-grid button:focus-visible .gl-cap{transform:none}
@media (hover:none){.gl-cap{display:none}}
.gl-grid[data-mode=grid] li{aspect-ratio:4/5}
.gl-grid[data-mode=mosaic]{grid-auto-rows:clamp(130px,34vw,200px);grid-auto-flow:dense}
.gl-grid[data-mode=mosaic] li:nth-child(6n+1){grid-column:span 2;grid-row:span 2}
.gl-grid[data-mode=mosaic] li:nth-child(6n+4){grid-row:span 2}
.gl-grid[data-mode=mosaic] li:nth-child(6n+5){grid-column:span 2}
.gl-grid[data-mode=columns]{display:block;columns:2;column-gap:var(--s3)}
.gl-grid[data-mode=columns] li{break-inside:avoid;margin-bottom:var(--s3)}
.gl-grid[data-mode=columns] li:nth-child(4n+1){aspect-ratio:3/4}.gl-grid[data-mode=columns] li:nth-child(4n+2){aspect-ratio:1/1}.gl-grid[data-mode=columns] li:nth-child(4n+3){aspect-ratio:4/5}.gl-grid[data-mode=columns] li:nth-child(4n){aspect-ratio:5/4}
@media (min-width:760px){.gl-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--s4)}.gl-grid[data-mode=mosaic]{grid-auto-rows:clamp(170px,19vw,280px)}.gl-grid[data-mode=columns]{columns:3;column-gap:var(--s4)}.gl-grid[data-mode=columns] li{margin-bottom:var(--s4)}}
/* Two columns: the tall tile and the two-wide one cannot share a row, which left a hole beside the tall tile on every page of 6 or more
   photos; here every tile is one cell after the big first one and a lone last tile takes the row (16 Oct 2026 QA). */
@media (max-width:759px){.gl-grid[data-mode=mosaic] li:nth-child(6n+4){grid-row:auto}.gl-grid[data-mode=mosaic] li:nth-child(6n+5){grid-column:auto}.gl-grid[data-mode=mosaic] li:last-child:nth-child(even){grid-column:span 2}}
@media (min-width:1100px){.gl-grid[data-n="4"][data-mode=grid],.gl-grid[data-n="4"][data-mode=mosaic]{grid-template-columns:repeat(4,minmax(0,1fr))}.gl-grid[data-n="4"][data-mode=columns]{columns:4}}
/* ---- contact ---- */
.ct{padding-block:clamp(1.5rem,4vw,3rem) var(--section-pad);background:var(--paper)}
.ct-grid{display:grid;gap:clamp(1.5rem,4vw,4rem);align-items:start}
@media (min-width:960px){.ct-grid{grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr)}.ct-form{position:sticky;top:84px}}
.ct-left{display:grid;gap:var(--s4)}
.ct-open .open-dot{flex:none;width:8px;height:8px;border-radius:50%;background:#1f9d57}
.ct-open[data-state=closed] .open-dot{background:var(--muted)}
.ct-open{display:inline-flex;align-items:center;gap:.6em;padding:.55em 1em;border:1px solid var(--line);border-radius:var(--r-pill);font-size:var(--t-meta);font-weight:600}
.ct-reach{display:grid;gap:var(--s3);margin:0;padding:0;list-style:none}
.ct-reach a{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:var(--s4);padding:var(--s4) var(--s5);border:1px solid var(--line);border-radius:var(--r-card);color:var(--ink);text-decoration:none;background:var(--paper);transition:border-color .25s,transform .35s cubic-bezier(.2,.7,.2,1),background .25s}
.ct-reach a:hover{border-color:var(--ink);transform:translateY(-2px)}
.ct-reach a[data-wa]{background:color-mix(in srgb,var(--wa) 68%,#000);border-color:transparent;color:#fff}
.ct-ic{display:grid;place-items:center;width:46px;height:46px;border-radius:50%;background:var(--accent-soft);color:var(--accent)}
.ct-reach a[data-wa] .ct-ic{background:rgba(255,255,255,.2);color:#fff}
.ct-tx{display:grid;gap:2px;min-width:0}.ct-tx small{font-size:12px;letter-spacing:.06em;text-transform:uppercase;opacity:.7}.ct-tx b{font-weight:600;font-size:1.05rem;overflow:hidden;text-overflow:ellipsis}
.ct-card{display:grid;gap:var(--s3);justify-items:start;padding:var(--s5) var(--s6);border-radius:var(--r-card);background:var(--paper-2)}
.ct-card .kicker{margin:0}.ct-card address{font-style:normal;font-family:var(--font-display);font-size:clamp(1.3rem,2.4vw,1.8rem);line-height:1.25}
.ct-note{margin:0;color:var(--muted)}
.ct-hours{width:100%;border-collapse:collapse;font-size:var(--t-body);font-variant-numeric:tabular-nums}
.ct-hours th,.ct-hours td{padding:.7em 0;border-bottom:1px solid var(--line);text-align:left;font-weight:500}
.ct-hours td{text-align:right;color:var(--muted)}
.ct-hours tr:last-child th,.ct-hours tr:last-child td{border-bottom:0}
.ct-hours tr[data-today] th,.ct-hours tr[data-today] td{color:var(--ink);font-weight:700}
.ct-hours em{margin-left:.7em;padding:.2em .6em;border-radius:var(--r-pill);background:var(--accent);color:var(--on-accent);font-style:normal;font-size:11px;letter-spacing:.06em;text-transform:uppercase}
.ct-formcard{padding:clamp(1.5rem,3vw,2.5rem);border-radius:var(--r-tile);background:var(--paper-2);border:1px solid var(--line)}
.ct-formcard h2{font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.8rem,3.4vw,2.6rem);line-height:1.05;letter-spacing:var(--display-tr);margin:0 0 var(--s2)}
.ct-formcard>p{margin:0 0 var(--s5);color:var(--muted)}
.ct-map{padding-bottom:var(--section-pad);background:var(--paper)}
/* width:100% is what stops aspect-ratio + min-height from deriving a 600px width: the map was wider than a phone and its address pill ran off the edge (16 Oct 2026 QA). */
.ct-mapbox{position:relative;width:100%;aspect-ratio:16/8;min-height:300px;border-radius:var(--r-tile);overflow:hidden;background:var(--accent-soft);border:1px solid var(--line)}
/* fit-content capped to the frame: max-content let a long address run past the phone's right edge (16 Oct 2026 QA). */
.ct-pin{position:absolute;left:16px;bottom:16px;width:fit-content;max-width:calc(100% - 32px);display:flex;align-items:center;gap:.7em;padding:.8em 1.1em;border-radius:var(--r-card);background:var(--paper);color:var(--ink);font-size:14px;font-weight:600;text-decoration:none;box-shadow:var(--e-1)}
.ct-pin svg{flex:none;color:var(--accent)}.ct-pin span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ct-mapbox iframe{position:absolute;inset:0;width:100%;height:100%;border:0;filter:saturate(.85) contrast(1.02)}
/* ---- updates ---- */
.up{padding-block:clamp(1.5rem,4vw,3rem) var(--section-pad);background:var(--paper)}
.up-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(1.5rem,3vw,2.5rem) var(--gap);margin:0;padding:0;list-style:none}
@media (min-width:900px){.up-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
.up-grid li{display:grid;gap:var(--s2);align-content:start;animation:cg-in .7s cubic-bezier(.2,.7,.2,1) both;animation-delay:var(--d,0ms)}
.up-pic{position:relative;display:block;aspect-ratio:4/5;padding:0;border:0;border-radius:var(--r-card);overflow:hidden;cursor:zoom-in;background:var(--accent-soft)}
.up-grid .kicker{margin:var(--s3) 0 0}
.up-grid h3{font-family:var(--font-display);font-weight:var(--display-w);font-size:1.25rem;line-height:1.15;margin:0}
.up-cap{margin:0;font-size:var(--t-meta);color:var(--muted);line-height:1.5}
/* ---- other pages, block by block ---- */
.gb-prose{max-width:62ch;font-size:var(--t-sub)}
.gb-ticks{display:grid;gap:var(--s3);margin:0;padding:0;list-style:none;max-width:56rem}
@media (min-width:760px){.gb-ticks{grid-template-columns:1fr 1fr;column-gap:var(--s7)}}
.gb-ticks li{display:grid;grid-template-columns:auto 1fr;gap:var(--s3);font-size:var(--t-body);line-height:1.5}
.gb-ticks li span{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:var(--accent-soft);color:var(--accent)}
.gb-steps,.gb-cards{display:grid;gap:var(--s4);margin:0;padding:0;list-style:none;counter-reset:g}
@media (min-width:760px){.gb-steps,.gb-cards{grid-template-columns:repeat(3,1fr);gap:var(--s5)}}
.gb-steps li,.gb-cards li{position:relative;padding:var(--s5);border:1px solid var(--line);border-radius:var(--r-card);background:var(--paper);counter-increment:g}
.gb-steps li::before{content:counter(g,decimal-leading-zero);display:block;margin-bottom:var(--s3);font-family:var(--font-display);font-size:2rem;color:var(--accent)}
.gb-steps li b,.gb-cards li b{font-family:var(--font-display);font-weight:var(--display-w);font-size:1.25rem;line-height:1.2}
.gb-steps li p,.gb-cards li p{margin:var(--s2) 0 0;color:var(--muted);font-size:var(--t-meta);line-height:1.55}
.gb-quotes{display:grid;gap:var(--s5);margin:0;padding:0;list-style:none}
@media (min-width:760px){.gb-quotes{grid-template-columns:repeat(3,1fr)}}
.gb-quotes li{padding:var(--s6);border:1px solid var(--line);border-radius:var(--r-card);background:var(--paper)}
.gb-quotes blockquote{margin:var(--s4) 0;font-family:var(--font-display);font-size:1.2rem;line-height:1.35}
.gb-quotes cite{font-style:normal;font-size:var(--t-meta);color:var(--muted)}
.gb-faq{max-width:52rem;border-top:1px solid var(--line)}
.gb-faq details{border-bottom:1px solid var(--line);padding:var(--s4) 0}
.gb-faq summary{cursor:pointer;font-family:var(--font-display);font-size:clamp(1.15rem,2vw,1.5rem);line-height:1.25;list-style:none;display:flex;justify-content:space-between;gap:var(--s4)}
.gb-faq summary::-webkit-details-marker{display:none}
.gb-faq summary::after{content:"+";font-family:var(--font-text);font-size:1.5rem;color:var(--accent);transition:transform .3s}
.gb-faq details[open] summary::after{transform:rotate(45deg)}
.gb-faq p{margin:var(--s3) 0 0;color:var(--muted);max-width:62ch;line-height:1.6}
.gb-code{margin:var(--s4) 0;font-size:var(--t-sub)}.gb-code b{padding:.2em .7em;border:1px dashed currentColor;border-radius:var(--r-ctl);letter-spacing:.08em}
.gb-table{overflow-x:auto;border:1px solid var(--line);border-radius:var(--r-card)}
.gb-table table{width:100%;border-collapse:collapse;font-size:var(--t-body);min-width:480px}
.gb-table th,.gb-table td{padding:.9em 1.1em;text-align:left;border-bottom:1px solid var(--line)}
.gb-table thead th{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);background:var(--paper-2)}
.gb-table td[data-hl]{font-weight:700;color:var(--accent)}.gb-table tr:last-child td,.gb-table tr:last-child th{border-bottom:0}
.gb-form{max-width:36rem}
.gb-hours{max-width:34rem}.gb-addr{font-style:normal;margin-bottom:var(--s4);font-size:var(--t-sub)}
.gb-show{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--s5);margin:0;padding:0;list-style:none}
@media (min-width:900px){.gb-show{grid-template-columns:repeat(3,1fr)}}
.gb-show li div{position:relative;aspect-ratio:4/3;border-radius:var(--r-card);overflow:hidden;margin-bottom:var(--s3);background:var(--accent-soft)}
.gb-show b{display:block;font-family:var(--font-display);font-weight:var(--display-w);font-size:1.2rem}.gb-show span{color:var(--muted);font-size:var(--t-meta)}
.gb-share{padding-bottom:var(--s7)}
`;
