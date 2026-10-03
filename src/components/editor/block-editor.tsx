"use client";

import { useRef, useState } from "react";
import { ChevronUp, ChevronDown, Trash2, Plus, X, Upload, FileText, GripVertical } from "lucide-react";
import type { CardBlock } from "@/lib/types";
import { ImageUpload } from "./image-upload";
import { AiTextarea } from "./ai-fields";

const kindLabel: Record<CardBlock["kind"], string> = {
  table: "Price list / table",
  form: "Form (enquiry / booking)",
  about: "About / text",
  highlights: "Highlights",
  services: "Services",
  product: "Products",
  gallery: "Gallery",
  image: "Image / photos",
  carousel: "Slider (arrows)",
  video: "Video",
  pdf: "PDF / file",
  testimonials: "Testimonials",
  faq: "FAQ",
  hours: "Business hours",
  appointment: "Appointment",
  location: "Location",
  offer: "Offer / coupon",
  contact: "Contact form",
  cta: "Button (link)",
  compare: "Us vs them (comparison)",
  showcase: "Showcase (picture tiles)",
};

export function BlockEditor({
  block, onChange, onRemove, onMoveUp, onMoveDown, canUp, canDown, dragHandleProps,
}: {
  block: CardBlock;
  onChange: (b: CardBlock) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canUp: boolean;
  canDown: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLSpanElement> & { draggable?: boolean };
}) {
  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface2/50 rounded-t-xl">
        {dragHandleProps && (
          <span {...dragHandleProps} className="cursor-grab active:cursor-grabbing shrink-0" title="Drag to reorder">
            <GripVertical className="h-4 w-4 text-faint" />
          </span>
        )}
        <span className="flex-1 text-xs font-semibold text-muted">{kindLabel[block.kind]}</span>
        <button onClick={onMoveUp} disabled={!canUp} className="ed-icon" aria-label="Move up"><ChevronUp className="h-4 w-4" /></button>
        <button onClick={onMoveDown} disabled={!canDown} className="ed-icon" aria-label="Move down"><ChevronDown className="h-4 w-4" /></button>
        <button onClick={onRemove} className="ed-icon hover:text-danger" aria-label="Delete block"><Trash2 className="h-4 w-4" /></button>
      </div>

      <div className="p-3 space-y-3">
        <input
          className="ed-input"
          value={block.title}
          placeholder="Section title"
          onChange={(e) => onChange({ ...block, title: e.target.value })}
        />

        {block.kind === "about" && (
          <>
            <AiTextarea
              value={block.body}
              onChange={(v) => onChange({ ...block, body: v })}
              task="bio"
              placeholder="Write something about yourself…"
            />
            <div>
              <p className="text-[13px] font-medium mb-1 text-muted">Photo (optional)</p>
              <ImageUpload shape="cover" value={block.imageUrl}
                onChange={(url) => onChange({ ...block, imageUrl: url })} />
            </div>
          </>
        )}

        {block.kind === "highlights" && (
          <ListRows values={block.items} placeholder="Highlight"
            onChange={(items) => onChange({ ...block, items })} />
        )}

        {block.kind === "services" && (
          <div className="space-y-2">
            {block.items.map((s, i) => (
              <div key={i} className="rounded-lg border border-border p-2 space-y-2">
                <div className="flex gap-2">
                  <input className="ed-input" value={s.name} placeholder="Service name"
                    onChange={(e) => { const items = block.items.slice(); items[i] = { ...s, name: e.target.value }; onChange({ ...block, items }); }} />
                  <button className="ed-icon hover:text-danger shrink-0" onClick={() => onChange({ ...block, items: block.items.filter((_, x) => x !== i) })}><X className="h-4 w-4" /></button>
                </div>
                <input className="ed-input" value={s.desc} placeholder="Short description"
                  onChange={(e) => { const items = block.items.slice(); items[i] = { ...s, desc: e.target.value }; onChange({ ...block, items }); }} />
              </div>
            ))}
            <button className="ed-add" onClick={() => onChange({ ...block, items: [...block.items, { name: "", desc: "" }] })}>
              <Plus className="h-3.5 w-3.5" /> Add service
            </button>
          </div>
        )}

        {block.kind === "product" && (
          <div className="space-y-3">
            {block.items.map((p, i) => {
              const setP = (patch: Partial<typeof p>) => {
                const items = block.items.slice();
                items[i] = { ...p, ...patch };
                onChange({ ...block, items });
              };
              return (
                <div key={i} className="rounded-xl border border-border p-3 space-y-3 bg-surface2/30">
                  <div className="flex items-center justify-between">
                    <span className="mono text-[11px] uppercase tracking-wide text-faint">Product {i + 1}</span>
                    <button className="ed-icon hover:text-danger" onClick={() => onChange({ ...block, items: block.items.filter((_, x) => x !== i) })}><Trash2 className="h-4 w-4" /></button>
                  </div>

                  {/* Up to 3 product photos — first one is the main shot */}
                  <div>
                    <span className="text-[11px] font-medium text-muted">Product photos (up to 3)</span>
                    <div className="mt-1 grid grid-cols-3 gap-2">
                      {[0, 1, 2].map((slot) => {
                        const imgs = p.images ?? (p.imageUrl ? [p.imageUrl] : []);
                        return (
                          <ImageUpload
                            key={slot}
                            shape="cover"
                            value={imgs[slot]}
                            onChange={(url) => {
                              const next = [...imgs];
                              if (url) next[slot] = url;
                              else next.splice(slot, 1);
                              const clean = next.filter(Boolean).slice(0, 3);
                              setP({ images: clean, imageUrl: clean[0] ?? "" });
                            }}
                          />
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-faint mt-1">The first photo is the main shot. Visitors can tap any photo to zoom.</p>
                  </div>

                  <input className="ed-input" value={p.name} placeholder="Product name"
                    onChange={(e) => setP({ name: e.target.value })} />

                  <div className="grid grid-cols-3 gap-2">
                    <label className="block">
                      <span className="text-[11px] text-muted">MRP</span>
                      <input className="ed-input" value={p.mrp ?? ""} placeholder="₹99,000"
                        onChange={(e) => setP({ mrp: e.target.value })} />
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-muted">Offer price</span>
                      <input className="ed-input" value={p.price ?? ""} placeholder="₹65,000"
                        onChange={(e) => setP({ price: e.target.value })} />
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-muted">Badge</span>
                      <input className="ed-input" value={p.badge ?? ""} placeholder="Bestseller"
                        onChange={(e) => setP({ badge: e.target.value })} />
                    </label>
                  </div>

                  <input className="ed-input" value={p.desc ?? ""} placeholder="Short description"
                    onChange={(e) => setP({ desc: e.target.value })} />

                  {/* Features */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-medium text-muted">Features</span>
                    {p.features.map((f, fi) => (
                      <div key={fi} className="flex gap-2">
                        <input className="ed-input" value={f} placeholder="Key feature / benefit"
                          onChange={(e) => { const features = p.features.slice(); features[fi] = e.target.value; setP({ features }); }} />
                        <button className="ed-icon hover:text-danger shrink-0" onClick={() => setP({ features: p.features.filter((_, x) => x !== fi) })}><X className="h-4 w-4" /></button>
                      </div>
                    ))}
                    <button className="ed-add" onClick={() => setP({ features: [...p.features, ""] })}><Plus className="h-3.5 w-3.5" /> Add feature</button>
                  </div>

                  {/* Specifications */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-medium text-muted">Specifications</span>
                    {p.specs.map((s, si) => (
                      <div key={si} className="flex gap-2">
                        <input className="ed-input" value={s.label} placeholder="Label (e.g. Warranty)"
                          onChange={(e) => { const specs = p.specs.slice(); specs[si] = { ...s, label: e.target.value }; setP({ specs }); }} />
                        <input className="ed-input" value={s.value} placeholder="Value (e.g. 5 years)"
                          onChange={(e) => { const specs = p.specs.slice(); specs[si] = { ...s, value: e.target.value }; setP({ specs }); }} />
                        <button className="ed-icon hover:text-danger shrink-0" onClick={() => setP({ specs: p.specs.filter((_, x) => x !== si) })}><X className="h-4 w-4" /></button>
                      </div>
                    ))}
                    <button className="ed-add" onClick={() => setP({ specs: [...p.specs, { label: "", value: "" }] })}><Plus className="h-3.5 w-3.5" /> Add spec</button>
                  </div>

                  <label className="block">
                    <span className="text-[11px] text-muted">Button text</span>
                    <input className="ed-input" value={p.ctaLabel ?? ""} placeholder="Order on WhatsApp"
                      onChange={(e) => setP({ ctaLabel: e.target.value })} />
                  </label>
                </div>
              );
            })}
            <button className="ed-add" onClick={() => onChange({ ...block, items: [...block.items, { name: "", imageUrl: "", mrp: "", price: "", badge: "", desc: "", features: [""], specs: [{ label: "", value: "" }], ctaLabel: "Order on WhatsApp" }] })}>
              <Plus className="h-3.5 w-3.5" /> Add product
            </button>
          </div>
        )}

        {block.kind === "gallery" && (
          <div className="space-y-2">
            {block.images.map((img, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-border p-2">
                <ImageUpload shape="tile" value={img.url}
                  onChange={(url) => { const images = block.images.slice(); images[i] = { ...img, url }; onChange({ ...block, images }); }} />
                <div className="flex-1 space-y-2">
                  <input className="ed-input" value={img.label} placeholder="Label"
                    onChange={(e) => { const images = block.images.slice(); images[i] = { ...img, label: e.target.value }; onChange({ ...block, images }); }} />
                  <button className="text-xs text-danger" onClick={() => onChange({ ...block, images: block.images.filter((_, x) => x !== i) })}>Remove</button>
                </div>
              </div>
            ))}
            <button className="ed-add" onClick={() => onChange({ ...block, images: [...block.images, { color: "#0e9e90", label: "" }] })}>
              <Plus className="h-3.5 w-3.5" /> Add photo
            </button>
          </div>
        )}

        {block.kind === "image" && (
          <div className="space-y-2">
            {block.images.map((img, i) => (
              <div key={i} className="rounded-lg border border-border p-2 space-y-2">
                <ImageUpload shape="cover" value={img.url}
                  onChange={(url) => { const images = block.images.slice(); if (url) images[i] = { ...img, url }; onChange({ ...block, images }); }} />
                <div className="flex gap-2">
                  <input className="ed-input" value={img.caption ?? ""} placeholder="Caption (optional)"
                    onChange={(e) => { const images = block.images.slice(); images[i] = { ...img, caption: e.target.value }; onChange({ ...block, images }); }} />
                  <button className="ed-icon hover:text-danger shrink-0" onClick={() => onChange({ ...block, images: block.images.filter((_, x) => x !== i) })}><X className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
            <button className="ed-add" onClick={() => onChange({ ...block, images: [...block.images, { url: "" }] })}>
              <Plus className="h-3.5 w-3.5" /> Add photo
            </button>
          </div>
        )}

        {block.kind === "carousel" && (
          <div className="space-y-2">
            <p className="text-xs text-muted">Visitors see one photo at a time with left/right arrows, starting on the middle one.</p>
            {block.images.map((img, i) => (
              <div key={i} className="rounded-lg border border-border p-2 space-y-2">
                <ImageUpload shape="cover" value={img.url}
                  onChange={(url) => { const images = block.images.slice(); if (url) images[i] = { ...img, url }; onChange({ ...block, images }); }} />
                <div className="flex gap-2">
                  <input className="ed-input" value={img.caption ?? ""} placeholder="Caption (optional)"
                    onChange={(e) => { const images = block.images.slice(); images[i] = { ...img, caption: e.target.value }; onChange({ ...block, images }); }} />
                  <button className="ed-icon hover:text-danger shrink-0" onClick={() => onChange({ ...block, images: block.images.filter((_, x) => x !== i) })}><X className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
            <button className="ed-add" onClick={() => onChange({ ...block, images: [...block.images, { url: "" }] })}>
              <Plus className="h-3.5 w-3.5" /> Add photo
            </button>
          </div>
        )}

        {block.kind === "video" && (
          <>
            <input className="ed-input" value={block.url} placeholder="YouTube / Facebook / Vimeo / .mp4 link"
              onChange={(e) => onChange({ ...block, url: e.target.value })} />
            <input className="ed-input" value={block.caption} placeholder="Caption (optional)"
              onChange={(e) => onChange({ ...block, caption: e.target.value })} />
            <div>
              <p className="text-[13px] font-medium mb-1 text-muted">Video cover / poster (optional)</p>
              <ImageUpload shape="cover" value={block.posterUrl}
                onChange={(posterUrl) => onChange({ ...block, posterUrl })} />
              <p className="text-[10px] text-faint mt-1">Shown before an uploaded MP4 starts. Replace it with a clear product or presenter frame.</p>
            </div>
          </>
        )}

        {block.kind === "pdf" && (
          <>
            <input className="ed-input" value={block.fileLabel} placeholder="File name (e.g. Brochure.pdf)"
              onChange={(e) => onChange({ ...block, fileLabel: e.target.value })} />
            <PdfUpload
              fileUrl={block.fileUrl}
              onChange={(fileUrl, name) => onChange({ ...block, fileUrl, fileLabel: name ?? block.fileLabel })}
            />
            <div>
              <p className="text-[13px] font-medium mb-1 text-muted">Preview image (optional) — shown above the file, 16:9</p>
              <ImageUpload shape="cover" value={block.posterUrl}
                onChange={(url) => onChange({ ...block, posterUrl: url })} />
            </div>
          </>
        )}

        {block.kind === "testimonials" && (
          <div className="space-y-2">
            {block.items.map((t, i) => (
              <div key={i} className="rounded-lg border border-border p-2 space-y-2">
                <div className="flex gap-2">
                  <input className="ed-input" value={t.name} placeholder="Customer name"
                    onChange={(e) => { const items = block.items.slice(); items[i] = { ...t, name: e.target.value }; onChange({ ...block, items }); }} />
                  <select className="ed-input !w-20" value={t.rating}
                    onChange={(e) => { const items = block.items.slice(); items[i] = { ...t, rating: Number(e.target.value) }; onChange({ ...block, items }); }}>
                    {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r}★</option>)}
                  </select>
                  <button className="ed-icon hover:text-danger shrink-0" onClick={() => onChange({ ...block, items: block.items.filter((_, x) => x !== i) })}><X className="h-4 w-4" /></button>
                </div>
                <textarea className="ed-input min-h-14 resize-y" value={t.text} placeholder="What did they say?"
                  onChange={(e) => { const items = block.items.slice(); items[i] = { ...t, text: e.target.value }; onChange({ ...block, items }); }} />
              </div>
            ))}
            <button className="ed-add" onClick={() => onChange({ ...block, items: [...block.items, { name: "", text: "", rating: 5 }] })}>
              <Plus className="h-3.5 w-3.5" /> Add testimonial
            </button>
          </div>
        )}

        {block.kind === "faq" && (
          <div className="space-y-2">
            {block.items.map((f, i) => (
              <div key={i} className="rounded-lg border border-border p-2 space-y-2">
                <div className="flex gap-2">
                  <input className="ed-input" value={f.q} placeholder="Question"
                    onChange={(e) => { const items = block.items.slice(); items[i] = { ...f, q: e.target.value }; onChange({ ...block, items }); }} />
                  <button className="ed-icon hover:text-danger shrink-0" onClick={() => onChange({ ...block, items: block.items.filter((_, x) => x !== i) })}><X className="h-4 w-4" /></button>
                </div>
                <textarea className="ed-input min-h-14 resize-y" value={f.a} placeholder="Answer"
                  onChange={(e) => { const items = block.items.slice(); items[i] = { ...f, a: e.target.value }; onChange({ ...block, items }); }} />
              </div>
            ))}
            <button className="ed-add" onClick={() => onChange({ ...block, items: [...block.items, { q: "", a: "" }] })}>
              <Plus className="h-3.5 w-3.5" /> Add question
            </button>
          </div>
        )}

        {block.kind === "hours" && (
          <div className="space-y-2">
            {block.rows.map((r, i) => (
              <div key={i} className="flex gap-2">
                <input className="ed-input !w-32" value={r.day} placeholder="Day"
                  onChange={(e) => { const rows = block.rows.slice(); rows[i] = { ...r, day: e.target.value }; onChange({ ...block, rows }); }} />
                <input className="ed-input" value={r.time} placeholder="10:00 – 19:00 or Closed"
                  onChange={(e) => { const rows = block.rows.slice(); rows[i] = { ...r, time: e.target.value }; onChange({ ...block, rows }); }} />
                <button className="ed-icon hover:text-danger shrink-0" onClick={() => onChange({ ...block, rows: block.rows.filter((_, x) => x !== i) })}><X className="h-4 w-4" /></button>
              </div>
            ))}
            <button className="ed-add" onClick={() => onChange({ ...block, rows: [...block.rows, { day: "", time: "" }] })}>
              <Plus className="h-3.5 w-3.5" /> Add row
            </button>
          </div>
        )}

        {block.kind === "appointment" && (
          <>
            <input className="ed-input" value={block.url} placeholder="Booking link (Calendly / Google Calendar / any URL)"
              onChange={(e) => onChange({ ...block, url: e.target.value })} />
            <input className="ed-input" value={block.note} placeholder="Note (e.g. Free 15-min demo call)"
              onChange={(e) => onChange({ ...block, note: e.target.value })} />
          </>
        )}

        {block.kind === "location" && (
          <textarea className="ed-input min-h-14 resize-y" value={block.address} placeholder="Full address (opens in Google Maps)"
            onChange={(e) => onChange({ ...block, address: e.target.value })} />
        )}

        {block.kind === "offer" && (
          <>
            <input className="ed-input" value={block.text} placeholder="Offer text (e.g. 10% off on first order)"
              onChange={(e) => onChange({ ...block, text: e.target.value })} />
            <div className="flex gap-2">
              <input className="ed-input" value={block.code} placeholder="Coupon code (optional)"
                onChange={(e) => onChange({ ...block, code: e.target.value.toUpperCase() })} />
              <input className="ed-input" value={block.expires} placeholder="Valid till (e.g. 31 Aug)"
                onChange={(e) => onChange({ ...block, expires: e.target.value })} />
            </div>
          </>
        )}

        {block.kind === "contact" && (
          <>
            <p className="text-xs text-muted">A contact form (name, phone, email, message). Every submission lands in your Leads and pings you on WhatsApp.</p>
            <input className="ed-input" value={block.note ?? ""} placeholder="Note shown under the Send button (optional), e.g. Connect with your relationship manager"
              onChange={(e) => onChange({ ...block, note: e.target.value })} />
          </>
        )}

        {block.kind === "cta" && (
          <>
            <input className="ed-input" value={block.body ?? ""} placeholder="Short description (optional)"
              onChange={(e) => onChange({ ...block, body: e.target.value })} />
            <input className="ed-input" value={block.joinLabel} placeholder="Button text (e.g. See all products)"
              onChange={(e) => onChange({ ...block, joinLabel: e.target.value })} />
            <input className="ed-input" value={block.joinUrl} placeholder="Opens — a web address (https://…) or a page of your card (#products)"
              onChange={(e) => onChange({ ...block, joinUrl: e.target.value })} />
            {/* A button to a page of the card (#products) has nothing to do with referrals — the referral code only
                shows for an outside web address (e.g. a company's join form). */}
            {/^https?:\/\//i.test(block.joinUrl) ? (
              <>
                <input className="ed-input" value={block.referralCode} placeholder="Referral code (optional — added to the link)"
                  onChange={(e) => onChange({ ...block, referralCode: e.target.value })} />
                <p className="text-xs text-muted">Visitors see a &quot;{block.joinLabel || "Join Now"}&quot; button that opens this web address{block.referralCode ? " with your referral code attached, plus a copyable link" : ""}.</p>
              </>
            ) : (
              <p className="text-xs text-muted">Visitors see a &quot;{block.joinLabel || "Open"}&quot; button that opens {block.joinUrl?.startsWith("#") ? <>the <b>{block.joinUrl.slice(1)}</b> page of your card</> : "the address above"}.</p>
            )}
          </>
        )}

        {block.kind === "showcase" && (
          <div className="space-y-2">
            <p className="text-xs text-muted">Wide picture tiles — a name and one line under each. Add a link and the tile opens it.</p>
            {block.items.map((it, i) => {
              const setI = (patch: Partial<typeof it>) => { const items = block.items.slice(); items[i] = { ...it, ...patch }; onChange({ ...block, items }); };
              return (
                <div key={i} className="rounded-lg border border-border p-2 space-y-2">
                  <div className="flex gap-2">
                    <input className="ed-input" value={it.label} placeholder="Name, e.g. Doctor / Clinic" onChange={(e) => setI({ label: e.target.value })} />
                    <button className="ed-icon hover:text-danger shrink-0" onClick={() => onChange({ ...block, items: block.items.filter((_, x) => x !== i) })}><X className="h-4 w-4" /></button>
                  </div>
                  <input className="ed-input" value={it.sub ?? ""} placeholder="One line under it (optional)" onChange={(e) => setI({ sub: e.target.value })} />
                  <input className="ed-input" value={it.imageUrl} placeholder="Picture URL (wide, e.g. 1600×600)" onChange={(e) => setI({ imageUrl: e.target.value.trim() })} />
                  <input className="ed-input" value={it.url ?? ""} placeholder="Opens this link when tapped (optional)" onChange={(e) => setI({ url: e.target.value.trim() })} />
                </div>
              );
            })}
            <button className="ed-add" onClick={() => onChange({ ...block, items: [...block.items, { imageUrl: "", label: "", sub: "", url: "" }] })}>
              <Plus className="h-3.5 w-3.5" /> Add tile
            </button>
          </div>
        )}

        {block.kind === "compare" && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input className="ed-input" value={block.leftLabel} placeholder="Left column (you), e.g. Wellwa Aura"
                onChange={(e) => onChange({ ...block, leftLabel: e.target.value })} />
              <input className="ed-input" value={block.rightLabel} placeholder="Right column, e.g. Competitor"
                onChange={(e) => onChange({ ...block, rightLabel: e.target.value })} />
            </div>
            {block.rows.map((r, i) => {
              const setR = (patch: Partial<typeof r>) => { const rows = block.rows.slice(); rows[i] = { ...r, ...patch }; onChange({ ...block, rows }); };
              return (
                <div key={i} className="rounded-lg border border-border p-2 space-y-2">
                  <div className="flex gap-2">
                    <input className="ed-input" value={r.feature} placeholder="Feature, e.g. Plate size" onChange={(e) => setR({ feature: e.target.value })} />
                    <button className="ed-icon hover:text-danger shrink-0" onClick={() => onChange({ ...block, rows: block.rows.filter((_, x) => x !== i) })}><X className="h-4 w-4" /></button>
                  </div>
                  <div className="flex gap-2">
                    <input className="ed-input" value={r.left} placeholder="You" onChange={(e) => setR({ left: e.target.value })} />
                    <button type="button" title="Tick or cross on your side" className={`ed-icon shrink-0 ${r.leftOk === false ? "text-danger" : "text-good"}`} onClick={() => setR({ leftOk: r.leftOk === false ? undefined : false })}>{r.leftOk === false ? "✗" : "✓"}</button>
                  </div>
                  <div className="flex gap-2">
                    <input className="ed-input" value={r.right} placeholder="Competitor" onChange={(e) => setR({ right: e.target.value })} />
                    <button type="button" title="Tick or cross on their side" className={`ed-icon shrink-0 ${r.rightOk ? "text-good" : "text-danger"}`} onClick={() => setR({ rightOk: r.rightOk ? undefined : true })}>{r.rightOk ? "✓" : "✗"}</button>
                  </div>
                </div>
              );
            })}
            <button className="ed-add" onClick={() => onChange({ ...block, rows: [...block.rows, { feature: "", left: "", right: "" }] })}>
              <Plus className="h-3.5 w-3.5" /> Add row
            </button>
          </div>
        )}
        {block.kind === "table" && (
          <div className="space-y-2">
            <input className="ed-input" value={block.columns.join(" | ")} placeholder="Columns, separated by | — e.g. Class | Fee per month | Includes"
              onChange={(e) => onChange({ ...block, columns: e.target.value.split("|").map((x) => x.trim()) })} />
            <textarea className="ed-input min-h-[120px] font-mono text-xs" value={block.rows.map((r) => r.join(" | ")).join("\n")}
              placeholder={"One row per line, cells separated by | — e.g.\nNursery–UKG | ₹1,200 | books, activities\nClass 1–5 | ₹1,500 | books, transport"}
              onChange={(e) => onChange({ ...block, rows: e.target.value.split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((r) => r.some(Boolean)) })} />
            <div className="flex gap-2">
              <input className="ed-input" value={block.note ?? ""} placeholder="Note under the table (optional)" onChange={(e) => onChange({ ...block, note: e.target.value })} />
              <select className="ed-input !w-auto" value={block.highlight ?? 1} onChange={(e) => onChange({ ...block, highlight: Number(e.target.value) })} title="Bold column">
                {block.columns.map((c, i) => <option key={i} value={i}>Bold: {c || `col ${i + 1}`}</option>)}
              </select>
            </div>
          </div>
        )}
        {block.kind === "form" && (
          <div className="space-y-2">
            {block.fields.map((f, i) => {
              const setF = (patch: Partial<typeof f>) => { const fields = block.fields.slice(); fields[i] = { ...f, ...patch }; onChange({ ...block, fields }); };
              return (
                <div key={f.key} className="rounded-lg border border-border p-2 space-y-2">
                  <div className="flex gap-2">
                    <input className="ed-input" value={f.label} placeholder="Field label, e.g. Child's name" onChange={(e) => setF({ label: e.target.value })} />
                    <select className="ed-input !w-auto" value={f.type} onChange={(e) => setF({ type: e.target.value as typeof f.type })}>
                      {(["text", "phone", "email", "select", "date", "textarea"] as const).map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={!!f.required} onChange={(e) => setF({ required: e.target.checked })} /> req.</label>
                    <button className="ed-icon hover:text-danger shrink-0" onClick={() => onChange({ ...block, fields: block.fields.filter((_, x) => x !== i) })}><X className="h-4 w-4" /></button>
                  </div>
                  {f.type === "select" && <input className="ed-input" value={(f.options ?? []).join(", ")} placeholder="Choices, separated by commas" onChange={(e) => setF({ options: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />}
                </div>
              );
            })}
            <button className="ed-add" onClick={() => onChange({ ...block, fields: [...block.fields, { key: `f${Date.now().toString(36)}`, label: "", type: "text" }] })}><Plus className="h-3.5 w-3.5" /> Add field</button>
            <div className="flex gap-2">
              <input className="ed-input" value={block.button ?? ""} placeholder="Button text, e.g. Send enquiry" onChange={(e) => onChange({ ...block, button: e.target.value })} />
              <input className="ed-input" value={block.note ?? ""} placeholder="Note under the button (optional)" onChange={(e) => onChange({ ...block, note: e.target.value })} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const MAX_PDF_BYTES = 2_500_000; // ~2.5MB — localStorage-safe until Supabase storage arrives

function PdfUpload({ fileUrl, onChange }: {
  fileUrl?: string;
  onChange: (url: string | undefined, name?: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState("");

  function pick(file?: File) {
    if (!file) return;
    if (file.size > MAX_PDF_BYTES) {
      setErr("File is too big (max 2.5 MB for now). Cloud storage arrives with Supabase.");
      return;
    }
    setErr("");
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string, file.name);
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => input.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-surface2">
          <Upload className="h-3.5 w-3.5" /> {fileUrl ? "Replace PDF" : "Upload PDF"}
        </button>
        {fileUrl && (
          <>
            <span className="inline-flex items-center gap-1 text-xs text-good"><FileText className="h-3.5 w-3.5" /> Attached</span>
            <button type="button" onClick={() => onChange(undefined)} className="text-xs text-danger hover:underline">Remove</button>
          </>
        )}
      </div>
      {err && <p className="text-xs text-danger">{err}</p>}
      <input ref={input} type="file" accept="application/pdf" className="hidden"
        onChange={(e) => { pick(e.target.files?.[0]); e.currentTarget.value = ""; }} />
    </div>
  );
}

function ListRows({ values, placeholder, onChange }: { values: string[]; placeholder: string; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-2">
      {values.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <input className="ed-input" value={v} placeholder={placeholder}
            onChange={(e) => { const next = values.slice(); next[i] = e.target.value; onChange(next); }} />
          <button className="ed-icon hover:text-danger shrink-0" onClick={() => onChange(values.filter((_, x) => x !== i))}><X className="h-4 w-4" /></button>
        </div>
      ))}
      <button className="ed-add" onClick={() => onChange([...values, ""])}>
        <Plus className="h-3.5 w-3.5" /> Add item
      </button>
    </div>
  );
}
