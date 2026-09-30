"use client";
// Customer testimonials: list + add/edit (→ "💬 Testimonial" posters), and
// "ask for a review" WhatsApp links (plain review request + Google review link).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, Plus, Trash2, Camera, Images, ChevronLeft, MessageCircle, Star, Clapperboard } from "lucide-react";
import { api, isLoggedIn, uploadImage, type Profile } from "@/lib/poster-client";
import { compressToFile } from "@/lib/image-utils";
import { useT } from "@/lib/poster-i18n";

type Testimonial = { id: string; customer_name: string; text: string; rating: number; city: string; photo_url: string | null; approved: boolean };
type Draft = { id?: string; customer_name: string; text: string; rating: number; city: string; photo_url: string | null };
const GOOGLE_KEY = "akp-google-review";

const S = {
  hi: {
    title: "ग्राहकों की राय", hint: "ग्राहक की review जोड़ें — calendar में 💬 Testimonial वाले दिन उसका सुंदर poster बनेगा।",
    add: "जोड़ें", name: "ग्राहक का नाम", text: "Review (छोटी, 2–3 लाइन)", city: "शहर", photo: "ग्राहक की फ़ोटो (optional)", rating: "Rating",
    save: "सेव करें", saveFail: "Save नहीं हुआ।", edit: "Edit", remove: (n: string) => `"${n}" की review हटा दें?`, none: "अभी कोई review नहीं।",
    askTitle: "Review माँगें", askHint: "ग्राहक का WhatsApp नंबर डालें — एक tap में review माँगने का message खुलेगा।",
    phone: "ग्राहक का मोबाइल नंबर", askBtn: "WhatsApp पर review माँगें", googleLabel: "Google review link (optional)", googlePh: "https://g.page/r/…",
    googleBtn: "Google review link भेजें", googleHint: "Google Maps → अपना business → 'Get more reviews' से link copy करें। यह link इस phone पर save रहती है।",
    badPhone: "10 अंकों का सही नंबर डालें।",
  },
  en: {
    title: "Customer reviews", hint: "Add a customer's review — on 💬 Testimonial days in the calendar it becomes a beautiful poster.",
    add: "Add", name: "Customer name", text: "Review (short, 2–3 lines)", city: "City", photo: "Customer photo (optional)", rating: "Rating",
    save: "Save", saveFail: "Could not save.", edit: "Edit", remove: (n: string) => `Delete "${n}"'s review?`, none: "No reviews yet.",
    askTitle: "Ask for a review", askHint: "Enter the customer's WhatsApp number — a ready message asking for a review opens in one tap.",
    phone: "Customer mobile number", askBtn: "Ask for review on WhatsApp", googleLabel: "Google review link (optional)", googlePh: "https://g.page/r/…",
    googleBtn: "Send Google review link", googleHint: "Google Maps → your business → 'Get more reviews' to copy the link. Saved on this phone.",
    badPhone: "Enter a valid 10-digit number.",
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
  const [phoneErr, setPhoneErr] = useState("");

  async function load() { const r = await api<{ testimonials: Testimonial[] }>("/api/poster/testimonials"); setList(r.data.testimonials ?? []); }
  useEffect(() => { (async () => {
    if (!(await isLoggedIn())) { router.push("/login?next=/poster/testimonials"); return; }
    try { setGoogle(localStorage.getItem(GOOGLE_KEY) ?? ""); } catch { /* ignore */ }
    const p = await api<{ profiles: Profile[] }>("/api/poster/profiles"); const list = p.data.profiles ?? [];
    const d = list.find((x) => x.is_default) ?? list[0]; if (d) setBiz(d.tagline || d.name || "");
    load();
  })(); }, [router]);

  async function save() {
    if (!draft) return; setBusy(true); setErr("");
    const r = await api<{ testimonial?: Testimonial; error?: string }>("/api/poster/testimonials", { method: "POST", json: draft });
    setBusy(false);
    if (!r.ok) { setErr(r.data.error || s.saveFail); return; }
    setDraft(null); load();
  }
  async function pick(file: File | null) { if (!file || !draft) return; setBusy(true); const small = await compressToFile(file, "testimonial.jpg"); const u = await uploadImage(small, "photo"); setBusy(false); if (u) setDraft({ ...draft, photo_url: u }); }
  async function remove(t: Testimonial) { if (!confirm(s.remove(t.customer_name))) return; await api(`/api/poster/testimonials?id=${t.id}`, { method: "DELETE" }); load(); }
  function saveGoogle(v: string) { setGoogle(v); try { if (v) localStorage.setItem(GOOGLE_KEY, v); else localStorage.removeItem(GOOGLE_KEY); } catch { /* ignore */ } }
  function cleanPhone(): string | null {
    const p = phone.replace(/\D/g, "").replace(/^0+/, "").replace(/^91(?=\d{10}$)/, "");
    if (!/^[6-9]\d{9}$/.test(p)) { setPhoneErr(s.badPhone); return null; }
    setPhoneErr(""); return p;
  }
  function askReview() {
    const p = cleanPhone(); if (!p) return;
    const who = biz ? `${biz} ` : "";
    const msg = `नमस्ते 🙏\n${who}से जुड़ने के लिए धन्यवाद! क्या आप हमारे बारे में 2 लाइन की छोटी सी review और 1 से 5 तक rating ⭐ भेज सकते हैं? आपकी राय हमारे लिए बहुत मायने रखती है।\nधन्यवाद!`;
    window.open(waLink(p, msg), "_blank");
  }
  function sendGoogle() {
    const p = cleanPhone(); if (!p || !google) return;
    const who = biz ? `${biz} ` : "";
    const msg = `नमस्ते 🙏\n${who}पर भरोसा करने के लिए धन्यवाद! अगर आपको हमारी सेवा पसंद आई हो तो कृपया Google पर 5 ⭐ review दें — बस 1 मिनट लगेगा:\n${google}\nधन्यवाद!`;
    window.open(waLink(p, msg), "_blank");
  }

  if (list === null) return <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const inp = "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand";
  const stars = (n: number, onPick?: (v: number) => void) => (
    <span className="inline-flex gap-0.5">{[1, 2, 3, 4, 5].map((i) => <button key={i} type="button" disabled={!onPick} onClick={() => onPick?.(i)} className="p-0"><Star className={`h-5 w-5 ${i <= n ? "fill-amber-400 text-amber-400" : "text-muted"}`} /></button>)}</span>
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/poster/more" className="text-muted"><ChevronLeft className="h-5 w-5" /></Link>
        <h1 className="text-lg font-bold flex-1">💬 {s.title}</h1>
        {!draft && <button type="button" onClick={() => setDraft({ customer_name: "", text: "", rating: 5, city: "", photo_url: null })} className="inline-flex items-center gap-1 rounded-full grad-brand px-3 py-1.5 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> {s.add}</button>}
      </div>
      <p className="text-xs text-muted">{s.hint}</p>
      {draft && (
        <div className="rounded-xl border border-brand bg-brand-soft/40 p-3 space-y-3">
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
                  <Images className="h-3.5 w-3.5" /> Gallery
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
                </label>
              </div>
            </div>
          </div>
          <input className={inp} placeholder={s.name} value={draft.customer_name} onChange={(e) => setDraft({ ...draft, customer_name: e.target.value })} />
          <input className={inp} placeholder={s.city} value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
          <textarea className={inp} rows={4} maxLength={300} placeholder={s.text} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
          <div className="flex items-center gap-3 text-sm"><span>{s.rating}</span>{stars(draft.rating, (v) => setDraft({ ...draft, rating: v }))}<span className="text-xs text-muted">{draft.text.length}/300</span></div>
          {err && <p className="text-sm text-danger">{err}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setDraft(null)} className="rounded-xl border border-border px-4 py-2.5 text-sm">✕</button>
            <button type="button" onClick={save} disabled={busy || !draft.customer_name.trim() || !draft.text.trim()} className="flex-1 rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{s.save}</button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {list.map((t) => (
          <div key={t.id} className="flex items-start gap-3 rounded-xl border border-border p-3">
            <div className="h-12 w-12 rounded-full bg-surface2 overflow-hidden grid place-items-center shrink-0">{t.photo_url ? <img src={t.photo_url} alt="" className="h-full w-full object-cover" /> : "🙂"}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{t.customer_name}{t.city ? <span className="text-muted font-normal"> · {t.city}</span> : null}</p>
              {stars(t.rating)}
              <p className="text-xs text-muted line-clamp-2">{t.text}</p>
            </div>
            <Link href={`/poster/video?testimonial=${t.id}`} className="p-2 text-brand-ink" title={lang === "en" ? "Make a video from this review" : "Is review se video banao"}><Clapperboard className="h-4 w-4" /></Link>
            <button type="button" onClick={() => setDraft({ id: t.id, customer_name: t.customer_name, text: t.text, rating: t.rating, city: t.city ?? "", photo_url: t.photo_url })} className="p-2 text-muted text-xs">{s.edit}</button>
            <button type="button" onClick={() => remove(t)} className="p-2 text-muted"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        {list.length === 0 && !draft && <p className="text-sm text-muted">{s.none}</p>}
      </div>

      <div className="rounded-xl border border-border p-3 space-y-3">
        <h2 className="text-base font-bold">⭐ {s.askTitle}</h2>
        <p className="text-xs text-muted">{s.askHint}</p>
        <input className={inp} inputMode="tel" placeholder={s.phone} value={phone} onChange={(e) => setPhone(e.target.value)} />
        {phoneErr && <p className="text-sm text-danger">{phoneErr}</p>}
        <button type="button" onClick={askReview} className="w-full inline-flex items-center justify-center gap-2 rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white"><MessageCircle className="h-4 w-4" /> {s.askBtn}</button>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">{s.googleLabel}</span>
          <input className={inp} inputMode="url" placeholder={s.googlePh} value={google} onChange={(e) => saveGoogle(e.target.value.trim())} />
          <span className="block text-[11px] text-muted">{s.googleHint}</span>
        </label>
        <button type="button" onClick={sendGoogle} disabled={!google} className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-brand bg-brand-soft px-4 py-3 text-sm font-semibold text-brand-ink disabled:opacity-50"><MessageCircle className="h-4 w-4" /> {s.googleBtn}</button>
      </div>
    </div>
  );
}
