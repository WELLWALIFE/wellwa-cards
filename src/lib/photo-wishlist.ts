// The photos a website of this trade still needs, and where each one goes (owner's call, 3 Oct 2026: an agency
// asks for the gate, the classroom, the playground; we were showing stock). Computed from what the owner has
// already uploaded — the banner, work photos, product photos, their portrait — so nothing is asked twice; and
// `applyOwnPhotos` puts the uploads into the live card in place of stock or AI pictures, without touching a word.
//
// Isomorphic: no 'use client', no 'server-only'.
import type { Card, CardPage, CardBlock } from "@/lib/types";
import type { CardFacts, SavedProduct } from "@/lib/card-facts";
import { categoryOf } from "@/lib/poster-categories";
import { recipeFor } from "@/lib/site-recipes";

export type Shot = { en: string; hi: string };
export type Wish =
  | { key: string; slot: "banner"; en: string; hi: string; why: string; whyHi: string }
  | { key: string; slot: "photo"; en: string; hi: string; why: string; whyHi: string }
  | { key: string; slot: "product"; productId: string; en: string; hi: string; why: string; whyHi: string }
  | { key: string; slot: "portrait"; en: string; hi: string; why: string; whyHi: string }
  | { key: string; slot: "logo"; en: string; hi: string; why: string; whyHi: string };

