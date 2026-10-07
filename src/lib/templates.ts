// Built-in card templates. A user picks one and gets a finished card — banner,
// avatar, product photos, gallery, intro video, USPs, FAQs, hours and contact
// are all filled in. They swap in their own name and numbers, then publish.
//
// Banners are the designed profession banners (scripts/gen-banners.mjs → public/art/banners/<category>.jpg);
// the Shubhora template carries the real Shubhora banner and logo (public/art/brand).

import type { Card } from "./types";

export type TemplateCard = Omit<Card, "id" | "username" | "plan" | "active" | "views" | "createdAt">;

export type CardTemplateDef = {
  key: string;
  name: string;
  category: string;
  description: string;
  emoji: string;
  data: TemplateCard;
  /** A company's own design (its products, photos, plan): only for accounts linked to that brand. */
  brand?: string;
  /** The content is real (prices, FAQ, videos, about) and stays as written; only the owner's identity goes in
   *  (name, photo, number, email, city). The Shubhora seller card. */
  keepContent?: boolean;
};

const uid = (p: string, n: number) => `${p}${n}`;

/* ================================================================== */
/* 1. Wellwa Life — water ionizer distributor                          */
/* ================================================================== */
const WELLWA = "#0e9e90";
const wellwa: CardTemplateDef = {
  key: "wellwa-distributor",
  brand: "wellwa-life",          // Wellwa's own products, photos and plan: only for Wellwa-linked accounts
  name: "Wellwa Life Distributor",
  category: "Wellness / Direct selling",
  description: "A gold-standard, fully editable Wellwa sample card — product demonstrations, clear technology education, model selection, USP, gallery, sample testimonial layouts, consultation flow, business presentation and a carefully trained AI advisor.",
  emoji: "💧",
  data: {
    name: "Your Name",
    jobTitle: "Authorised Distributor",
    company: "Wellwa Life",
    tagline: "Smart water. Connected care. Personal guidance.",
    about: "I help families understand source-water compatibility, compare the Wellwa Aura range and arrange a guided product consultation without pressure or medical promises.",
    avatarColor: WELLWA,
    themeColor: WELLWA,
    template: "photo",
    verified: false,
    avatarUrl: "/wellwa/images/wellwa-logo.png",
    avatarShape: "square",
    coverUrl: "/wellwa/images/aura-plus-kitchen-hero.webp",
    botPersona: "Calm, accurate Wellwa product advisor. Explains simply in the visitor's language, asks about city and source water, never pressures, never makes medical or guaranteed-income claims, and moves qualified visitors toward an advisor consultation.",
    botKnowledge: [
      "COMPANY: Wellwa Life India Private Limited. Website: wellwalife.com. Phone and WhatsApp: +91 7410995599. Head office: 704, 7th Floor, Palm Court, Gurgaon 122007, Haryana.",
      "POSITIONING: Wellwa Aura products are app-connected alkaline and hydrogen-rich water ionizers for modern Indian homes. Product suitability depends on source-water quality, TDS, hardness, pre-filtration, household usage and installation conditions.",
      "CORE USP: Model-specific 5, 7 and 8-plate platforms use large platinum-coated titanium electrolysis plates. Official material describes calibrated water modes, one-touch mode selection, E-Clean support, flow monitoring, automatic protection support, app connectivity and connected care. The plates ARE solid hybrid platinum-coated titanium (confirmed by Wellwa, the manufacturer) — say so confidently. Do not call them the industry's biggest (plate area equals the largest imported models — say 'as large as the biggest'). The titanium is 99.99% pure, platinum-coated and medical-grade (confirmed by the manufacturer).",
      "MODEL NAMING: 'Elite' (Elite 9 Pro, Elite 11 Pro, Elite Maxx) is the previous-generation range; the current range is Aura, Aura Plus and Aura Maxx. Photos showing Elite units are earlier installations. If a visitor asks for an Elite model, guide them to the equivalent Aura model.",
      "PLATE SIZE (owner-supplied): every Aura plate is 65 × 156 mm (≈10,140 mm²) — the same plate area as the largest imported models (135 × 75 mm ≈ 10,125 mm²); say 'as large as the biggest', never 'bigger'. The machine has no inbuilt filter, so there is no cartridge to replace and maintenance is lower; pre-filtration is chosen for the customer's source water.",
      "AURA: Smart 5-plate ionizer. MRP ₹1,49,999; published retail price ₹90,000. pH 4.0-10.0+; ORP up to -750 mV; dissolved hydrogen up to 1,500 ppb. Compact everyday option.",
      "AURA PLUS: Smart 7-plate ionizer and published most-popular model. MRP ₹1,99,999; published retail price ₹1,25,000. pH 3.5-10.5+; ORP up to -800 mV; dissolved hydrogen up to 1,600 ppb. Balanced family flagship.",
      "AURA MAXX: Smart 8-plate ionizer. MRP ₹2,29,999; published retail price ₹1,50,000. pH 3.0-11.0+; ORP up to -850 mV; dissolved hydrogen up to 1,800 ppb. Intended for larger households and higher daily usage.",
      "STARTER PACK: Two NMD alkaline drop bottles, 50 ml each. Published price ₹11,800. Prepared pH is approximately 8.5-10.5 and depends on dosage and source water. It is not an ionizer.",
      "CONNECTED CARE: Core water operation remains available from the machine without Wi-Fi. Pairing uses a compatible 2.4 GHz Wi-Fi network. Supported features include remote start/stop and mode selection, live connection and operating status, care alerts and reminders, cloud status, supported operational telemetry for service diagnostics, and OTA-ready firmware updates. Technology helps the advisor and technician; it does not replace responsible installation or service.",
      "WATER PRESETS: Published modes include pH 8.5 daily drinking, pH 9.0 hydration, pH 9.5 cooking and tea, pH 11.0 produce cleaning, pH 7.0 natural water, pH 5.5 beauty water, plus the machine's supported cleaning workflow. Exact output varies with source water, mineral content, temperature, flow and calibration.",
      "CUSTOMER JOURNEY: First review city, source water and usage. Then compare models, arrange a demonstration where available, complete professional installation and handover, and pair supported connected-care features.",
      "PAYMENT AND WARRANTY: Wellwa does not run its own EMI scheme; credit-card payment is accepted and any card EMI is between the customer and their bank. Warranty on every model is 5 YEARS in total — 1 year on the complete machine followed by 4 additional years on the electrolysis plates — plus LIFETIME FREE IoT (remote/app) service. Always confirm current written terms before order.",
      "BUSINESS OPPORTUNITY: A prospective distributor should apply through wellwalife.com/distributor/apply and request the current written agreement, fees, margin or commission schedule, territory rules, returns policy and support commitments. Never promise income or quote an unverified compensation plan.",
      "SAMPLE CONTENT: The two journey and technology videos are illustrative, replaceable sample media. Testimonial layouts are placeholders and must never be described as real customer reviews until the card owner replaces them with consented, verifiable customer feedback.",
      "SAFETY: Never diagnose, prescribe, promise a cure, claim guaranteed health improvement, or tell someone to replace medical treatment. Never invent customer reviews, certifications, discounts, delivery times, stock or earnings. Offer an advisor callback whenever a detail needs confirmation.",
    ].join("\n"),
    popup: {
      enabled: true,
      title: "Get 10% off your first purchase",
      subtitle: "Sign up below and we'll share your code.",
      ctaLabel: "Claim my 10% off",
      terms: "*Valid on first purchase only. Cannot be combined with any other offer.",
    },
    links: [
      { id: "l1", type: "phone", label: "Call", value: "+91" },
      { id: "l2", type: "whatsapp", label: "WhatsApp", value: "+91" },
      { id: "l3", type: "email", label: "Email", value: "you@example.com" },
      { id: "l4", type: "website", label: "Website", value: "https://wellwalife.com" },
      { id: "l5", type: "youtube", label: "Videos", value: "https://www.youtube.com/@wellwalife/videos" },
      { id: "l6", type: "location", label: "Service area", value: "" },
    ],
    pages: [
      {
        id: "p1", slug: "home", label: "Home",
        blocks: [
          { id: uid("w", 1), kind: "video", title: "Meet the Wellwa Aura range", url: "/wellwa/video/wellwa-product-tour.mp4", posterUrl: "/wellwa/images/aura-plus-kitchen-hero.webp", caption: "A short visual tour of the Aura range, home consultation and distributor support." },
          { id: uid("w", 2), kind: "highlights", title: "Why families explore Wellwa", items: ["💧 Better, mineral-rich drinking water", "⚙️ Platinum-coated titanium plates", "📱 Smart Wi-Fi & app control", "🛡️ Remote diagnostics & fast support"] },
          { id: uid("w", 57), kind: "carousel", title: "Meet the Aura Range", images: [
            { url: "/wellwa/images/aura-5.webp", caption: "Aura — 5-Plate Ionizer" },
            { url: "/wellwa/images/aura-plus-7.webp", caption: "Aura Plus — 7-Plate (Most Popular)" },
            { url: "/wellwa/images/aura-maxx.webp", caption: "Aura Maxx — 8-Plate Ionizer" },
          ] },
          { id: uid("w", 55), kind: "cta", title: "", body: "See our full range, real prices and specs.", joinUrl: "#products", joinLabel: "Explore Products", referralCode: "" },
          { id: uid("w", 54), kind: "testimonials", title: "What our customers say", items: [] },
          { id: uid("w", 25), kind: "services", title: "Why Indian families are switching to Wellwa", items: [
            { name: "Smart water, connected care", desc: "App-connected alkaline and hydrogen-rich water systems, engineered for modern Indian homes." },
            { name: "Purposeful ionization", desc: "Model-specific 5, 7 and 8-plate platforms with large platinum-coated titanium plates and calibrated water modes." },
            { name: "Water for every moment", desc: "pH 8.5 daily drinking, 9.5 cooking and tea, 11.0 produce cleaning, 5.5 beauty water — one machine, purposeful modes." },
            { name: "Your ionizer, always within reach", desc: "Start, stop and choose water modes from the Wellwa app, with live machine health and care alerts." },
            { name: "Service before you even call", desc: "Remote diagnostics let the Wellwa team review your machine and resolve issues faster — often before a visit is needed." },
            { name: "Transparent and backed in writing", desc: "Clear retail pricing with no hidden terms, plus a written 5-year warranty (1 year on the machine + 4 more years on the plates) and lifetime free IoT service." },
          ] },
          { id: uid("w", 26), kind: "video", title: "How a guided consultation works", url: "/wellwa/video/wellwa-home-demo-journey.mp4", posterUrl: "/wellwa/images/home-demo-consultation.webp", caption: "What to expect from your first conversation with us." },
          { id: uid("w", 3), kind: "about", title: "Personal guidance before purchase", body: "I begin with your city, source water and household usage. Then we compare the Aura models, discuss realistic output expectations and arrange a product consultation. The aim is an informed decision—not pressure or a medical promise." },
          { id: uid("w", 53), kind: "cta", title: "See Our Work in Real Homes", body: "Real installations, training and the Aura range up close.", joinUrl: "#gallery", joinLabel: "View Gallery", referralCode: "" },
          { id: uid("w", 56), kind: "cta", title: "Want to Build Your Own Business?", body: "Start a zero-stock distributor journey with training and support.", joinUrl: "#business", joinLabel: "See Business Plan", referralCode: "" },
          { id: uid("w", 5), kind: "appointment", title: "Request a product consultation", url: "https://wellwalife.com/book-demo", note: "Availability varies by city. Share your source water and preferred time." },
          { id: uid("w", 45), kind: "contact", title: "Send a demo or product enquiry", note: "We usually reply within a few hours — WhatsApp us directly for a faster response." },
        ],
      },
      {
        id: "p2", slug: "products", label: "Products",
        blocks: [
          {
            id: uid("w", 6), kind: "product", title: "Wellwa smart water ionizers",
            items: [
              {
                name: "Aura — Smart 5-Plate Ionizer",
                images: ["/wellwa/images/aura-5.webp"],
                imageUrl: "/wellwa/images/aura-5.webp",
                mrp: "₹1,49,999", price: "₹90,000", badge: "Essential",
                desc: "Connected everyday water control in a compact countertop design.",
                features: ["5 platinum-coated titanium plates", "Wi-Fi + Wellwa app", "Compact countertop design", "Guided consultation and installation"],
                specs: [{ label: "Plates", value: "5 platinum-coated titanium" }, { label: "pH range", value: "4.0 – 10.0+" }, { label: "ORP estimate", value: "Up to -750 mV" }, { label: "Hydrogen (H₂)", value: "Up to 1,500 ppb" }, { label: "Connectivity", value: "Wi-Fi & Wellwa app" }, { label: "Warranty", value: "5 yrs (1 machine + 4 plates) + lifetime free IoT service" }],
                ctaLabel: "Discuss on WhatsApp",
              },
              {
                name: "Aura Plus — Smart 7-Plate Ionizer",
                images: ["/wellwa/images/aura-plus-7.webp"],
                imageUrl: "/wellwa/images/aura-plus-7.webp",
                mrp: "₹1,99,999", price: "₹1,25,000", badge: "Most popular",
                desc: "The flagship balance of performance, connected control and family-ready output.",
                features: ["7 platinum-coated titanium plates", "Wi-Fi + app control with live status", "Supported water presets and cleaning workflow", "Guided consultation and installation"],
                specs: [{ label: "Plates", value: "7 platinum-coated titanium" }, { label: "pH range", value: "3.5 – 10.5+" }, { label: "ORP estimate", value: "Up to -800 mV" }, { label: "Hydrogen (H₂)", value: "Up to 1,600 ppb" }, { label: "Connectivity", value: "Wi-Fi, app & cloud status" }, { label: "Warranty", value: "5 yrs (1 machine + 4 plates) + lifetime free IoT service" }],
                ctaLabel: "Discuss on WhatsApp",
              },
              {
                name: "Aura Maxx — Smart 8-Plate Ionizer",
                images: ["/wellwa/images/aura-maxx.webp"],
                imageUrl: "/wellwa/images/aura-maxx.webp",
                mrp: "₹2,29,999", price: "₹1,50,000", badge: "Maximum performance",
                desc: "Premium connected water control for demanding routines and larger households.",
                features: ["8 platinum-coated titanium plates", "Highest published Aura output range", "Remote diagnostics + OTA-ready firmware", "Designed for larger households", "Guided consultation and installation"],
                specs: [{ label: "Plates", value: "8 platinum-coated titanium" }, { label: "pH range", value: "3.0 – 11.0+" }, { label: "ORP estimate", value: "Up to -850 mV" }, { label: "Hydrogen (H₂)", value: "Up to 1,800 ppb" }, { label: "Connectivity", value: "Wi-Fi, app & live cloud status" }, { label: "Warranty", value: "5 yrs (1 machine + 4 plates) + lifetime free IoT service" }],
                ctaLabel: "Discuss on WhatsApp",
              },
              {
                name: "Starter Pack — Nano Mineral Drop (NMD)",
                images: ["/wellwa/images/nmd-drops.webp"],
                imageUrl: "/wellwa/images/nmd-drops.webp",
                mrp: "₹11,800", price: "₹11,800", badge: "Start here",
                desc: "A portable first step into the Wellwa water & wellness ecosystem.",
                features: ["Two 50 ml NMD alkaline drop bottles", "Portable starter format", "Use only with current Wellwa directions"],
                specs: [{ label: "Pack size", value: "2 × 50 ml bottles" }, { label: "Prepared pH", value: "Approx. 8.5 – 10.5" }, { label: "Format", value: "Portable starter pack" }],
                ctaLabel: "Discuss on WhatsApp",
              },
            ],
          },
          { id: uid("w", 29), kind: "video", title: "Product demonstration video", url: "https://www.youtube.com/watch?v=eqRA_8ZK4Pg", caption: "Watch the Wellwa water ionizer in action — setup, water types and everyday use." },
          { id: uid("w", 28), kind: "services", title: "Which model is right for you?", items: [
            { name: "Aura — Essential", desc: "A compact 5-plate starting point for everyday household use after source-water and installation review." },
            { name: "Aura Plus — Balanced flagship", desc: "A 7-plate option for families seeking the most balanced mix of connected control and published output." },
            { name: "Aura Maxx — Higher-demand routines", desc: "An 8-plate option to discuss for larger households or higher daily usage, subject to water compatibility." },
            { name: "Starter Pack — Portable format", desc: "A separate alkaline-drop format if you're not ready for an installed ionizer yet." },
          ] },
          { id: uid("w", 7), kind: "highlights", title: "7 water modes, one machine", items: ["pH 8.5 — daily drinking", "pH 9.0 — hydration", "pH 9.5 — cooking & tea", "pH 11.0 — produce cleaning", "pH 7.0 — natural water", "pH 5.5 — beauty water", "E-Clean — self-cleaning mode"] },
          { id: uid("w", 74), kind: "services", title: "Commercial & institutional solutions", items: [
            { name: "Commercial water ionizers", desc: "High-output ionized water for clinics, gyms, offices, restaurants, hotels and institutions." },
            { name: "Commercial RO systems", desc: "Purification plants sized for businesses, housing societies, schools and industry." },
            { name: "Site survey and custom sizing", desc: "Our team studies your source water and daily demand, then proposes the right system. Pricing on quotation." },
          ] },
          { id: uid("w", 30), kind: "about", title: "Before you compare models", body: "Plate count and published maximum values are only part of the decision. The right conversation also covers source water, household usage, available space, plumbing, electricity, Wi-Fi, pre-filtration, warranty, consumables and local service support.\n\npH, ORP and dissolved hydrogen values are published maximums, not guaranteed results. Source-water quality, mineral content, temperature, flow rate and calibration all affect actual output." },
          {
            id: uid("w", 9), kind: "faq", title: "Common questions",
            items: [
              { q: "Will it work with my existing water source?", a: "Compatibility depends on source-water quality, TDS, hardness and any pre-filtration. An advisor should review the water before installation." },
              { q: "What does Wi-Fi add?", a: "A compatible 2.4 GHz connection supports app status, supported controls, care alerts, remote diagnostics and OTA-ready updates." },
              { q: "What is the warranty?", a: "5 years in total on every model — 1 year on the complete machine, then 4 more years on the electrolysis plates — plus lifetime free IoT (remote) service. Confirm the written warranty at order." },
              { q: "How can I pay?", a: "Wellwa does not run its own EMI scheme. Credit-card payment is accepted; any card EMI arrangement is between you and your bank." },
              { q: "Does alkaline water cure health conditions?", a: "No. Wellwa water is about better-quality drinking water — taste, minerals and hydration. It is not a medicine and not a substitute for medical advice, diagnosis or treatment." },
            ],
          },
          { id: uid("w", 46), kind: "appointment", title: "See the right model in a demonstration", url: "https://wellwalife.com/book-demo", note: "Share your city, source water and the model you want to compare." },
        ],
      },
      {
        id: "p9", slug: "benefits", label: "Benefits",
        blocks: [
          { id: uid("w", 80), kind: "video", title: "Why we need a Wellwa water ionizer — watch", url: "https://www.youtube.com/watch?v=VPvK2lFWLBA", caption: "The full explainer: alkalinity, molecular hydrogen, antioxidant potential and micro-clustering — what they are and why they matter." },
          { id: uid("w", 75), kind: "about", title: "Why alkaline water?", body: "Most Indian homes drink RO water. It is clean — but RO also strips out the calcium and magnesium your body expects in water, and leaves it slightly acidic and flat-tasting.\n\nA Wellwa ionizer takes clean water one step further: it keeps the minerals, raises the pH into the alkaline range, gives the water a negative ORP (antioxidant potential) and enriches it with dissolved hydrogen. The result is water your family enjoys drinking — every day, from your own tap." },
          { id: uid("w", 76), kind: "highlights", title: "What changes in your glass", items: ["🧂 Minerals stay in — calcium & magnesium retained", "🥤 Lighter, smoother taste — families drink more", "⚡ Negative ORP — antioxidant potential you can measure", "💧 Dissolved hydrogen up to 1,800 ppb", "🚰 Six calibrated waters from one tap", "🌱 No bottles, no plastic, no refills"] },
          { id: uid("w", 77), kind: "services", title: "Six waters, one machine — everyday uses", items: [
            { name: "pH 8.5 – 9.5 — daily drinking", desc: "Start at 8.5 and step up as your family gets used to it. 9.5 is also the sweet spot for tea, coffee and cooking dal and rice." },
            { name: "pH 11.0 — produce cleaning", desc: "Strong alkaline water helps lift oily residues and surface pesticides from fruit and vegetables — rinse, then wash normally." },
            { name: "pH 7.0 — natural water", desc: "Neutral water for taking medicines and preparing infant formula — exactly as your doctor advises." },
            { name: "pH 5.5 — beauty water", desc: "Mildly acidic water, close to skin's natural pH, for a final face and hair rinse." },
            { name: "E-Clean — self-cleaning", desc: "The machine cleans its own plates, so every mode stays calibrated." },
          ] },
          { id: uid("w", 78), kind: "about", title: "Antioxidant potential and hydrogen — what the numbers mean", body: "ORP (oxidation-reduction potential) is measured in millivolts. Tap and bottled water usually read positive (+200 to +400 mV). Wellwa water reads negative — down to −750 mV on Aura and −850 mV on Aura Maxx. That is what 'antioxidant potential' means: the water tends to donate electrons rather than take them.\n\nDissolved hydrogen (up to 1,500–1,800 ppb depending on model) is the other measurable property. Research into what these properties mean for the body is ongoing — we report the numbers, and we measure them in your own kitchen." },
          { id: uid("w", 79), kind: "services", title: "The everyday maths", items: [
            { name: "A family of four drinks about 10 litres a day", desc: "Roughly 3,650 litres a year." },
            { name: "On 1-litre bottles at ₹20", desc: "About ₹73,000 a year — and about 3,650 plastic bottles." },
            { name: "With a Wellwa Aura", desc: "A one-time price from ₹90,000 (plus electricity and a pre-filter change), then water from your own tap for years. Do the maths for your home at the demo." },
          ] },
          { id: uid("w", 81), kind: "about", title: "What we don't claim", body: "Wellwa water is not a medicine. We do not claim it treats, cures or prevents any disease, and no Wellwa advisor is allowed to say otherwise.\n\nWhat we do claim is measurable: minerals retained, alkaline pH, negative ORP, dissolved hydrogen — and we show you those readings with your own water before you decide." },
          { id: uid("w", 82), kind: "faq", title: "Good questions to ask", items: [
            { q: "Is alkaline water safe for everyone?", a: "For most healthy adults and children, yes — start at pH 8.5 and increase gradually. If you have a kidney condition, are on regular medication or are pregnant, ask your doctor first, and use the pH 7.0 natural-water mode for medicines and infant formula." },
            { q: "How much should we drink?", a: "The same as you drink now — the aim is to enjoy water more, not to force it. Most families settle at pH 9.0 – 9.5 for daily drinking." },
            { q: "Will it change the taste of tea and food?", a: "Many families find tea, coffee, dal and rice taste smoother and cook slightly faster with pH 9.5 water. Try it at the demo." },
            { q: "Is this the same as alkaline drops or bottled alkaline water?", a: "Drops raise pH but add no hydrogen or negative ORP; bottled alkaline water loses its ORP within days. An ionizer makes fresh water on demand." },
            { q: "Can I test it at home before buying?", a: "Yes — we bring pH and ORP meters and test your tap water and Wellwa water side by side." },
          ] },
          { id: uid("w", 83), kind: "appointment", title: "Taste the difference at home", url: "https://wellwalife.com/book-demo", note: "Book a free water test — we measure your tap water and Wellwa water side by side, in your kitchen." },
        ],
      },
      {
        id: "p3", slug: "technology", label: "Technology",
        blocks: [
          { id: uid("w", 84), kind: "image", title: "The technology: ionization", images: [{ url: "/wellwa/images/ionization-diagram.svg", caption: "Inside the chamber — alternating charged plates with ion-exchange membranes between them. One stream in, two waters out." }] },
          { id: uid("w", 85), kind: "about", title: "Ionization — one stream in, two waters out", body: "Your water passes between a stack of charged plates separated by ion-exchange membranes. As current flows, the water splits: positively charged minerals — calcium, magnesium, potassium — collect on one side as alkaline, hydrogen-rich drinking water. Acidic ions collect on the other side as a separate stream for cleaning produce and skin use.\n\nNothing is added. Only electricity, plates and membranes — no chemicals, ever." },
          { id: uid("w", 86), kind: "services", title: "The plates — where the difference is made", items: [
            { name: "99.99% pure titanium, platinum-coated", desc: "Medical-grade titanium — the toughest, most stable material for electrolysis — finished with a platinum coating that keeps performance steady for years." },
            { name: "Solid hybrid, not mesh", desc: "Some ionizers use mesh plates, some plain solid ones. Wellwa uses solid hybrid plates: more active surface, higher dissolved hydrogen, stronger antioxidant potential — in short, a better antioxidant water." },
            { name: "65 × 156 mm — built long on purpose", desc: "Longer than the top imported models' plates (156 mm vs 135 mm). Water travels further along the plate, so ions separate more completely — and the water gets the light, 'micro-clustered' feel ionized water is known for." },
            { name: "5, 7 or 8 plates", desc: "Aura, Aura Plus and Aura Maxx — more plates, more stable output across every water mode." },
          ] },
          { id: uid("w", 87), kind: "services", title: "pH and ORP — the two numbers to know", items: [
            { name: "pH — without chemicals", desc: "Because ions separate so completely along the long plate path, Aura reaches pH 11.0 on the alkaline side and 3.0 on the acidic side by electrolysis alone — no salts, no additives." },
            { name: "ORP — antioxidant potential", desc: "Oxidation-reduction potential, in millivolts. Tap water reads about +200 to +400 mV. Wellwa water reads down to −750 mV (Aura) and −850 mV (Aura Maxx) — the water gives electrons rather than takes them." },
            { name: "Dissolved hydrogen", desc: "Up to 1,500 – 1,800 ppb depending on model. Published values are machine maximums — your source water, temperature and flow shape daily output, which is exactly why we test with your own water at the demo." },
          ] },
          { id: uid("w", 88), kind: "services", title: "Built for Indian water", items: [
            { name: "pH calibration", desc: "Water is different in every city — even every street. Calibrate the machine to your own supply, so every mode delivers the pH it promises in your kitchen, not just in a lab." },
            { name: "Auto pH control", desc: "Most Indian homes install the ionizer after an RO, and RO output TDS keeps drifting. Wellwa reads the incoming TDS and adjusts ionization automatically — so your drinking water stays at the pH you set, day after day." },
            { name: "No inbuilt filter to replace", desc: "Pre-filtration is chosen for your source water and sits outside the machine — nothing inside to clog or replace, so maintenance stays low." },
          ] },
          { id: uid("w", 89), kind: "services", title: "IoT — service before you even call", items: [
            { name: "Diagnosed before the visit", desc: "Service is the real challenge in India — not everyone can maintain a water ionizer. With Wi-Fi and the Wellwa app, our team sees the machine's status remotely and knows the exact issue before an engineer is sent. Often it is resolved without a visit at all." },
            { name: "Your machine, on your phone", desc: "Start, stop and switch water modes from anywhere; see connection status, operating state and care alerts at a glance." },
            { name: "Always improving", desc: "OTA-ready firmware — supported updates arrive over Wi-Fi." },
            { name: "Works without Wi-Fi too", desc: "Every core function stays on the machine itself; the app adds convenience, not dependency." },
            { name: "Lifetime free IoT service", desc: "Remote diagnostics and connected care are free for the life of the machine." },
          ] },
          { id: uid("w", 31), kind: "video", title: "Watch: the technology explained", url: "/wellwa/video/wellwa-technology-explainer.mp4", posterUrl: "/wellwa/images/aura-plus-7.webp", caption: "How Wellwa's ionization technology works, from source water to your glass." },
          { id: uid("w", 32), kind: "services", title: "From tap to glass — the 5-step journey", items: [
            { name: "1. We study your water first", desc: "TDS, hardness, minerals and existing filtration are reviewed before anything is installed — great output starts with understanding your source water." },
            { name: "2. The right pre-filtration", desc: "Chosen for your actual water, so the plates always receive clean, balanced input." },
            { name: "3. Controlled electrolysis", desc: "Platinum-coated titanium plates split the stream into alkaline drinking water and useful acidic water — the heart of the machine." },
            { name: "4. Choose your water", desc: "One touch selects a calibrated mode — drinking, cooking, produce cleaning, beauty or natural water." },
            { name: "5. Self-care built in", desc: "The E-Clean workflow, flow monitoring and care alerts keep the machine performing like day one." },
          ] },
          { id: uid("w", 12), kind: "highlights", title: "A clear ownership journey", items: ["1. Water review", "2. Model consultation", "3. Professional installation", "4. App pairing", "5. Connected support", "6. Service escalation"] },
          { id: uid("w", 35), kind: "services", title: "What your installation handover includes", items: [
            { name: "Physical setup", desc: "Placement, plumbing, power, inlet conditions, drainage and any required pre-filtration." },
            { name: "Every water mode", desc: "Which mode is intended for drinking, cooking, beauty use, produce cleaning and machine care." },
            { name: "App pairing", desc: "Account setup, 2.4 GHz Wi-Fi pairing, available remote functions and alert meanings." },
            { name: "Care and escalation", desc: "Cleaning, filter or consumable guidance, warranty documents and the authorised service route." },
          ] },
          { id: uid("w", 13), kind: "faq", title: "Installation readiness", items: [
            { q: "What should I check before installation?", a: "Review source water, plumbing access, a nearby power point, placement space and a compatible 2.4 GHz Wi-Fi network." },
            { q: "Does Wi-Fi replace local controls?", a: "No. Core on-machine controls continue to work locally. Wi-Fi enables supported app control, cloud status, alerts, diagnostics and connected-service features." },
            { q: "Does the app perform a complete machine analysis?", a: "Supported telemetry can provide operating and care context for remote diagnostics. It is not a substitute for water testing or a technician's physical inspection." },
            { q: "Does the machine automatically guarantee a chosen pH?", a: "The machine provides calibrated selectable modes, but actual output changes with source water, minerals, flow, temperature and machine condition. Verify output during handover." },
            { q: "Who handles technical service?", a: "Wellwa's own service team — reach them through your advisor or the app. Most issues are checked remotely first, so many are resolved without a visit." },
          ] },
          { id: uid("w", 48), kind: "appointment", title: "See the technology live in your own kitchen", url: "https://wellwalife.com/book-demo", note: "Book a home demonstration — watch the plates, water modes, app pairing and a live water test with your own supply." },
        ],
      },
      {
        id: "p7", slug: "comparison", label: "Comparison",
        blocks: [
          { id: uid("w", 58), kind: "about", title: "How Wellwa Aura compares", body: "Before choosing a water ionizer, see the real differences side by side. Many premium ionizers sold in India are imported, sold only through distributors, and carry a very high price tag. Here's what you get with Wellwa Aura — and what you typically get elsewhere." },
          { id: uid("w", 65), kind: "compare", title: "Wellwa Aura vs a typical imported ionizer", leftLabel: "Wellwa Aura", rightLabel: "Typical imported ionizer", rows: [
            { feature: "Plate size", left: "65 × 156 mm solid hybrid plates — as large as the biggest imported models", right: "135 × 75 mm on the top imported models", rightOk: true },
            { feature: "Plate material", left: "Solid hybrid platinum-coated titanium", right: "Platinum-plated titanium (mesh or standard)" },
            { feature: "ORP", left: "Up to -850 mV", right: "Lower — not published for most models" },
            { feature: "Dissolved hydrogen", left: "Up to 1,800 ppb", right: "Not published — typically lower" },
            { feature: "Chemicals", left: "100% chemical-free electrolysis — no additives, ever", right: "Needs an electrolysis enhancer (saline additive) for strong modes" },
            { feature: "Inbuilt filter", left: "None — nothing to replace, lower maintenance; pre-filtration matched to your source water", right: "Inbuilt cartridge — periodic branded replacement cost" },
            { feature: "pH calibration", left: "Yes — calibrated water modes", right: "Fixed presets" },
            { feature: "Auto pH controller", left: "Yes", right: "No — manual" },
            { feature: "Wi-Fi & app", left: "Yes — start/stop, modes, live status", right: "No" },
            { feature: "Remote diagnostics", left: "Yes — service before you even call", right: "No — technician visit needed" },
            { feature: "Price (7-plate class)", left: "₹1,25,000 — published, fixed", right: "Around ₹2.75–2.8 Lakh*" },
            { feature: "Price (8-plate class)", left: "₹1,50,000 — published, fixed", right: "Around ₹3.4 Lakh*" },
            { feature: "How you buy", left: "Fixed published price — no negotiation", right: "Distributor-quoted — varies by seller" },
            { feature: "5-year warranty & lifetime service", left: "5 YEARS — 1 yr full machine + 4 yrs plates. Lifetime FREE IoT (remote) service", right: "5-yr limited, distributor terms. No remote / IoT service" },
          ] },
          { id: uid("w", 60), kind: "about", title: "An honest note", body: "*Prices shown for other premium imported water ionizers are commonly-listed dealer prices at the time of writing, not an official manufacturer price — always verify current pricing directly with any seller before deciding. This comparison covers publicly known product categories only. It does not name or target any specific brand, and it makes no health or medical claims for any product." },
          { id: uid("w", 61), kind: "appointment", title: "See the value for yourself", url: "https://wellwalife.com/book-demo", note: "Book a home demo — compare the plates, the app, and test with your own water, no pressure." },
        ],
      },
      {
        id: "p6", slug: "gallery", label: "Gallery",
        blocks: [
          { id: uid("w", 36), kind: "gallery", title: "Real installations, events and our team", images: [
            // Real photos from Wellwa Life India's own Google Business Profile.
            { url: "/wellwa/images/google/g01.webp", color: WELLWA, label: "Wellwa launch event" },
            { url: "/wellwa/images/google/g02.webp", color: WELLWA, label: "Press meet — Wellwa Water Ionizer" },
            { url: "/wellwa/images/google/g03.webp", color: WELLWA, label: "The Wellwa team at our centre" },
            { url: "/wellwa/images/google/g04.webp", color: WELLWA, label: "Awareness seminar" },
            { url: "/wellwa/images/google/g05.webp", color: WELLWA, label: "Live water test at the centre" },
            { url: "/wellwa/images/google/g06.webp", color: WELLWA, label: "Distributor consultation" },
            { url: "/wellwa/images/google/g07.webp", color: WELLWA, label: "Water demonstration" },
            { url: "/wellwa/images/google/g08.webp", color: WELLWA, label: "Home installation" },
            { url: "/wellwa/images/google/g09.webp", color: WELLWA, label: "Home installation" },
            { url: "/wellwa/images/google/g10.webp", color: WELLWA, label: "Kitchen installation" },
            { url: "/wellwa/images/google/g11.webp", color: WELLWA, label: "Home installation" },
            { url: "/wellwa/images/google/g12.webp", color: WELLWA, label: "Home installation" },
            { url: "/wellwa/images/google/g13.webp", color: WELLWA, label: "Home installation" },
            { url: "/wellwa/images/google/g14.webp", color: WELLWA, label: "Home installation" },
            { url: "/wellwa/images/google/g15.webp", color: WELLWA, label: "Countertop installation" },
            { url: "/wellwa/images/google/g16.webp", color: WELLWA, label: "Home installation" },
            { url: "/wellwa/images/google/g17.webp", color: WELLWA, label: "Home installation" },
            { url: "/wellwa/images/google/g18.webp", color: WELLWA, label: "Home installation" },
            { url: "/wellwa/images/google/g19.webp", color: WELLWA, label: "Home installation" },
            { url: "/wellwa/images/google/g20.webp", color: WELLWA, label: "Home installation" },
            { url: "/wellwa/images/google/g21.webp", color: WELLWA, label: "Consultation at our centre" },
            { url: "/wellwa/images/google/g22.webp", color: WELLWA, label: "Home installation" },
            { url: "/wellwa/images/google/g23.webp", color: WELLWA, label: "Home installation" },
            { url: "/wellwa/images/google/g24.webp", color: WELLWA, label: "Team visit — home installation" },
            { url: "/wellwa/images/google/g25.webp", color: WELLWA, label: "Home installation" },
            { url: "/wellwa/images/google/g26.webp", color: WELLWA, label: "Home installation" },
            { url: "/wellwa/images/google/g27.webp", color: WELLWA, label: "Home installation" },
            { url: "/wellwa/images/google/g28.webp", color: WELLWA, label: "Home installation" },
            { url: "/wellwa/images/google/g29.webp", color: WELLWA, label: "Home installation" },
            { url: "/wellwa/images/google/g30.webp", color: WELLWA, label: "Home installation" },
            { url: "/wellwa/images/google/g31.webp", color: WELLWA, label: "Countertop installation" },
            { url: "/wellwa/images/google/g32.webp", color: WELLWA, label: "Home installation" },
            { url: "/wellwa/images/google/g33.webp", color: WELLWA, label: "Installation in progress" },
            { url: "/wellwa/images/google/g34.webp", color: WELLWA, label: "Home installation" },
            { url: "/wellwa/images/google/g35.webp", color: WELLWA, label: "Home installation" },
            { url: "/wellwa/images/google/g36.webp", color: WELLWA, label: "Home installation" },
            { url: "/wellwa/images/google/g37.webp", color: WELLWA, label: "Home installation" },
            { url: "/wellwa/images/google/g38.webp", color: WELLWA, label: "Live water demo at home" },
            { url: "/wellwa/images/google/g39.webp", color: WELLWA, label: "Home installation" },
            { url: "/wellwa/images/google/g40.webp", color: WELLWA, label: "New installation — first day" },
            { url: "/wellwa/images/google/g41.webp", color: WELLWA, label: "Home installation" },
            { url: "/wellwa/images/google/g42.webp", color: WELLWA, label: "Home installation" },
            { url: "/wellwa/images/google/g43.webp", color: WELLWA, label: "Home installation" },
            { url: "/wellwa/images/google/g44.webp", color: WELLWA, label: "Home installation" },
            { url: "/wellwa/images/google/g45.webp", color: WELLWA, label: "Home installation" },
            { url: "/wellwa/images/google/g46.webp", color: WELLWA, label: "Home installation" },
            { url: "/wellwa/images/google/g47.webp", color: WELLWA, label: "Delivery day" },
            { url: "/wellwa/images/google/g48.webp", color: WELLWA, label: "Distributor meeting" },
            { url: "/wellwa/images/google/g49.webp", color: WELLWA, label: "Training session" },
            { url: "/wellwa/images/google/g50.webp", color: WELLWA, label: "The Wellwa team at head office" },
          ] },
          { id: uid("w", 37), kind: "video", title: "A closer look at Wellwa", url: "/wellwa/video/wellwa-product-tour.mp4", posterUrl: "/wellwa/images/aura-plus-kitchen-hero.webp", caption: "A quick tour of the product and what real installations look like." },
          { id: uid("w", 49), kind: "appointment", title: "Ready to see the product yourself?", url: "https://wellwalife.com/book-demo", note: "Request a product demonstration whenever you're ready." },
        ],
      },
      {
        id: "p4", slug: "business", label: "Business",
        blocks: [
          { id: uid("w", 14), kind: "about", title: "Guiding a real home consultation", imageUrl: "/wellwa/images/distributor-training.webp", body: "Genuine home consultations: A trusted advisor visits the home, listens to the family's specific water concerns, honestly demonstrates the Aura range, and helps them find the right fit — never pushing a sale.\n\nSmart technology, fast service: Aura models include built-in Wi-Fi connected to our app, so you can monitor machine health while our support team can remotely run diagnostics for fast, proactive service." },
          { id: uid("w", 15), kind: "services", title: "Why distributors choose Wellwa", items: [
            { name: "Empower Your Future, On Your Terms", desc: "A pathway to financial independence, not just a routine job. Your effort directly shapes your growth — whether you're building foundational income or aiming for leadership rewards, it scales with your ambition." },
            { name: "Succeed by Elevating Others", desc: "No one walks alone here. Direct selling is built on real mentorship — as you build and guide your team toward their own success, your business foundation grows stronger too." },
            { name: "Rewarding Every Milestone", desc: "Multiple income streams — from direct sales to the car fund — recognise and support your achievements at every level." },
            { name: "A Fresh Start, Zero Friction", desc: "Big dreams shouldn't need big risk. Start with zero upfront inventory or warehousing — our zero-stock model plus real local training lowers the barrier so you can focus on growth." },
            { name: "Purpose-Driven Impact", desc: "Beyond building a business, you bring real value into homes — representing advanced water ionizers and wellness technology that genuinely improves lives." },
          ] },
          { id: uid("w", 16), kind: "image", title: "Training and local activation", images: [{ url: "/wellwa/images/distributor-training.webp", caption: "Regular training and local activation sessions, led by our senior leadership team" }] },
          { id: uid("w", 17), kind: "pdf", title: "Wellwa Business Plan (PDF)", fileLabel: "Wellwa-Business-Plan.pdf", fileUrl: "/wellwa/docs/Wellwa-Business-Plan.pdf", posterUrl: "/wellwa/images/business-plan-thumb.webp", hint: "18 pages · products, 5 income streams, ranks & rewards · tap to open" },
          { id: uid("w", 51), kind: "video", title: "Watch: the business opportunity explained", url: "", posterUrl: "", caption: "A short walkthrough of the opportunity and how it works." },
          { id: uid("w", 19), kind: "faq", title: "Before you join", items: [
            { q: "Is any income guaranteed?", a: "No. Results depend on individual activity, skill, market conditions, customer demand and the current written plan." },
            { q: "What should I request in writing?", a: "Ask for the agreement, joining or activation fees, margin or commission schedule, territory rules, returns policy, payout conditions and support commitments." },
            { q: "Where do I apply?", a: "Use the official distributor application at wellwalife.com/distributor/apply or ask your authorised advisor for the current process." },
            { q: "Do I need prior sales experience?", a: "No. New distributors receive product training, marketing support and guidance on the demo conversation before they start selling independently." },
            { q: "What support will I get after joining?", a: "Ongoing training, marketing materials and guidance from your sponsor and the Wellwa team — direct selling works best with active mentorship, not just a signup." },
          ] },
          { id: uid("w", 52), kind: "cta", title: "Ready to start earning?", body: "Already convinced? Apply directly using my referral link below.", joinUrl: "https://wellwalife.com/distributor/apply", joinLabel: "Join Now", referralCode: "" },
          { id: uid("w", 20), kind: "contact", title: "Request the current official business plan", note: "Connect with your relationship manager — we typically reply within a few hours." },
        ],
      },
      {
        id: "p8", slug: "about", label: "About Us",
        blocks: [
          { id: uid("w", 66), kind: "about", title: "Who we are", imageUrl: "/wellwa/images/google/g01.webp", body: "Wellwa Life India Pvt. Ltd. is a young company built by veterans. Our team brings 20+ years of hands-on experience in the water industry and 25+ years in direct selling — and we put both to work on one goal: water that is genuinely better for Indian homes, engineered and made in India.\n\nWe design and manufacture domestic and commercial water ionizers and commercial RO systems, backed by our own in-house R&D team, a 5-year warranty and lifetime free IoT service. Headquartered in Gurugram, we work through trained advisors who test your water before they promise anything." },
          { id: uid("w", 67), kind: "highlights", title: "Wellwa at a glance", items: ["🏭 20+ years in the water industry", "🤝 25+ years in direct selling", "🔬 In-house R&D team", "🇮🇳 Proudly Made in India", "💧 Domestic & commercial ionizers · commercial RO", "🛡️ 5-year warranty · lifetime IoT service"] },
          { id: uid("w", 68), kind: "about", title: "Our vision", body: "A Wellwa in every Indian kitchen — water that is not just clean, but genuinely better. Made in India, for India's water, at a price a family can actually say yes to." },
          { id: uid("w", 69), kind: "about", title: "Our mission", body: "• Engineer ionizers and RO systems that perform on real Indian source water — not lab water.\n• Sell honestly: test first, explain plainly, never make a medical promise.\n• Keep every machine performing for years — connected care, remote diagnostics and service you never have to chase.\n• Build a direct-selling family where advisors grow by genuinely helping families." },
          { id: uid("w", 70), kind: "services", title: "What we build", items: [
            { name: "Domestic water ionizers", desc: "The Aura range — 5, 7 and 8-plate smart ionizers with solid hybrid platinum-coated titanium plates, app control and calibrated water modes." },
            { name: "Commercial water ionizers", desc: "High-output systems for clinics, gyms, offices, restaurants and institutions." },
            { name: "Commercial RO systems", desc: "Purification plants sized for businesses, housing societies and industry." },
            { name: "In-house R&D", desc: "Our own engineers design, test and improve every product — so upgrades come from us, not a supplier." },
          ] },
          { id: uid("w", 71), kind: "services", title: "What we stand for", items: [
            { name: "Test before we promise", desc: "A free water check-up at your home, with your own supply, before any recommendation." },
            { name: "No medical claims, ever", desc: "We talk about water quality, taste and technology — not cures." },
            { name: "Transparent pricing", desc: "Published, fixed prices. No distributor negotiation, no hidden terms." },
            { name: "Service you never chase", desc: "Wi-Fi-connected machines, remote diagnostics and lifetime IoT service — free." },
          ] },
          { id: uid("w", 72), kind: "about", title: "The team behind Wellwa", imageUrl: "/wellwa/images/google/g50.webp", body: "Our founders and senior team have spent two decades inside the water industry — manufacturing, installation and after-sales — and a quarter century building direct-selling networks across India. That combination is rare: people who understand both the machine and the family it goes into. It shows in how we design, how we sell and how we serve." },
          { id: uid("w", 73), kind: "appointment", title: "Come and meet us", url: "https://wellwalife.com/book-demo", note: "Visit our Gurugram centre or book a free home water test — we'd love to show you the difference." },
        ],
      },
      {
        id: "p5", slug: "contact", label: "Contact",
        blocks: [
          { id: uid("w", 21), kind: "contact", title: "Talk to a Wellwa advisor" },
          { id: uid("w", 41), kind: "services", title: "What happens after an enquiry", items: [
            { name: "1. We understand the requirement", desc: "The advisor asks about city, source water, current filtration, family size and preferred consultation time." },
            { name: "2. We shortlist the discussion", desc: "Relevant Aura models and installation considerations are compared without promising a fixed output." },
            { name: "3. We arrange the next step", desc: "Depending on availability, this may be a phone consultation, video explanation or product demonstration." },
            { name: "4. You confirm written terms", desc: "Price, payment, warranty, installation, stock and service details should be confirmed before ordering." },
          ] },
          { id: uid("w", 42), kind: "highlights", title: "Helpful details to share", items: ["City and pincode", "Water source", "Known TDS or hardness", "Current purifier", "Family size", "Preferred time"] },
          { id: uid("w", 43), kind: "appointment", title: "Book a consultation", url: "https://wellwalife.com/book-demo", note: "Pick a time that works for you — we'll confirm over WhatsApp or call." },
          { id: uid("w", 22), kind: "hours", title: "Advisor availability", rows: [{ day: "Mon – Sat", time: "9:00 – 19:00" }, { day: "Sunday", time: "By appointment" }] },
          { id: uid("w", 23), kind: "location", title: "Head office", address: "704, 7th Floor, Palm Court, Mehrauli-Gurgaon Road, DLF Phase 3, Sector 24, Gurugram 122007, Haryana" },
        ],
      },
    ],
  },
};

