"use client";
// Customer testimonials: list + add/edit (→ "💬 Review" posters), and
// "ask for a review" WhatsApp links (plain review request + Google review link).
import { FinishNext } from "@/components/poster/site-finish";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, Plus, Trash2, Camera, Images, ChevronLeft, MessageCircle, Star, Clapperboard } from "lucide-react";
import { api, isLoggedIn, uploadImage, type Profile } from "@/lib/poster-client";
import { compressToFile } from "@/lib/image-utils";
import { useT } from "@/lib/poster-i18n";
import { goBack } from "@/lib/nav-back";

type Testimonial = { id: string; customer_name: string; text: string; rating: number; city: string; photo_url: string | null; approved: boolean };
type Draft = { id?: string; customer_name: string; text: string; rating: number; city: string; photo_url: string | null };
const GOOGLE_KEY = "akp-google-review";

const S = {
  hi: {
    title: "ग्राहकों की राय", hint: "ग्राहक की review जोड़ें। Calendar में 💬 ग्राहक राय वाले दिन उसका सुंदर poster बन जाएगा।",
    add: "जोड़ें", name: "ग्राहक का नाम", text: "Review (छोटी, 2–3 लाइन)", city: "शहर", photo: "ग्राहक की फ़ोटो (अगर हो)", rating: "Rating",
    save: "सेव करें", saveFail: "Save नहीं हुआ।", edit: "बदलें", remove: (n: string) => `"${n}" की review हटा दें?`, none: "अभी कोई review नहीं।",
    askTitle: "Review माँगें", askHint: "ग्राहक का WhatsApp नंबर डालें। एक बार दबाते ही review माँगने का message खुल जाएगा।",
    phone: "ग्राहक का मोबाइल नंबर", askBtn: "WhatsApp पर review माँगें", googleLabel: "Google review link (अगर हो)", googlePh: "https://g.page/r/…",
    googleBtn: "Google review link भेजें", googleHint: "Link Google Maps से copy करें: अपना business खोलें, फिर 'Get more reviews' दबाएँ। यह link इस phone में save रहता है।",
    badPhone: "10 अंकों का सही नंबर डालें।",
    needName: "पहले ग्राहक का नाम लिखें।", needText: "पहले review लिखें।", noGoogle: "पहले ऊपर Google review link डालें।",
    photoFail: "वो फ़ोटो upload नहीं हुई। दोबारा कोशिश करें।", rowFail: "Save नहीं हुआ। दोबारा कोशिश करें।", delFail: "हटाया नहीं जा सका। दोबारा कोशिश करें।",
    waiting: "आपकी मंज़ूरी का इंतज़ार", waitingHint: "ये reviews आपकी website से आई हैं। जो आप मंज़ूर करेंगे वही card और website पर दिखेगी।",
    approve: "Card पर दिखाएँ", approved: "Card पर दिख रही है",
  },
  en: {
    title: "Customer reviews", hint: "Add a customer's review. On 💬 Review days in the calendar, it becomes a nice poster.",
    add: "Add", name: "Customer name", text: "Review (short, 2–3 lines)", city: "City", photo: "Customer photo (if you have one)", rating: "Rating",
    save: "Save", saveFail: "Could not save.", edit: "Edit", remove: (n: string) => `Delete "${n}"'s review?`, none: "No reviews yet.",
    askTitle: "Ask for a review", askHint: "Enter the customer's WhatsApp number. A message asking for a review opens with one tap.",
    phone: "Customer mobile number", askBtn: "Ask for review on WhatsApp", googleLabel: "Google review link (if you have one)", googlePh: "https://g.page/r/…",
    googleBtn: "Send Google review link", googleHint: "Copy the link from Google Maps: open your business, then tap 'Get more reviews'. The link stays saved on this phone.",
    badPhone: "Enter a valid 10-digit number.",
    needName: "Write the customer's name first.", needText: "Write the review first.", noGoogle: "Paste your Google review link above first.",
    photoFail: "Could not upload that photo. Please try again.", rowFail: "Could not save. Please try again.", delFail: "Could not delete. Please try again.",
    waiting: "Waiting for your approval", waitingHint: "These came from your website. Only the ones you approve go on your card and website.",
    approve: "Show on my card", approved: "Showing on your card",
  },
};

function waLink(phone: string, text: string) { return `https://wa.me/91${phone}?text=${encodeURIComponent(text)}`; }

