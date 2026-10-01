"use client";
// "My products": the one place a product is saved. Photo, name and ₹ price are all most shops need — everything
// else sits under "More details". The same rows feed the V-Card, the website and the daily posters.
// Owner's call (26 Sep 2026): two prices — the offer price and an optional MRP. When the MRP is higher, the card
// shows it struck out next to the offer price, with "% OFF" and "You save ₹…" (card-compose / card-view).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, Plus, Trash2, Camera, Images, ChevronLeft, RefreshCw } from "lucide-react";
import { api, isLoggedIn, uploadImage } from "@/lib/poster-client";
import { fetchMyCardsStrict } from "@/lib/cloud";
import { compressToFile } from "@/lib/image-utils";
import { useT } from "@/lib/poster-i18n";
import { Guide } from "@/components/poster/guide";
import { ProductCheckSheet } from "@/components/poster/product-check-sheet";
import { PHOTO_VIEWS, type ProductPhoto, type PhotoView } from "@/lib/media/product-facts";


type Product = { id: string; name: string; brand_id?: string | null; photo_url: string | null; benefits: string[]; offer: string; active: boolean; category?: string; price?: string; mrp?: string | null; brand?: string; photos?: ProductPhoto[]; facts_confirmed_at?: string | null };
type Draft = { id?: string; name: string; photo_url: string | null; benefits: string; offer: string; category: string; price: string; mrp?: string; brand: string; photos: ProductPhoto[] };

const EMPTY: Draft = { name: "", photo_url: null, benefits: "", offer: "", category: "", price: "", mrp: "", brand: "", photos: [] };

/** The first number in a price ("1,200/kg" → 1200), or NaN — the same reading as card-compose. */
const amount = (v: string | null | undefined) => { const m = /\d[\d,]*(?:\.\d+)?/.exec(v ?? ""); return m ? Number(m[0].replace(/,/g, "")) : NaN; };
/** ₹ only before a number ("₹On request" / "₹FREE" read wrong). */
const rs = (v: string) => (/^\s*[\d,.]/.test(v) ? `₹${v.trim()}` : v.trim());
/** The MRP is shown (struck out) only when it is more than the offer price — exactly when the card shows it. */
const mrpShown = (price: string | null | undefined, mrp: string | null | undefined) => !!(price?.trim() && mrp?.trim()) && amount(mrp) > amount(price);