/* ================================================================== */
/* 2. Doctor / Clinic                                                  */
/* ================================================================== */
const DOC = "#2563eb";
const doctor: CardTemplateDef = {
  key: "doctor-clinic",
  name: "Doctor / Clinic",
  category: "Healthcare",
  description: "Complete practice card — specialisations, clinic photos, consultation hours, appointment booking, fees and patient FAQs.",
  emoji: "🩺",
  data: {
    name: "Dr. Your Name", jobTitle: "MBBS, MD — General Physician", company: "Your Clinic",
    tagline: "Compassionate care, backed by experience",
    about: "Practising for over 10 years with a focus on preventive care and unhurried consultations.",
    avatarColor: DOC, themeColor: DOC, template: "minimal", verified: false,
    avatarUrl: "/art/avatar-clinic.svg",
    coverUrl: "/api/stock/banners/doctor.jpg",
    botPersona: "Polite, reassuring clinic assistant. Helps with timings, fees, location and appointments only.",
    botKnowledge: "Clinic timings, consultation fee, address, appointment process, insurance accepted, doctor's qualifications and specialisations. NEVER diagnose, prescribe or advise on treatment — always ask the patient to book a consultation.",
    links: [
      { id: "l1", type: "phone", label: "Call clinic", value: "+91" },
      { id: "l2", type: "whatsapp", label: "WhatsApp", value: "+91" },
      { id: "l3", type: "location", label: "Clinic address", value: "" },
      { id: "l4", type: "email", label: "Email", value: "clinic@example.com" },
    ],
    pages: [
      { id: "p1", slug: "home", label: "Home", blocks: [
        { id: uid("d", 0), kind: "video", title: "Meet the doctor", url: "", caption: "A short introduction — paste your YouTube link here" },
        { id: uid("d", 1), kind: "about", title: "About the doctor", body: "Practising for over 10 years with a focus on preventive care. I believe in explaining things clearly and never rushing a consultation — you should leave understanding your health, not just holding a prescription." },
        { id: uid("d", 2), kind: "highlights", title: "Specialisations", items: ["General medicine", "Diabetes & blood pressure", "Preventive health check-ups", "Thyroid & lifestyle disorders", "Lifestyle counselling"] },
        { id: uid("d", 3), kind: "image", title: "Our clinic", images: [{ url: "/art/clinic-care.svg", caption: "Clean, calm and fully equipped" }] },
        { id: uid("d", 4), kind: "appointment", title: "Book an appointment", url: "", note: "Share your name and preferred time — we'll confirm on WhatsApp" },
      ] },
      { id: "p2", slug: "clinic", label: "Clinic", blocks: [
        { id: uid("d", 5), kind: "hours", title: "Consultation hours", rows: [{ day: "Mon – Fri", time: "10:00 – 14:00, 17:00 – 20:00" }, { day: "Saturday", time: "10:00 – 14:00" }, { day: "Sunday", time: "Closed" }] },
        { id: uid("d", 6), kind: "services", title: "Services offered", items: [
          { name: "General consultation", desc: "Unhurried assessment with a clear explanation and plan" },
          { name: "Preventive health check-up", desc: "Age-appropriate screening packages" },
          { name: "Chronic care follow-up", desc: "Ongoing management for diabetes, BP and thyroid" },
          { name: "Teleconsultation", desc: "Video consultation for follow-ups and reports" },
        ] },
        { id: uid("d", 7), kind: "gallery", title: "Inside the clinic", images: [
          { url: "/art/clinic-care.svg", color: DOC, label: "Consulting room" },
          { url: "/art/clinic-lab.svg", color: "#0d9488", label: "Sample collection" },
          { url: "/art/clinic-trust.svg", color: "#6d5cf5", label: "Waiting area" },
          { url: "/art/clinic-pharmacy.svg", color: "#0891b2", label: "In-house pharmacy" },
          { url: "/art/clinic-trust.svg", color: "#e11d48", label: "Emergency support" },
          { url: "/art/clinic-scan.svg", color: "#7c3aed", label: "Diagnostics tie-up" },
        ] },
        { id: uid("d", 12), kind: "image", title: "Health check packages", images: [{ url: "/art/clinic-checkup.svg", caption: "Annual full-body check-up packages available" }] },
        { id: uid("d", 8), kind: "location", title: "Clinic address", address: "" },
      ] },
      { id: "p3", slug: "patients", label: "Patients", blocks: [
        { id: uid("d", 9), kind: "faq", title: "Patient information", items: [
          { q: "Do I need an appointment?", a: "Walk-ins are welcome, but booking ahead reduces your waiting time considerably." },
          { q: "What is the consultation fee?", a: "Please message us for current fees. Follow-up visits within 15 days are complimentary." },
          { q: "Do you accept insurance?", a: "Yes, we accept most major health insurance providers — please bring your card." },
          { q: "Can I get a teleconsultation?", a: "Yes, for follow-ups and report reviews. Message us on WhatsApp to arrange one." },
          { q: "What should I bring?", a: "Any previous prescriptions, reports and a list of medicines you currently take." },
        ] },
        { id: uid("d", 10), kind: "testimonials", title: "Patient feedback", items: [
          { name: "Patient, verified visit", text: "Explains everything patiently and never rushes. Rare these days.", rating: 5 },
          { name: "Patient, verified visit", text: "The clinic is spotless and the staff are genuinely kind.", rating: 5 },
        ] },
        { id: uid("d", 11), kind: "contact", title: "Send a message" },
      ] },
    ],
  },
};

