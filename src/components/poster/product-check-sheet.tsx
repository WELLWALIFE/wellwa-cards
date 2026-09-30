"use client";
// "Product check" — three visual questions that become the product facts every ad prompt obeys
// (docs/ad-video-one-shot-spec.md §2 Screen A2). English-only UI.
import { useCallback, useEffect, useState } from "react";
import { X, LoaderCircle, Check, Plus } from "lucide-react";
import { api } from "@/lib/poster-client";
import type { ProductFacts, ProductPhoto } from "@/lib/media/product-facts";

type Res = { facts: ProductFacts | null; photos: ProductPhoto[]; blocking: string[]; facts_version: number; confirmed_at?: string | null; confirmed?: boolean; error?: string };
const inp = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const MEDIUM_WORD: Record<string, string> = { water: "Water", air: "Air", light: "Light", sound: "Sound", heat: "Heat", food: "Food", none: "The result" };

export function ProductCheckSheet({ productId, productName, langs, onClose, onConfirmed }: { productId: string; productName: string; langs?: string[]; onClose: () => void; onConfirmed?: (f: ProductFacts) => void }) {
  const [facts, setFacts] = useState<ProductFacts | null>(null);
  const [photos, setPhotos] = useState<ProductPhoto[]>([]);
  const [blocking, setBlocking] = useState<string[]>([]);
  const [busy, setBusy] = useState<"" | "load" | "draft" | "save">("load");
  const [err, setErr] = useState("");
  const [notes, setNotes] = useState("");
  const [partOk, setPartOk] = useState<null | boolean>(null);
  const [newChip, setNewChip] = useState("");
  const [adv, setAdv] = useState(false);
  const [done, setDone] = useState(false);

  const take = (d: Res) => { setFacts(d.facts); setPhotos(d.photos ?? []); setBlocking(d.blocking ?? []); };
  const load = useCallback(async () => { setBusy("load"); const r = await api<Res>(`/api/poster/products/${productId}/facts`); setBusy(""); if (r.ok) { take(r.data); if (r.data.facts?.confirmed_by_owner) setPartOk(true); } else setErr(r.data.error || "Could not load."); }, [productId]);
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);

  async function draft() { setBusy("draft"); setErr(""); const r = await api<Res>(`/api/poster/products/${productId}/facts`, { method: "POST", json: { notes } }); setBusy(""); if (r.ok) { take(r.data); setPartOk(null); } else setErr(r.data.error || "Could not read the photos."); }
  async function save(confirm: boolean) {
    if (!facts) return; setBusy("save"); setErr("");
    const verified = confirm ? ["output", "stage_positive", "appearance", "must_not_show", ...facts.unverified] : [];
    const r = await api<Res>(`/api/poster/products/${productId}/facts`, { method: "PUT", json: { facts, confirm, verified, langs: langs?.length ? langs : ["hinglish"] } });
    setBusy("");
    if (!r.ok) { setErr(r.data.error || "Could not save."); if (r.data.blocking) setBlocking(r.data.blocking); return; }
    take(r.data);
    if (confirm && r.data.facts) { setDone(true); onConfirmed?.(r.data.facts); }
  }
  const set = (p: Partial<ProductFacts>) => facts && setFacts({ ...facts, ...p });
  const setOut = (p: Partial<NonNullable<ProductFacts["output"]>>) => facts?.output && setFacts({ ...facts, output: { ...facts.output, ...p } });

  const idPhotos = photos.map((p, i) => ({ ...p, i })).filter((p) => p.role !== "context" && !p.generated_crop);
  const pointPhoto = idPhotos.find((p) => p.view === "front") ?? idPhotos.find((p) => p.view === "three_quarter") ?? idPhotos[0];
  const needsPoint = !!facts?.output;
  const pointSet = !!facts?.output?.point;
  const canConfirm = !!facts && (!needsPoint || (pointSet && partOk !== null)) && facts.must_not_show.length > 0 && !!facts.appearance && !!facts.stage_positive && (!facts.output || !!facts.output.action_positive);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <div className="max-h-[94dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-4 shadow-xl md:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between"><h3 className="text-base font-bold">Product check — {productName}</h3><button type="button" onClick={onClose} className="rounded-lg p-1 text-muted" aria-label="Close"><X className="h-5 w-5" /></button></div>
        <p className="mb-3 text-xs text-muted">Three quick answers. Every AI video of this product obeys them, so the product looks and works exactly as it does in real life. You are the expert — fix anything that is wrong.</p>
        {busy === "load" && <div className="grid place-items-center py-10"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}

        {busy !== "load" && !facts && (
          <div className="space-y-3">
            <p className="text-sm">We will read your product photos and prepare the answers for you to check.</p>
            <textarea className={inp} rows={2} placeholder="Anything the AI should know? (optional) e.g. water comes out of the hose on top" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <button type="button" onClick={draft} disabled={busy === "draft" || !photos.length} className="grad-brand w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy === "draft" ? "Reading your photos… (about 20 seconds)" : "Read my photos"}</button>
            {!photos.length && <p className="text-xs text-danger">Add at least one product photo first (2 or more gives the best result).</p>}
          </div>
        )}

        {facts && !done && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border p-3 text-sm">
              <p className="font-semibold">{facts.what_it_is || facts.label}</p>
              <p className="mt-1 text-xs text-muted">{facts.appearance}</p>
            </div>

            {needsPoint && pointPhoto && (
              <section>
                <h4 className="text-sm font-semibold">1. Tap where the result comes out</h4>
                <p className="mb-2 text-xs text-muted">Tap the exact spot on your product. The AI uses a close-up of it as a reference.</p>
                <div className="relative mx-auto w-fit cursor-crosshair overflow-hidden rounded-xl border border-border"
                  onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setOut({ point: { photo: pointPhoto.i, x: +((e.clientX - r.left) / r.width).toFixed(3), y: +((e.clientY - r.top) / r.height).toFixed(3) } }); }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pointPhoto.url} alt="Your product" className="max-h-72 w-auto select-none" draggable={false} />
                  {facts.output?.point && facts.output.point.photo === pointPhoto.i && <span className="pointer-events-none absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-brand/70 shadow" style={{ left: `${facts.output.point.x * 100}%`, top: `${facts.output.point.y * 100}%` }} />}
                </div>
                <button type="button" onClick={() => { set({ output: null }); setPartOk(true); }} className="mt-1 text-[11px] text-muted underline">Nothing comes out of this product</button>
              </section>
            )}

            {facts.output && (
              <section>
                <h4 className="text-sm font-semibold">{needsPoint ? "2." : "1."} Is this correct?</h4>
                <div className={`mt-1 rounded-xl border p-3 text-sm ${blocking.includes("output") ? "border-lead bg-lead/10" : "border-border"}`}>
                  {MEDIUM_WORD[facts.output.medium] ?? "The result"} comes out of <b>{facts.output.part}</b> and from nowhere else — correct?
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => setPartOk(true)} className={`flex-1 rounded-lg border py-1.5 text-sm font-semibold ${partOk === true ? "border-brand bg-brand-soft text-brand-ink" : "border-border"}`}>Yes</button>
                    <button type="button" onClick={() => setPartOk(false)} className={`flex-1 rounded-lg border py-1.5 text-sm font-semibold ${partOk === false ? "border-brand bg-brand-soft text-brand-ink" : "border-border"}`}>No</button>
                  </div>
                  {partOk === false && (
                    <div className="mt-2 space-y-1.5">
                      <input className={inp} placeholder="Where does it come out? e.g. the flexible white hose on top of the unit" value={facts.output.part} onChange={(e) => { const part = e.target.value; setOut({ part, part_short: part.split(/\s+/).slice(0, 4).join(" "), action_positive: `a steady stream of ${facts.output!.medium === "none" ? "the result" : facts.output!.medium} flows from ${part} into ${facts.output!.receptacle || "the receptacle held directly beneath it"}` }); }} />
                      <input className={inp} placeholder="What receives it? e.g. a clear glass held directly beneath the end of the hose" value={facts.output.receptacle} onChange={(e) => setOut({ receptacle: e.target.value })} />
                    </div>
                  )}
                </div>
              </section>
            )}

            <section>
              <h4 className="text-sm font-semibold">{facts.output ? (needsPoint ? "3." : "2.") : "1."} The video must never show</h4>
              <p className="mb-2 text-xs text-muted">Remove anything that does not apply. Add what AI pictures usually get wrong for your product.</p>
              <div className="flex flex-wrap gap-1.5">
                {facts.must_not_show.map((m) => (
                  <button key={m} type="button" onClick={() => set({ must_not_show: facts.must_not_show.filter((x) => x !== m), removed_defaults: [...new Set([...facts.removed_defaults, m])] })} className="inline-flex items-center gap-1 rounded-full border border-brand bg-brand-soft px-2.5 py-1 text-xs text-brand-ink">{m} <X className="h-3 w-3" /></button>
                ))}
              </div>
              <div className="mt-2 flex gap-2"><input className={inp} placeholder="Add one, e.g. the unit held in someone's hands" value={newChip} onChange={(e) => setNewChip(e.target.value)} /><button type="button" onClick={() => { const v = newChip.trim(); if (v) { set({ must_not_show: [...new Set([...facts.must_not_show, v])].slice(0, 8), removed_defaults: facts.removed_defaults.filter((x) => x.toLowerCase() !== v.toLowerCase()) }); setNewChip(""); } }} className="rounded-lg border border-border px-3"><Plus className="h-4 w-4" /></button></div>
            </section>

            <section>
              <button type="button" onClick={() => setAdv(!adv)} className="text-xs font-semibold text-brand-ink">{adv ? "Hide" : "Show"} advanced details</button>
              {adv && (
                <div className="mt-2 space-y-2 text-xs">
                  <label className="block"><span className="mb-1 block font-semibold text-muted">What it looks like</span><textarea className={inp} rows={3} value={facts.appearance} onChange={(e) => set({ appearance: e.target.value })} /></label>
                  <label className="block"><span className="mb-1 block font-semibold text-muted">Where it stands (surface and backdrop only — do not name taps, sinks or other objects)</span><input className={inp} value={facts.stage_positive} onChange={(e) => set({ stage_positive: e.target.value })} /></label>
                  <label className="block"><span className="mb-1 block font-semibold text-muted">When nobody is using it</span><input className={inp} value={facts.idle_positive} onChange={(e) => set({ idle_positive: e.target.value })} /></label>
                  {facts.output && <label className="block"><span className="mb-1 block font-semibold text-muted">Correct use, as seen on camera</span><textarea className={inp} rows={2} value={facts.output.action_positive} onChange={(e) => setOut({ action_positive: e.target.value })} /></label>}
                  <label className="block"><span className="mb-1 block font-semibold text-muted">Benefits (one per line)</span><textarea className={inp} rows={3} value={facts.benefits.join("\n")} onChange={(e) => set({ benefits: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })} /></label>
                  <label className="block"><span className="mb-1 block font-semibold text-muted">Numbers I vouch for (one per line, e.g. 5,000+ Indian homes)</span><textarea className={inp} rows={2} value={facts.proof.map((p) => p.text).join("\n")} onChange={(e) => set({ proof: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean).map((text) => ({ text, number: text.match(/[\d,]+/)?.[0]?.replace(/,/g, ""), source: "owner" })) })} /></label>
                  <label className="block"><span className="mb-1 block font-semibold text-muted">Never claim (comma separated)</span><input className={inp} value={facts.banned_claims.join(", ")} onChange={(e) => set({ banned_claims: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} /></label>
                  {Object.entries(facts.pronunciations).filter(([l]) => l !== "latin_hint").map(([l, m]) => (
                    <label key={l} className="block"><span className="mb-1 block font-semibold text-muted">How to say it ({l})</span><input className={inp} value={Object.entries(m).map(([k, v]) => `${k}=${v}`).join(", ")} onChange={(e) => set({ pronunciations: { ...facts.pronunciations, [l]: Object.fromEntries(e.target.value.split(",").map((x) => x.split("=").map((y) => y.trim())).filter((x) => x[0] && x[1])) } })} /></label>
                  ))}
                  <button type="button" onClick={draft} disabled={busy === "draft"} className="rounded-lg border border-border px-3 py-1.5 text-xs">{busy === "draft" ? "Reading…" : "Read my photos again"}</button>
                </div>
              )}
            </section>

            {err && <p className="text-xs text-danger">{err}</p>}
            {!canConfirm && <p className="text-[11px] text-muted">{needsPoint && !pointSet ? "Tap the spot on the photo (question 1). " : ""}{facts.output && partOk === null ? "Answer Yes or No (question 2). " : ""}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => save(false)} disabled={busy === "save"} className="rounded-xl border border-border px-4 py-2.5 text-sm">Save for later</button>
              <button type="button" onClick={() => save(true)} disabled={busy === "save" || !canConfirm} className="grad-brand flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy === "save" ? <LoaderCircle className="mx-auto h-5 w-5 animate-spin" /> : "Confirm"}</button>
            </div>
          </div>
        )}

        {done && facts && (
          <div className="space-y-3 py-4 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-good/10 text-good"><Check className="h-6 w-6" /></span>
            <p className="text-sm font-semibold">Product check confirmed</p>
            <p className="text-xs text-muted">Every AI video of {productName} will now follow these answers.</p>
            <button type="button" onClick={onClose} className="grad-brand w-full rounded-xl py-2.5 text-sm font-semibold text-white">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
