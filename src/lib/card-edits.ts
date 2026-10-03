// "Baat karke badlo" (owner's call, 3 Oct 2026): the owner says what to change in plain words — "fees wala
// section hata do", "about me CBSE likho", "reviews ko upar le jao" — the AI turns it into a few small,
// checkable operations, and this module applies them to the card in code. The AI never writes the card itself:
// it only picks from the operations below, each one validated against the real card before it runs, so a
// wrong guess changes nothing and the owner sees exactly what will change before it goes live.
//
// Isomorphic: no 'use client', no 'server-only'.
import type { Card, CardBlock, CardPage, SiteStyle } from "@/lib/types";
import { cleanStyle } from "@/lib/site-style";

export type EditOp =
  | { op: "remove_block"; id: string }
  | { op: "move_block"; id: string; before: string | null }      // before: a block id on the same page, or null = last
  | { op: "set_title"; id: string; value: string }
  | { op: "set_text"; id: string; value: string }               // about body / offer text / contact note / cta body
  | { op: "set_item"; id: string; index: number; name?: string; desc?: string; price?: string }
  | { op: "remove_item"; id: string; index: number }
  | { op: "add_item"; id: string; name: string; desc?: string; price?: string }
  | { op: "set_hero"; headline?: string; sub?: string; ctaLabel?: string }
  | { op: "set_identity"; tagline?: string; about?: string; company?: string; jobTitle?: string }
  | { op: "set_style"; palette?: string; font?: string; hero?: string; radius?: string }
  | { op: "hide_page"; slug: string }
  | { op: "show_page"; slug: string }
  | { op: "rename_page"; slug: string; label: string };

const S = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

/** The card as a short outline the AI can point at: every page, every block with its id, kind, title and a
 *  glimpse of what is in it. Hidden pages (the Shubhora page) are left out — they are not the owner's to edit here. */
export function cardOutline(card: Card): string {
  const lines: string[] = [];
  lines.push(`company: ${card.company} | name: ${card.name} | jobTitle: ${card.jobTitle} | tagline: ${card.tagline}`);
  lines.push(`about: ${(card.about ?? "").slice(0, 160)}`);
  if (card.site?.hero) lines.push(`hero: headline="${card.site.hero.headline}" sub="${(card.site.hero.sub ?? "").slice(0, 120)}" cta="${card.site.hero.ctaLabel ?? ""}"`);
  if (card.site?.style) lines.push(`style: ${JSON.stringify(card.site.style)}`);
  const hidden = new Set(card.site?.hidden ?? []);
  for (const p of card.pages) {
    if (p.hidden) continue;
    lines.push(`PAGE "${p.label}" slug=${p.slug}${hidden.has(p.slug) ? " (hidden from the menu)" : ""}`);
    for (const b of p.blocks) {
      const glimpse =
        b.kind === "about" ? (b.body ?? "").slice(0, 100)
        : b.kind === "offer" ? b.text
        : b.kind === "contact" ? (b.note ?? "")
        : b.kind === "cta" ? `${b.joinLabel} → ${b.joinUrl}`
        : "items" in b && Array.isArray(b.items) ? b.items.slice(0, 8).map((it: unknown, i: number) => { const o = it as { name?: string; q?: string; price?: string }; return `[${i}] ${o.name ?? o.q ?? String(it)}${o.price ? ` (${o.price})` : ""}`; }).join("; ")
        : "images" in b ? `${b.images.length} images`
        : "";
      lines.push(`  block id=${b.id} kind=${b.kind} title="${"title" in b ? b.title : ""}" :: ${glimpse.slice(0, 220)}`);
    }
  }
  return lines.join("\n");
}