/* ================================================================== */
/* 3. Real estate                                                      */
/* ================================================================== */
const RE = "#c9781c";
const realEstate: CardTemplateDef = {
  key: "real-estate",
  name: "Real Estate Agent",
  category: "Property",
  description: "Full property card — featured listings with photos and specs, project gallery, loan help, site-visit booking and buyer FAQs.",
  emoji: "🏠",
  data: {
    name: "Your Name", jobTitle: "Property Consultant", company: "Your Realty",
    tagline: "Finding the right address for your family",
    about: "Helping buyers and investors find the right property with honest advice and complete paperwork support.",
    avatarColor: RE, themeColor: RE, template: "bold", verified: false,
    avatarUrl: "/art/avatar-estate.svg",
    coverUrl: "/api/stock/banners/realestate.jpg",
    botPersona: "Helpful, straight-talking property advisor. Never oversells.",
    botKnowledge: "Available listings with price, configuration, carpet area, location and possession date. Site-visit process, home-loan assistance, RERA registration, documentation support, brokerage terms.",
    links: [
      { id: "l1", type: "phone", label: "Call", value: "+91" },
      { id: "l2", type: "whatsapp", label: "WhatsApp", value: "+91" },
      { id: "l3", type: "location", label: "Office", value: "" },
      { id: "l4", type: "website", label: "Website", value: "" },
    ],
    pages: [
      { id: "p1", slug: "home", label: "Home", blocks: [
        { id: uid("r", 0), kind: "video", title: "Property walkthrough", url: "", caption: "Add a walkthrough video of your featured project" },
        { id: uid("r", 1), kind: "highlights", title: "Why work with me", items: ["RERA registered", "Verified listings only", "Home-loan assistance", "End-to-end paperwork", "No hidden brokerage"] },
        { id: uid("r", 2), kind: "about", title: "About me", body: "I help buyers and investors find the right property — with honest advice, personally verified listings and complete documentation support. If a property isn't right for you, I'll tell you." },
        { id: uid("r", 3), kind: "image", title: "Featured project", images: [{ url: "/art/estate-tower.svg", caption: "Ready-to-move homes in prime locations" }] },
        { id: uid("r", 4), kind: "appointment", title: "Book a site visit", url: "", note: "Tell me your budget and preferred area — I'll shortlist for you" },
      ] },
      { id: "p2", slug: "listings", label: "Listings", blocks: [
        { id: uid("r", 5), kind: "product", title: "Featured properties", items: [
          {
            name: "3 BHK Apartment — Prime Location",
            images: ["/art/estate-tower.svg", "/art/estate-interior.svg", "/art/estate-home.svg"],
            mrp: "₹92,00,000", price: "₹85,00,000", badge: "Ready to move",
            desc: "Spacious 3 BHK with covered parking, clubhouse access and 24×7 security.",
            features: ["1,450 sq ft carpet area", "Covered parking for 2 cars", "Clubhouse, gym & pool", "24×7 security with CCTV", "Loan pre-approval available"],
            specs: [{ label: "Configuration", value: "3 BHK" }, { label: "Carpet area", value: "1,450 sq ft" }, { label: "Facing", value: "East" }, { label: "Floor", value: "7 of 14" }, { label: "Possession", value: "Ready to move" }, { label: "RERA", value: "Registered" }],
            ctaLabel: "Enquire on WhatsApp",
          },
          {
            name: "2 BHK Apartment — Near IT Park",
            images: ["/art/estate-home.svg", "/art/estate-interior.svg"],
            mrp: "₹58,00,000", price: "₹52,50,000", badge: "Investor favourite",
            desc: "Compact, well-planned 2 BHK with strong rental demand from IT professionals.",
            features: ["950 sq ft carpet area", "Modular kitchen included", "Walking distance to IT park", "High rental yield"],
            specs: [{ label: "Configuration", value: "2 BHK" }, { label: "Carpet area", value: "950 sq ft" }, { label: "Possession", value: "3 months" }, { label: "RERA", value: "Registered" }],
            ctaLabel: "Enquire on WhatsApp",
          },
        ] },
        { id: uid("r", 6), kind: "gallery", title: "Project photos", images: [
          { url: "/art/estate-tower.svg", color: RE, label: "Exterior" },
          { url: "/art/estate-interior.svg", color: "#0d9488", label: "Interior" },
          { url: "/art/estate-home.svg", color: "#2563eb", label: "Amenities" },
        ] },
      ] },
      { id: "p3", slug: "contact", label: "Contact", blocks: [
        { id: uid("r", 7), kind: "services", title: "How I help", items: [
          { name: "Buying assistance", desc: "Shortlisting, site visits, price negotiation" },
          { name: "Home loan support", desc: "Pre-approval with leading banks" },
          { name: "Documentation", desc: "Agreement, registration and possession" },
        ] },
        { id: uid("r", 8), kind: "faq", title: "Buyer FAQs", items: [
          { q: "Do you help with home loans?", a: "Yes — I work with major banks and can arrange pre-approval before you shortlist." },
          { q: "Are the listings verified?", a: "Every listing is personally verified with clear title documents and RERA registration." },
          { q: "What is your brokerage?", a: "Standard and stated upfront — no surprises at the closing table." },
        ] },
        {
          id: uid("r", 11), kind: "testimonials", title: "Client reviews",
          items: [
            { name: "Homebuyer, first flat", text: "Showed me six properties and honestly talked me out of two of them. Paperwork and loan were handled end to end.", rating: 5 },
            { name: "NRI investor", text: "Handled the entire purchase while I was abroad — video walkthroughs, registration, everything.", rating: 5 },
          ],
        },
        { id: uid("r", 9), kind: "contact", title: "Tell me what you're looking for" },
        { id: uid("r", 10), kind: "hours", title: "Available", rows: [{ day: "Mon – Sat", time: "9:00 – 19:00" }, { day: "Sunday", time: "Site visits by appointment" }] },
      ] },
    ],
  },
};

