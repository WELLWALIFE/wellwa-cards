"use client";
// "Add many at once" on the Products page (owner, 14 Oct 2026): paste a list, photograph a price list, or tick the usual
// things of the trade — then look the list over and add all of it in one tap.
import { useEffect, useRef, useState } from "react";
import { Camera, ClipboardList, LoaderCircle, Sparkles, X } from "lucide-react";
import { api, uploadImage } from "@/lib/poster-client";
import { compressToFile } from "@/lib/image-utils";

type Item = { name: string; price: string; category: string; on: boolean };
type Mode = "text" | "photo" | "suggest";

/** What a failed reply says in the owner's language. The server's own text is English: Hindi is chosen by its `code`, else by the
 *  status (a gateway that gives up sends no JSON at all, so there is no text then). `fallback` is for any other case. */
function failText(en: boolean, status: number, code: string | undefined, text: string | undefined, fallback: [string, string]): string {
  if (en) return text || fallback[0];
  const by: Record<string, string> = {
    busy: "आपकी पिछली लिस्ट अभी जुड़ रही है। एक मिनट रुकें, फिर अपने products देखें।",
    limit: "एक घंटे में बहुत बार try हो गया। थोड़ा रुकें।",
    big: "यह बहुत बड़ा है। थोड़ा छोटा करके दोबारा try करें।",
    read: "आपके products पढ़े नहीं जा सके। दोबारा try करें।",
    full: "आपके पास 500 products हैं — इससे ज़्यादा नहीं रख सकते। पहले कुछ हटाएँ।",
    save: "Save नहीं हुआ। दोबारा try करें।",
    login: "दोबारा log in करें।",
  };
  if (code && by[code]) return by[code];
  if (status === 401) return by.login;
  if (status === 409) return by.busy;
  if (status === 413) return by.big;
  if (status === 429) return by.limit;
  return fallback[1];
}

