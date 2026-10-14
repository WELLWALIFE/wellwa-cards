"use client";
// "Add many at once" on the Products page (owner, 14 Oct 2026): paste a list, photograph a price list, or tick the usual
// things of the trade — then look the list over and add all of it in one tap.
import { useRef, useState } from "react";
import { Camera, ClipboardList, LoaderCircle, Sparkles, X } from "lucide-react";
import { api, uploadImage } from "@/lib/poster-client";
import { compressToFile } from "@/lib/image-utils";

type Item = { name: string; price: string; category: string; on: boolean };
type Mode = "text" | "photo" | "suggest";

export function BulkAdd({ en, trade, city, onClose, onAdded }: { en: boolean; trade: string; city?: string; onClose: () => void; onAdded: (n: number) => void }) {
  const T = (e: string, h: string) => (en ? e : h);
  const [mode, setMode] = useState<Mode>("text");
  const [text, setText] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const pick = useRef<HTMLInputElement>(null);

  async function read(body: Record<string, unknown>) {
    setBusy("read"); setErr("");
    try {
      const r = await api<{ items?: Omit<Item, "on">[]; error?: string }>("/api/poster/products/import", { method: "POST", json: body });
      if (!r.ok || !r.data.items) { setErr(r.data.error ?? T("Something went wrong. Please try again.", "कुछ गड़बड़ हुई। दोबारा try करें।")); return; }
      setItems(r.data.items.map((x) => ({ ...x, on: true })));
    } catch { setErr(T("No internet — please try again.", "Internet नहीं है — दोबारा try करें।")); } finally { setBusy(""); }
  }
  async function photo(file: File | null) {
    if (!file) return;
    setBusy("read"); setErr("");
    try {
      const small = await compressToFile(file, "pricelist.jpg");
      const url = await uploadImage(small, "product");
      if (!url) { setErr(T("The photo could not be uploaded. Please try again.", "Photo upload नहीं हुई। दोबारा try करें।")); setBusy(""); return; }
      await read({ mode: "photo", image_url: url });
    } catch { setErr(T("The photo could not be used.", "ये photo इस्तेमाल नहीं हो पाई।")); setBusy(""); }
  }
  async function add() {
    const keep = (items ?? []).filter((x) => x.on && x.name.trim());
    if (!keep.length) { setErr(T("Tick at least one.", "कम से कम एक चुनें।")); return; }
    setBusy("save"); setErr("");
    try {
      const r = await api<{ added?: number; error?: string }>("/api/poster/products/bulk", { method: "POST", json: { items: keep.map(({ name, price, category }) => ({ name, price, category })) } });
      if (!r.ok) { setErr(r.data.error ?? T("Could not save. Please try again.", "Save नहीं हुआ। दोबारा try करें।")); return; }
      onAdded(r.data.added ?? 0);
    } catch { setErr(T("No internet — please try again.", "Internet नहीं है — दोबारा try करें।")); } finally { setBusy(""); }
  }
  const upd = (i: number, p: Partial<Item>) => setItems((l) => (l ?? []).map((x, j) => (j === i ? { ...x, ...p } : x)));
  const tab = (m: Mode, I: typeof Camera, label: string) => (
    <button key={m} type="button" onClick={() => { setMode(m); setItems(null); setErr(""); }} className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold ${mode === m ? "bg-brand text-white" : "bg-surface2 text-muted"}`}><I className="h-4 w-4" /> {label}</button>
  );
  const on = (items ?? []).filter((x) => x.on).length;

  return (
    <section className="space-y-3 rounded-2xl border-2 border-brand/40 bg-brand-soft/30 p-3.5">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-base font-bold">{T("Add many products at once", "बहुत से products एक साथ जोड़ें")}</p>
        <button type="button" onClick={onClose} aria-label={T("Close", "बंद करें")} className="text-muted"><X className="h-5 w-5" /></button>
      </div>
      {!items && (
        <>
          <div className="flex gap-1.5">
            {tab("text", ClipboardList, T("Type a list", "लिस्ट लिखें"))}
            {tab("photo", Camera, T("Price-list photo", "रेट-लिस्ट की photo"))}
            {tab("suggest", Sparkles, T("Ideas for me", "मेरे लिए सुझाव"))}
          </div>
          {mode === "text" && (
            <div className="space-y-2">
              <p className="text-xs text-muted">{T("One item on each line. Write the price after the name if you like. Example: Kaju Katli 800 / kg", "हर लाइन में एक चीज़। चाहें तो नाम के बाद दाम लिखें। जैसे: काजू कतली 800 / किलो")}</p>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} placeholder={"Kaju Katli 800\nMotichoor Laddu 400\nSamosa 15"} className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-base" />
              <button type="button" disabled={!!busy || text.trim().length < 2} onClick={() => void read({ mode: "text", text })} className="inline-flex w-full items-center justify-center gap-2 rounded-xl grad-brand py-3 text-sm font-semibold text-white disabled:opacity-50">{busy === "read" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null} {T("Read my list", "मेरी लिस्ट पढ़ें")}</button>
            </div>
          )}
          {mode === "photo" && (
            <div className="space-y-2">
              <p className="text-xs text-muted">{T("Take a straight, clear photo of your price list, menu or rate card. We read the names and prices for you.", "अपनी रेट-लिस्ट, menu या rate card की सीधी और साफ़ photo खींचें। नाम और दाम हम पढ़ लेंगे।")}</p>
              <input ref={pick} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ""; void photo(f); }} />
              <button type="button" disabled={!!busy} onClick={() => pick.current?.click()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl grad-brand py-3 text-sm font-semibold text-white disabled:opacity-50">{busy === "read" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} {busy === "read" ? T("Reading… about 20 seconds", "पढ़ रहे हैं… लगभग 20 सेकंड") : T("Choose or take a photo", "Photo चुनें या खींचें")}</button>
            </div>
          )}
          {mode === "suggest" && (
            <div className="space-y-2">
              <p className="text-xs text-muted">{T("We list the usual things a shop like yours sells. Tick the ones you have — you add the prices later.", "आपके जैसी दुकान जो आम तौर पर बेचती है, उसकी लिस्ट हम दिखाएँगे। जो आपके पास हैं उन्हें चुनें — दाम बाद में लिखें।")}</p>
              <button type="button" disabled={!!busy} onClick={() => void read({ mode: "suggest", trade, city })} className="inline-flex w-full items-center justify-center gap-2 rounded-xl grad-brand py-3 text-sm font-semibold text-white disabled:opacity-50">{busy === "read" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {T(`Show ideas for ${trade || "my shop"}`, `${trade || "मेरी दुकान"} के लिए सुझाव दिखाएँ`)}</button>
            </div>
          )}
        </>
      )}
      {items && (
        <div className="space-y-2">
          <p className="text-xs text-muted">{T("Look it over. Untick what you do not want, fix any name or price.", "एक बार देख लें। जो नहीं चाहिए उसका निशान हटाएँ, नाम या दाम ठीक करें।")}</p>
          <ul className="max-h-[55vh] space-y-1.5 overflow-auto">
            {items.map((x, i) => (
              <li key={i} className={`flex items-center gap-2 rounded-xl border bg-surface px-2.5 py-2 ${x.on ? "border-brand/50" : "border-border opacity-60"}`}>
                <input type="checkbox" checked={x.on} onChange={(e) => upd(i, { on: e.target.checked })} className="h-5 w-5 shrink-0" aria-label={x.name} />
                <input value={x.name} onChange={(e) => upd(i, { name: e.target.value })} maxLength={60} className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none" aria-label={T("Name", "नाम")} />
                <span className="shrink-0 text-sm text-muted">₹</span>
                <input value={x.price} onChange={(e) => upd(i, { price: e.target.value })} maxLength={30} inputMode="decimal" placeholder={T("price", "दाम")} className="w-20 shrink-0 rounded-lg border border-border bg-surface2 px-2 py-1 text-sm outline-none" aria-label={T("Price", "दाम")} />
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setItems(null); setErr(""); }} className="rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold">{T("Back", "पीछे")}</button>
            <button type="button" disabled={!!busy || !on} onClick={() => void add()} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl grad-brand py-3 text-sm font-semibold text-white disabled:opacity-50">{busy === "save" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null} {T(`Add ${on} products`, `${on} products जोड़ें`)}</button>
          </div>
        </div>
      )}
      {busy === "save" && <p className="text-xs text-muted">{T("Finding a clean, matching picture for each product… this can take up to a minute. Please keep this page open.", "हर product के लिए साफ़ और मिलती-जुलती picture ढूँढ रहे हैं… एक मिनट तक लग सकता है। यह page खुला रखें।")}</p>}
      {err && <p className="text-sm font-semibold text-danger">{err}</p>}
    </section>
  );
}