const s = (en: string, hi: string): Shot => ({ en, hi });
/** The shots a trade's website wants, best first; the first is the banner. */
const SHOTS: Record<string, Shot[]> = {
  school: [s("School gate / building from the road", "सड़क से स्कूल का गेट / इमारत"), s("A classroom with children", "बच्चों के साथ कक्षा"), s("Playground or sports", "खेल का मैदान / खेल"), s("Computer or science lab", "कंप्यूटर / साइंस लैब"), s("Teachers / staff together", "शिक्षक / स्टाफ़ साथ में"), s("Assembly or annual function", "प्रार्थना सभा / वार्षिक उत्सव"), s("School bus", "स्कूल बस")],
  playschool: [s("Entrance / play area from outside", "बाहर से एंट्री / प्ले एरिया"), s("Classroom with toys and children", "खिलौनों और बच्चों के साथ कक्षा"), s("Outdoor play / slides", "बाहर खेल / झूले"), s("Activity time (art, music)", "एक्टिविटी (आर्ट, म्यूज़िक)"), s("Teachers with children", "बच्चों के साथ शिक्षिकाएँ"), s("Meal / rest area", "खाने / आराम की जगह")],
  coaching: [s("Classroom with students", "छात्रों के साथ क्लासरूम"), s("Institute board / entrance", "इंस्टीट्यूट का बोर्ड / एंट्री"), s("Teacher at the board", "बोर्ड पर पढ़ाते शिक्षक"), s("Toppers / results board", "टॉपर / रिज़ल्ट बोर्ड"), s("Library / study area", "लाइब्रेरी / स्टडी एरिया")],
  college: [s("Campus building", "कैंपस की इमारत"), s("Classroom / lecture hall", "क्लासरूम / लेक्चर हॉल"), s("Lab / library", "लैब / लाइब्रेरी"), s("Students on campus", "कैंपस में छात्र"), s("Hostel / canteen", "हॉस्टल / कैंटीन"), s("Convocation / event", "दीक्षांत / कार्यक्रम")],
  computer: [s("Computer lab with students", "छात्रों के साथ कंप्यूटर लैब"), s("Centre board / entrance", "सेंटर का बोर्ड / एंट्री"), s("Certificate ceremony", "सर्टिफ़िकेट वितरण"), s("Trainer teaching", "पढ़ाते ट्रेनर")],
  teacher: [s("You teaching (at the board)", "आप पढ़ाते हुए"), s("Students in class", "क्लास में छात्र"), s("Study material / notes", "नोट्स / सामग्री"), s("Results / certificates", "रिज़ल्ट / सर्टिफ़िकेट")],
  dance: [s("A class in session", "चलती हुई क्लास"), s("Stage performance", "मंच पर प्रस्तुति"), s("Studio / hall", "स्टूडियो / हॉल"), s("Students in costume", "पोशाक में छात्र"), s("Trophies / annual day", "ट्रॉफ़ी / वार्षिक दिवस")],
  restaurant: [s("Your signature dish, close up", "आपकी ख़ास डिश, पास से"), s("Seating / dining area", "बैठने की जगह"), s("Front of the restaurant", "रेस्टोरेंट का सामने का हिस्सा"), s("Thali or a full table", "थाली या भरी हुई टेबल"), s("Kitchen / chef at work", "किचन / शेफ़ काम करते हुए"), s("Dessert or drinks", "मीठा या ड्रिंक्स")],
  cafe: [s("Coffee / tea, close up", "कॉफ़ी / चाय, पास से"), s("Seating corner", "बैठने का कोना"), s("Counter / front", "काउंटर / सामने"), s("Snacks on the table", "टेबल पर स्नैक्स")],
  sweets: [s("Sweets counter, full", "मिठाई का भरा काउंटर"), s("Your famous sweet, close up", "आपकी मशहूर मिठाई, पास से"), s("Shop front", "दुकान का सामने का हिस्सा"), s("Namkeen / bakery section", "नमकीन / बेकरी"), s("Gift packs", "गिफ़्ट पैक"), s("Kitchen / halwai at work", "कारख़ाना / हलवाई")],
  doctor: [s("Clinic front / board", "क्लिनिक का सामने / बोर्ड"), s("Consulting room", "कंसल्टिंग रूम"), s("Reception / waiting area", "रिसेप्शन / वेटिंग एरिया"), s("You with a patient (with consent)", "मरीज़ के साथ आप (अनुमति से)"), s("Equipment / lab", "उपकरण / लैब")],
  dentist: [s("Dental chair / treatment room", "डेंटल चेयर / ट्रीटमेंट रूम"), s("Clinic front", "क्लिनिक का सामने"), s("Reception", "रिसेप्शन"), s("Equipment, close up", "उपकरण, पास से")],
  hospital: [s("Hospital building", "अस्पताल की इमारत"), s("Reception / OPD", "रिसेप्शन / OPD"), s("Ward / rooms", "वार्ड / कमरे"), s("ICU / OT (door view)", "ICU / OT (बाहर से)"), s("Doctors team", "डॉक्टरों की टीम"), s("Ambulance", "एम्बुलेंस")],
  salon: [s("Salon interior", "सैलून का अंदर"), s("A finished hairstyle / makeup", "तैयार हेयरस्टाइल / मेकअप"), s("Front / board", "सामने / बोर्ड"), s("Stylist at work", "काम करते स्टाइलिस्ट"), s("Products shelf", "प्रोडक्ट शेल्फ़")],
  gym: [s("Gym floor with equipment", "मशीनों के साथ जिम फ़्लोर"), s("A class / people training", "ट्रेनिंग करते लोग"), s("Front / board", "सामने / बोर्ड"), s("Trainer", "ट्रेनर"), s("Transformation / results", "ट्रांसफ़ॉर्मेशन")],
  kirana: [s("Shop front with board", "बोर्ड के साथ दुकान का सामने"), s("Full shelves inside", "अंदर भरी अलमारियाँ"), s("Counter / billing", "काउंटर / बिलिंग"), s("Fresh items / bestsellers", "ताज़ा सामान / सबसे ज़्यादा बिकने वाला")],
  garments: [s("Showroom front", "शोरूम का सामने"), s("Display of your best range", "आपकी बेहतरीन रेंज"), s("Inside the showroom", "शोरूम के अंदर"), s("Trial / customer", "ट्रायल / ग्राहक"), s("New arrivals", "नया माल")],
  jewellery: [s("Showroom front", "शोरूम का सामने"), s("Jewellery display, close up", "ज्वेलरी डिस्प्ले, पास से"), s("Bridal set", "ब्राइडल सेट"), s("Inside the showroom", "शोरूम के अंदर"), s("Hallmark / certificate", "हॉलमार्क / सर्टिफ़िकेट")],
  mobile: [s("Shop front", "दुकान का सामने"), s("Display counter of phones", "फ़ोन का डिस्प्ले काउंटर"), s("Accessories wall", "एक्सेसरीज़ की दीवार"), s("Repair desk", "रिपेयर डेस्क")],
  furniture: [s("Showroom front", "शोरूम का सामने"), s("Sofa / bedroom set", "सोफ़ा / बेडरूम सेट"), s("Inside the showroom", "शोरूम के अंदर"), s("Modular kitchen / custom work", "मॉड्यूलर किचन / कस्टम काम")],
  hardware: [s("Shop front", "दुकान का सामने"), s("Paint / sanitary display", "पेंट / सैनिटरी डिस्प्ले"), s("Inside with stock", "अंदर सामान के साथ"), s("Counter", "काउंटर")],
  medical: [s("Store front with board", "बोर्ड के साथ स्टोर का सामने"), s("Medicine shelves", "दवाइयों की अलमारियाँ"), s("Counter / pharmacist", "काउंटर / फ़ार्मासिस्ट")],
  hotel: [s("Hotel building / entrance", "होटल की इमारत / एंट्री"), s("A room, well lit", "कमरा, अच्छी रोशनी में"), s("Restaurant / dining", "रेस्टोरेंट / डाइनिंग"), s("Lobby / reception", "लॉबी / रिसेप्शन"), s("Banquet / pool / view", "बैंक्वेट / पूल / नज़ारा")],
  realestate: [s("A property you are selling", "कोई प्रॉपर्टी जो आप बेच रहे हैं"), s("Office front", "ऑफ़िस का सामने"), s("Site / plots", "साइट / प्लॉट"), s("A completed deal / handover", "सौदा / चाबी हस्तांतरण")],
  builder: [s("A finished house / building", "बना हुआ मकान / इमारत"), s("Work in progress", "चलता हुआ काम"), s("Team on site", "साइट पर टीम"), s("Interior of a finished project", "पूरे प्रोजेक्ट का अंदर")],
  interior: [s("Your best finished room", "आपका सबसे अच्छा तैयार कमरा"), s("Modular kitchen", "मॉड्यूलर किचन"), s("Before / after", "पहले / बाद"), s("3D design vs real", "3D डिज़ाइन और असली")],
  auto: [s("Garage / showroom front", "गैराज / शोरूम का सामने"), s("Work bay with a vehicle", "गाड़ी के साथ वर्क बे"), s("Mechanics at work", "काम करते मैकेनिक"), s("Spare parts / tyres", "स्पेयर पार्ट्स / टायर")],
  electrician: [s("You at work (safely)", "काम करते हुए आप"), s("A finished job", "पूरा किया हुआ काम"), s("Tools / van", "औज़ार / वैन"), s("Team", "टीम")],
  photography: [s("Your best wedding / portrait shot", "आपका सबसे अच्छा शादी / पोर्ट्रेट शॉट"), s("Studio", "स्टूडियो"), s("You with the camera", "कैमरे के साथ आप"), s("Album / prints", "एल्बम / प्रिंट")],
  event: [s("A decorated stage / mandap", "सजा हुआ मंच / मंडप"), s("Full venue set-up", "पूरा सजा हुआ वेन्यू"), s("Lighting at night", "रात की लाइटिंग"), s("Team at work", "काम करती टीम")],
  catering: [s("A full buffet spread", "भरा हुआ बुफ़े"), s("Live counter", "लाइव काउंटर"), s("Team serving", "परोसती टीम"), s("Your signature dish", "आपकी ख़ास डिश")],
  ca: [s("Office / meeting room", "ऑफ़िस / मीटिंग रूम"), s("You at your desk", "डेस्क पर आप"), s("Team", "टीम"), s("Certificates on the wall", "दीवार पर सर्टिफ़िकेट")],
  lawyer: [s("Chamber / office", "चैंबर / ऑफ़िस"), s("You in court dress", "कोर्ट ड्रेस में आप"), s("Law books / desk", "क़ानून की किताबें / डेस्क"), s("Team", "टीम")],
  travel: [s("A tour group / happy customers", "टूर ग्रुप / खुश ग्राहक"), s("Office front", "ऑफ़िस का सामने"), s("Your vehicles", "आपकी गाड़ियाँ"), s("A destination you sell", "कोई जगह जो आप बेचते हैं")],
  agri: [s("Shop front", "दुकान का सामने"), s("Seeds / fertilizer stock", "बीज / खाद का स्टॉक"), s("Farmers at the counter", "काउंटर पर किसान"), s("Nursery plants", "नर्सरी के पौधे")],
  dairy: [s("Dairy / shop front", "डेयरी / दुकान का सामने"), s("Milk / paneer / ghee, close up", "दूध / पनीर / घी, पास से"), s("Cattle / farm", "पशु / फ़ार्म"), s("Delivery", "डिलीवरी")],
  temple: [s("Temple from the front", "मंदिर सामने से"), s("The deity / sanctum", "विग्रह / गर्भगृह"), s("Aarti / festival crowd", "आरती / उत्सव"), s("Bhandara / seva", "भंडारा / सेवा")],
  ngo: [s("A camp / activity with people", "शिविर / लोगों के साथ गतिविधि"), s("Team", "टीम"), s("Beneficiaries (with consent)", "लाभार्थी (अनुमति से)"), s("Office / banner", "ऑफ़िस / बैनर")],
  political: [s("You with the public", "जनता के साथ आप"), s("A rally / meeting", "रैली / सभा"), s("Development work", "विकास कार्य"), s("With party leaders", "पार्टी नेताओं के साथ")],
};
const BY_GROUP: Record<string, Shot[]> = {
  Retail: [s("Shop front with board", "बोर्ड के साथ दुकान का सामने"), s("Inside with stock", "अंदर सामान के साथ"), s("Your bestsellers, close up", "सबसे ज़्यादा बिकने वाला, पास से"), s("Counter / team", "काउंटर / टीम")],
  Food: [s("Your best dish, close up", "आपकी बेहतरीन डिश, पास से"), s("Front / seating", "सामने / बैठने की जगह"), s("Kitchen", "किचन"), s("A full table", "भरी हुई टेबल")],
  Health: [s("Clinic / centre front", "क्लिनिक / सेंटर का सामने"), s("Treatment room", "ट्रीटमेंट रूम"), s("Reception", "रिसेप्शन"), s("Team", "टीम")],
  Services: [s("Office / shop front", "ऑफ़िस / दुकान का सामने"), s("You at work", "काम करते हुए आप"), s("A finished job", "पूरा किया हुआ काम"), s("Team", "टीम")],
  Education: [s("Entrance / building", "एंट्री / इमारत"), s("Classroom with students", "छात्रों के साथ कक्षा"), s("Activity", "गतिविधि"), s("Teachers", "शिक्षक")],
  Sales: [s("You with a customer", "ग्राहक के साथ आप"), s("Products / demo", "प्रोडक्ट / डेमो"), s("Office / event", "ऑफ़िस / कार्यक्रम"), s("Team / awards", "टीम / अवार्ड")],
  Industry: [s("Factory / godown front", "फ़ैक्टरी / गोदाम का सामने"), s("Production / stock", "उत्पादन / स्टॉक"), s("Team", "टीम"), s("Loading / dispatch", "लोडिंग / डिस्पैच")],
  Community: [s("You with people", "लोगों के साथ आप"), s("An event", "कार्यक्रम"), s("Work on the ground", "ज़मीन पर काम"), s("Team", "टीम")],
  Personal: [s("A good photo of you", "आपकी एक अच्छी फ़ोटो"), s("With family / friends", "परिवार / दोस्तों के साथ")],
};