/** `onAdded(n, withPicture)`: n products were added, withPicture of them got a picture (undefined: not told). */
export function BulkAdd({ en, trade, city, onClose, onAdded }: { en: boolean; trade: string; city?: string; onClose: () => void; onAdded: (n: number, withPicture?: number) => void }) {
  const T = (e: string, h: string) => (en ? e : h);
  const [mode, setMode] = useState<Mode>("text");
  const [text, setText] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  // Saving finds a picture for each product on the server (5 at a time, ending by 90 s): the page says how long it should take and
  // how far along it is, and — if it fails — offers to add the products without pictures, so a picture search never blocks them.
  const [saveN, setSaveN] = useState(0);
  const [secs, setSecs] = useState(0);
  const [plainOk, setPlainOk] = useState(false);
  const [withPics, setWithPics] = useState(true);   // the save now running looks for pictures (false: "Add without pictures")
  const pick = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (busy !== "save") return;
    const t0 = Date.now();
    const id = setInterval(() => setSecs(Math.round((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [busy]);

  async function read(body: Record<string, unknown>) {
    setBusy("read"); setErr("");
    try {
      const r = await api<{ items?: Omit<Item, "on">[]; error?: string; code?: string }>("/api/poster/products/import", { method: "POST", json: body });
      if (!r.ok || !r.data.items) {
        // 422: it worked but nothing could be read; the Hindi says what to do for the way the list was given.
        const m = body.mode;
        setErr(r.status === 422 && !en
          ? (m === "photo" ? "इस photo से कुछ पढ़ा नहीं जा सका। साफ़ और सीधी photo लें।" : m === "suggest" ? "अभी कोई सुझाव नहीं। खुद जोड़ें।" : "इस लिस्ट में कुछ नहीं मिला।")
          : r.status === 503 && !en ? "अभी यह नहीं हो सकता। Products एक-एक करके जोड़ें।"
          : failText(en, r.status, r.data.code, r.data.error, ["Something went wrong. Please try again.", "कुछ गड़बड़ हुई। दोबारा try करें।"]));
        return;
      }
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
  /** `pictures: false` adds the products at once without looking for pictures (the owner's choice after a try that failed). */
  async function add(pictures = true) {
    const keep = (items ?? []).filter((x) => x.on && x.name.trim());
    if (!keep.length) { setErr(T("Tick at least one.", "कम से कम एक चुनें।")); return; }
    setBusy("save"); setErr(""); setPlainOk(false); setSaveN(keep.length); setSecs(0); setWithPics(pictures);
    try {
      const r = await api<{ added?: number; withPicture?: number; error?: string; code?: string }>("/api/poster/products/bulk", { method: "POST", json: { items: keep.map(({ name, price, category }) => ({ name, price, category })), ...(pictures ? {} : { pictures: false }) } });
      if (!r.ok) {
        setErr(failText(en, r.status, r.data.code, r.data.error, ["Could not save. Please try again.", "Save नहीं हुआ। दोबारा try करें।"]));
        // A try that failed may be added without pictures; one already running, limited, too big or over the most products cannot.
        setPlainOk(pictures && ![401, 409, 413, 429].includes(r.status) && r.data.code !== "full");
        return;
      }
      onAdded(r.data.added ?? 0, r.data.withPicture);
    } catch { setErr(T("No internet — please try again.", "Internet नहीं है — दोबारा try करें।")); setPlainOk(pictures); } finally { setBusy(""); }
  }
  const upd = (i: number, p: Partial<Item>) => setItems((l) => (l ?? []).map((x, j) => (j === i ? { ...x, ...p } : x)));
  const tab = (m: Mode, I: typeof Camera, label: string) => (
    <button key={m} type="button" onClick={() => { setMode(m); setItems(null); setErr(""); }} className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold ${mode === m ? "bg-brand text-white" : "bg-surface2 text-muted"}`}><I className="h-4 w-4" /> {label}</button>
  );
  const on = (items ?? []).filter((x) => x.on).length;
  const count = (n: number) => `${n} ${n === 1 ? "product" : "products"}`;

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
            <button type="button" disabled={!!busy || !on} onClick={() => void add()} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl grad-brand py-3 text-sm font-semibold text-white disabled:opacity-50">{busy === "save" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null} {busy === "save" ? T(`Adding ${count(saveN)}…`, saveN === 1 ? "1 product जुड़ रहा है…" : `${saveN} products जुड़ रहे हैं…`) : T(`Add ${count(on)}`, `${on} ${on === 1 ? "product" : "products"} जोड़ें`)}</button>
          </div>
        </div>
      )}
      {busy === "save" && (() => {
        // "Add without pictures" only saves: no search, no long wait.
        if (!withPics) return <p className="text-xs text-muted">{T("Adding your products… Please keep this page open.", "आपके products जुड़ रहे हैं… यह page खुला रखें।")}</p>;
        // About 15 s for each five products. The server starts no lookup after a minute and ends them all by 90 s, so "Almost done" is
        // said only from 90 s on, when the save is really starting; the bar never reaches the end before the answer does.
        const est = Math.min(80, 15 + Math.ceil(saveN / 5) * 15);
        const one = saveN === 1;
        return (
          <div className="space-y-1.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-brand transition-all duration-1000" style={{ width: `${Math.min(95, Math.round((secs / est) * 100))}%` }} /></div>
            <p className="text-xs text-muted">{secs < est
              ? T(`Finding a clean, matching picture for ${one ? "your product" : `each of your ${saveN} products`}… about ${est} seconds. Please keep this page open.`, `${one ? "आपके product" : `आपके ${saveN} products में से हर एक`} के लिए साफ़ और मिलती-जुलती picture ढूँढ रहे हैं… लगभग ${est} सेकंड। यह page खुला रखें।`)
              : secs < 90
                ? T("Still finding pictures. It needs a little more time. Please keep this page open.", "अभी pictures ढूँढ रहे हैं। थोड़ा और समय लगेगा। यह page खुला रखें।")
                : secs < 110
                  ? T("Almost done — saving your products. Please wait a little more.", "लगभग हो गया — products save हो रहे हैं। थोड़ा और रुकें।")
                  : T("It is taking longer than usual. Please keep waiting. Your products will be added even if some pictures are not found.", "आज थोड़ा ज़्यादा समय लग रहा है। रुके रहें। कुछ pictures न मिलें, तब भी आपके products जुड़ जाएँगे।")}</p>
          </div>
        );
      })()}
      {err && <p className="text-sm font-semibold text-danger">{err}</p>}
      {err && plainOk && !busy && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted">{T("You can add the products now without pictures. Pictures can be added free later.", "आप products अभी बिना picture के जोड़ सकते हैं। Picture बाद में free लग जाएँगी।")}</p>
          <button type="button" onClick={() => void add(false)} className="w-full rounded-xl border border-brand px-4 py-2.5 text-sm font-semibold text-brand-ink">{T("Add without pictures", "बिना picture के जोड़ें")}</button>
        </div>
      )}
    </section>
  );
}