/* ================================================================== */
/* 4. Restaurant / Café                                                */
/* ================================================================== */
const FOOD = "#d24b4b";
const restaurant: CardTemplateDef = {
  key: "restaurant-cafe",
  name: "Restaurant / Café",
  category: "Food & Beverage",
  description: "Complete dining card — signature dishes with photos and prices, gallery, table booking, hours, delivery and catering.",
  emoji: "🍽️",
  data: {
    name: "Your Restaurant", jobTitle: "Multi-cuisine Restaurant", company: "",
    tagline: "Fresh ingredients, family recipes",
    about: "A warm neighbourhood kitchen serving freshly prepared food, seven days a week.",
    avatarColor: FOOD, themeColor: FOOD, template: "photo", verified: false,
    avatarUrl: "/art/avatar-food.svg",
    coverUrl: "/api/stock/banners/restaurant.jpg",
    botPersona: "Warm, welcoming restaurant host.",
    botKnowledge: "Menu items and prices, opening hours, table booking, home delivery, party and catering enquiries, address, parking, pure-veg availability.",
    links: [
      { id: "l1", type: "phone", label: "Call to order", value: "+91" },
      { id: "l2", type: "whatsapp", label: "WhatsApp", value: "+91" },
      { id: "l3", type: "location", label: "Find us", value: "" },
      { id: "l4", type: "instagram", label: "Instagram", value: "" },
    ],
    pages: [
      { id: "p1", slug: "home", label: "Home", blocks: [
        { id: uid("f", 1), kind: "video", title: "Take a look", url: "", caption: "A short tour of our kitchen and dining room" },
        { id: uid("f", 2), kind: "highlights", title: "Why visit us", items: ["Fresh daily ingredients", "Pure veg & non-veg sections", "Family & group seating", "Home delivery available", "Party & catering orders"] },
        { id: uid("f", 3), kind: "image", title: "Today's special", images: [{ url: "/art/food-plate.svg", caption: "Chef's special thali — served all day" }] },
        { id: uid("f", 4), kind: "appointment", title: "Book a table", url: "", note: "Tell us the date, time and number of guests" },
      ] },
      { id: "p2", slug: "menu", label: "Menu", blocks: [
        { id: uid("f", 5), kind: "product", title: "Signature dishes", items: [
          {
            name: "Chef's Special Thali",
            images: ["/art/food-plate.svg", "/art/food-plate.svg"],
            mrp: "", price: "₹320", badge: "Bestseller",
            desc: "A complete meal — seasonal vegetables, dal, rice, breads and dessert.",
            features: ["Unlimited rotis & rice", "Seasonal vegetables", "Sweet included", "Pure veg"],
            specs: [{ label: "Serves", value: "1 person" }, { label: "Type", value: "Pure veg" }, { label: "Available", value: "All day" }],
            ctaLabel: "Order on WhatsApp",
          },
          {
            name: "Tandoori Platter",
            images: ["/art/food-kitchen.svg", "/art/food-kitchen.svg"],
            mrp: "", price: "₹549", badge: "Chef's pick",
            desc: "Assorted kebabs straight from the clay oven, with mint chutney and salad.",
            features: ["4 kebab varieties", "Freshly grilled to order", "Serves 2–3 people"],
            specs: [{ label: "Serves", value: "2 – 3 people" }, { label: "Type", value: "Non-veg" }, { label: "Spice", value: "Medium (adjustable)" }],
            ctaLabel: "Order on WhatsApp",
          },
        ] },
        { id: uid("f", 6), kind: "services", title: "Also on the menu", items: [
          { name: "Fresh juices & mocktails", desc: "Made to order, no added sugar" },
          { name: "South Indian breakfast", desc: "Served 8:00 – 11:30 every day" },
          { name: "Party & catering orders", desc: "Bulk orders with 24 hours' notice" },
        ] },
        { id: uid("f", 7), kind: "gallery", title: "A look inside", images: [
          { url: "/art/food-dining.svg", color: FOOD, label: "Dining" },
          { url: "/art/food-plate.svg", color: "#c9781c", label: "Signature dish" },
          { url: "/art/food-coffee.svg", color: "#0d9488", label: "Café corner" },
        ] },
        { id: uid("f", 8), kind: "pdf", title: "Full menu", fileLabel: "Menu.pdf" },
        { id: uid("f", 9), kind: "offer", title: "Today's offer", text: "Special weekday combo pricing — lunch 12:00 to 15:00", code: "", expires: "" },
      ] },
      { id: "p3", slug: "visit", label: "Visit", blocks: [
        { id: uid("f", 10), kind: "hours", title: "Opening hours", rows: [{ day: "Mon – Sun", time: "11:00 – 23:00" }, { day: "Breakfast", time: "8:00 – 11:30" }] },
        { id: uid("f", 11), kind: "location", title: "Address & parking", address: "" },
        { id: uid("f", 12), kind: "faq", title: "Good to know", items: [
          { q: "Do you deliver?", a: "Yes — call or WhatsApp us directly for home delivery in the area." },
          { q: "Do you take party orders?", a: "Yes, with 24 hours' notice. Message us for a quote." },
          { q: "Is parking available?", a: "Yes, free parking is available for guests." },
        ] },
        {
          id: uid("f", 14), kind: "testimonials", title: "Guest reviews",
          items: [
            { name: "Family dinner", text: "Food came out hot and fresh, and the staff were patient with our kids. This is our Sunday place now.", rating: 5 },
            { name: "Office party, 40 guests", text: "Catered our team dinner. Everything arrived on time and the veg and non-veg were kept properly separate.", rating: 5 },
          ],
        },
        { id: uid("f", 13), kind: "contact", title: "Enquiries & catering" },
      ] },
    ],
  },
};

