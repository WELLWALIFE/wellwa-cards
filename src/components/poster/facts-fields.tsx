"use client";
// The profile's detail questions, in the step they belong to (owner's flow, 2 Oct 2026):
//   company  — step 2 "Company / Firm": your role in it, banner & photos, since / experience / team, timings, home service, areas,
//              payments & UPI (only what the website shows — no bank details, no KYC), qualification, social, map
//   products — step 3 "Products / Services": what makes you special, who buys, the offer, your work in your words
// One component, three screens: the set-up (step 2), My products (step 3) and the build form ("Check your
// details"), so a question is asked once and the "Make it better" chips (q-… ids) still land on it anywhere.
import { useState } from "react";
import { catalogCopyFor } from "@/lib/catalog-copy";
import { Camera, LoaderCircle, X } from "lucide-react";
import { uploadImage } from "@/lib/poster-client";
import { compressToFile, dataUrlToFile } from "@/lib/image-utils";
import { ImageCropper } from "@/components/editor/image-cropper";
import { UPI_RE, type CardFacts } from "@/lib/card-facts";

/** A change to some of the answers; `social` may carry only the one link that changed. */
export type FactsPatch = Partial<Omit<CardFacts, "social">> & { social?: Partial<CardFacts["social"]> };
export type FactsGroup = "company" | "products";

