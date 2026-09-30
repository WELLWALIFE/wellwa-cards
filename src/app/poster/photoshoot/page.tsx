"use client";
// Product Photoshoot: one product photo in → 4 AI-generated catalog/social
// shots out (lifestyle, angle, marketplace white-bg, in-context). No video —
// just fast, ready-to-post images from a single phone photo.
import { AiPageGate } from "@/lib/ai-access";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, Camera, Images, ChevronLeft, Sparkles, Download, Share2 } from "lucide-react";
import { api, isLoggedIn, uploadImage, shareFile, downloadPoster } from "@/lib/poster-client";
import { compressToFile } from "@/lib/image-utils";
import { useT } from "@/lib/poster-i18n";
import { Guide } from "@/components/poster/guide";

type MyProduct = { id: string; name: string; photo_url: string | null; photos?: { url: string; role?: string }[] };
const SHOTS: Record<string, [string, string][]> = {
  lifestyle: [["lifestyle", "Lifestyle"], ["angle", "Different angle"], ["white", "White background"], ["scene", "In a setting"]],
  marketplace: [["front", "Front, white bg"], ["three-quarter", "3/4 angle"], ["detail", "Close-up detail"], ["scale", "In use / scale"]],
  model: [["model-f", "Woman using it"], ["model-m", "Man using it"], ["family", "Family"], ["hands", "Hands close-up"]],
  social: [["flatlay", "Flat-lay"], ["story", "Story 9:16"], ["feed", "Feed 4:5"], ["minimal", "Minimal"]],
};
const PER_PHOTO = 5;
type Shot = { key: string; label: string; url: string };