/** The shots a trade's website wants, best first. */
export function tradeShots(category: string): Shot[] {
  const c = categoryOf(category);
  return SHOTS[category] ?? (c ? BY_GROUP[c.group] : undefined) ?? BY_GROUP.Services;
}

const WANT_PHOTOS = 6;

/** What is still missing, in the order it matters: the banner, the work photos, a photo per product without
 *  one, the portrait (when the card leads with the person), the logo. */
export function photoWishlist(opts: { category: string; facts: CardFacts; products: SavedProduct[]; card: Card | null; lang: "en" | "hi" | "hinglish" }): Wish[] {
  const { category, facts, products, card } = opts;
  const shots = tradeShots(category);
  const out: Wish[] = [];
  const c = categoryOf(category);
  const professional = c?.persona === "professional";
  if (!facts.bannerUrl) {
    const b = shots[0];
    out.push({ key: "banner", slot: "banner", en: b.en, hi: b.hi, why: "The big picture on top of your website and card", whyHi: "आपकी website और card के ऊपर की बड़ी तस्वीर" });
  }
  const have = facts.photos.length;
  const want = Math.max(0, Math.min(WANT_PHOTOS, shots.length - 1) - have);
  shots.slice(1, 1 + want + have).slice(have).forEach((sh, i) => {
    out.push({ key: `photo-${have + i}`, slot: "photo", en: sh.en, hi: sh.hi, why: "Goes in your photo gallery and the about section", whyHi: "आपकी photo gallery और about में जाएगी" });
  });
  const recipe = recipeFor(category);
  const thing = recipe.catalog === "menu" ? { en: "dish", hi: "डिश" } : recipe.catalog === "courses" ? { en: "class", hi: "कक्षा" } : recipe.catalog === "services" || recipe.catalog === "treatments" ? { en: "service", hi: "सेवा" } : { en: "product", hi: "प्रोडक्ट" };
  for (const p of products.filter((p) => !p.photo && !p.images.length).slice(0, 8)) {
    out.push({ key: `product-${p.id}`, slot: "product", productId: p.id, en: `${p.name} — a clear photo of this ${thing.en}`, hi: `${p.name} — इस ${thing.hi} की साफ़ फ़ोटो`, why: "Shown on its card with the price", whyHi: "दाम के साथ इसके card पर दिखेगी" });
  }
  if (professional && card && !card.avatarUrl) {
    out.push({ key: "portrait", slot: "portrait", en: "Your portrait — face clear, plain background", hi: "आपकी फ़ोटो — चेहरा साफ़, सादा background", why: "Customers come for you; it is the first thing they see", whyHi: "ग्राहक आपके लिए आते हैं; यही पहली चीज़ दिखती है" });
  }
  if (card && !card.site?.logoUrl && !professional) {
    out.push({ key: "logo", slot: "logo", en: "Your logo (if you have one)", hi: "आपका logo (अगर है)", why: "On the website header and the card", whyHi: "website के header और card पर" });
  }
  return out;
}