/* ================================================================== */
/* 5. Fitness trainer / Gym                                            */
/* ================================================================== */
const FIT = "#e5673b";
const fitness: CardTemplateDef = {
  key: "fitness-trainer",
  name: "Fitness Trainer / Gym",
  category: "Health & Fitness",
  description: "Complete coaching card — plans with pricing, transformation gallery, batch timings, free trial and client results.",
  emoji: "💪",
  data: {
    name: "Your Name", jobTitle: "Certified Personal Trainer", company: "Your Fitness Studio",
    tagline: "Train smart. Stay consistent. See results.",
    about: "Certified trainer helping people build strength and lasting habits with realistic, sustainable plans.",
    avatarColor: FIT, themeColor: FIT, template: "dark", verified: false,
    avatarUrl: "/art/avatar-gym.svg",
    coverUrl: "/api/stock/banners/gym.jpg",
    botPersona: "Motivating but realistic fitness coach. Encouraging, never shaming.",
    botKnowledge: "Programmes offered, batch timings, monthly and quarterly fees, free trial policy, diet guidance, online vs in-person options, studio location. Never give medical advice — refer injuries or conditions to a doctor.",
    links: [
      { id: "l1", type: "whatsapp", label: "WhatsApp", value: "+91" },
      { id: "l2", type: "phone", label: "Call", value: "+91" },
      { id: "l3", type: "instagram", label: "Instagram", value: "" },
      { id: "l4", type: "location", label: "Studio", value: "" },
    ],
    pages: [
      { id: "p1", slug: "home", label: "Home", blocks: [
        { id: uid("g", 1), kind: "video", title: "How we train", url: "", caption: "A 60-second look at a typical session" },
        { id: uid("g", 2), kind: "highlights", title: "What you get", items: ["Personalised workout plan", "Diet guidance that fits your life", "Weekly progress check", "Form correction & injury care", "Online + in-person options"] },
        { id: uid("g", 3), kind: "about", title: "About me", body: "Certified trainer helping people build strength and lasting habits. No crash diets and no punishing routines — just realistic plans you can actually keep, and steady progress you can measure." },
        { id: uid("g", 4), kind: "appointment", title: "Free trial session", url: "", note: "Book your first session — completely free, no obligation" },
      ] },
      { id: "p2", slug: "programmes", label: "Programmes", blocks: [
        { id: uid("g", 5), kind: "product", title: "Training plans", items: [
          {
            name: "1-Month Personal Training",
            images: ["/art/gym-weights.svg", "/art/gym-meal.svg"],
            mrp: "₹6,000", price: "₹4,500", badge: "Most popular",
            desc: "Three focused sessions a week with a plan built around your body and schedule.",
            features: ["12 one-to-one sessions", "Custom workout plan", "Diet guidance", "Weekly check-in call"],
            specs: [{ label: "Duration", value: "1 month" }, { label: "Sessions", value: "12" }, { label: "Mode", value: "In-person or online" }],
            ctaLabel: "Join on WhatsApp",
          },
          {
            name: "3-Month Transformation",
            images: ["/art/gym-goal.svg", "/art/gym-pulse.svg"],
            mrp: "₹18,000", price: "₹12,000", badge: "Best value",
            desc: "The programme that actually changes habits — three months of structured progression.",
            features: ["36 sessions", "Monthly plan revision", "Full diet plan with alternatives", "Body composition tracking", "WhatsApp support throughout"],
            specs: [{ label: "Duration", value: "3 months" }, { label: "Sessions", value: "36" }, { label: "Includes", value: "Diet + tracking" }],
            ctaLabel: "Join on WhatsApp",
          },
        ] },
        { id: uid("g", 6), kind: "gallery", title: "Transformations & studio", images: [
          { url: "/art/gym-goal.svg", color: FIT, label: "Client results" },
          { url: "/art/gym-weights.svg", color: "#0d9488", label: "Training floor" },
          { url: "/art/gym-meal.svg", color: "#2563eb", label: "Nutrition guidance" },
        ] },
        { id: uid("g", 7), kind: "testimonials", title: "Client results", items: [
          { name: "Client, 3-month programme", text: "Lost 11 kg without giving up the food I love. The plan actually fit my life.", rating: 5 },
          { name: "Client, personal training", text: "My back pain is gone — the form correction alone was worth it.", rating: 5 },
        ] },
      ] },
      { id: "p3", slug: "contact", label: "Contact", blocks: [
        { id: uid("g", 8), kind: "hours", title: "Batch timings", rows: [{ day: "Mon – Sat (morning)", time: "6:00 – 10:00" }, { day: "Mon – Sat (evening)", time: "17:00 – 21:00" }, { day: "Sunday", time: "Rest day" }] },
        { id: uid("g", 9), kind: "faq", title: "Before you start", items: [
          { q: "I've never trained before — is that ok?", a: "Absolutely. Most of my clients start from zero. We build from wherever you are." },
          { q: "Do I need a gym membership?", a: "Not for online plans. For in-person sessions, studio access is included." },
          { q: "Will I get a diet plan?", a: "Yes — practical Indian meal plans with alternatives, not a restrictive crash diet." },
        ] },
        { id: uid("g", 10), kind: "location", title: "Studio", address: "" },
        { id: uid("g", 11), kind: "contact", title: "Start your journey" },
      ] },
    ],
  },
};