export default function TestimonialsPage() {
  const router = useRouter();
  const { lang } = useT(); const s = lang === "en" ? S.en : S.hi;
  const [list, setList] = useState<Testimonial[] | null>(null);
  const [biz, setBiz] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [phone, setPhone] = useState("");
  const [google, setGoogle] = useState("");
  const [phoneErr, setPhoneErr] = useState("");      // under the phone box, above "Ask for review on WhatsApp"
  const [googleErr, setGoogleErr] = useState("");     // under "Send Google review link"
  const [photoErr, setPhotoErr] = useState("");       // under the customer-photo buttons
  const [rowErr, setRowErr] = useState<{ id: string; text: string } | null>(null);   // under the review that was approved / deleted
  const nameRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const googleRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  /** Open / close the add-edit form; whatever it was saying about the last try goes with it. */
  function openDraft(d: Draft | null) { setErr(""); setPhotoErr(""); setDraft(d); }

  async function load() { const r = await api<{ testimonials: Testimonial[] }>("/api/poster/testimonials"); setList(r.data.testimonials ?? []); }
  useEffect(() => { (async () => {
    // Replace, not push: Back from the login page must not land here again and bounce straight back to it.
    if (!(await isLoggedIn())) { router.replace("/login?next=/poster/testimonials"); return; }
    try { setGoogle(localStorage.getItem(GOOGLE_KEY) ?? ""); } catch { /* ignore */ }
    const p = await api<{ profiles: Profile[] }>("/api/poster/profiles"); const list = p.data.profiles ?? [];
    const d = list.find((x) => x.is_default) ?? list[0]; if (d) setBiz(d.tagline || d.name || "");
    load();
  })(); }, [router]);

  async function save() {
    if (!draft) return;
    // Nothing to save yet: say what is missing right above the button and put the cursor in that box (was a silent, greyed-out button).
    if (!draft.customer_name.trim()) { setErr(s.needName); nameRef.current?.focus(); return; }
    if (!draft.text.trim()) { setErr(s.needText); textRef.current?.focus(); return; }
    setBusy(true); setErr("");
    const r = await api<{ testimonial?: Testimonial; error?: string }>("/api/poster/testimonials", { method: "POST", json: draft });
    setBusy(false);
    if (!r.ok) { setErr(r.data.error || s.saveFail); return; }
    openDraft(null); load();
  }
  async function pick(file: File | null) {
    if (!file || !draft) return;
    setBusy(true); setPhotoErr("");
    try {
      const small = await compressToFile(file, "testimonial.jpg"); const u = await uploadImage(small, "photo");
      if (u) setDraft({ ...draft, photo_url: u }); else setPhotoErr(s.photoFail);
    } catch { setPhotoErr(s.photoFail); }
    finally { setBusy(false); }
  }
  /** A review a visitor left on the website goes on the card only once the owner says so. */
  async function approve(t: Testimonial) {
    setRowErr(null);
    try {
      const r = await api("/api/poster/testimonials", { method: "POST", json: { id: t.id, customer_name: t.customer_name, text: t.text, rating: t.rating, city: t.city ?? "", photo_url: t.photo_url, approved: true } });
      if (!r.ok) { setRowErr({ id: t.id, text: s.rowFail }); return; }
    } catch { setRowErr({ id: t.id, text: s.rowFail }); return; }
    load();
  }
  async function remove(t: Testimonial) {
    if (!confirm(s.remove(t.customer_name))) return;
    setRowErr(null);
    try {
      const r = await api(`/api/poster/testimonials?id=${t.id}`, { method: "DELETE" });
      if (!r.ok) { setRowErr({ id: t.id, text: s.delFail }); return; }
    } catch { setRowErr({ id: t.id, text: s.delFail }); return; }
    load();
  }
  function saveGoogle(v: string) { setGoogle(v); try { if (v) localStorage.setItem(GOOGLE_KEY, v); else localStorage.removeItem(GOOGLE_KEY); } catch { /* ignore */ } }
  /** The number, or null — and the "bad number" line goes under the button that was tapped (`say`). */
  function cleanPhone(say: (m: string) => void): string | null {
    const p = phone.replace(/\D/g, "").replace(/^0+/, "").replace(/^91(?=\d{10}$)/, "");
    if (!/^[6-9]\d{9}$/.test(p)) { say(s.badPhone); return null; }
    say(""); return p;
  }
  function askReview() {
    setGoogleErr("");
    const p = cleanPhone(setPhoneErr); if (!p) return;
    const who = biz ? `${biz} ` : "";
    const msg = `नमस्ते 🙏\n${who}से जुड़ने के लिए धन्यवाद! क्या आप हमारे बारे में 2 लाइन की छोटी सी review और 1 से 5 तक rating ⭐ भेज सकते हैं? आपकी राय हमारे लिए बहुत मायने रखती है।\nधन्यवाद!`;
    window.open(waLink(p, msg), "_blank");
  }
  function sendGoogle() {
    setPhoneErr("");
    if (!google) { setGoogleErr(s.noGoogle); googleRef.current?.focus(); return; }   // was a dead, greyed-out button
    const p = cleanPhone(setGoogleErr); if (!p) return;
    const who = biz ? `${biz} ` : "";
    const msg = `नमस्ते 🙏\n${who}पर भरोसा करने के लिए धन्यवाद! अगर आपको हमारी सेवा पसंद आई हो तो कृपया Google पर 5 ⭐ review दें — बस 1 मिनट लगेगा:\n${google}\nधन्यवाद!`;
    window.open(waLink(p, msg), "_blank");
  }

  if (list === null) return <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const inp = "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand";
  // Reviews a visitor left on the website arrive unapproved and are shown first, with one tap to publish them.
  const waiting = list.filter((t) => t.approved === false);
  const shown = list.filter((t) => t.approved !== false);
  const stars = (n: number, onPick?: (v: number) => void) => (
    <span className="inline-flex gap-0.5">{[1, 2, 3, 4, 5].map((i) => <button key={i} type="button" disabled={!onPick} onClick={() => onPick?.(i)} className="p-0"><Star className={`h-5 w-5 ${i <= n ? "fill-amber-400 text-amber-400" : "text-muted"}`} /></button>)}</span>
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {/* An open add / edit form closes first (it has its own ✕); otherwise Back = the screen the owner was just on (the Create tab, the
            finished-website screen, the card's checklist); opened fresh, the Create tab. */}
        <button type="button" onClick={() => (draft ? openDraft(null) : goBack(router, "/poster/create"))} className="text-muted" aria-label={lang === "en" ? "Back" : "पीछे"}><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="text-lg font-bold flex-1">💬 {s.title}</h1>
        {!draft && <button type="button" onClick={() => openDraft({ customer_name: "", text: "", rating: 5, city: "", photo_url: null })} className="inline-flex items-center gap-1 rounded-full grad-brand px-3 py-1.5 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> {s.add}</button>}
      </div>
      <p className="text-xs text-muted">{s.hint}</p>
      {draft && (
        <div ref={formRef} className="rounded-xl border border-brand bg-brand-soft/40 p-3 space-y-3">
          <div className="flex items-center gap-3">
            <span className="h-20 w-20 rounded-full bg-surface border border-border grid place-items-center overflow-hidden shrink-0">
              {draft.photo_url ? <img src={draft.photo_url} alt="" className="h-full w-full object-cover" /> : busy ? <LoaderCircle className="h-5 w-5 animate-spin text-muted" /> : <Camera className="h-6 w-6 text-muted" />}
            </span>
            <div className="flex-1 space-y-1.5">
              <span className="text-sm font-semibold block">{s.photo}</span>
              <div className="flex gap-2">
                <label className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium cursor-pointer">
                  <Camera className="h-3.5 w-3.5" /> {lang === "en" ? "Camera" : "कैमरा"}
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
                </label>
                <label className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium cursor-pointer">
                  <Images className="h-3.5 w-3.5" /> {lang === "en" ? "Gallery" : "गैलरी"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
                </label>
              </div>
              {photoErr && <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-2 py-1.5 text-xs font-semibold text-danger">{photoErr}</p>}
            </div>
          </div>
          <input ref={nameRef} className={inp} placeholder={s.name} value={draft.customer_name} onChange={(e) => { setErr(""); setDraft({ ...draft, customer_name: e.target.value }); }} />
          <input className={inp} placeholder={s.city} value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
          <textarea ref={textRef} className={inp} rows={4} maxLength={300} placeholder={s.text} value={draft.text} onChange={(e) => { setErr(""); setDraft({ ...draft, text: e.target.value }); }} />
          <div className="flex items-center gap-3 text-sm"><span>{s.rating}</span>{stars(draft.rating, (v) => setDraft({ ...draft, rating: v }))}<span className="text-xs text-muted">{draft.text.length}/300</span></div>
          {err && <p role="alert" className="text-sm font-semibold text-danger">{err}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => openDraft(null)} className="rounded-xl border border-border px-4 py-2.5 text-sm">✕</button>
            <button type="button" onClick={save} disabled={busy} className="flex-1 rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{s.save}</button>
          </div>
        </div>
      )}
      {waiting.length > 0 && (
        <div className="rounded-xl border-2 border-amber bg-amber/10 p-3 space-y-2">
          <h2 className="text-base font-bold">⏳ {s.waiting} ({waiting.length})</h2>
          <p className="text-xs text-muted">{s.waitingHint}</p>
          {waiting.map((t) => (
            <div key={t.id} className="rounded-xl border border-border bg-surface p-3 space-y-2">
              <p className="text-sm font-semibold">{t.customer_name}{t.city ? <span className="text-muted font-normal"> · {t.city}</span> : null}</p>
              {stars(t.rating)}
              <p className="text-sm">{t.text}</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => approve(t)} className="flex-1 rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white">✓ {s.approve}</button>
                <button type="button" onClick={() => remove(t)} className="rounded-xl border border-border px-4 py-2.5 text-sm"><Trash2 className="h-4 w-4" /></button>
              </div>
              {rowErr?.id === t.id && <p role="alert" className="text-sm font-semibold text-danger">{rowErr.text}</p>}
            </div>
          ))}
        </div>
      )}
      <div className="space-y-2">
        {shown.map((t) => (
          <div key={t.id} className="flex items-start gap-3 rounded-xl border border-border p-3">
            <div className="h-12 w-12 rounded-full bg-surface2 overflow-hidden grid place-items-center shrink-0">{t.photo_url ? <img src={t.photo_url} alt="" className="h-full w-full object-cover" /> : "🙂"}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{t.customer_name}{t.city ? <span className="text-muted font-normal"> · {t.city}</span> : null}</p>
              {stars(t.rating)}
              <p className="text-xs text-muted line-clamp-2">{t.text}</p>
              {rowErr?.id === t.id && <p role="alert" className="mt-1 text-xs font-semibold text-danger">{rowErr.text}</p>}
            </div>
            <Link href={`/poster/video?testimonial=${t.id}`} className="p-2 text-brand-ink" title={lang === "en" ? "Make a video from this review" : "इस review से video बनाएँ"}><Clapperboard className="h-4 w-4" /></Link>
            <button type="button" onClick={() => { openDraft({ id: t.id, customer_name: t.customer_name, text: t.text, rating: t.rating, city: t.city ?? "", photo_url: t.photo_url }); setTimeout(() => formRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }), 60); }} className="p-2 text-muted text-xs">{s.edit}</button>
            <button type="button" onClick={() => remove(t)} className="p-2 text-muted"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        {shown.length === 0 && !draft && <p className="text-sm text-muted">{s.none}</p>}
      </div>

      <div className="rounded-xl border border-border p-3 space-y-3">
        <h2 className="text-base font-bold">⭐ {s.askTitle}</h2>
        <p className="text-xs text-muted">{s.askHint}</p>
        <input className={inp} inputMode="tel" placeholder={s.phone} value={phone} onChange={(e) => { setPhone(e.target.value); setPhoneErr(""); setGoogleErr(""); }} />
        {phoneErr && <p role="alert" className="text-sm font-semibold text-danger">{phoneErr}</p>}
        <button type="button" onClick={askReview} className="w-full inline-flex items-center justify-center gap-2 rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white"><MessageCircle className="h-4 w-4" /> {s.askBtn}</button>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">{s.googleLabel}</span>
          <input ref={googleRef} className={inp} inputMode="url" placeholder={s.googlePh} value={google} onChange={(e) => { setGoogleErr(""); saveGoogle(e.target.value.trim()); }} />
          <span className="block text-[11px] text-muted">{s.googleHint}</span>
        </label>
        {googleErr && <p role="alert" className="text-sm font-semibold text-danger">{googleErr}</p>}
        <button type="button" onClick={sendGoogle} className={`w-full inline-flex items-center justify-center gap-2 rounded-xl border border-brand bg-brand-soft px-4 py-3 text-sm font-semibold text-brand-ink ${google ? "" : "opacity-60"}`}><MessageCircle className="h-4 w-4" /> {s.googleBtn}</button>
      </div>
      <FinishNext hi={lang !== "en"} />
    </div>
  );
}