/** The facts each step saves — what its PATCH to /api/card/facts carries, nothing from another step. */
export const COMPANY_FACT_KEYS = ["designation", "bannerUrl", "photos", "since", "experience", "team", "hours", "homeService", "areas", "payments", "upi", "qualification", "social", "tradeAnswers"] as const;
export const PRODUCT_FACT_KEYS = ["special", "specialText", "customers", "offer", "work"] as const;
export const YOU_FACT_KEYS = ["whatsapp"] as const;
export function pickFacts(f: CardFacts, keys: readonly (keyof CardFacts)[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = f[k];
  return out;
}

export const box = "rounded-xl border border-border bg-surface px-3.5 py-3 text-[15px]";
export const field = `mt-1 w-full ${box}`;
export const chipCls = (on: boolean) => `rounded-full border-2 px-3.5 py-2 text-sm font-medium ${on ? "border-brand bg-brand-soft text-brand-ink" : "border-border bg-surface"}`;

/** One question box — big and simple. The id is what a "Make it better" chip scrolls to. */
export function Sec({ id, title, hint, children }: { id?: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4 space-y-2 rounded-2xl border border-border bg-surface p-4">
      <p className="text-[15px] font-semibold">{title}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      {children}
    </section>
  );
}

// eslint-disable-next-line @next/next/no-img-element
const Img = (p: { src: string; className?: string }) => <img src={p.src} alt="" className={p.className} />;

export const DESIGNATIONS = ["Owner", "Proprietor", "Founder", "Director", "Partner", "Manager", "Dr.", "Advocate", "CA", "Consultant"];
export const SPECIAL_CHIPS = ["💰 Fair prices", "⭐ Best quality", "🚚 Fast delivery", "🧑‍🔧 Expert team", "✂️ Custom orders", "🤝 Trusted by many customers"];
export const CUSTOMER_CHIPS = ["👪 Families", "🏪 Shops", "🏢 Offices", "🎓 Students", "👵 Senior citizens", "🙋 Everyone"];
export const PAYMENT_CHIPS = ["💵 Cash", "📱 UPI", "💳 Card", "🧾 EMI"];
const HOURS_CHIPS = ["Mon–Sat 10 AM – 8 PM", "All days 9 AM – 9 PM", "Mon–Fri 10 AM – 6 PM"];

export function FactsFields({ group, facts, setF, hi, professional, hasAbout, category }: {
  group: FactsGroup;
  /** The trade: step 3 asks in its words (classes for a school, dishes for a restaurant — catalog-copy.ts). */
  category?: string;
  facts: CardFacts;
  setF: (p: FactsPatch) => void;
  hi: boolean;
  /** A professional (doctor, CA, lawyer…) is asked for the degree / registration. */
  professional?: boolean;
  /** The set-up already has an "About" → "your work in your words" is not asked again. */
  hasAbout?: boolean;
}) {
  const T = (en: string, h: string) => (hi ? h : en);
  const copy = catalogCopyFor(category);
  // The trade's chips, plus anything already ticked from another list, so it can still be un-ticked.
  const specialChips = [...copy.special, ...facts.special.filter((x) => !copy.special.includes(x))];
  const customerChips = [...copy.customers, ...facts.customers.filter((x) => !copy.customers.includes(x))];
  const [crop, setCrop] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const toggle = (key: "customers" | "special" | "payments", v: string) => {
    const list = facts[key];
    setF({ [key]: list.includes(v) ? list.filter((x) => x !== v) : [...list, v] } as FactsPatch);
  };
  const upiOn = facts.payments.some((p) => /upi/i.test(p));
  const OFFLINE = T("No internet — please try again.", "internet नहीं है — दोबारा try करें।");
  const FAILED = T("Could not upload the photo. Please try again.", "Photo upload नहीं हो पाई। दोबारा try करें।");

  function pickFile(f: File) {
    const r = new FileReader();
    r.onload = () => setCrop(String(r.result || ""));
    r.onerror = () => setErr(T("Could not open that photo.", "वो photo खुल नहीं पाई।"));
    r.readAsDataURL(f);
  }
  async function banner(dataUrl: string) {
    setCrop(""); setErr(""); setBusy("banner");
    try {
      const url = await uploadImage(dataUrlToFile(dataUrl, "banner.jpg"), "wide");
      if (url) setF({ bannerUrl: url }); else setErr(FAILED);
    } catch { setErr(OFFLINE); } finally { setBusy(""); }
  }
  async function addPhoto(f: File) {
    if (facts.photos.length >= 5) return;
    setBusy("photo"); setErr("");
    try {
      const url = await uploadImage(await compressToFile(f, "photo.jpg", 1600, 0.85), "wide");
      if (url) setF({ photos: [...facts.photos, url].slice(0, 5) }); else setErr(FAILED);
    } catch { setErr(OFFLINE); } finally { setBusy(""); }
  }

  if (group === "products") return (
    <>
      <Sec id="q-special" title={T("What makes you special?", "आपकी खास बात क्या है?")} hint={T("Tap 3 to 5 that are true — they become your website's highlights.", "3 से 5 दबाएँ जो सही हैं — यही आपकी website की highlights बनेंगी।")}>
        <div className="flex flex-wrap gap-2">
          {specialChips.map((c) => <button key={c} type="button" onClick={() => toggle("special", c)} className={chipCls(facts.special.includes(c))}>{c}</button>)}
        </div>
        <input value={facts.specialText} onChange={(e) => setF({ specialText: e.target.value })} placeholder={T("In your own words — e.g. pure desi ghee only", "अपने शब्दों में — जैसे सिर्फ़ शुद्ध देसी घी")} className={field} />
      </Sec>
      <Sec id="q-customers" title={T("Who buys from you?", "आपसे कौन खरीदता है?")}>
        <div className="flex flex-wrap gap-2">
          {customerChips.map((c) => <button key={c} type="button" onClick={() => toggle("customers", c)} className={chipCls(facts.customers.includes(c))}>{c}</button>)}
        </div>
      </Sec>
      <Sec id="q-offer" title={T("Any offer right now?", "अभी कोई offer चल रहा है?")} hint={T("Optional — shown on the card and the website.", "Optional — card और website पर दिखेगा।")}>
        <input value={facts.offer} onChange={(e) => setF({ offer: e.target.value })} placeholder={T("e.g. Free delivery above ₹500", "जैसे ₹500 से ऊपर free delivery")} className={field} />
      </Sec>
      {!hasAbout && (
        <Sec id="q-work" title={T(copy.work, copy.workHi)} hint={T("In your own words — 2 or 3 lines is enough.", "अपने शब्दों में — 2-3 लाइन काफ़ी हैं।")}>
          <textarea value={facts.work} onChange={(e) => setF({ work: e.target.value })} rows={3} placeholder={T(copy.workEg, copy.workEgHi)} className={field} />
        </Sec>
      )}
    </>
  );

  return (
    <>
      {crop && <ImageCropper src={crop} aspect={3} outWidth={1500} format="jpeg" onApply={banner} onCancel={() => setCrop("")} />}
      <Sec id="q-designation" title={T("Your role in the company", "Company में आपका पद")} hint={T("Shown under your name on the card and website — e.g. Rajesh Sharma · Owner.", "Card और website पर आपके नाम के नीचे — जैसे Rajesh Sharma · Owner।")}>
        <div className="flex flex-wrap gap-1.5">
          {DESIGNATIONS.map((d) => <button key={d} type="button" onClick={() => setF({ designation: facts.designation === d ? "" : d })} className={chipCls(facts.designation === d)}>{d}</button>)}
        </div>
        <input value={facts.designation} onChange={(e) => setF({ designation: e.target.value.slice(0, 60) })} placeholder={T("Or type it — e.g. Senior Consultant", "या लिखें — जैसे Senior Consultant")} className={field} />
      </Sec>
      <Sec id="q-photos" title={T("Banner and photos", "Banner और photos")} hint={T("The banner is the wide picture on top of your website; the photos make the gallery.", "Banner website के ऊपर की चौड़ी photo है; बाकी photos से gallery बनती है।")}>
        <p className="text-sm font-semibold">{T("Shop front / banner photo", "दुकान के सामने की / banner photo")}</p>
        {facts.bannerUrl ? (
          <div className="relative overflow-hidden rounded-xl border border-border" style={{ aspectRatio: "3 / 1" }}>
            <Img src={facts.bannerUrl} className="h-full w-full object-cover" />
            <button type="button" onClick={() => setF({ bannerUrl: "" })} className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white" aria-label={T("Remove the banner photo", "Banner photo हटाएँ")}><X className="h-3.5 w-3.5" /></button>
          </div>
        ) : (
          <label className="grid cursor-pointer place-items-center gap-1 rounded-xl border-2 border-dashed border-border bg-surface2 py-6 text-sm text-muted">
            {busy === "banner" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Camera className="h-6 w-6" />} {T("Add your shop / office photo", "दुकान / office की photo डालें")}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) pickFile(f); }} />
          </label>
        )}
        <p className="pt-1 text-sm font-semibold">{T("More photos (up to 5)", "और photos (5 तक)")}</p>
        <div className="flex flex-wrap gap-2">
          {facts.photos.map((u, i) => (
            <div key={u} className="relative h-20 w-20 overflow-hidden rounded-xl border border-border">
              <Img src={u} className="h-full w-full object-cover" />
              <button type="button" onClick={() => setF({ photos: facts.photos.filter((_, k) => k !== i) })} className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white" aria-label={T("Remove photo", "Photo हटाएँ")}><X className="h-3 w-3" /></button>
            </div>
          ))}
          {facts.photos.length < 5 && (
            <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-border bg-surface2 text-muted">
              {busy === "photo" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Camera className="h-6 w-6" />}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) addPhoto(f); }} />
            </label>
          )}
        </div>
        {err && <p className="text-sm text-danger">{err}</p>}
      </Sec>

      <Sec id="q-since" title={T("Since when, and how big", "कब से, और कितनी बड़ी team")}>
        <div className="grid grid-cols-3 gap-2">
          <label className="block text-sm font-semibold">{T("Since (year)", "कब से (साल)")}
            <input value={facts.since} onChange={(e) => setF({ since: e.target.value.replace(/\D/g, "").slice(0, 4) })} inputMode="numeric" placeholder="2015" className={field} /></label>
          <label className="block text-sm font-semibold">{T("Experience (yrs)", "Experience (साल)")}
            <input value={facts.experience} onChange={(e) => setF({ experience: e.target.value.replace(/\D/g, "").slice(0, 2) })} inputMode="numeric" placeholder="10" className={field} /></label>
          <label className="block text-sm font-semibold">{T("Team", "Team")}
            <input value={facts.team} onChange={(e) => setF({ team: e.target.value })} placeholder={T("e.g. 12 people", "जैसे 12 लोग")} className={field} /></label>
        </div>
      </Sec>

      <Sec id="q-hours" title={T("Your timings", "आपका समय")}>
        <div className="flex flex-wrap gap-2">
          {HOURS_CHIPS.map((c) => <button key={c} type="button" onClick={() => setF({ hours: c })} className={chipCls(facts.hours === c)}>{c}</button>)}
        </div>
        <input value={facts.hours} onChange={(e) => setF({ hours: e.target.value })} placeholder={T("Or type your own, e.g. Sunday closed", "या खुद लिखें, जैसे रविवार बंद")} className={field} />
      </Sec>

      <Sec id="q-delivery" title={T("Do you deliver or visit homes?", "आप delivery या घर पर service देते हैं?")}>
        <div className="grid grid-cols-2 gap-2">
          {([["yes", T("✅ Yes", "✅ हाँ")], ["no", T("❌ No", "❌ नहीं")]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setF({ homeService: k })} className={`rounded-xl border-2 py-3 font-semibold ${facts.homeService === k ? "border-brand bg-brand-soft" : "border-border bg-surface"}`}>{l}</button>
          ))}
        </div>
      </Sec>

      <Sec id="q-areas" title={T("Which areas do you serve?", "आप किन इलाकों में काम करते हैं?")}>
        <input value={facts.areas} onChange={(e) => setF({ areas: e.target.value })} placeholder={T("e.g. Karol Bagh, Rajouri Garden, Janakpuri", "जैसे Karol Bagh, Rajouri Garden, Janakpuri")} className={field} />
      </Sec>

      <Sec id="q-pay" title={T("How can customers pay?", "Customer payment कैसे कर सकते हैं?")} hint={T("Only what the website shows. Bank details are not asked here — add them later, when you want payouts.", "सिर्फ़ website पर दिखाने के लिए। Bank details यहाँ नहीं — बाद में, जब payout चाहिए।")}>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_CHIPS.map((c) => <button key={c} type="button" onClick={() => toggle("payments", c)} className={chipCls(facts.payments.includes(c))}>{c}</button>)}
        </div>
        {upiOn && (
          <label className="block text-sm font-semibold">{T("Your UPI ID", "आपकी UPI ID")}
            <input value={facts.upi} onChange={(e) => setF({ upi: e.target.value.trim() })} autoCapitalize="none" spellCheck={false} placeholder={T("e.g. sharmasweets@okhdfc", "जैसे sharmasweets@okhdfc")} className={field} />
            {!!facts.upi && !UPI_RE.test(facts.upi) && <span className="mt-1 block text-xs font-semibold text-danger">{T("This does not look like a UPI ID. It looks like name@bank.", "ये UPI ID नहीं लगती। UPI ID ऐसी होती है — name@bank")}</span>}
          </label>
        )}
      </Sec>

      {professional && (
        <Sec id="q-qual" title={T("Your degree / registration (optional)", "आपकी degree / registration (ज़रूरी नहीं)")}>
          <input value={facts.qualification} onChange={(e) => setF({ qualification: e.target.value })} placeholder={T("e.g. MBBS, MD · Reg. no. 12345", "जैसे MBBS, MD · Reg. no. 12345")} className={field} />
        </Sec>
      )}

      <Sec id="q-social" title={T("Social media and Google Maps", "Social media और Google Maps")} hint={T("Optional — paste the links you have.", "Optional — जो links हैं, paste करें।")}>
        {([["instagram", "Instagram", "instagram.com/yourshop"], ["facebook", "Facebook", "facebook.com/yourshop"], ["youtube", "YouTube", "youtube.com/@yourshop"]] as const).map(([k, l, ph]) => (
          <label key={k} className="block text-sm font-semibold">{l}
            <input value={facts.social[k]} onChange={(e) => setF({ social: { [k]: e.target.value.trim() } })} placeholder={ph} inputMode="url" autoCapitalize="none" className={field} />
          </label>
        ))}
        <label id="q-map" className="block scroll-mt-4 text-sm font-semibold">{T("Google Maps link", "Google Maps का link")}
          <input value={facts.social.google} onChange={(e) => setF({ social: { google: e.target.value.trim() } })} placeholder="maps.app.goo.gl/…" inputMode="url" autoCapitalize="none" className={field} />
          <span className="mt-1 block text-xs font-normal text-muted">{T("Google Maps → your shop → Share → Copy link", "Google Maps → अपनी दुकान → Share → Copy link")}</span>
        </label>
      </Sec>
    </>
  );
}