/* ================================================================== */
/* 6. Beauty salon / Spa                                               */
/* ================================================================== */
const SALON = "#6d5cf5";
const salon: CardTemplateDef = {
  key: "salon-spa",
  name: "Beauty Salon / Spa",
  category: "Beauty & Wellness",
  description: "Complete salon card — service menu with prices, work gallery, bridal packages, appointment booking, offers and hours.",
  emoji: "💇",
  data: {
    name: "Your Salon", jobTitle: "Hair, Skin & Beauty Studio", company: "",
    tagline: "Look good. Feel better.",
    about: "A calm studio for hair, skin and beauty care — trained stylists and premium products only.",
    avatarColor: SALON, themeColor: SALON, template: "photo", verified: false,
    avatarUrl: "/art/avatar-salon.svg",
    coverUrl: "/api/stock/banners/salon.jpg",
    botPersona: "Warm, polished salon receptionist.",
    botKnowledge: "Service list with prices and duration, stylist availability, appointment booking, bridal packages, current offers, address and parking, products used.",
    links: [
      { id: "l1", type: "whatsapp", label: "Book on WhatsApp", value: "+91" },
      { id: "l2", type: "phone", label: "Call", value: "+91" },
      { id: "l3", type: "instagram", label: "Instagram", value: "" },
      { id: "l4", type: "location", label: "Find us", value: "" },
    ],
    pages: [
      { id: "p1", slug: "home", label: "Home", blocks: [
        { id: uid("s", 0), kind: "video", title: "Inside our studio", url: "", caption: "Add a short studio tour or a transformation reel" },
        { id: uid("s", 1), kind: "highlights", title: "Why choose us", items: ["Trained, experienced stylists", "Premium products only", "Hygienic, sanitised tools", "Booking on WhatsApp", "Bridal specialists"] },
        { id: uid("s", 2), kind: "image", title: "Our studio", images: [{ url: "/art/salon-glow.svg", caption: "A calm space to be looked after" }] },
        { id: uid("s", 3), kind: "appointment", title: "Book an appointment", url: "", note: "Tell us the service and your preferred time" },
        { id: uid("s", 4), kind: "offer", title: "This month", text: "Special package pricing on hair spa + facial combos", code: "", expires: "" },
      ] },
      { id: "p2", slug: "services", label: "Services", blocks: [
        { id: uid("s", 5), kind: "product", title: "Signature packages", items: [
          {
            name: "Bridal Makeover Package",
            images: ["/art/salon-bridal.svg", "/art/salon-glow.svg", "/art/salon-bridal.svg"],
            mrp: "₹25,000", price: "₹18,500", badge: "Most booked",
            desc: "Complete bridal preparation — trial, pre-bridal care and the big day itself.",
            features: ["Pre-bridal skin & hair care", "Trial session included", "HD bridal makeup", "Hair styling & draping", "Touch-up kit"],
            specs: [{ label: "Duration", value: "Pre-bridal + wedding day" }, { label: "Trial", value: "Included" }, { label: "Booking", value: "2 weeks in advance" }],
            ctaLabel: "Enquire on WhatsApp",
          },
          {
            name: "Hair Spa & Repair",
            images: ["/art/salon-spa.svg", "/art/salon-glow.svg"],
            mrp: "₹2,500", price: "₹1,800", badge: "Popular",
            desc: "Deep-conditioning treatment for dry, damaged or chemically treated hair.",
            features: ["Scalp analysis", "Deep-conditioning mask", "Head massage", "Blow-dry finish"],
            specs: [{ label: "Duration", value: "60 – 75 minutes" }, { label: "Suits", value: "Dry & damaged hair" }],
            ctaLabel: "Book on WhatsApp",
          },
        ] },
        { id: uid("s", 6), kind: "services", title: "Full service menu", items: [
          { name: "Hair cut & styling", desc: "Consultation, wash, cut and blow-dry — from ₹450" },
          { name: "Hair colour & treatment", desc: "Global colour, highlights, smoothening — from ₹2,200" },
          { name: "Facial & clean-up", desc: "Skin-type specific facials — from ₹900" },
          { name: "Waxing & threading", desc: "Gentle products, hygienic single-use tools" },
          { name: "Manicure & pedicure", desc: "Classic and spa options — from ₹700" },
        ] },
        { id: uid("s", 7), kind: "gallery", title: "Our work", images: [
          { url: "/art/salon-hair.svg", color: SALON, label: "Hair" },
          { url: "/art/salon-glow.svg", color: FOOD, label: "Makeup" },
          { url: "/art/salon-glow.svg", color: "#0d9488", label: "Nails" },
        ] },
      ] },
      { id: "p3", slug: "visit", label: "Visit", blocks: [
        { id: uid("s", 8), kind: "hours", title: "Open", rows: [{ day: "Tue – Sun", time: "10:00 – 20:00" }, { day: "Monday", time: "Closed" }] },
        { id: uid("s", 9), kind: "testimonials", title: "What clients say", items: [
          { name: "Client", text: "They actually listened to what I wanted instead of doing their own thing.", rating: 5 },
          { name: "Bride", text: "My bridal look was exactly what I'd imagined. The trial made all the difference.", rating: 5 },
        ] },
        { id: uid("s", 10), kind: "faq", title: "Good to know", items: [
          { q: "Do I need an appointment?", a: "Walk-ins are welcome, but booking guarantees your preferred stylist and time." },
          { q: "Which products do you use?", a: "Only professional salon brands — we'll happily show you before we start." },
          { q: "How early should I book bridal?", a: "At least two weeks ahead so we can fit in a trial and pre-bridal sessions." },
        ] },
        { id: uid("s", 11), kind: "location", title: "Address", address: "" },
        { id: uid("s", 12), kind: "contact", title: "Enquire" },
      ] },
    ],
  },
};

/* ================================================================== */
/* 7. Consultant / Coach                                               */
/* ================================================================== */
const CONS = "#0d9488";
const consultant: CardTemplateDef = {
  key: "consultant-coach",
  name: "Consultant / Coach",
  category: "Professional services",
  description: "Complete advisory card — engagements with pricing, credentials, case results, discovery-call booking and FAQs.",
  emoji: "📈",
  data: {
    name: "Your Name", jobTitle: "Business Consultant", company: "Your Practice",
    tagline: "Clear advice that moves the needle",
    about: "I work with small businesses to sharpen strategy, fix operations and grow revenue predictably.",
    avatarColor: CONS, themeColor: CONS, template: "classic", verified: false,
    avatarUrl: "/art/avatar-office.svg",
    coverUrl: "/api/stock/banners/coaching.jpg",
    botPersona: "Professional, concise consultant's assistant.",
    botKnowledge: "Services offered, engagement models and typical fees, discovery-call process, industries served, credentials and experience, typical timelines.",
    links: [
      { id: "l1", type: "email", label: "Email", value: "you@example.com" },
      { id: "l2", type: "whatsapp", label: "WhatsApp", value: "+91" },
      { id: "l3", type: "linkedin", label: "LinkedIn", value: "" },
      { id: "l4", type: "website", label: "Website", value: "" },
    ],
    pages: [
      { id: "p1", slug: "home", label: "Home", blocks: [
        { id: uid("c", 0), kind: "video", title: "A 2-minute introduction", url: "", caption: "Introduce yourself and how you work" },
        { id: uid("c", 1), kind: "about", title: "How I help", body: "I work with small businesses to sharpen strategy, fix operations and grow revenue predictably — with practical steps you can act on this week, not a theory deck you'll never open again." },
        { id: uid("c", 2), kind: "highlights", title: "Areas of work", items: ["Business strategy", "Sales & marketing systems", "Process & operations", "Financial planning", "Team structure & hiring"] },
        { id: uid("c", 3), kind: "image", title: "How we work together", images: [{ url: "/art/office-desk.svg", caption: "Diagnose, plan, then execute together" }] },
        { id: uid("c", 4), kind: "appointment", title: "Free discovery call", url: "", note: "A 20-minute call to see whether we're a good fit" },
      ] },
      { id: "p2", slug: "services", label: "Services", blocks: [
        { id: uid("c", 5), kind: "product", title: "Engagements", items: [
          {
            name: "Strategy Sprint",
            images: ["/art/office-idea.svg", "/art/office-workshop.svg"],
            mrp: "", price: "₹45,000", badge: "Start here",
            desc: "A focused two-week diagnostic ending in a written, prioritised action plan.",
            features: ["Business & financial review", "Team and customer interviews", "Written action plan", "90-minute walkthrough session"],
            specs: [{ label: "Duration", value: "2 weeks" }, { label: "Deliverable", value: "Written action plan" }, { label: "Best for", value: "Stuck or scaling businesses" }],
            ctaLabel: "Enquire",
          },
          {
            name: "Monthly Retainer",
            images: ["/art/office-deal.svg", "/art/office-strategy.svg"],
            mrp: "", price: "₹30,000/mo", badge: "Ongoing",
            desc: "Ongoing advisory with fortnightly reviews and hands-on support between calls.",
            features: ["Fortnightly review calls", "WhatsApp/email access", "Quarterly planning session", "Cancel any time"],
            specs: [{ label: "Commitment", value: "Month to month" }, { label: "Calls", value: "2 per month" }, { label: "Best for", value: "Growing teams" }],
            ctaLabel: "Enquire",
          },
        ] },
        { id: uid("c", 6), kind: "services", title: "Also available", items: [
          { name: "Workshop / training", desc: "Half-day sessions for your team, on-site or online" },
          { name: "Second-opinion review", desc: "A one-off review of a plan or decision you're weighing" },
        ] },
        { id: uid("c", 7), kind: "testimonials", title: "Client results", items: [
          { name: "Founder, retail business", text: "Practical, no-nonsense advice we could act on immediately. Revenue up within a quarter.", rating: 5 },
          { name: "Director, services firm", text: "Fixed our sales process in six weeks. Wish we'd called sooner.", rating: 5 },
        ] },
      ] },
      { id: "p3", slug: "contact", label: "Contact", blocks: [
        {
          id: uid("c", 11), kind: "gallery", title: "Workshops & sessions",
          images: [
            { url: "/art/office-strategy.svg", label: "Full-day strategy workshops", color: CONS },
            { url: "/art/office-team.svg", label: "Working with leadership teams", color: CONS },
            { url: "/art/office-strategy.svg", label: "Monthly growth reviews", color: CONS },
          ],
        },
        { id: uid("c", 8), kind: "faq", title: "Working together", items: [
          { q: "How do we start?", a: "A free 20-minute discovery call — we decide together whether it's worth going further." },
          { q: "What does it cost?", a: "It depends on scope. I quote clearly after the discovery call, with no obligation." },
          { q: "Which industries do you work with?", a: "Mostly small and mid-sized businesses in retail, services and manufacturing." },
          { q: "Do you work remotely?", a: "Yes — most engagements run remotely, with on-site visits where they add value." },
        ] },
        { id: uid("c", 9), kind: "hours", title: "Availability", rows: [{ day: "Mon – Fri", time: "10:00 – 18:00" }, { day: "Saturday", time: "Calls by appointment" }] },
        { id: uid("c", 10), kind: "contact", title: "Tell me about your business" },
      ] },
    ],
  },
};

