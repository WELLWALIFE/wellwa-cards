"use client";
// Product Photoshoot: one product photo in → 4 AI-generated catalog/social
// shots out (lifestyle, angle, marketplace white-bg, in-context). No video —
// just fast, ready-to-post images from a single phone photo.
import { AiPageGate } from "@/lib/ai-access";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Camera, Images, ChevronLeft, Sparkles, Download, Share2 } from "lucide-react";
import { api, isLoggedIn, uploadImage, shareFile, downloadPoster } from "@/lib/poster-client";
import { compressToFile } from "@/lib/image-utils";
import { useT } from "@/lib/poster-i18n";
import { Guide } from "@/components/poster/guide";
import { AddCredits } from "@/components/poster/add-credits";
import { goBack } from "@/lib/nav-back";

type MyProduct = { id: string; name: string; photo_url: string | null; photos?: { url: string; role?: string }[] };
const SHOTS: Record<string, [string, string, string][]> = {
  lifestyle: [["lifestyle", "In daily use", "रोज़ के इस्तेमाल में"], ["angle", "From another side", "दूसरी तरफ़ से"], ["white", "White background", "सफ़ेद background पर"], ["scene", "In a real place", "असली जगह पर"]],
  marketplace: [["front", "Front, white background", "सामने से, सफ़ेद background"], ["three-quarter", "A little from the side", "थोड़ा साइड से"], ["detail", "Close-up", "पास से"], ["scale", "In use", "इस्तेमाल करते हुए"]],
  model: [["model-f", "Woman using it", "महिला इस्तेमाल करते हुए"], ["model-m", "Man using it", "पुरुष इस्तेमाल करते हुए"], ["family", "Family", "परिवार"], ["hands", "Hands, close-up", "हाथों के साथ, पास से"]],
  social: [["flatlay", "From above", "ऊपर से"], ["story", "Tall, for Status or Story", "लंबी, Status या Story के लिए"], ["feed", "For a Feed post", "Feed post के लिए"], ["minimal", "Clean and simple", "साफ़ और सादी"]],
};
const PER_PHOTO = 5;
// The finished photos are kept for a short while when the owner goes on to "Make a video ad with these photos", so Back from there
// lands on the same photos (not an empty form after 5 credits a photo). It is read once, and only if it is fresh.
const SNAP_KEY = "akp-photoshoot-snap";
const SNAP_MINUTES = 30;
type Shot = { key: string; label: string; url: string };