function PhotoshootPageInner() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const [ready, setReady] = useState(false);
  const [products, setProducts] = useState<MyProduct[]>([]);
  const SLOTS = [["front", "Front"], ["left", "Left side"], ["right", "Right side"], ["top", "Top"], ["back", "Back"]] as const;
  const [slots, setSlots] = useState<Record<string, string>>({}); // view → url
  const [slotBusy, setSlotBusy] = useState("");
  const refs = SLOTS.map(([k]) => slots[k]).filter(Boolean);
  const [zoom, setZoom] = useState("");
  const [off, setOff] = useState<string[]>([]); // shots the user switched off
  const [credits, setCredits] = useState<number | null>(null);
  
  const [product, setProduct] = useState("");
  const [category, setCategory] = useState("");
  const [preset, setPreset] = useState<"lifestyle" | "marketplace" | "model" | "social">("lifestyle");
  const chosen = SHOTS[preset].map(([k]) => k).filter((k) => !off.includes(k));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [shots, setShots] = useState<Shot[] | null>(null);
  const [busyAction, setBusyAction] = useState("");

  useEffect(() => { (async () => {
    if (!(await isLoggedIn())) { router.push("/login?next=/poster/photoshoot"); return; }
    setReady(true);
    fetch("/api/media/jobs", { cache: "no-store" }).then((x) => x.json()).then((j) => typeof j.credits === "number" && setCredits(j.credits)).catch(() => {});
    api<{ products?: MyProduct[] }>("/api/poster/products").then((r) => setProducts(r.data.products ?? [])).catch(() => {});
  })(); }, [router]);

  function fillFromProduct(id: string) {
    const p = products.find((x) => x.id === id); if (!p) return;
    setProduct(p.name); const all = (p.photos ?? []).filter((x) => x.role !== "context").map((x) => x.url); const list = (all.length ? all : p.photo_url ? [p.photo_url] : []).slice(0, 5); const byView: Record<string, string> = {}; const vmap: Record<string, string> = { front: "front", three_quarter: "right", back: "back" }; const free = ["front", "left", "right", "top", "back"]; (p.photos ?? []).forEach((x) => { const v = vmap[(x as { view?: string }).view ?? ""]; if (v && !byView[v] && list.includes(x.url)) byView[v] = x.url; }); list.forEach((u) => { if (!Object.values(byView).includes(u)) { const k = free.find((f) => !byView[f]); if (k) byView[k] = u; } }); setSlots(byView);
  }
  async function pick(file: File | null, view: string) {
    if (!file) return; setSlotBusy(view); setErr("");
    const small = await compressToFile(file, "photoshoot.jpg");
    const u = await uploadImage(small, "product");
    setSlotBusy("");
    if (u) setSlots((x) => ({ ...x, [view]: u })); else setErr("Photo upload failed.");
  }
  async function generate() {
    setBusy(true); setErr(""); setShots(null);
    const r = await api<{ photos?: Shot[]; error?: string }>("/api/poster/photoshoot", { method: "POST", json: { photo_urls: SLOTS.filter(([k]) => slots[k]).map(([k]) => slots[k]), views: SLOTS.filter(([k]) => slots[k]).map(([k]) => k), product, category, preset, shots: chosen } });
    fetch("/api/media/jobs", { cache: "no-store" }).then((x) => x.json()).then((j) => typeof j.credits === "number" && setCredits(j.credits)).catch(() => {});
    setBusy(false);
    if (!r.ok) { setErr(r.data.error || (hi ? "Kuch gadbad hui." : "Something went wrong.")); return; }
    setShots(r.data.photos ?? []);
  }
  const fileName = (url: string) => (url.split("/").pop() || "photoshoot.png").split("?")[0]; // unique per photo — a fixed name made every download overwrite the last one
  async function share(url: string) { setBusyAction(url); await shareFile(url, product, fileName(url), "image/png"); setBusyAction(""); }
  function useInAd() { try { sessionStorage.setItem("akp-ad-seed", JSON.stringify({ product, category, photos: [...refs, ...(shots ?? []).map((x) => x.url)].slice(0, 5) })); } catch { /* ignore */ } router.push("/poster/video"); }
  async function download(url: string) { setBusyAction(url + "dl"); await downloadPoster(url, fileName(url)); setBusyAction(""); }

  if (!ready) return <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const inp = "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/poster/create" className="text-muted"><ChevronLeft className="h-5 w-5" /></Link>
        <h1 className="text-lg font-bold flex-1">📸 {hi ? "Product Photoshoot" : "Product Photoshoot"}</h1>
      </div>
      <Guide hi="Add one photo — AI makes 4 different professional shots: lifestyle, another angle, marketplace white-background, and in a real setting. Ready for your catalog or social posts." en="Add one photo — AI makes 4 different professional shots: lifestyle, another angle, marketplace white-background, and in a real setting. Ready for your catalog or social posts." />

      <div className="rounded-xl border border-border p-3 space-y-3">
        {products.length > 0 && (
          <div className="rounded-xl border border-brand/40 bg-brand-soft/40 p-2.5">
            <label className="text-xs font-semibold text-brand-ink block mb-1">{hi ? "⚡ Mere kisi product se bharein" : "⚡ Fill from one of my products"}</label>
            <select onChange={(e) => e.target.value && fillFromProduct(e.target.value)} defaultValue="" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm">
              <option value="">{hi ? "-- chunein --" : "-- choose --"}</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <p className="text-sm font-semibold mb-1">Product photos ({refs.length}/5)</p>
          <p className="text-xs text-muted mb-1.5">Front is required. Add the other sides too — the more sides the AI sees, the more exactly it copies your product.</p>
          <div className="grid grid-cols-5 gap-1.5">
            {SLOTS.map(([k, label]) => (
              <div key={k} className="space-y-1 text-center">
                {slots[k] ? (
                  <span className="relative block aspect-square overflow-hidden rounded-xl border border-border">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={slots[k]} alt={label} className="h-full w-full object-cover" onClick={() => setZoom(slots[k])} /><button type="button" onClick={() => setSlots((x) => { const n = { ...x }; delete n[k]; return n; })} className="absolute right-0.5 top-0.5 rounded-full bg-black/60 px-1.5 text-[11px] text-white" aria-label={`Remove ${label}`}>×</button></span>
                ) : (
                  <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border border-dashed border-border bg-surface2">{slotBusy === k ? <LoaderCircle className="h-5 w-5 animate-spin text-muted" /> : <Camera className="h-5 w-5 text-muted" />}<input type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? null, k)} /></label>
                )}
                <span className={`block text-[10px] leading-tight ${k === "front" ? "font-semibold" : "text-muted"}`}>{label}{k === "front" ? " *" : ""}</span>
              </div>
            ))}
          </div>
        </div>
        <input className={inp} placeholder={hi ? "Product ka naam *" : "Product name *"} value={product} onChange={(e) => setProduct(e.target.value)} />
        <input className={inp} placeholder={hi ? "Category (optional)" : "Category (optional)"} value={category} onChange={(e) => setCategory(e.target.value)} />
        <div>
          <p className="text-xs font-semibold text-muted mb-1">Shoot type</p>
          <div className="grid grid-cols-2 gap-2">
            {([["lifestyle", "Lifestyle", "Real use, angle, white bg, setting"], ["marketplace", "Marketplace", "Amazon / Flipkart: white bg, 3/4, detail, scale"], ["model", "With a model", "Woman / man / family / hands using it"], ["social", "Social", "Flat-lay, 9:16 story, 4:5 feed, minimal"]] as const).map(([k, l, d]) => (
              <button key={k} type="button" onClick={() => { setPreset(k); setOff([]); }} className={`rounded-xl border-2 p-2.5 text-left ${preset === k ? "border-brand bg-brand-soft" : "border-border"}`}><span className="block text-sm font-semibold">{l}</span><span className="block text-[11px] text-muted leading-tight">{d}</span></button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted mb-1">Which photos? ({PER_PHOTO} credits each)</p>
          <div className="flex flex-wrap gap-1.5">{SHOTS[preset].map(([k, l]) => { const on = !off.includes(k); return <button key={k} type="button" onClick={() => setOff(on ? [...off, k] : off.filter((x) => x !== k))} className={`rounded-full border px-3 py-1.5 text-xs ${on ? "border-brand bg-brand-soft text-brand-ink font-semibold" : "border-border text-muted"}`}>{on ? "✓ " : ""}{l}</button>; })}</div>
        </div>
        {err && <p className="text-sm text-danger">{err}</p>}
        <button type="button" onClick={generate} disabled={busy || !slots.front || product.trim().length < 2 || !chosen.length} className="w-full inline-flex items-center justify-center gap-2 rounded-xl grad-brand px-4 py-3.5 text-base font-semibold text-white disabled:opacity-50">
          {busy ? <span className="inline-flex items-center gap-2"><LoaderCircle className="h-5 w-5 animate-spin" /> {hi ? "बन रहा है… (~30 sec)" : "Generating… (~30 s)"}</span> : <><Sparkles className="h-5 w-5" /> Make {chosen.length} photo{chosen.length === 1 ? "" : "s"} · {chosen.length * PER_PHOTO} credits{credits !== null ? ` (you have ${credits})` : ""}</>}
        </button>
      </div>

      {shots && shots.length > 0 && <button type="button" onClick={useInAd} className="w-full rounded-xl border-2 border-brand bg-brand-soft px-4 py-3 text-sm font-semibold text-brand-ink">🎬 Make an AI ad with these photos →</button>}
      {zoom && <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-3" onClick={() => setZoom("")}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={zoom} alt="" className="max-h-full max-w-full rounded-lg object-contain" /><button type="button" className="absolute right-4 top-4 rounded-full bg-white/20 px-3 py-1 text-white" aria-label="Close">✕</button></div>}
      {shots && (
        <div className="grid grid-cols-2 gap-2">
          {shots.map((s) => (
            <div key={s.key} className="rounded-xl border border-border overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.url} alt={s.label} className="w-full aspect-square object-cover cursor-zoom-in" onClick={() => setZoom(s.url)} />
              <div className="p-2 space-y-1.5">
                <p className="text-xs font-semibold">{s.label}</p>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => share(s.url)} disabled={busyAction === s.url} className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-[#25D366] px-2 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60">{busyAction === s.url ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />} Share</button>
                  <button type="button" onClick={() => download(s.url)} disabled={busyAction === s.url + "dl"} className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-60">{busyAction === s.url + "dl" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PhotoshootPage() {
  return <AiPageGate title="AI product photoshoot" reason="One photo of your product becomes professional lifestyle and marketplace photos."><PhotoshootPageInner /></AiPageGate>;
}