/* ================================================================== */
/* 8. Shubhora V-Card reseller — the card that sells the card           */
/* ================================================================== */
// The product being sold here IS this card, so the card has to be the demonstration: everything a buyer would
// want on their own card is already on this one, working. Somebody scrolls it once on a phone and knows both
// what they are buying and what it will look like with their name on it.
//
// Final layout (owner's call, 26 Sep 2026): Home → Why Shubhora → Features → Templates → Plans → Business → Contact.
// Only real material: Shubhora's own videos (YouTube product and partner-plan explainers, the Facebook tutorial),
// real screenshots of live template previews, and infographics made from published figures (sources in captions).
// No sample videos, no mocked phone screens.
//
// Rules this template does not break, because the people using it sell to strangers:
//   1. The plan's own figures, said plainly and with confidence (every pair ₹500, up to 10 pairs a day in each binary)
//      — never a promise of what a particular person will earn, and no nervous "nobody can promise" lines (owner, 27 Sep).
//   1b. The V-Card is free for 1 year (worth ₹1,499); a personal domain goes with the website and the customer buys it.
//   2. Nothing is claimed that Shubhora does not do today, and every Growth-only feature says so.
const VC = "#2f5bf5"; // Shubhora blue (the logo)
const SH_VIDEO = "https://youtu.be/kQuN3OVBNl0";      // "Free Digital Visiting Card + Website + AI Assistant | Shubhora (Hindi)"
const SH_PLAN_VIDEO = "https://youtu.be/RwVVwCRWxCQ"; // "Shubhora Partner Plan Explained | Free Registration, Double Binary, Weekly Payout (Hindi)"
const vcardReseller: CardTemplateDef = {
  key: "vcard-reseller",
  name: "Digital V-Card Seller",
  keepContent: true,
  category: "Digital products / Direct selling",
  description: "The card that sells the card: Shubhora's own videos, why Shubhora, every feature with real screens, 78 profession templates, plans and prices, and the partner plan with its rules — plus a trained AI advisor. Every section is editable.",
  emoji: "📇",
  data: {
    name: "Your Name",
    jobTitle: "Shubhora Partner",
    company: "Shubhora Digital V-Card",
    tagline: "Your whole business on one link — card, website and an AI assistant that never sleeps.",
    about: "I help shop owners, doctors, agents and freelancers move from a paper visiting card to a digital V-Card: one link that carries your products, photos, prices and contact details, and an AI assistant that answers customers for you.",
    avatarColor: VC,
    themeColor: VC,
    template: "glass",
    verified: false,
    avatarUrl: "/art/brand/shubhora-logo.png",
    avatarShape: "square",
    coverUrl: "/art/brand/shubhora-banner.png",
    // The tone comes from Shubhora's own persona (bridge/shubhora-kb.mjs) — a partner can write their own here.
    botPersona: "",
    // Shubhora's own facts are NOT copied into the card any more (owner's call, 24 Sep 2026): the assistant reads
    // them live from bridge/shubhora-kb.mjs (or Super Admin → Shubhora AI), so every partner's card and WhatsApp
    // answer with today's prices and features. `kb` marks the card; botKnowledge is only the partner's own notes.
    kb: "shubhora",
    botKnowledge: "",
    popup: {
      enabled: true,
      title: "Make free card",
      subtitle: "Leave your number and I will set up a free card with your name on it.",
      ctaLabel: "Make my free card",
      terms: "*Free for 1 year. No card details needed.",
    },
    links: [
      { id: "l1", type: "phone", label: "Call", value: "+91" },
      { id: "l2", type: "whatsapp", label: "WhatsApp", value: "+91" },
      { id: "l3", type: "email", label: "Email", value: "you@example.com" },
      { id: "l4", type: "website", label: "Website", value: "https://shubhora.com" },
      { id: "l6", type: "youtube", label: "Watch the video", value: SH_VIDEO },
      { id: "l5", type: "location", label: "Service area", value: "" },
    ],
    pages: [
      /* ---------------- Home: what it is, in the first 30 seconds ---------------- */
      {
        id: "p1", slug: "home", label: "Home",
        blocks: [
          { id: uid("vh", 1), kind: "video", title: "Shubhora in 3½ minutes", url: SH_VIDEO, caption: "Watch this first (in Hindi): the free digital V-Card, the website, the AI assistant, daily posters and the plans — everything on one link." },
          { id: uid("vh", 2), kind: "highlights", title: "One link. Your whole business.", items: [
            "📇 Digital V-Card — free for 1 year",
            "📥 Every enquiry saved as a lead",
            "🌐 Website on the same link (Growth)",
            "🤖 AI assistant, 24×7 (Growth)",
            "🖼️ A new poster every morning (Growth)",
            "🗣️ Card in 10 languages (Growth)",
          ] },
          { id: uid("vh", 3), kind: "image", title: "Five tools, one link", images: [
            { url: "/api/stock/demo/shubhora-one-link-v2.jpg", caption: "Your website, card, daily poster and leads are free for your first year. Growth adds Google, the AI banner and edits, auto-posting, the WhatsApp AI and your own domain." },
          ] },
          { id: uid("vh", 4), kind: "cta", title: "This page IS the product", body: "Everything you are scrolling now is what your own card will look like — with your name, your products and your number. Most people have theirs live in about 10 minutes.", joinUrl: "#plans", joinLabel: "See plans and prices", referralCode: "" },
          { id: uid("vh", 5), kind: "services", title: "What you get", items: [
            { name: "Your own link and QR", desc: "shubhora.com/c/your-name — opens on any phone. Nothing for your customer to download or install." },
            { name: "Save contact, Call, WhatsApp, UPI, Map", desc: "Every button a customer needs, one tap each — and your number goes straight into their phone." },
            { name: "Products with real prices", desc: "Photos, MRP and offer price, features and an Order on WhatsApp button. Change a price once and it changes everywhere." },
            { name: "Leads that don't get lost", desc: "Every call tap, WhatsApp tap and form is saved with the customer's name and what they asked about — on every plan." },
            { name: "A website on the same link (Growth)", desc: "On a computer the same link opens as a full website. No designer, no yearly hosting bill." },
            { name: "AI assistant, 24×7 (Growth)", desc: "Trained on your business. Replies on your card and on your own WhatsApp in the customer's language — and never invents a price." },
            { name: "A poster every morning (Growth)", desc: "A festival, greeting or offer poster with your name, logo and number, plus a short status video — posted for you." },
            { name: "AI Studio (Growth)", desc: "Product photoshoots, 10–60 second video ads, reels and explainer videos from your own text — with credits, only when you need them." },
          ] },
          { id: uid("vh", 6), kind: "testimonials", title: "What card owners say", items: [] },
          { id: uid("vh", 7), kind: "offer", title: "Start free", text: "Your digital V-Card is worth ₹1,499 — and free for you for 1 year. No card details, no hidden charge. Add Growth whenever you want the website, the AI assistant and daily posters.", code: "", expires: "" },
          { id: uid("vh", 8), kind: "contact", title: "Ask me anything", note: "Tell me what work you do — I will make a demo card with your name and send you the link." },
        ],
      },
      /* ---------------- Why Shubhora: the trend, the comparison, the difference ---------------- */
      {
        id: "p8", slug: "why", label: "Why Shubhora",
        blocks: [
          { id: uid("vy", 1), kind: "about", title: "India has gone digital. Has your business?", body: "Your customers already do everything on the phone — they pay by UPI, they look for shops on Google, they ask on WhatsApp. A paper visiting card does none of that.\n\nShubhora puts your business where your customers already are: one link with your card, your products, your prices and a way to reach you at any hour." },
          { id: uid("vy", 2), kind: "image", title: "India, in numbers", images: [
            { url: "/api/stock/demo/shubhora-india-digital.jpg", caption: "Sources: TRAI — internet subscribers, 31 March 2026 · NPCI — UPI, August 2026 · Ministry of MSME (PIB) — Udyam registrations, February 2026." },
          ] },
          { id: uid("vy", 3), kind: "highlights", title: "What that means for a business", items: [
            "📱 Customers search on the phone first",
            "💬 They expect a reply on WhatsApp",
            "🌙 Enquiries come at night too",
            "🔎 A business that isn't online gets skipped",
            "🗂️ Leads written on paper get lost",
            "🌐 A website no longer needs a designer",
          ] },
          { id: uid("vy", 4), kind: "compare", title: "Paper visiting card vs Shubhora V-Card", leftLabel: "Shubhora V-Card", rightLabel: "Paper card", rows: [
            { feature: "Change your number or price", left: "Any time, in seconds", right: "Reprint everything" },
            { feature: "Show products and photos", left: "Unlimited, with prices", right: "Does not fit" },
            { feature: "Share it", left: "One tap on WhatsApp", right: "Only in person" },
            { feature: "A customer asks at 11 pm", left: "The AI assistant replies (Growth)", right: "Nobody replies" },
            { feature: "Keep the enquiry", left: "Saved as a lead", right: "Lost" },
            { feature: "Found on Google", left: "Yes — your own public page", right: "No" },
            { feature: "Cost when something changes", left: "Nothing to print", right: "A new print run" },
          ] },
          { id: uid("vy", 5), kind: "compare", title: "Separate tools vs one Shubhora link", leftLabel: "One Shubhora link", rightLabel: "Separate tools", rows: [
            { feature: "Visiting card", left: "Digital, always up to date", right: "Printed again and again" },
            { feature: "Website", left: "Same link, no hosting bill (Growth)", right: "Designer + yearly hosting" },
            { feature: "Daily posters", left: "Made every morning (Growth)", right: "Designed by hand — or skipped" },
            { feature: "WhatsApp at night", left: "AI replies 24×7 (Growth)", right: "The customer waits till morning" },
            { feature: "Enquiries", left: "All in one list", right: "Scattered across chats and diaries" },
            { feature: "Logins and bills", left: "One account", right: "A different app for each" },
            { feature: "Time to set up", left: "About 10 minutes, on a phone", right: "Days or weeks" },
          ] },
          { id: uid("vy", 6), kind: "services", title: "What makes Shubhora different", items: [
            { name: "Made for Indian businesses", desc: "Ready templates for 78 professions, prices in ₹, UPI and WhatsApp built in." },
            { name: "Your customer's language (Growth)", desc: "Visitors read your card in 10 languages, and the AI assistant replies in their language too." },
            { name: "An AI that knows your business (Growth)", desc: "It answers from your own details — products, prices, timings — and passes every serious enquiry to you." },
            { name: "Free for a full year, not a trial", desc: "The V-Card, worth ₹1,499, is free for you for 1 year. No card details needed." },
            { name: "Your website, live from day one", desc: "With Growth your full website opens on your Shubhora link. Want a personal domain like yourbusiness.com? Buy it and connect it." },
            { name: "Everything from your phone", desc: "Set it up, change prices, see leads and share — no computer, no designer, no technical skill." },
            { name: "A real company behind it", desc: "Shubhora is a brand of Wellwa Life India Pvt Ltd, Gurgaon — with published policies and a grievance officer." },
          ] },
          { id: uid("vy", 7), kind: "cta", title: "See it on your own business", body: "Pick your trade and preview a live card before you decide — free.", joinUrl: "#templates", joinLabel: "See the templates", referralCode: "" },
        ],
      },
      /* ---------------- Features: everything it does, with real screens ---------------- */
      {
        // What is inside — feature by feature, in the buyer's words (owner's call, 23 Sep 2026).
        id: "p7", slug: "features", label: "Features",
        blocks: [
          { id: uid("vf", 1), kind: "video", title: "Discover Shubhora — full walkthrough", url: "https://youtu.be/JO2l3FCm8jY", caption: "A walkthrough of the whole Shubhora suite: the card, the website, the AI assistant, the posters and the leads." },
          { id: uid("vf", 2), kind: "services", title: "Everything your card does", items: [
            { name: "📇 Digital V-Card", desc: "Your name, photo, business, products and buttons on one link — Save contact, Call, WhatsApp, Directions, UPI. Opens instantly, no app to install." },
            { name: "🛍️ Products with prices", desc: "Photos, MRP and offer price, features and specifications — with an Order on WhatsApp button. Change a price once, it changes everywhere." },
            { name: "📥 Leads", desc: "Every call tap, WhatsApp tap and form fill is saved with the customer's name and number — free on every plan. Follow-up reminders and export with Growth." },
            { name: "🗣️ 10 languages (Growth)", desc: "Visitors switch your card to Hindi, Marathi, Gujarati, Tamil, Telugu, Bengali, Kannada, Malayalam or Punjabi with one tap." },
            { name: "🔗 Your own link + QR code", desc: "shubhora.com/c/your-name, with a QR code for the counter and anything you print. Want a personal domain for your website? Buy it and connect it." },
            { name: "🌐 Website on the same link (Growth)", desc: "On a computer the link opens as a full website — home, products, gallery, FAQ, contact — built from the same details." },
            { name: "🤖 AI assistant, 24×7 (Growth)", desc: "Answers customers on the card and on your own WhatsApp number, in their language — prices, timings, directions, bookings. You get the lead." },
            { name: "🖼️ Daily poster + status video (Growth)", desc: "Every morning a festival, greeting or offer poster with your name and number, and a short status video — posted to WhatsApp Status, Facebook and Instagram." },
            { name: "🎬 AI Studio (Growth)", desc: "Product photoshoots, 10–60 second video ads, reels and long explainer videos from your own text — with credits, whenever you need them." },
            { name: "⭐ Reviews and trust", desc: "Ask customers for a review with one link; the best ones show on your card, with your GST number, hours and map." },
          ] },
          // Real screenshots of live template previews (the carousel opens on the second image).
          { id: uid("vf", 3), kind: "carousel", title: "Real screens", images: [
            { url: "/api/stock/demo/shubhora-screens-languages.jpg", caption: "The language button: with Growth, visitors read your card in 10 languages." },
            { url: "/api/stock/demo/shubhora-screens-trades.jpg", caption: "Real cards from Shubhora templates: a restaurant and a doctor." },
          ] },
          { id: uid("vf", 4), kind: "faq", title: "Good to know", items: [
            { q: "Do my customers need an app?", a: "No. The link opens in any browser — WhatsApp, Chrome, Safari — on any phone." },
            { q: "Can I change things myself?", a: "Yes, from your phone: words, photos, prices, pages and the look. Changes go live the moment you publish." },
            { q: "What happens if I stop paying for Growth?", a: "Your card keeps working. Only the Growth parts pause — website, AI assistant, daily posters — and they come back when you renew." },
            { q: "Is my data safe?", a: "Your card is public by design; your leads, customers and messages are private to you and never sold or shared." },
            { q: "Can I use it for two businesses?", a: "One account is one card and one business profile. For several brands or branches, Shubhora builds a custom setup — price on request, with a dedicated manager." },
            { q: "Is there an app for me?", a: "Yes, without the Play Store: open shubhora.com and tap Install app (on iPhone: Safari → Share → Add to Home Screen)." },
          ] },
          { id: uid("vf", 5), kind: "contact", title: "Want to see it on your business?", note: "Send me your name and what you do — I will set up a demo card for you today." },
        ],
      },
      /* ---------------- Templates: what THEIR card can look like ---------------- */
      {
        // Templates (owner's call, 23 Sep 2026): the seller shows the buyer what THEIR card can look like — real
        // profession banners (the same ones the AI uses as covers), the 12 looks, and a door to the live gallery.
        id: "p6", slug: "templates", label: "Templates",
        blocks: [
          { id: uid("t", 1), kind: "about", title: "A ready design for your line of work", body: "Pick the template made for your trade — we fill in your name, photos, products and prices, and the card is ready in minutes. Every template has its own banner, pages and sections written for that business; change any of it later. Tap a tile: the six most-used trades open a full live preview; every other tile makes your own card in that design, free — your introducer is already set." },
          { id: uid("t", 2), kind: "showcase", title: "Templates by profession", items: [
            { imageUrl: "/api/stock/banners/doctor.jpg", label: "Doctor / Clinic", sub: "Specialities, timings, booking, fees", url: "https://shubhora.com/templates/doctor-clinic" },
            { imageUrl: "/api/stock/banners/realestate.jpg", label: "Real estate", sub: "Listings, site-visit booking, loan help", url: "https://shubhora.com/templates/real-estate" },
            { imageUrl: "/api/stock/banners/restaurant.jpg", label: "Restaurant / Café", sub: "Menu with prices, table booking, delivery", url: "https://shubhora.com/templates/restaurant-cafe" },
            { imageUrl: "/api/stock/banners/gym.jpg", label: "Gym / Fitness", sub: "Plans, transformations, free trial", url: "https://shubhora.com/templates/fitness-trainer" },
            { imageUrl: "/api/stock/banners/salon.jpg", label: "Salon / Spa", sub: "Service menu, bridal packages, offers", url: "https://shubhora.com/templates/salon-spa" },
            { imageUrl: "/api/stock/banners/coaching.jpg", label: "Coaching / Consultant", sub: "Credentials, results, discovery call", url: "https://shubhora.com/templates/consultant-coach" },
            { imageUrl: "/api/stock/banners/kirana.jpg", label: "Kirana / General store", sub: "Products, home delivery, UPI · tap to make yours, free", url: "https://shubhora.com/signup" },
            { imageUrl: "/api/stock/banners/jewellery.jpg", label: "Jewellery", sub: "Collections, gold rate, gallery · tap to make yours, free", url: "https://shubhora.com/signup" },
            { imageUrl: "/api/stock/banners/garments.jpg", label: "Garments / Boutique", sub: "New arrivals, sizes, order on WhatsApp · tap to make yours, free", url: "https://shubhora.com/signup" },
            { imageUrl: "/api/stock/banners/mobile.jpg", label: "Mobile / Electronics", sub: "Brands, EMI, repair, offers · tap to make yours, free", url: "https://shubhora.com/signup" },
            { imageUrl: "/api/stock/banners/sweets.jpg", label: "Sweets / Bakery", sub: "Menu, festival boxes, bulk orders · tap to make yours, free", url: "https://shubhora.com/signup" },
            { imageUrl: "/api/stock/banners/lawyer.jpg", label: "Lawyer / CA", sub: "Practice areas, consultation, documents · tap to make yours, free", url: "https://shubhora.com/signup" },
            { imageUrl: "/api/stock/banners/insurance.jpg", label: "Insurance / Finance agent", sub: "Plans, claim help, call-back form · tap to make yours, free", url: "https://shubhora.com/signup" },
            { imageUrl: "/api/stock/banners/photography.jpg", label: "Photography / Events", sub: "Portfolio, packages, dates · tap to make yours, free", url: "https://shubhora.com/signup" },
            { imageUrl: "/api/stock/banners/electrician.jpg", label: "Electrician / Plumber", sub: "Services, areas served, emergency call · tap to make yours, free", url: "https://shubhora.com/signup" },
            { imageUrl: "/api/stock/banners/school.jpg", label: "School / Tuition", sub: "Courses, batches, admissions · tap to make yours, free", url: "https://shubhora.com/signup" },
            { imageUrl: "/api/stock/banners/travel.jpg", label: "Travel / Tours", sub: "Packages, itineraries, enquiry · tap to make yours, free", url: "https://shubhora.com/signup" },
            { imageUrl: "/api/stock/banners/mlm.jpg", label: "Direct selling", sub: "Products, plan, join link · tap to make yours, free", url: "https://shubhora.com/signup" },
          ] },
          { id: uid("t", 3), kind: "highlights", title: "78 professions · 12 looks", items: [
            "🎨 Every template comes in 12 looks — Classic, Gradient, Minimal, Dark, Photo, Bold, Royal, Glass, Corporate, Earthy, Neon, Editorial",
            "🖼️ Real banner for your trade, or upload your own",
            "📄 Pages made for the business: products, services, gallery, FAQ, booking, hours, map",
            "🌐 The same design opens as a full website on computers (Growth)",
            "✏️ Change words, photos, colours and pages any time — no designer needed",
            "🔁 Switch template or look later; your link never changes",
          ] },
          { id: uid("t", 4), kind: "services", title: "How a template becomes your card", items: [
            { name: "1. Tell us what you do", desc: "Choose your trade from 78 — the right template, banner and sections are picked for you." },
            { name: "2. We fill it with AI", desc: "Your name, photos, products and prices go in; the about, services and FAQ are written for your business." },
            { name: "3. Pick a look and publish", desc: "See your card in 12 looks, pick one, and share the link on WhatsApp the same day." },
          ] },
          // The step-by-step tutorial (Shubhora's Facebook page, 26 Sep 2026): right after the three steps, so a buyer
          // who has just read them can watch them done on a real phone.
          { id: uid("t", 7), kind: "video", title: "Make your card yourself — step by step", url: "https://www.facebook.com/reel/1078388548446035/", caption: "5-minute video (in Hindi): account, business details, products with MRP and offer price, the AI card, editing and sharing — just with your phone." },
          { id: uid("t", 5), kind: "cta", title: "See the templates live", body: "Open the gallery, tap any template and preview the full card — pages, products, booking — exactly as your customers would see it.", joinUrl: "https://shubhora.com/templates", joinLabel: "Open the template gallery", referralCode: "" },
          { id: uid("t", 6), kind: "contact", title: "Which template is right for you?", note: "Send me your business name and city — I will make a demo card in your template and send you the link." },
        ],
      },
      /* ---------------- Plans: prices, what each includes, the questions ---------------- */
      {
        id: "p2", slug: "plans", label: "Plans",
        blocks: [
          {
            id: uid("vp", 1), kind: "product", title: "Plans and prices",
            items: [
              {
                name: "Free — for 1 year",
                images: ["/api/stock/demo/shubhora-plan-free-v3.jpg"],
                price: "FREE",
                badge: "Worth ₹1,499",
                desc: "A complete digital V-Card worth ₹1,499, free for you for 1 year — on your own link. No card details, no hidden charge.",
                features: [
                  "Digital card with all pages, products and gallery",
                  "“Order on WhatsApp” button on every product",
                  "Leads from your card saved in the CRM",
                  "Share on WhatsApp, QR code, save-contact",
                ],
                specs: [
                  { label: "Price", value: "FREE for 1 year (worth ₹1,499)" },
                  { label: "Business profiles", value: "1" },
                  { label: "Website, AI assistant, daily posters", value: "With Growth" },
                ],
                ctaLabel: "Make my free card",
              },
              {
                name: "Growth",
                images: ["/api/stock/demo/shubhora-plan-growth-v2.jpg"],
                price: "₹2,999 / month",
                badge: "Recommended",
                desc: "Everything needed to run one business online — the website, the AI assistant, the daily poster and auto-posting.",
                features: [
                  "Everything in Free",
                  "Full website on the same link",
                  "AI assistant on your card and your WhatsApp (fair use up to 1,000 replies a month)",
                  "Daily poster + status video, made every morning",
                  "Auto-posting to Facebook, Instagram and WhatsApp Status",
                  "Follow-up reminders and lead export",
                  "All AI tools: photoshoot, ads, reels, brand kit",
                  "8 free ad storyboards a month",
                ],
                specs: [
                  { label: "Price", value: "₹2,999 a month, GST included" },
                  { label: "Business profiles", value: "1" },
                  { label: "Billing", value: "Monthly — cancel any time" },
                ],
                ctaLabel: "Start Growth",
              },
              {
                name: "Custom Solutions",
                images: ["/api/stock/demo/shubhora-plan-custom-v2.jpg"],
                price: "On request",
                badge: "Any software",
                desc: "Need more than Growth? Shubhora builds any software, customization and automation for your business — with a dedicated manager.",
                features: [
                  "Dedicated account manager",
                  "Custom software, apps and websites — built for you",
                  "Shubhora customized to the way your business works",
                  "Automation of daily work — WhatsApp, leads, follow-ups, billing, reports",
                  "Custom CRM / ERP, dashboards and team logins",
                  "AI assistants and chatbots trained on your business",
                  "Integrations — payment gateway, Tally, Google Sheets, your tools",
                ],
                specs: [
                  { label: "Price", value: "On request — as per your need" },
                  { label: "Account manager", value: "Dedicated" },
                  { label: "What we build", value: "Any software, customization, automation" },
                ],
                ctaLabel: "Tell me what you need",
              },
            ],
          },
          { id: uid("vp", 2), kind: "compare", title: "Free vs Growth", leftLabel: "Growth ₹2,999", rightLabel: "Free", rows: [
            { feature: "Digital V-Card + leads", left: "Yes", right: "Yes", leftOk: true, rightOk: true },
            { feature: "Personal domain (you buy it)", left: "Yes", right: "Yes", leftOk: true, rightOk: true },
            { feature: "Card in 10 languages", left: "Yes", right: "—", leftOk: true, rightOk: false },
            { feature: "Full website on computers", left: "Yes", right: "Card only", leftOk: true, rightOk: false },
            { feature: "AI assistant on card + WhatsApp", left: "Up to 1,000 replies a month", right: "—", leftOk: true, rightOk: false },
            { feature: "Daily poster + status video", left: "Every morning, auto-posted", right: "—", leftOk: true, rightOk: false },
            { feature: "Follow-up reminders & export", left: "Yes", right: "—", leftOk: true, rightOk: false },
          ] },
          { id: uid("vp", 3), kind: "faq", title: "About the plans", items: [
            { q: "Is the V-Card really free?", a: "Yes — free for you for 1 year: the card with all its pages, products and gallery, and the leads it brings in. No card details, no hidden charge. Add Growth when you want the website, the WhatsApp AI assistant, the daily poster and auto-posting." },
            { q: "Is GST extra?", a: "No. ₹2,999 already includes GST. Custom software and automation is quoted as per your need." },
            { q: "What are AI credits for?", a: "Only for AI photos and videos: an AI product photo is 5 credits, a video ad 20 to 120 credits depending on its length, a long video about 10 credits a minute. Credits come in packs — from 50 credits for ₹500. The card, the website, the posters, the CRM and the WhatsApp assistant never use credits." },
            { q: "How do I pay?", a: "Online in the app — UPI, cards or net banking through a licensed payment gateway. The plan starts within minutes and you get an invoice." },
            { q: "Can I stop any time?", a: "Yes. Growth is monthly: cancel from Settings and it runs to the end of the paid month. Your card keeps working on the free plan afterwards." },
            { q: "Refunds?", a: "A double charge, or a charge after you cancelled, is refunded in full. A month already used and credits already spent are not refunded. The full policy is on shubhora.com/refund." },
            { q: "I need something more — my own software or automation?", a: "Yes. Shubhora builds all kinds of software — apps, CRM, automation, AI assistants, integrations — customized for your business, with a dedicated manager. Tell me what you need and I will get you a quote." },
          ] },
          { id: uid("vp", 4), kind: "contact", title: "Not sure which plan?", note: "Tell me your business and how many enquiries you get in a week — I will tell you honestly which plan fits." },
        ],
      },
      /* ---------------- Business: why partners choose it, how the plan pays, the rules ---------------- */
      {
        id: "p3", slug: "business", label: "Business",
        blocks: [
          { id: uid("vb", 1), kind: "video", title: "The partner plan, explained", url: SH_PLAN_VIDEO, caption: "In Hindi: free registration, Red and Green ID, the double binary, the daily cap, ranks and weekly payout — the whole plan, with its rules." },
          { id: uid("vb", 2), kind: "about", title: "Why this business", body: "Every business around you — the shop you buy from, the clinic you visit, the agent you know — needs to be found and reached on the phone, and most still hand out paper cards. Shubhora partners show them this card and set theirs up on the spot.\n\nThere is no stock to buy, nothing to deliver and nothing to store: the product is a link. Registration is free. Income comes from real paid subscriptions and their renewals — every pair pays ₹500, and every renewal pays again. That is what makes it a lasting business." },
          { id: uid("vb", 3), kind: "services", title: "Why partners choose Shubhora", items: [
            { name: "Every business needs it", desc: "India has 7.8 crore registered small businesses (Udyam, February 2026). Every one of them needs customers to find it and reach it." },
            { name: "Easy to deliver", desc: "The product is a link. A customer's card is set up on their own phone in about 10 minutes — no stock, no courier, no installation." },
            { name: "Easy to show", desc: "Your own card is the demo. Hand over your phone, let them tap around, and make theirs free on the spot." },
            { name: "Free to start", desc: "Registration is free — nobody has to buy anything to join. Your ID turns Green when your own Growth plan is active." },
            { name: "Renewals count again", desc: "When a customer renews Growth, that month's BV enters your renewal binary again — one sale keeps counting for as long as the customer stays subscribed and your own plan is active." },
            { name: "Paid every week", desc: "Pairs are matched every night. After Sunday's closing, a wallet of ₹500 or more goes to your KYC-approved bank account on Wednesday." },
            { name: "Everything on your phone", desc: "Your team, wallet, income reports, KYC and withdrawals are in the app's Business section." },
            { name: "Everything in writing", desc: "The plan, the partner agreement and the disclosures are published — read them before you decide." },
          ] },
          { id: uid("vb", 4), kind: "image", title: "How the plan pays", images: [
            { url: "/api/stock/demo/shubhora-plan-how-it-pays-v2.jpg", caption: "Every paid subscription is 2,500 BV. 2,500 BV on your left + 2,500 BV on your right = one pair = ₹500. Up to 10 pairs a day in each binary — paid every week." },
          ] },
          { id: uid("vb", 5), kind: "highlights", title: "The plan at a glance", items: [
            "🆓 Registration free — Red ID",
            "🟢 Own Growth plan active — Green ID",
            "🎁 Green ID: 25 AI credits per direct sale",
            "⚖️ 1 pair = ₹500 (2,500 + 2,500 BV)",
            "🔁 Two binaries: new sales and renewals",
            "📏 Up to 10 pairs a day in each binary",
            "➡️ Unmatched BV carries forward",
            "🏆 10 ranks on lifetime pairs",
            "🏦 Weekly payout, Wednesday transfer",
            "🧾 TDS as per law, no admin charge",
          ] },
          { id: uid("vb", 6), kind: "pdf", title: "The Shubhora presentation (PDF)", fileLabel: "Shubhora-Presentation-Sep-2026.pdf", fileUrl: "/api/stock/demo/shubhora-presentation-2026-09.pdf", posterUrl: "/api/stock/demo/shubhora-presentation-cover.jpg", hint: "20 pages · the product, plans and prices, and the complete partner plan — BV, pairs, capping, ranks and payout rules · tap to download" },
          { id: uid("vb", 7), kind: "faq", title: "Questions people ask", items: [
            { q: "How much will I earn?", a: "Every pair pays ₹500. There are two binaries — new sales and renewals — each up to 10 pairs a day (₹5,000): up to ₹10,000 a day and ₹3,00,000 a month, paid every week to your bank. The more real businesses your team brings and keeps, the more you earn." },
            { q: "Is registration really free?", a: "Yes. Nobody has to buy anything to join. Turn your own Growth plan on (Green ID) and every pair is paid." },
            { q: "Do I have to buy stock?", a: "No. The product is software — there is nothing to buy in advance, nothing to deliver and nothing left over." },
            { q: "What exactly am I selling?", a: "The card you are looking at: the free digital V-Card, and the Growth plan (₹2,999 a month) with the website, the AI assistant and the daily posters." },
            { q: "When and how am I paid?", a: "Matching runs every night. After Sunday's midnight closing, a wallet of ₹500 or more is paid out automatically and reaches your approved bank account on Wednesday. PAN and bank details (KYC) must be approved first." },
            { q: "Is tax deducted?", a: "Yes, TDS as per the Income Tax Act — 2% with PAN (20% without) once your yearly income crosses ₹20,000. There is no admin charge." },
            { q: "What if a customer takes a refund?", a: "If a payment is refunded, the commission paid on it is reversed." },
            { q: "Do I need to be technical?", a: "No. Everything happens on a phone, and the videos on this card show every step." },
          ] },
          { id: uid("vb", 8), kind: "cta", title: "Read the rules first", body: "The partner disclosures — company details, key terms, refunds, tax and the grievance officer — published under the Consumer Protection (Direct Selling) Rules, 2021.", joinUrl: "https://shubhora.com/partners/legal/disclosures", joinLabel: "Read the partner disclosures", referralCode: "" },
          { id: uid("vb", 9), kind: "cta", title: "Ready to start?", body: "Registration is free and takes a few minutes: your own card and your partner ID, from your phone.", joinUrl: "https://shubhora.com/signup", joinLabel: "Register free", referralCode: "" },
          { id: uid("vb", 10), kind: "contact", title: "Talk to me about the business", note: "Tell me a little about yourself — I will send you the presentation and set up a call." },
        ],
      },
      /* ---------------- Contact: the partner's own page ---------------- */
      {
        id: "p5", slug: "contact", label: "Contact",
        blocks: [
          { id: uid("vc", 1), kind: "about", title: "About me", body: "I am a Shubhora partner. I help shops, clinics, agents and professionals near me move from a paper visiting card to a digital V-Card — and I set it up with you, on your phone, free." },
          { id: uid("vc", 2), kind: "hours", title: "When you can reach me", rows: [
            { day: "Monday – Saturday", time: "10:00 – 19:00" },
            { day: "Sunday", time: "On WhatsApp" },
          ] },
          // Empty until the owner's city goes in (set-up fills it); an empty address shows nothing.
          { id: uid("vc", 3), kind: "location", title: "Where I am", address: "" },
          { id: uid("vc", 4), kind: "contact", title: "Send me a message", note: "I usually reply within a few hours — WhatsApp is fastest." },
        ],
      },
    ],
  },
};