function PhotoshootPageInner() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const [ready, setReady] = useState(false);
  const [products, setProducts] = useState<MyProduct[]>([]);
  const SLOTS = [["front", hi ? "सामने" : "Front"], ["left", hi ? "बाईं तरफ़" : "Left side"], ["right", hi ? "दाईं तरफ़" : "Right side"], ["top", hi ? "ऊपर" : "Top"], ["back", hi ? "पीछे" : "Back"]] as const;
  const [slots, setSlots] = useState<Record<string, string>>({}); // view → url
  const [slotBusy, setSlotBusy] = useState("");
  const refs = SLOTS.map(([k]) => slots[k]).filter(Boolean);
  const [zoom, setZoom] = useState("");
  const [off, setOff] = useState<string[]>([]); // shots the user switched off
  const [credits, setCredits] = useState<number | null>(null);
  
  const [product, setProduct] = useState("");
  const [category, setCategory] = useState("");
  const [preset, setPreset] = useState<"lifestyle" | "marketplace" | "model" | "social">("lifestyle");
  const shotName = (key: string, fallback: string) => { for (const list of Object.values(SHOTS)) { const m = list.find((x) => x[0] === key); if (m) return hi ? m[2] : m[1]; } return fallback; };
  const chosen = SHOTS[preset].map(([k]) => k).filter((k) => !off.includes(k));
  const [busy, setBusy] = useState(false);
  // Messages sit beside the control that caused them: slotErr under the five photo slots (also "add the front photo first"),
  // nameErr under the name field, err (and the credit packs) right above "Make photos" (server errors, "pick a photo"), shotMsg under that photo's Share / Download buttons.
  const [err, setErr] = useState("");
  const [slotErr, setSlotErr] = useState("");
  const [nameErr, setNameErr] = useState("");   // "Write the product name first" — right under the name field
  const [needCredits, setNeedCredits] = useState<number | null>(null);
  const [shotMsg, setShotMsg] = useState<Record<string, { t: string; ok: boolean; neutral?: boolean }>>({});
  const slotsRef = useRef<HTMLDivElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const [shots, setShots] = useState<Shot[] | null>(null);
  const [busyAction, setBusyAction] = useState("");

  useEffect(() => { (async () => {
    if (!(await isLoggedIn())) { router.replace("/login?next=/poster/photoshoot"); return; }
    setReady(true);
    try {
      const snap = JSON.parse(sessionStorage.getItem(SNAP_KEY) || "null"); sessionStorage.removeItem(SNAP_KEY);
      if (snap && Array.isArray(snap.shots) && snap.shots.length && Date.now() - Number(snap.at) < SNAP_MINUTES * 60_000) {
        setProduct(String(snap.product ?? "")); setCategory(String(snap.category ?? "")); if (snap.preset in SHOTS) setPreset(snap.preset);
        setSlots(snap.slots && typeof snap.slots === "object" ? snap.slots : {}); setShots(snap.shots);
      }
    } catch { /* a convenience only */ }
    fetch("/api/media/jobs", { cache: "no-store" }).then((x) => x.json()).then((j) => typeof j.credits === "number" && setCredits(j.credits)).catch(() => {});
    api<{ products?: MyProduct[] }>("/api/poster/products").then((r) => setProducts(r.data.products ?? [])).catch(() => {});
  })(); }, [router]);

  function fillFromProduct(id: string) {
    const p = products.find((x) => x.id === id); if (!p) return;
    setNameErr(""); setSlotErr(""); setErr("");
    setProduct(p.name); const all = (p.photos ?? []).filter((x) => x.role !== "context").map((x) => x.url); const list = (all.length ? all : p.photo_url ? [p.photo_url] : []).slice(0, 5); const byView: Record<string, string> = {}; const vmap: Record<string, string> = { front: "front", three_quarter: "right", back: "back" }; const free = ["front", "left", "right", "top", "back"]; (p.photos ?? []).forEach((x) => { const v = vmap[(x as { view?: string }).view ?? ""]; if (v && !byView[v] && list.includes(x.url)) byView[v] = x.url; }); list.forEach((u) => { if (!Object.values(byView).includes(u)) { const k = free.find((f) => !byView[f]); if (k) byView[k] = u; } }); setSlots(byView);
  }
  async function pick(file: File | null, view: string) {
    if (!file) return; setSlotBusy(view); setSlotErr("");
    let u: string | null = null;
    try { u = await uploadImage(await compressToFile(file, "photoshoot.jpg"), "product"); } catch { u = null; }
    setSlotBusy("");
    if (u) { setSlots((x) => ({ ...x, [view]: u! })); setSlotErr(""); } else setSlotErr(hi ? "Photo नहीं चढ़ पाई। फिर से कोशिश करें।" : "Could not add the photo. Please try again.");
  }
  async function generate() {
    // The button is never silently dead: say what is missing right under the field that needs it, and bring that field and its message on screen.
    setErr("");
    if (!slots.front) { setNameErr(""); setSlotErr(hi ? "पहले सामने की photo डालें।" : "Add the front photo first."); slotsRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); return; }
    if (product.trim().length < 2) { setSlotErr(""); setNameErr(hi ? "पहले product का नाम लिखें।" : "Write the product name first."); nameRef.current?.focus(); nameRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); return; }
    setNameErr(""); setSlotErr("");
    if (!chosen.length) { setErr(hi ? "कम से कम एक photo चुनें।" : "Pick at least one photo to make."); return; }
    setBusy(true); setErr(""); setNeedCredits(null); setShots(null); setShotMsg({});
    let r: { ok: boolean; status: number; data: { photos?: Shot[]; error?: string; cost?: number } };
    try { r = await api<{ photos?: Shot[]; error?: string; cost?: number }>("/api/poster/photoshoot", { method: "POST", json: { photo_urls: SLOTS.filter(([k]) => slots[k]).map(([k]) => slots[k]), views: SLOTS.filter(([k]) => slots[k]).map(([k]) => k), product, category, preset, shots: chosen } }); }
    catch { setBusy(false); setErr(hi ? "Internet नहीं चल रहा। फिर से कोशिश करें।" : "No internet. Please try again."); return; }
    fetch("/api/media/jobs", { cache: "no-store" }).then((x) => x.json()).then((j) => typeof j.credits === "number" && setCredits(j.credits)).catch(() => {});
    setBusy(false);
    if (!r.ok) {
      setErr(r.data.error || (hi ? "कुछ गड़बड़ हो गई। फिर से कोशिश करें।" : "Something went wrong. Please try again."));
      if (r.status === 402) setNeedCredits(Math.max(1, Number(r.data.cost) || chosen.length * PER_PHOTO)); // a refused order always shows the packs right here
      return;
    }
    setShots(r.data.photos ?? []);
  }
  const fileName = (url: string) => (url.split("/").pop() || "photoshoot.png").split("?")[0]; // unique per photo — a fixed name made every download overwrite the last one
  const clearShotMsg = (url: string) => setShotMsg((m) => { const n = { ...m }; delete n[url]; return n; });
  async function share(url: string) {
    setBusyAction(url); clearShotMsg(url);
    const r = await shareFile(url, product, fileName(url), "image/png");
    setShotMsg((m) => ({ ...m, [url]: r === "shared" ? { t: hi ? "भेज दी" : "Sent", ok: true } : r === "downloaded" ? { t: hi ? "फ़ोन में save हो गई" : "Saved to your phone", ok: true } : { t: hi ? "Share नहीं हुआ। फिर से Share दबाएँ, या Download दबाएँ।" : "Not shared. Tap Share to try again, or tap Download.", ok: false, neutral: true } }));
    setBusyAction("");
  }
  function useInAd() { try { sessionStorage.setItem("akp-ad-seed", JSON.stringify({ product, category, photos: [...refs, ...(shots ?? []).map((x) => x.url)].slice(0, 5) })); sessionStorage.setItem(SNAP_KEY, JSON.stringify({ at: Date.now(), product, category, preset, slots, shots })); } catch { /* ignore */ } router.push("/poster/video"); }
  async function download(url: string) {
    setBusyAction(url + "dl"); clearShotMsg(url);
    const ok = await downloadPoster(url, fileName(url));
    setShotMsg((m) => ({ ...m, [url]: ok ? { t: hi ? "फ़ोन में save हो गई" : "Saved to your phone", ok: true } : { t: hi ? "Save नहीं हुई — फिर कोशिश करें" : "Could not save — try again", ok: false } }));
    setBusyAction("");
  }

  if (!ready) return <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const inp = "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {/* Back = the screen the owner was just on (the Brand door on Create); opened fresh, that same door. */}
        <button type="button" onClick={() => goBack(router, "/poster/create?door=brand")} aria-label={hi ? "पीछे" : "Back"} className="text-muted"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="text-lg font-bold flex-1">📸 {hi ? "Product Photoshoot" : "Product Photoshoot"}</h1>
      </div>
      <Guide hi="अपने product की photo डालें — AI उससे 4 अच्छी photos बनाएगा, जो आप अपने catalog या social media पर लगा सकते हैं। नीचे चुनें कि कैसी photos चाहिए।" en="Add a photo of your product. AI makes 4 good photos from it that you can use in your catalog or on social media. Pick the kind of photos you want below." />

      <div className="rounded-xl border border-border p-3 space-y-3">
        {products.length > 0 && (
          <div className="rounded-xl border border-brand/40 bg-brand-soft/40 p-2.5">
            <label className="text-xs font-semibold text-brand-ink block mb-1">{hi ? "⚡ मेरे किसी product से भरें" : "⚡ Fill from one of my products"}</label>
            <select onChange={(e) => e.target.value && fillFromProduct(e.target.value)} defaultValue="" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm">
              <option value="">{hi ? "-- चुनें --" : "-- choose --"}</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <p className="text-sm font-semibold mb-1">{hi ? "Product की photos" : "Product photos"} ({refs.length}/5)</p>
          <p className="text-xs text-muted mb-1.5">{hi ? "सामने की photo ज़रूरी है। बाकी तरफ़ों की photos भी डालें। AI जितनी ज़्यादा तरफ़ें देखेगा, आपका product उतना सही बनाएगा।" : "The front photo is a must. Add the other sides too. The more sides the AI sees, the better it matches your product."}</p>
          <div ref={slotsRef} className="grid grid-cols-5 gap-1.5">
            {SLOTS.map(([k, label]) => (
              <div key={k} className="space-y-1 text-center">
                {slots[k] ? (
                  <span className="relative block aspect-square overflow-hidden rounded-xl border border-border">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={slots[k]} alt={label} className="h-full w-full object-cover" onClick={() => setZoom(slots[k])} /><button type="button" onClick={() => setSlots((x) => { const n = { ...x }; delete n[k]; return n; })} className="absolute right-0.5 top-0.5 rounded-full bg-black/60 px-1.5 text-[11px] text-white" aria-label={hi ? `${label} हटाएँ` : `Remove ${label}`}>×</button></span>
                ) : (
                  <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border border-dashed border-border bg-surface2">{slotBusy === k ? <LoaderCircle className="h-5 w-5 animate-spin text-muted" /> : <Camera className="h-5 w-5 text-muted" />}<input type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? null, k)} /></label>
                )}
                <span className={`block text-[10px] leading-tight ${k === "front" ? "font-semibold" : "text-muted"}`}>{label}{k === "front" ? " *" : ""}</span>
              </div>
            ))}
          </div>
          {slotErr && <p className="mt-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">{slotErr}</p>}
        </div>
        <input ref={nameRef} className={inp} placeholder={hi ? "Product का नाम *" : "Product name *"} value={product} onChange={(e) => { setProduct(e.target.value); setNameErr(""); }} />
        {nameErr && product.trim().length < 2 && <p className="-mt-1.5 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">{nameErr}</p>}
        <input className={inp} placeholder={hi ? "Category (ज़रूरी नहीं)" : "Category (optional)"} value={category} onChange={(e) => setCategory(e.target.value)} />
        <div>
          <p className="text-xs font-semibold text-muted mb-1">{hi ? "कैसी photos चाहिए?" : "What kind of photos?"}</p>
          <div className="grid grid-cols-2 gap-2">
            {([["lifestyle", hi ? "रोज़ की ज़िंदगी में" : "In daily life", hi ? "इस्तेमाल करते हुए, दूसरी तरफ़ से, सफ़ेद background, असली जगह" : "In use, another side, white background, a real place"], ["marketplace", hi ? "Online store के लिए" : "For online stores", hi ? "Amazon / Flipkart के लिए: सफ़ेद background, साइड से, पास से, इस्तेमाल में" : "For Amazon / Flipkart: white background, side view, close-up, in use"], ["model", hi ? "इंसान के साथ" : "With a person", hi ? "महिला, पुरुष, परिवार या हाथ इस्तेमाल करते हुए" : "A woman, a man, a family or hands using it"], ["social", hi ? "Social media के लिए" : "For social media", hi ? "ऊपर से, Story, Feed, साफ़ और सादी" : "From above, Story, Feed, clean and simple"]] as const).map(([k, l, d]) => (
              <button key={k} type="button" onClick={() => { setPreset(k); setOff([]); }} className={`rounded-xl border-2 p-2.5 text-left ${preset === k ? "border-brand bg-brand-soft" : "border-border"}`}><span className="block text-sm font-semibold">{l}</span><span className="block text-[11px] text-muted leading-tight">{d}</span></button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted mb-1">{hi ? `कौन-सी photos? (हर एक के ${PER_PHOTO} credits)` : `Which photos? (${PER_PHOTO} credits each)`}</p>
          <div className="flex flex-wrap gap-1.5">{SHOTS[preset].map(([k, le, lh]) => { const on = !off.includes(k); const l = hi ? lh : le; return <button key={k} type="button" onClick={() => setOff(on ? [...off, k] : off.filter((x) => x !== k))} className={`rounded-full border px-3 py-1.5 text-xs ${on ? "border-brand bg-brand-soft text-brand-ink font-semibold" : "border-border text-muted"}`}>{on ? "✓ " : ""}{l}</button>; })}</div>
        </div>
        {err && <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{err}</p>}
        {needCredits !== null && <AddCredits need={needCredits} have={credits ?? 0} onDone={() => { setNeedCredits(null); setErr(""); fetch("/api/media/jobs", { cache: "no-store" }).then((x) => x.json()).then((j) => typeof j.credits === "number" && setCredits(j.credits)).catch(() => {}); }} />}
        <button type="button" onClick={generate} disabled={busy} className="w-full inline-flex items-center justify-center gap-2 rounded-xl grad-brand px-4 py-3.5 text-base font-semibold text-white disabled:opacity-50">
          {busy ? <span className="inline-flex items-center gap-2"><LoaderCircle className="h-5 w-5 animate-spin" /> {hi ? "बन रहा है… (लगभग 30 सेकंड)" : "Making… (about 30 seconds)"}</span> : <><Sparkles className="h-5 w-5" /> {hi ? `${chosen.length} photo बनाएँ · ${chosen.length * PER_PHOTO} credits${credits !== null ? ` (आपके पास ${credits})` : ""}` : `Make ${chosen.length} photo${chosen.length === 1 ? "" : "s"} · ${chosen.length * PER_PHOTO} credits${credits !== null ? ` (you have ${credits})` : ""}`}</>}
        </button>
      </div>

      {shots && shots.length > 0 && <button type="button" onClick={useInAd} className="w-full rounded-xl border-2 border-brand bg-brand-soft px-4 py-3 text-sm font-semibold text-brand-ink">{hi ? "🎬 इन photos से video ad बनाएँ →" : "🎬 Make a video ad with these photos →"}</button>}
      {zoom && <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-3" onClick={() => setZoom("")}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={zoom} alt="" className="max-h-full max-w-full rounded-lg object-contain" /><button type="button" className="absolute right-4 top-4 rounded-full bg-white/20 px-3 py-1 text-white" aria-label={hi ? "बंद करें" : "Close"}>✕</button></div>}
      {shots && (
        <div className="grid grid-cols-2 gap-2">
          {shots.map((s) => (
            <div key={s.key} className="rounded-xl border border-border overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.url} alt={shotName(s.key, s.label)} className="w-full aspect-square object-cover cursor-zoom-in" onClick={() => setZoom(s.url)} />
              <div className="p-2 space-y-1.5">
                <p className="text-xs font-semibold">{shotName(s.key, s.label)}</p>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => share(s.url)} disabled={busyAction === s.url} className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-[#25D366] px-2 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60">{busyAction === s.url ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />} Share</button>
                  <button type="button" onClick={() => download(s.url)} disabled={busyAction === s.url + "dl"} className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-60">{busyAction === s.url + "dl" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}</button>
                </div>
                {shotMsg[s.url] && <p className={`text-[11px] ${shotMsg[s.url].ok ? "text-good" : shotMsg[s.url].neutral ? "text-muted" : "font-semibold text-danger"}`}>{shotMsg[s.url].t}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PhotoshootPage() {
  return <AiPageGate title="AI product photoshoot" reason="One photo of your product becomes good photos for your catalog, social media and online stores."><PhotoshootPageInner /></AiPageGate>;
}
