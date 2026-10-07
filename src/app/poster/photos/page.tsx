"use client";
// "Photos your website needs" (owner's call, 3 Oct 2026: an agency asks for the gate, the classroom, the
// playground — we showed stock). The list comes from the trade and what is already uploaded; each line has a
// camera; an upload lands in the card facts (banner, work photos) or on the product, and "Put them on my
// website" swaps them into the live card in place of stock or AI pictures, without touching a word.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Camera, Check, ChevronLeft, Images, LoaderCircle, RefreshCw } from "lucide-react";
import { api, uploadImage } from "@/lib/poster-client";
import { fetchMyCardsStrict, publishCard } from "@/lib/cloud";
import { compressToFile } from "@/lib/image-utils";
import { useT } from "@/lib/poster-i18n";
import { Guide } from "@/components/poster/guide";
import { normalizeFacts, type CardFacts, type FactsResponse, type SavedProduct } from "@/lib/card-facts";
import { photoWishlist, applyOwnPhotos, type Wish } from "@/lib/photo-wishlist";
import type { Card } from "@/lib/types";

export default function PhotosPage() {
  const { lang } = useT();
  const hi = lang === "hi";
  const T = (en: string, h: string) => (hi ? h : en);
  const [facts, setFacts] = useState<CardFacts | null>(null);
  const [category, setCategory] = useState("");
  const [products, setProducts] = useState<SavedProduct[]>([]);
  const [card, setCard] = useState<Card | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [done, setDone] = useState<Record<string, string>>({});   // wish key → uploaded url
  const [applied, setApplied] = useState("");
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setErr("");
    try {
      const [r, cards] = await Promise.all([api<FactsResponse>("/api/card/facts"), fetchMyCardsStrict().catch(() => [] as Card[])]);
      if (!r.ok) { setErr(T("Could not load. Tap to try again.", "लोड नहीं हुआ। दोबारा दबाएँ।")); return; }
      const f = normalizeFacts(r.data.facts);
      setFacts(f); setCategory(r.data.setup?.category ?? ""); setProducts(r.data.products ?? []);
      setCard(cards.find((c) => c.id === f.primaryCardId) ?? cards[0] ?? null);
    } catch { setErr(T("No internet — tap to try again.", "internet नहीं — दोबारा दबाएँ।")); }
  }, [hi]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [load]);

  const wishes: Wish[] = facts ? photoWishlist({ category, facts, products, card, lang }) : [];
  const pending = wishes.filter((w) => !done[w.key] && w.slot !== "portrait" && w.slot !== "logo");

  async function upload(w: Wish, file: File | null) {
    if (!file || !facts) return;
    setBusy(w.key); setErr("");
    try {
      if (w.slot === "banner") {
        const url = await uploadImage(await compressToFile(file, "banner.jpg", 1800, 0.86), "wide");
        if (!url) throw new Error("upload");
        const next = { ...facts, bannerUrl: url };
        await api("/api/card/facts", { method: "PATCH", json: { facts: { bannerUrl: url } } });
        setFacts(next);
      } else if (w.slot === "photo") {
        const url = await uploadImage(await compressToFile(file, "photo.jpg", 1600, 0.85), "wide");
        if (!url) throw new Error("upload");
        const photos = [...facts.photos, url].slice(0, 12);
        await api("/api/card/facts", { method: "PATCH", json: { facts: { photos } } });
        setFacts({ ...facts, photos });
      } else if (w.slot === "product") {
        const url = await uploadImage(await compressToFile(file, "product.jpg", 1400, 0.86), "product");
        if (!url) throw new Error("upload");
        const r = await api<{ product?: { id: string } }>("/api/poster/products", { method: "POST", json: { id: w.productId, photos: [{ url, view: "front", role: "identity" }] } });
        if (!r.ok) throw new Error("save");
        setProducts((ps) => ps.map((p) => (p.id === w.productId ? { ...p, photo: url, images: [url] } : p)));
      }
      setDone((d) => ({ ...d, [w.key]: "ok" }));
      setDirty(true);
    } catch { setErr(T("Could not upload that photo. Please try again.", "वो photo upload नहीं हुई। दोबारा try करें।")); }
    finally { setBusy(""); }
  }

  async function apply() {
    if (!card || !facts) return;
    setBusy("apply"); setErr(""); setApplied("");
    try {
      const { card: next, changed } = applyOwnPhotos(card, facts, products);
      if (!changed.length) { setApplied(T("Your website already shows these photos.", "आपकी website पर ये photos पहले से हैं।")); setDirty(false); return; }
      const r = await publishCard(next);
      if (!r.ok) throw new Error(r.error);
      setCard(next); setDirty(false);
      setApplied(T(`Done — updated: ${changed.join(", ")}. Open your website to see.`, `हो गया — बदला: ${changed.join(", ")}। website खोल कर देखें।`));
    } catch { setErr(T("Could not update the website. Please try again.", "website update नहीं हुई। दोबारा try करें।")); }
    finally { setBusy(""); }
  }

  if (!facts) return err ? (
    <div className="py-20 grid place-items-center gap-3 text-center"><p className="font-semibold">{err}</p><button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl grad-brand px-5 py-3 text-base font-semibold text-white"><RefreshCw className="h-5 w-5" /> {T("Try again", "फिर कोशिश करें")}</button></div>
  ) : <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;

  const btn = "inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium cursor-pointer";
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/poster/site" className="text-muted"><ChevronLeft className="h-5 w-5" /></Link>
        <h1 className="text-lg font-bold flex-1">{T("Photos your website needs", "आपकी website को ये photos चाहिए")}</h1>
      </div>
      <Guide en="Real photos beat stock every time. Take these with your phone in daylight; we put each one in the right place." hi="असली photos stock से हमेशा बेहतर हैं। दिन की रोशनी में phone से लें; हर एक को सही जगह हम लगा देंगे।" />
      {err && <p className="text-sm text-danger">{err}</p>}
      {applied && <p className="rounded-xl border border-good/40 bg-good/10 px-3 py-2 text-sm font-semibold text-good">{applied}</p>}
      {!wishes.length && <p className="rounded-xl bg-surface2 px-3 py-3 text-sm">{T("Your website has every photo it needs. Add more any time from the company step.", "आपकी website के सारे photos पूरे हैं। और जोड़ने हों तो company step से।")}</p>}
      <div className="space-y-2">
        {wishes.map((w) => {
          const ok = !!done[w.key];
          const linkTo = w.slot === "portrait" ? "/poster/onboard?step=you" : w.slot === "logo" ? "/poster/onboard?step=site" : null;
          return (
            <div key={w.key} className={`flex items-center gap-3 rounded-xl border p-3 ${ok ? "border-good/40 bg-good/10" : "border-border"}`}>
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${ok ? "bg-good text-white" : "bg-surface2 text-muted"}`}>{ok ? <Check className="h-5 w-5" /> : busy === w.key ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug">{hi ? w.hi : w.en}</p>
                <p className="text-[11px] text-muted">{hi ? w.whyHi : w.why}</p>
              </div>
              {!ok && (linkTo ? (
                <Link href={linkTo} className={btn}>{T("Add", "जोड़ें")} →</Link>
              ) : (
                <div className="flex shrink-0 gap-1.5">
                  <label className={btn}><Camera className="h-3.5 w-3.5" /><input type="file" accept="image/*" capture="environment" className="hidden" disabled={!!busy} onChange={(e) => void upload(w, e.target.files?.[0] ?? null)} /></label>
                  <label className={btn}><Images className="h-3.5 w-3.5" /><input type="file" accept="image/*" className="hidden" disabled={!!busy} onChange={(e) => void upload(w, e.target.files?.[0] ?? null)} /></label>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {card && (
        <div className="sticky bottom-20 z-20 rounded-2xl border border-border bg-surface p-3 shadow-float">
          <button type="button" onClick={() => void apply()} disabled={busy === "apply" || (!dirty && !facts.bannerUrl && !facts.photos.length)} className="w-full inline-flex items-center justify-center gap-2 rounded-xl grad-brand py-3.5 text-base font-semibold text-white disabled:opacity-60">
            {busy === "apply" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} {T("Put them on my website", "website पर लगाओ")}
          </button>
          <p className="mt-1.5 text-center text-[11px] text-muted">{pending.length ? T(`${pending.length} still to add — you can apply now and add the rest later.`, `${pending.length} बाकी हैं — अभी लगा सकते हैं, बाक़ी बाद में।`) : T("Stock pictures are replaced by yours; nothing else changes.", "stock की जगह आपकी photos लगेंगी; बाक़ी कुछ नहीं बदलता।")}</p>
        </div>
      )}
    </div>
  );
}