/** The ops exactly as the AI may send them: unknown shapes dropped, strings capped. */
export function cleanOps(raw: unknown): EditOp[] {
  if (!Array.isArray(raw)) return [];
  const out: EditOp[] = [];
  for (const x of raw.slice(0, 12)) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const id = S(o.id, 40), slug = S(o.slug, 40);
    switch (o.op) {
      case "remove_block": if (id) out.push({ op: "remove_block", id }); break;
      case "move_block": if (id) out.push({ op: "move_block", id, before: o.before === null ? null : S(o.before, 40) || null }); break;
      case "set_title": if (id && S(o.value, 80)) out.push({ op: "set_title", id, value: S(o.value, 80) }); break;
      case "set_text": if (id && S(o.value, 1200)) out.push({ op: "set_text", id, value: S(o.value, 1200) }); break;
      case "set_item": if (id && Number.isInteger(o.index)) out.push({ op: "set_item", id, index: o.index as number, ...(S(o.name, 80) ? { name: S(o.name, 80) } : {}), ...(S(o.desc, 240) ? { desc: S(o.desc, 240) } : {}), ...(S(o.price, 30) ? { price: S(o.price, 30) } : {}) }); break;
      case "remove_item": if (id && Number.isInteger(o.index)) out.push({ op: "remove_item", id, index: o.index as number }); break;
      case "add_item": if (id && S(o.name, 80)) out.push({ op: "add_item", id, name: S(o.name, 80), ...(S(o.desc, 240) ? { desc: S(o.desc, 240) } : {}), ...(S(o.price, 30) ? { price: S(o.price, 30) } : {}) }); break;
      case "set_hero": out.push({ op: "set_hero", ...(S(o.headline, 80) ? { headline: S(o.headline, 80) } : {}), ...(S(o.sub, 200) ? { sub: S(o.sub, 200) } : {}), ...(S(o.ctaLabel, 40) ? { ctaLabel: S(o.ctaLabel, 40) } : {}) }); break;
      case "set_identity": out.push({ op: "set_identity", ...(S(o.tagline, 90) ? { tagline: S(o.tagline, 90) } : {}), ...(S(o.about, 1400) ? { about: S(o.about, 1400) } : {}), ...(S(o.company, 80) ? { company: S(o.company, 80) } : {}), ...(S(o.jobTitle, 60) ? { jobTitle: S(o.jobTitle, 60) } : {}) }); break;
      case "set_style": { const st = cleanStyle({ palette: o.palette, font: o.font, hero: o.hero, radius: o.radius }); if (st && Object.keys(st).length) out.push({ op: "set_style", ...st }); break; }
      case "hide_page": if (slug) out.push({ op: "hide_page", slug }); break;
      case "show_page": if (slug) out.push({ op: "show_page", slug }); break;
      case "rename_page": if (slug && S(o.label, 30)) out.push({ op: "rename_page", slug, label: S(o.label, 30) }); break;
    }
  }
  return out;
}

