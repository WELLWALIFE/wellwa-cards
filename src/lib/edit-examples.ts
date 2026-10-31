// The example chips under "Want to change something? Just say it" — the things an owner of THAT trade really changes on
// their website (owner, 31 Oct 2026: "CBSE ka card mein kya matlab… wo tab banao jo user actual mein change karta hai,
// business ke according"). Keyed by the trade group of src/lib/site-advanced-archetypes.ts; a Shubhora partner card has its
// own set. Pure module.
import { TRADE_GROUP } from "@/lib/site-advanced-archetypes";
import { isShubhoraSellerCard } from "@/lib/shubhora-page";
import type { Card } from "@/lib/types";

type Pair = [en: string, hi: string];
const EX: Record<string, Pair[]> = {
  general: [
    ["add today's offer: 10% off this week", "aaj ka offer daalo: is hafte 10% off"],
    ["change the timings to 10 am – 8 pm", "timing 10 am – 8 pm kar do"],
    ["write in the about that we are here since 2010", "about mein likho ki hum 2010 se hain"],
    ["put the reviews above the gallery", "reviews ko gallery ke upar le jao"],
  ],
  sweets: [
    ["add a Diwali gift box offer", "Diwali gift box ka offer daalo"],
    ["say we take bulk orders for weddings", "likho ki shaadi ke bulk order lete hain"],
    ["put the menu right after the top", "menu ko sabse upar ke baad rakho"],
    ["change the timings to 8 am – 10 pm", "timing 8 am – 10 pm kar do"],
  ],
  dining: [
    ["add a weekend family thali offer", "weekend family thali ka offer daalo"],
    ["say we do home delivery within 5 km", "likho ki 5 km tak home delivery hai"],
    ["put the menu above the photos", "menu ko photos ke upar rakho"],
    ["change the timings to 11 am – 11 pm", "timing 11 am – 11 pm kar do"],
  ],
  stay: [
    ["add an off-season room offer", "off-season room offer daalo"],
    ["say check-in is 12 noon, check-out 11 am", "likho check-in 12 baje, check-out 11 baje"],
    ["put the rooms above the gallery", "rooms ko gallery ke upar rakho"],
    ["make the look calmer", "look thoda shaant karo"],
  ],
  jewellery: [
    ["add a Dhanteras offer on making charges", "Dhanteras par making charge ka offer daalo"],
    ["say all our gold is BIS hallmarked", "likho ki saara sona BIS hallmark hai"],
    ["put the collection above the about", "collection ko about ke upar rakho"],
    ["make the look more premium", "look aur premium karo"],
  ],
  fashion: [
    ["add a festive collection offer", "festive collection ka offer daalo"],
    ["say we do alterations and custom stitching", "likho ki alteration aur custom silai hoti hai"],
    ["put the new arrivals right after the top", "new arrivals ko sabse upar ke baad rakho"],
    ["change the timings to 10 am – 9 pm", "timing 10 am – 9 pm kar do"],
  ],
  decor: [
    ["add a free site visit offer", "free site visit ka offer daalo"],
    ["say we have done 200+ projects", "likho ki 200+ project kiye hain"],
    ["put the projects above the services", "projects ko services ke upar rakho"],
    ["make the look more premium", "look aur premium karo"],
  ],
  shop: [
    ["add this week's offer: 10% off", "is hafte ka offer daalo: 10% off"],
    ["say we give EMI and home delivery", "likho ki EMI aur home delivery milti hai"],
    ["put the products right after the top", "products ko sabse upar ke baad rakho"],
    ["change the timings to 10 am – 9 pm", "timing 10 am – 9 pm kar do"],
  ],
  grocery: [
    ["say free home delivery above ₹500", "likho ₹500 se upar free home delivery"],
    ["add a monthly ration offer", "mahine ke ration ka offer daalo"],
    ["change the timings to 7 am – 10 pm", "timing 7 am – 10 pm kar do"],
    ["remove the gallery section", "gallery section hata do"],
  ],
  gifts: [
    ["add a Rakhi hamper offer", "Rakhi hamper ka offer daalo"],
    ["say we make custom gift boxes", "likho ki custom gift box banate hain"],
    ["put the products above the about", "products ko about ke upar rakho"],
    ["change the timings to 10 am – 9 pm", "timing 10 am – 9 pm kar do"],
  ],
  wholesale: [
    ["say minimum order is 50 pieces", "likho minimum order 50 piece hai"],
    ["add that we dispatch all over India", "likho ki poore India mein dispatch karte hain"],
    ["put the catalogue right after the top", "catalogue ko sabse upar ke baad rakho"],
    ["remove the reviews section", "reviews section hata do"],
  ],
  industry: [
    ["say our capacity is 10,000 units a month", "likho capacity 10,000 unit mahine ki hai"],
    ["add that samples are available", "likho ki sample milte hain"],
    ["put the products above the about", "products ko about ke upar rakho"],
    ["make the look simpler", "look thoda saada karo"],
  ],
  buildmat: [
    ["add a contractor rate offer", "contractor rate ka offer daalo"],
    ["say we deliver to the site", "likho ki site par delivery karte hain"],
    ["put the brands we keep above the about", "brands ko about ke upar rakho"],
    ["change the timings to 9 am – 8 pm", "timing 9 am – 8 pm kar do"],
  ],
  clinic: [
    ["change the OPD timings to 10 am – 2 pm and 5 – 8 pm", "OPD timing 10–2 aur 5–8 kar do"],
    ["say we are closed on Sunday", "likho Sunday band rehta hai"],
    ["write in the about that the doctor is MD, 15 years", "about mein likho doctor MD hain, 15 saal ka anubhav"],
    ["put the services above the reviews", "services ko reviews ke upar rakho"],
  ],
  pharmacy: [
    ["say we are open 24 hours", "likho 24 ghante khule hain"],
    ["add home delivery of medicines", "dawai ki home delivery likho"],
    ["add a 10% off on generic medicines offer", "generic dawai par 10% off ka offer daalo"],
    ["remove the gallery section", "gallery section hata do"],
  ],
  fitness: [
    ["add a new year membership offer", "new year membership ka offer daalo"],
    ["say the first day is a free trial", "likho pehla din free trial hai"],
    ["change the timings to 5 am – 10 pm", "timing 5 am – 10 pm kar do"],
    ["put the plans above the gallery", "plans ko gallery ke upar rakho"],
  ],
  beauty: [
    ["add a bridal package offer", "bridal package ka offer daalo"],
    ["say we are closed on Tuesday", "likho Tuesday band rehta hai"],
    ["put the services with prices right after the top", "services aur price sabse upar ke baad rakho"],
    ["make the look more premium", "look aur premium karo"],
  ],
  wellness: [
    ["add a free home demo offer", "free home demo ka offer daalo"],
    ["put the products above the about", "products ko about ke upar rakho"],
    ["write in the about that I am a certified distributor", "about mein likho main certified distributor hoon"],
    ["remove the FAQ section", "FAQ section hata do"],
  ],
  advisory: [
    ["say the first consultation is free", "likho pehli consultation free hai"],
    ["write in the about that we are practising since 2008", "about mein likho 2008 se practice kar rahe hain"],
    ["change the timings to 10 am – 6 pm", "timing 10 am – 6 pm kar do"],
    ["put the services above the reviews", "services ko reviews ke upar rakho"],
  ],
  property: [
    ["add a new project launch offer", "naye project launch ka offer daalo"],
    ["say we help with home loans", "likho ki home loan mein madad karte hain"],
    ["put the projects right after the top", "projects ko sabse upar ke baad rakho"],
    ["make the look more premium", "look aur premium karo"],
  ],
  homeservice: [
    ["say we reach within 2 hours", "likho 2 ghante mein pahunchte hain"],
    ["add a ₹99 visiting charge line", "₹99 visiting charge likho"],
    ["say we work on Sunday too", "likho Sunday bhi kaam karte hain"],
    ["put the services above the about", "services ko about ke upar rakho"],
  ],
  motors: [
    ["add a free check-up camp offer", "free check-up camp ka offer daalo"],
    ["say we give pick-up and drop", "likho pick-up aur drop dete hain"],
    ["change the timings to 9 am – 7 pm", "timing 9 am – 7 pm kar do"],
    ["put the services above the gallery", "services ko gallery ke upar rakho"],
  ],
  creative: [
    ["add a wedding season package offer", "wedding season package ka offer daalo"],
    ["put the portfolio right after the top", "portfolio ko sabse upar ke baad rakho"],
    ["say we travel all over India", "likho poore India mein jaate hain"],
    ["make the look more premium", "look aur premium karo"],
  ],
  tech: [
    ["say the first consultation is free", "likho pehli consultation free hai"],
    ["put the services above the about", "services ko about ke upar rakho"],
    ["write in the about that we have 50+ clients", "about mein likho 50+ client hain"],
    ["make the look simpler", "look thoda saada karo"],
  ],
  travel: [
    ["add a summer holiday package offer", "summer holiday package ka offer daalo"],
    ["say we also book train and flight tickets", "likho train aur flight ticket bhi karte hain"],
    ["put the packages right after the top", "packages ko sabse upar ke baad rakho"],
    ["remove the FAQ section", "FAQ section hata do"],
  ],
  school: [
    ["say admissions are open for 2026–27", "likho 2026–27 ke admission khule hain"],
    ["write in the about that we are CBSE affiliated", "about mein likho hum CBSE se affiliated hain"],
    ["change the school timings to 8 am – 2 pm", "school timing 8 am – 2 pm kar do"],
    ["put the admissions section above the gallery", "admission section ko gallery ke upar rakho"],
  ],
  playschool: [
    ["say admissions are open", "likho admission khule hain"],
    ["change the timings to 9 am – 12:30 pm", "timing 9 am – 12:30 pm kar do"],
    ["write in the about that we have CCTV and a nurse", "about mein likho CCTV aur nurse hai"],
    ["put the photos above the about", "photos ko about ke upar rakho"],
  ],
  college: [
    ["say admissions are open for 2026–27", "likho 2026–27 ke admission khule hain"],
    ["put the courses right after the top", "courses ko sabse upar ke baad rakho"],
    ["write in the about that we are UGC recognised", "about mein likho UGC se manyata prapt hain"],
    ["remove the offer section", "offer section hata do"],
  ],
  coaching: [
    ["say the new batch starts on 1 December", "likho nayi batch 1 December se hai"],
    ["add a free demo class offer", "free demo class ka offer daalo"],
    ["put the results above the about", "results ko about ke upar rakho"],
    ["change the timings to 7 am – 9 pm", "timing 7 am – 9 pm kar do"],
  ],
  farm: [
    ["say we deliver fresh every morning", "likho roz subah fresh delivery karte hain"],
    ["put the products right after the top", "products ko sabse upar ke baad rakho"],
    ["write in the about that we are a family farm since 1990", "about mein likho 1990 se family farm hai"],
    ["remove the FAQ section", "FAQ section hata do"],
  ],
  community: [
    ["add the next event's date at the top", "agle event ki date upar daalo"],
    ["say donations get an 80G receipt", "likho daan par 80G receipt milti hai"],
    ["put the photos above the about", "photos ko about ke upar rakho"],
    ["make the look simpler", "look thoda saada karo"],
  ],
  leader: [
    ["add the next public meeting at the top", "agli jan-sabha upar daalo"],
    ["put the work done above the about", "kiye gaye kaam ko about ke upar rakho"],
    ["say the office is open 10 am – 5 pm", "likho office 10 am – 5 pm khula hai"],
    ["remove the offer section", "offer section hata do"],
  ],
  astro: [
    ["say consultation is on call and WhatsApp too", "likho call aur WhatsApp par bhi consultation hai"],
    ["add a Navratri puja booking line", "Navratri puja booking likho"],
    ["change the timings to 9 am – 1 pm and 4 – 8 pm", "timing 9–1 aur 4–8 kar do"],
    ["make the look calmer", "look thoda shaant karo"],
  ],
  personal: [
    ["write in the about that I have 10 years of experience", "about mein likho 10 saal ka anubhav hai"],
    ["put the services above the reviews", "services ko reviews ke upar rakho"],
    ["add a free first call offer", "pehli call free ka offer daalo"],
    ["make the look more premium", "look aur premium karo"],
  ],
  /** A Shubhora partner's own website (template vcard-reseller): what a partner changes there. */
  shubhora: [
    ["write my city in the about", "about mein mera sheher likho"],
    ["add a line that I set up the card for you free, at your shop", "likho ki main aapki dukaan par aakar free card bana deta hoon"],
    ["put the plans right after the top", "plans ko sabse upar ke baad rakho"],
    ["say I am available on WhatsApp 9 am – 9 pm", "likho WhatsApp par 9 am – 9 pm milta hoon"],
  ],
};

/** The four example chips for this card, in the app's language. */
export function editExamples(card: Pick<Card, "name" | "company" | "jobTitle" | "tagline" | "seo"> | null | undefined, hi: boolean): string[] {
  const group = !card ? "general" : isShubhoraSellerCard(card) ? "shubhora" : TRADE_GROUP[card.seo?.categoryKey ?? ""] ?? "general";
  return (EX[group] ?? EX.general).map((p) => p[hi ? 1 : 0]);
}