export default function ProductsPage() {
  const router = useRouter();
  const { t, lang } = useT();
  const en = lang === "en";
  const [list, setList] = useState<Product[] | null>(null);
  // ?setup=1 — reached from the setup journey: show the way on to the card (with or without products).
  const [setupMode, setSetupMode] = useState(false);
  useEffect(() => { try { setSetupMode(new URLSearchParams(window.location.search).get("setup") === "1"); } catch { /* ignore */ } }, []);
  const [brandAdmin, setBrandAdmin] = useState<string | null>(null);
  const [forBrand, setForBrand] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [checking, setChecking] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // A 401/500/503 is NOT an empty shop: api() resolves on any status, so the status is checked before the
  // list is replaced — otherwise a returning owner is told "No products yet" and adds everything again.
  async function load() {
    setErr("");
    try {
      const r = await api<{ products?: Product[]; brand_admin_of?: string | null; error?: string }>("/api/poster/products");
      if (!r.ok) { setErr(r.data?.error || t.error); return; }
      setList(r.data.products ?? []); setBrandAdmin(r.data.brand_admin_of ?? null);
    } catch {
      setErr(t.error);
    }
  }
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.push("/login?next=/poster/products"); return; } load(); })(); }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!draft) return;
    if (draft.mrp?.trim() && !draft.price.trim()) { setErr(en ? "Write the offer price too — the MRP is shown struck out next to it." : "ऑफ़र दाम भी लिखें — MRP उसके साथ कटा हुआ दिखता है।"); return; }
    setBusy(true); setErr("");
    try {
      const r = await api<{ product?: Product; error?: string }>("/api/poster/products", { method: "POST", json: {
        ...draft, benefits: draft.benefits.split("\n"), ...(brandAdmin ? { for_brand: forBrand } : {}),
      } });
      if (!r.ok) { setErr(r.data.error || t.saveFail); return; }
      setDraft(null); await load();
    } catch {
      setErr(t.saveFail);
    } finally {
      setBusy(false);
    }
  }
  async function pick(file: File | null) {
    if (!file || !draft) return; if (draft.photos.length >= 6) { setErr("Up to 6 photos."); return; }
    setBusy(true); setErr("");
    try {
      const small = await compressToFile(file, "product.jpg");
      const u = await uploadImage(small, "product");
      if (!u) { setErr("Could not upload the photo. Please try again."); return; }
      const view: PhotoView = draft.photos.length === 0 ? "front" : "other";
      setDraft({ ...draft, photo_url: draft.photo_url ?? u, photos: [...draft.photos, { url: u, view, role: "identity" }] });
    } catch {
      setErr("Could not upload the photo. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function fillWithAi() {
    if (!draft) return; setBusy(true); setErr("");
    try {
      const r = await api<{ name?: string; benefits?: string[]; offer?: string; error?: string }>("/api/poster/products/ai", { method: "POST", json: { name: draft.name, photo_url: draft.photo_url, lang: en ? "en" : "hi" } });
      if (!r.ok) { setErr(r.data.error || t.error); return; }
      setDraft({ ...draft, name: draft.name || r.data.name || "", benefits: (r.data.benefits ?? []).map((x) => String(x).trim()).filter(Boolean).slice(0, 6).join("\n"), offer: draft.offer || r.data.offer || "" });
    } catch {
      setErr(t.error);
    } finally {
      setBusy(false);
    }
  }
  // No products of their own? Anyone can sell Shubhora itself — the same three plans as the V-Card seller template,
  // with the curated plan pictures (served by /api/stock, accepted by the products API as same-site paths).
  const SHUBHORA: Draft[] = [
    { name: "Shubhora AI Business Assistant — Growth", price: "2,999 / month", brand: "Shubhora", category: "Shubhora", photo_url: "/api/stock/vcard/plan-growth.jpg", photos: [{ url: "/api/stock/vcard/plan-growth.jpg", view: "front", role: "identity" }],
      offer: "Pre-launch: join free, book your city's top ID", benefits: ["Digital V-Card + full website on one link", "AI assistant answers customers on WhatsApp 24×7", "Daily poster + status video, auto-posted", "Leads saved in your CRM"].join("\n") },
    { name: "Shubhora Custom Solutions — Software & Automation", price: "On request — contact us", brand: "Shubhora", category: "Shubhora", photo_url: "/api/stock/vcard/plan-pro.jpg", photos: [{ url: "/api/stock/vcard/plan-pro.jpg", view: "front", role: "identity" }],
      offer: "We make all kinds of software — tell us what you need", benefits: ["Dedicated account manager", "Custom software, apps and websites", "Automation of daily work", "Custom CRM / ERP and dashboards", "AI assistants trained on your business"].join("\n") },
    { name: "Free Digital V-Card", price: "FREE for 1 year (worth ₹1,499)", brand: "Shubhora", category: "Shubhora", photo_url: "/api/stock/vcard/plan-free.jpg", photos: [{ url: "/api/stock/vcard/plan-free.jpg", view: "front", role: "identity" }],
      offer: "", benefits: ["Complete digital card on your own link", "Your own domain on the card", "Leads from the card in the CRM", "Share on WhatsApp, QR code, save-contact"].join("\n") },
  ];
  const hasShubhora = (list ?? []).some((p) => /shubhora/i.test(p.name) || /shubhora/i.test(p.brand ?? ""));
  const offCount = (list ?? []).filter((p) => p.active === false).length;
  const isShubhoraPlan = (p: Product) => /shubhora/i.test(p.name) || /shubhora/i.test(p.brand ?? "") || /shubhora/i.test(p.category ?? "");
  const mixedWithShubhora = (list ?? []).some((p) => p.active !== false && isShubhoraPlan(p)) && (list ?? []).some((p) => p.active !== false && !isShubhoraPlan(p));
  async function hideShubhora() {
    for (const p of (list ?? []).filter((x) => x.active !== false && isShubhoraPlan(x))) {
      await api("/api/poster/products", { method: "POST", json: { id: p.id, active: false } });
    }
    load();
  }
  /** Keep the row, keep it off the card: the build only takes active products. */
  async function toggle(p: Product) {
    setList((cur) => (cur ?? []).map((x) => (x.id === p.id ? { ...x, active: p.active === false } : x)));
    const r = await api<{ error?: string }>("/api/poster/products", { method: "POST", json: { id: p.id, active: p.active === false } });
    if (!r.ok) { setErr(r.data.error || t.saveFail); load(); }
  }
  async function promoteShubhora() {
    setBusy(true); setErr("");
    try {
      for (const d of SHUBHORA) {
        const r = await api<{ error?: string }>("/api/poster/products", { method: "POST", json: { ...d, benefits: d.benefits.split("\n") } });
        if (!r.ok) { setErr(r.data.error || t.saveFail); return; }
      }
      // …then straight into the ready-made Shubhora seller card (banner, logo, plans, demo videos, business plan).
      const cards = await fetchMyCardsStrict().catch(() => []);
      router.push(cards[0] ? `/poster/d/editor?id=${cards[0].id}&template=vcard-reseller` : "/poster/d/editor?id=new&template=vcard-reseller");
    } catch { setErr(t.saveFail); setBusy(false); }
  }
  async function remove(p: Product) {
    if (!confirm(`Delete "${p.name}"?`)) return;
    try { await api(`/api/poster/products?id=${p.id}`, { method: "DELETE" }); } catch { setErr(t.error); return; }
    load();
  }

  if (list === null) return err ? (
    <div className="py-20 grid place-items-center gap-3 text-center">
      <p className="font-semibold">{err}</p>
      <button type="button" onClick={() => load()} className="inline-flex items-center gap-2 rounded-xl grad-brand px-5 py-3 text-base font-semibold text-white">
        <RefreshCw className="h-5 w-5" /> {en ? "Try again" : "फिर कोशिश करें"}
      </button>
    </div>
  ) : <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const inp = "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand";
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/poster/setup" className="text-muted"><ChevronLeft className="h-5 w-5" /></Link>
        <h1 className="text-lg font-bold flex-1">{t.productsTitle}</h1>
        {!draft && <button type="button" onClick={() => { setForBrand(false); setDraft({ ...EMPTY }); }} className="inline-flex items-center gap-1 rounded-full grad-brand px-3 py-1.5 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> {t.addProduct}</button>}
      </div>
      <Guide hi="साफ़ फ़ोटो, नाम और ₹ दाम डालें। यही आपके V-Card, website और रोज़ के poster पर दिखेगा।" en="Add a clear photo, name and price. It shows on your V-Card, website and daily posters." />
      {draft && (
        <div className="rounded-xl border border-brand bg-brand-soft/40 p-3 space-y-3">
          <div className="flex items-center gap-3">
            <span className="h-20 w-20 rounded-xl bg-surface border border-border grid place-items-center overflow-hidden shrink-0">
              {draft.photo_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={draft.photo_url} alt="" className="h-full w-full object-contain" /> : busy ? <LoaderCircle className="h-5 w-5 animate-spin text-muted" /> : <Camera className="h-6 w-6 text-muted" />}
            </span>
            <div className="flex-1 space-y-1.5">
              <span className="text-sm font-semibold block">{t.productPhoto}</span>
              <div className="flex gap-2">
                <label className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium cursor-pointer">
                  <Camera className="h-3.5 w-3.5" /> {en ? "Camera" : "कैमरा"}
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
                </label>
                <label className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium cursor-pointer">
                  <Images className="h-3.5 w-3.5" /> {en ? "Gallery" : "Gallery"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
                </label>
              </div>
            </div>
          </div>
          <input className={inp} placeholder={t.productName} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          {/* Two prices: the offer price (what the customer pays) and, if there is a discount, the MRP. */}
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1">
              <span className="block text-xs font-semibold">{en ? "Offer price ₹" : "ऑफ़र दाम ₹"}</span>
              <input className={inp} inputMode="decimal" placeholder={en ? "e.g. 900 per kg" : "जैसे 900 per kg"} value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
            </label>
            <label className="block space-y-1">
              <span className="block text-xs font-semibold">MRP ₹ <span className="font-normal text-muted">(optional)</span></span>
              <input className={inp} inputMode="decimal" placeholder={en ? "e.g. 1,100" : "जैसे 1,100"} value={draft.mrp ?? ""} onChange={(e) => setDraft({ ...draft, mrp: e.target.value })} />
            </label>
          </div>
          {mrpShown(draft.price, draft.mrp) && (() => {
            const off = Math.round(((amount(draft.mrp) - amount(draft.price)) / amount(draft.mrp)) * 100);
            return (
              <p className="text-xs text-muted">
                {en ? "On your card:" : "Card पर:"} <b className="text-ink">{rs(draft.price)}</b> <s>{rs(draft.mrp ?? "")}</s>
                {off > 0 && <span className="ml-1.5 rounded bg-good/10 px-1 py-0.5 text-[11px] font-semibold text-good">{off}% OFF</span>}
              </p>
            );
          })()}
          {!!draft.mrp?.trim() && !!draft.price.trim() && !mrpShown(draft.price, draft.mrp) && (
            <p className="text-xs text-muted">{en ? "The MRP shows on the card only when it is more than the offer price." : "MRP card पर तभी दिखेगा जब वह ऑफ़र दाम से ज़्यादा हो।"}</p>
          )}
          <input className={inp} placeholder={en ? "Brand (optional) — only if you sell a company's product" : "Brand (optional) — सिर्फ़ किसी कंपनी का product बेचते हों तो"} value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} />

          <details className="rounded-lg border border-border bg-surface/70">
            <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold">{en ? "More details (optional)" : "और जानकारी (optional)"}</summary>
            <div className="space-y-3 border-t border-border p-3">
              {draft.photos.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted">Photos for AI videos ({draft.photos.length}/6) — tell us what each one shows. Most useful: a photo of the product <b>working / in use</b>.</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {draft.photos.map((ph, i) => (
                      <div key={ph.url} className="w-24 shrink-0 space-y-1">
                        <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-border bg-surface">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={ph.url} alt="" className="h-full w-full object-contain" />
                          {!ph.generated_crop && <button type="button" onClick={() => { const photos = draft.photos.filter((_, k) => k !== i); setDraft({ ...draft, photos, photo_url: photos[0]?.url ?? null }); }} className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white" aria-label="Remove photo"><Trash2 className="h-3 w-3" /></button>}
                        </div>
                        <select value={ph.view} disabled={!!ph.generated_crop} onChange={(e) => setDraft({ ...draft, photos: draft.photos.map((x, k) => (k === i ? { ...x, view: e.target.value as PhotoView } : x)) })} className="w-full rounded-md border border-border bg-surface px-1 py-1 text-[11px]">
                          {PHOTO_VIEWS.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button type="button" disabled={busy || (!draft.name && !draft.photo_url)} onClick={fillWithAi}
                className="w-full rounded-lg border border-brand bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-ink disabled:opacity-50">✨ {en ? "Fill benefits/offer with AI (from the photo)" : "AI से खूबियाँ/ऑफ़र भरो (photo देखकर)"}</button>
              <textarea className={`${inp} w-full leading-relaxed`} rows={5} placeholder={t.benefitsHint} value={draft.benefits} onChange={(e) => setDraft({ ...draft, benefits: e.target.value })} />
              <input className={inp} placeholder={t.offerLabel} value={draft.offer} onChange={(e) => setDraft({ ...draft, offer: e.target.value })} />
              <input className={inp} list="product-cats" placeholder={en ? "Category (optional) e.g. Sweets, Namkeen, Gifts" : "Category (optional) जैसे Sweets, Namkeen, Gifts"} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
              <datalist id="product-cats">{[...new Set((list ?? []).map((p) => p.category).filter(Boolean))].map((c) => <option key={c} value={c} />)}</datalist>
              {brandAdmin && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={forBrand} onChange={(e) => setForBrand(e.target.checked)} /> {en ? "For the whole team (company product)" : "पूरी team / सभी members के लिए (company product)"}</label>}
            </div>
          </details>

          {err && <p className="text-sm text-danger">{err}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setDraft(null)} className="rounded-xl border border-border px-4 py-2.5 text-sm">✕</button>
            <button type="button" onClick={save} disabled={busy || !draft.name.trim()} className="flex-1 rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{t.save}</button>
          </div>
        </div>
      )}
      {/* A seller who later adds their own range ends up with both on one card. One tap keeps the plans off it. */}
      {mixedWithShubhora && (
        <div className="rounded-xl border border-amber/50 bg-amber/10 p-3">
          <p className="text-sm font-semibold">{en ? "Shubhora's plans are on your card next to your own products." : "आपके अपने products के साथ Shubhora के plan भी card पर हैं।"}</p>
          <p className="mt-0.5 text-xs text-muted">{en ? "Selling Shubhora too? Leave them. Otherwise hide them — they stay here for later." : "Shubhora भी बेचते हैं? रहने दें। वरना छिपा दें — यहीं रखे रहेंगे।"}</p>
          <button type="button" onClick={hideShubhora} className="mt-2 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm font-semibold">{en ? "Hide the Shubhora plans" : "Shubhora के plan छिपाएँ"}</button>
        </div>
      )}
      {offCount > 0 && (
        <p className="rounded-xl bg-surface2 px-3 py-2 text-xs text-muted">{en
          ? `${offCount} product${offCount > 1 ? "s" : ""} hidden — they stay here but do not go on your card, website or posters.`
          : `${offCount} product छिपे हैं — यहाँ रहेंगे, पर card, website और poster पर नहीं जाएँगे।`}</p>
      )}
      <div className="space-y-2">
        {list.map((p) => (
          <div key={p.id} className={`flex items-center gap-3 rounded-xl border p-3 ${p.active === false ? "border-border bg-surface2 opacity-70" : "border-border"}`}>
            <div className="h-14 w-14 rounded-lg bg-surface2 overflow-hidden grid place-items-center shrink-0">{p.photo_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.photo_url} alt="" className="h-full w-full object-contain" /> : "📦"}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{p.name}</p>
              {/* ₹ only before a number ("₹On request" / "₹FREE" read wrong); no internal counts like "0 lines". */}
              <p className="text-xs text-muted truncate">{p.price ? <b className="text-ink">{rs(p.price)}</b> : null}{mrpShown(p.price, p.mrp) ? <> <s>{rs(p.mrp ?? "")}</s></> : null}{p.price && (p.brand || p.category) ? " · " : ""}{[p.brand, p.category].filter(Boolean).join(" · ")}</p>
            </div>
            {!setupMode && <button type="button" onClick={() => setChecking(p)} className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${p.facts_confirmed_at ? "border-good/40 bg-good/10 text-good" : "border-lead/50 bg-lead/10 text-lead"}`}>{p.facts_confirmed_at ? "✓ Product check" : "Product check"}</button>}
            <button type="button" onClick={() => { setForBrand(!!brandAdmin && p.brand_id === brandAdmin); setDraft({ id: p.id, name: p.name, photo_url: p.photo_url, benefits: (p.benefits ?? []).join("\n"), offer: p.offer ?? "", category: p.category ?? "", price: p.price ?? "", mrp: p.mrp ?? "", brand: p.brand ?? "", photos: p.photos?.length ? p.photos : p.photo_url ? [{ url: p.photo_url, view: "front", role: "identity" }] : [] }); }} className="p-2 text-muted text-xs">Edit</button>
            {/* One tap decides whether this product is on the card at all — the Shubhora plans and an old
                range do not have to be deleted to be kept off it. */}
            <button type="button" onClick={() => toggle(p)} title={p.active === false ? (en ? "Show on my card" : "Card पर दिखाओ") : (en ? "Hide from my card" : "Card से हटाओ")}
              className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${p.active === false ? "border-border text-muted" : "border-good/40 bg-good/10 text-good"}`}>
              {p.active === false ? (en ? "Hidden" : "छिपा है") : (en ? "On card" : "Card पर")}
            </button>
            <button type="button" onClick={() => remove(p)} className="p-2 text-muted"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        {/* Setup journey: the person just chose "my own business" — selling Shubhora is not offered here. */}
        {!draft && !hasShubhora && !setupMode && (
          <div className={`rounded-xl border p-3 ${list.length === 0 ? "border-brand bg-brand-soft/40" : "border-border"}`}>
            <p className="text-sm font-semibold">{en ? "No products of your own? Sell the V-Card itself." : "Apna koi product nahi? V-Card hi sell karo."}</p>
            <p className="mt-0.5 text-xs text-muted">{en ? "Adds the 3 Shubhora plans (Free, Growth ₹2,999, Custom Solutions) as your products for posters, and opens the ready-made Shubhora seller card — banner, logo, plans, demo videos and the business plan. Put your name and number on it and publish." : "Shubhora ke 3 plan (Free, Growth ₹2,999, Custom Solutions) poster ke liye product ban jaayenge, aur Shubhora ka bana-banaya seller card khulega — banner, logo, plans, demo video, business plan. Apna naam-number daal ke publish kar do."}</p>
            <button type="button" onClick={promoteShubhora} disabled={busy} className="mt-2 inline-flex items-center gap-1.5 rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {en ? "Make my Shubhora seller card" : "Shubhora seller card banao"}
            </button>
            {err && <p className="mt-2 text-sm text-danger">{err}</p>}
          </div>
        )}
        {list.length === 0 && !draft && <p className="text-sm text-muted">{en ? "No products yet. Add your first one — it shows on your V-Card, website and posters." : "अभी कोई product नहीं है। पहला जोड़ें — यह आपके V-Card, website और poster पर दिखेगा।"}</p>}
      </div>
      {/* Setup journey (?setup=1): a product is not required to make the card — one clear way on, with or without. */}
      {setupMode && !draft && (
        <div className="sticky bottom-20 z-20 rounded-2xl border border-border bg-surface p-3 shadow-float">
          <Link href="/poster/card/build" className="w-full inline-flex items-center justify-center gap-2 rounded-xl grad-brand py-3.5 text-base font-semibold text-white">
            {list.length > 0 ? (en ? "Continue — make my V-Card →" : "आगे — मेरा V-Card बनाओ →") : (en ? "Skip — add products later →" : "अभी नहीं — products बाद में →")}
          </Link>
          {list.length === 0 && <p className="mt-1.5 text-center text-[11px] text-muted">{en ? "Your card is made without products; add them any time from here." : "Card बिना products के बन जाएगा; बाद में यहीं से कभी भी जोड़ें।"}</p>}
        </div>
      )}
      {checking && <ProductCheckSheet productId={checking.id} productName={checking.name} onClose={() => { setChecking(null); load(); }} />}
    </div>
  );
}