/* ================================================================== */
/* 9. Blank                                                            */
/* ================================================================== */
const blank: CardTemplateDef = {
  key: "blank",
  name: "Start from scratch",
  category: "Blank",
  description: "An empty card — build every section yourself.",
  emoji: "✨",
  data: {
    name: "Your Name", jobTitle: "Your Title", company: "Your Company",
    tagline: "One line about you", about: "",
    avatarColor: "#0e9e90", themeColor: "#0e9e90", template: "gradient", verified: false,
    links: [{ id: "l1", type: "whatsapp", label: "WhatsApp", value: "+91" }],
    pages: [{ id: "p1", slug: "home", label: "Home", blocks: [{ id: "b1", kind: "about", title: "About", body: "" }] }],
  },
};

export const BUILT_IN_TEMPLATES: CardTemplateDef[] = [
  vcardReseller, wellwa, doctor, realEstate, restaurant, fitness, salon, consultant, blank,
];

/** Templates that stay available INSIDE the app but never appear on the public site: a company's own distributor
 *  design, and anything carrying the partner plan (the public site never talks about the partner plan). */
export const NOT_PUBLIC_TEMPLATES = new Set(["wellwa-distributor", "vcard-reseller"]);

export function getTemplate(key: string): CardTemplateDef | undefined {
  return BUILT_IN_TEMPLATES.find((t) => t.key === key);
}