/** The ops applied, each checked against the card; `notes` say in plain words what changed (or was skipped). */
export function applyEdits(card: Card, ops: EditOp[], lang: "en" | "hi" | "hinglish" = "en"): { card: Card; notes: string[]; applied: number } {
  const hi = lang === "hi";
  const notes: string[] = [];
  let applied = 0;
  let out: Card = { ...card, pages: card.pages.map((p) => ({ ...p, blocks: [...p.blocks] })) };
  const findBlock = (id: string): { page: CardPage; i: number; block: CardBlock } | null => {
    for (const page of out.pages) { if (page.hidden) continue; const i = page.blocks.findIndex((b) => b.id === id); if (i >= 0) return { page, i, block: page.blocks[i] }; }
    return null;
  };
  const title = (b: CardBlock) => ("title" in b && b.title ? b.title : b.kind);
  const skip = (what: string) => notes.push(hi ? `छोड़ा: ${what}` : `Skipped: ${what}`);
  for (const op of ops) {
    switch (op.op) {
      case "remove_block": { const f = findBlock(op.id); if (!f) { skip(op.id); break; } f.page.blocks.splice(f.i, 1); notes.push(hi ? `"${title(f.block)}" section हटाया` : `Removed the "${title(f.block)}" section`); applied++; break; }
      case "move_block": {
        const f = findBlock(op.id); if (!f) { skip(op.id); break; }
        const [b] = f.page.blocks.splice(f.i, 1);
        const at = op.before ? f.page.blocks.findIndex((x) => x.id === op.before) : -1;
        if (at >= 0) f.page.blocks.splice(at, 0, b); else f.page.blocks.push(b);
        notes.push(hi ? `"${title(b)}" को ${at >= 0 ? "ऊपर" : "नीचे"} किया` : `Moved "${title(b)}" ${at >= 0 ? "up" : "to the end"}`); applied++; break;
      }
      case "set_title": { const f = findBlock(op.id); if (!f || !("title" in f.block)) { skip(op.id); break; } f.page.blocks[f.i] = { ...f.block, title: op.value } as CardBlock; notes.push(hi ? `शीर्षक "${op.value}" किया` : `Title → "${op.value}"`); applied++; break; }
      case "set_text": {
        const f = findBlock(op.id); if (!f) { skip(op.id); break; }
        const b = f.block;
        const nb: CardBlock | null = b.kind === "about" ? { ...b, body: op.value } : b.kind === "offer" ? { ...b, text: op.value } : b.kind === "contact" ? { ...b, note: op.value } : b.kind === "cta" ? { ...b, body: op.value } : null;
        if (!nb) { skip(`${title(b)} (no text)`); break; }
        f.page.blocks[f.i] = nb; notes.push(hi ? `"${title(b)}" का text बदला` : `Rewrote "${title(b)}"`); applied++; break;
      }
      case "set_item": case "remove_item": case "add_item": {
        const f = findBlock(op.id); if (!f || !("items" in f.block) || !Array.isArray(f.block.items)) { skip(op.id); break; }
        const b = f.block as Extract<CardBlock, { items: unknown[] }>;
        const items = [...(b.items as unknown as Record<string, unknown>[])];
        if (op.op === "remove_item") { if (!items[op.index]) { skip(`${title(b)} [${op.index}]`); break; } const [gone] = items.splice(op.index, 1); notes.push(hi ? `"${String(gone.name ?? gone.q ?? "")}" हटाया` : `Removed "${String(gone.name ?? gone.q ?? "")}"`); }
        else if (op.op === "set_item") { if (!items[op.index]) { skip(`${title(b)} [${op.index}]`); break; } items[op.index] = { ...items[op.index], ...(op.name ? { name: op.name } : {}), ...(op.desc ? { desc: op.desc } : {}), ...(op.price ? { price: op.price } : {}) }; notes.push(hi ? `"${String(items[op.index].name ?? "")}" बदला` : `Changed "${String(items[op.index].name ?? "")}"`); }
        else { const base = b.kind === "product" ? { name: op.name, desc: op.desc ?? "", price: op.price ?? "", features: [], specs: [] } : b.kind === "faq" ? { q: op.name, a: op.desc ?? "" } : b.kind === "highlights" ? op.name : { name: op.name, desc: op.desc ?? "" }; items.push(base as Record<string, unknown>); notes.push(hi ? `"${op.name}" जोड़ा` : `Added "${op.name}"`); }
        f.page.blocks[f.i] = { ...b, items } as unknown as CardBlock; applied++; break;
      }
      case "set_hero": { if (!out.site?.hero) { skip("hero"); break; } out = { ...out, site: { ...out.site, hero: { ...out.site.hero, ...(op.headline ? { headline: op.headline } : {}), ...(op.sub ? { sub: op.sub } : {}), ...(op.ctaLabel ? { ctaLabel: op.ctaLabel } : {}) } } }; notes.push(hi ? "ऊपर का हिस्सा (hero) बदला" : "Changed the top section (hero)"); applied++; break; }
      case "set_identity": { out = { ...out, ...(op.tagline ? { tagline: op.tagline } : {}), ...(op.about ? { about: op.about } : {}), ...(op.company ? { company: op.company } : {}), ...(op.jobTitle ? { jobTitle: op.jobTitle } : {}) }; notes.push(hi ? `बदला: ${Object.keys(op).filter((k) => k !== "op").join(", ")}` : `Changed: ${Object.keys(op).filter((k) => k !== "op").join(", ")}`); applied++; break; }
      case "set_style": { const { op: _o, ...st } = op; void _o; out = { ...out, site: { ...(out.site ?? { enabled: true }), style: { ...(out.site?.style ?? {}), ...(st as SiteStyle) } } }; notes.push(hi ? `look बदला: ${Object.entries(st).map(([k, v]) => `${k}=${v}`).join(", ")}` : `Look → ${Object.entries(st).map(([k, v]) => `${k}=${v}`).join(", ")}`); applied++; break; }
      case "hide_page": case "show_page": {
        const p = out.pages.find((x) => x.slug === op.slug && !x.hidden); if (!p || p.slug === "home") { skip(op.slug); break; }
        const hidden = new Set(out.site?.hidden ?? []); if (op.op === "hide_page") hidden.add(op.slug); else hidden.delete(op.slug);
        out = { ...out, site: { ...(out.site ?? { enabled: true }), hidden: [...hidden] } };
        notes.push(op.op === "hide_page" ? (hi ? `"${p.label}" page menu से हटाया` : `Hid the "${p.label}" page from the menu`) : (hi ? `"${p.label}" page वापस दिखाया` : `Showing the "${p.label}" page again`)); applied++; break;
      }
      case "rename_page": { const p = out.pages.find((x) => x.slug === op.slug && !x.hidden); if (!p) { skip(op.slug); break; } out.pages = out.pages.map((x) => (x === p ? { ...x, label: op.label } : x)); notes.push(hi ? `page का नाम "${op.label}" किया` : `Page renamed to "${op.label}"`); applied++; break; }
    }
  }
  return { card: out, notes, applied };
}