/** True for a picture the owner uploaded (their banner, work photos, product photos, portrait, logo). */
function ownSet(facts: CardFacts, products: SavedProduct[], card: Card): Set<string> {
  const set = new Set<string>();
  const add = (u?: string | null) => { if (u) set.add(u.split("?")[0]); };
  add(facts.bannerUrl); facts.photos.forEach(add);
  for (const p of products) { add(p.photo); p.images.forEach(add); }
  add(card.avatarUrl); add(card.site?.logoUrl);
  return set;
}
const isOwn = (set: Set<string>, u?: string | null) => !!u && set.has(u.split("?")[0]);

/** The owner's uploads put into the live card where a stock or AI picture stood: the banner → cover and hero,
 *  the work photos → gallery and about, a product's photo → its card. Words are never touched. Returns the new
 *  card and what changed; `changed` 0 = nothing to do. */
export function applyOwnPhotos(card: Card, facts: CardFacts, products: SavedProduct[]): { card: Card; changed: string[] } {
  const own = ownSet(facts, products, card);
  const changed: string[] = [];
  let out: Card = { ...card, pages: card.pages.map((p) => ({ ...p, blocks: [...p.blocks] })) };
  // 1. banner → cover + hero picture
  if (facts.bannerUrl) {
    if (!isOwn(own, out.coverUrl) || out.coverUrl !== facts.bannerUrl) { if (out.coverUrl !== facts.bannerUrl) { out = { ...out, coverUrl: facts.bannerUrl }; changed.push("banner"); } }
    const heroImg = out.site?.hero?.imageUrl;
    if (out.site?.hero && heroImg && !isOwn(own, heroImg)) out = { ...out, site: { ...out.site, hero: { ...out.site.hero, imageUrl: facts.bannerUrl } } };
  }
  // 2. work photos → about picture, gallery
  const photos = facts.photos.filter(Boolean);
  if (photos.length) {
    out.pages = out.pages.map((p): CardPage => {
      if (p.hidden) return p;
      const blocks = p.blocks.map((b): CardBlock => {
        if (b.kind === "about" && b.imageUrl && !isOwn(own, b.imageUrl)) { changed.push("about photo"); return { ...b, imageUrl: photos[0] }; }
        if (b.kind === "gallery") {
          const keep = b.images.filter((i) => isOwn(own, i.url));
          const missing = photos.filter((u) => !keep.some((i) => i.url?.split("?")[0] === u.split("?")[0]));
          if (!missing.length && keep.length === b.images.length) return b;
          changed.push("gallery");
          return { ...b, images: [...keep, ...missing.map((url) => ({ url, color: b.images[0]?.color ?? "#e2e8f0", label: "" }))] };
        }
        if ((b.kind === "image" || b.kind === "carousel") && b.images.some((i) => !isOwn(own, i.url))) {
          changed.push("photos");
          return { ...b, images: b.images.map((i, k) => (isOwn(own, i.url) ? i : { ...i, url: photos[k % photos.length] })) };
        }
        return b;
      });
      return { ...p, blocks };
    });
  }
  // 3. a product's own photo → its card
  const byName = new Map(products.filter((p) => p.photo || p.images.length).map((p) => [p.name.trim().toLowerCase(), p] as const));
  if (byName.size) {
    out.pages = out.pages.map((p): CardPage => ({
      ...p,
      blocks: p.blocks.map((b): CardBlock => {
        if (b.kind !== "product") return b;
        let touched = false;
        const items = b.items.map((it) => {
          const sp = byName.get(it.name.trim().toLowerCase());
          if (!sp) return it;
          const images = (sp.images.length ? sp.images : [sp.photo]).filter(Boolean).slice(0, 3);
          if (!images.length || (it.imageUrl === images[0] && (it.images ?? []).join() === images.join())) return it;
          touched = true;
          return { ...it, imageUrl: images[0], images };
        });
        if (touched) changed.push("product photos");
        return touched ? { ...b, items } : b;
      }),
    }));
  }
  return { card: out, changed: [...new Set(changed)] };
}
