import type { Card, Lead } from "./types";

// ===== Demo data =====
// Phase 1 runs without a database so the UI is fully clickable.
// In Phase 2+ these read/writes move to Supabase (see lib/supabase).

export const sampleCards: Card[] = [
  {
    id: "8796",
    username: "neural",
    name: "J. S. Rao",
    jobTitle: "Founder & CEO",
    company: "Wellwa Life",
    tagline: "Smart water. Connected care. Personal guidance.",
    about:
      "Helping families review source-water compatibility, compare the Wellwa Aura range and arrange a guided product consultation.",
    avatarColor: "#0e9e90",
    themeColor: "#0e9e90",
    template: "photo",
    verified: true,
    avatarUrl: "/wellwa/images/wellwa-logo.png",
    avatarShape: "square",
    coverUrl: "/wellwa/images/aura-plus-kitchen-hero.webp",
    botPersona: "Friendly, knowledgeable Wellwa water-ionizer advisor. Helpful, never pushy.",
    botKnowledge: [
      "WELLWA SMART WATER IONIZERS (app-connected, Wi-Fi, alkaline + hydrogen-rich water).",
      "",
      "1) Aura Plus — Smart 7-Plate Ionizer (Most popular). MRP ₹1,99,999, offer ₹1,25,000. 7 platinum-coated titanium plates, pH 3.5–10.5+, ORP up to -800 mV, H₂ up to 1,600 ppb, 7 water modes, Wi-Fi + app + cloud status. Flagship, family-ready.",
      "2) Aura Maxx — Smart 8-Plate Ionizer (Maximum performance). MRP ₹2,29,999, offer ₹1,50,000. 8 plates, pH 3.0–11.0+, ORP up to -850 mV, H₂ up to 1,800 ppb, remote diagnostics + OTA firmware. Best for larger households.",
      "3) Aura — Smart 5-Plate Ionizer (Essential). MRP ₹1,49,999, offer ₹90,000. 5 plates, pH 4.0–10.0+, ORP up to -750 mV, H₂ up to 1,500 ppb, compact countertop, Wi-Fi + app.",
      "4) Starter Pack — NMD Alkaline Drops (Start here). ₹11,800. Two 50 ml bottles, prepared pH ~8.5–10.5. A portable first step before an ionizer.",
      "",
      "All ionizers: product consultation + guided installation, credit card accepted (no Wellwa EMI scheme), 7 water modes (4 alkaline, purified, beauty, E-Clean), platinum-coated titanium plates. Also: Wellwa business/distributor opportunity and educational masterclasses.",
      "Order or book a free demo on WhatsApp: +91 74109 95599.",
    ].join("\n"),
    links: [
      { id: "l1", type: "phone", label: "Call", value: "+917410995599" },
      { id: "l2", type: "whatsapp", label: "WhatsApp", value: "+917410995599" },
      { id: "l3", type: "email", label: "Email", value: "wellwalife@gmail.com" },
      { id: "l4", type: "website", label: "Website", value: "https://wellwalife.com" },
      { id: "l5", type: "instagram", label: "Instagram", value: "https://instagram.com/wellwa.life" },
      { id: "l6", type: "upi", label: "Pay via UPI", value: "wellwa@upi" },
    ],
    pages: [
      {
        id: "p-home",
        slug: "home",
        label: "Home",
        blocks: [
          {
            id: "b0",
            kind: "video",
            title: "पहले यह ज़रूर देखिए",
            url: "/wellwa/video/wellwa-product-tour.mp4",
            posterUrl: "/wellwa/images/aura-plus-kitchen-hero.webp",
            caption: "Aura range, home consultation और distributor support का short visual tour",
          },
          {
            id: "b1",
            kind: "highlights",
            title: "Why Wellwa",
            items: ["5, 7 and 8-plate choices", "App-connected care", "Remote diagnostics", "Guided installation"],
          },
          {
            id: "b2",
            kind: "about",
            title: "About me",
            imageUrl: "/wellwa/images/home-demo-consultation.webp",
            body: "I start with your city, source water and household usage, then explain the right Aura options without pressure or medical promises.",
          },
          {
            id: "b2t",
            kind: "image",
            title: "Personal consultation",
            images: [{ url: "/wellwa/images/home-demo-consultation.webp", caption: "Source-water review and model guidance" }],
          },
          {
            id: "b2a",
            kind: "appointment",
            title: "Free demo",
            url: "https://wellwalife.com/book-demo",
            note: "Availability varies by city; share your source water and preferred time",
          },
        ],
      },
      {
        id: "p-products",
        slug: "products",
        label: "Products",
        blocks: [
          {
            id: "b3p",
            kind: "product",
            title: "Wellwa smart water ionizers",
            items: [
              {
                name: "Aura Plus — Smart 7-Plate Ionizer",
                imageUrl: "/wellwa/images/aura-plus-7.webp",
                images: ["/wellwa/images/aura-plus-7.webp"],
                mrp: "₹1,99,999",
                price: "₹1,25,000",
                badge: "Most popular",
                desc: "The flagship balance of performance, connected control and family-ready output.",
                features: [
                  "7 platinum-coated titanium plates",
                  "Wi-Fi + app control with live cloud status",
                  "7 water modes — 4 alkaline, purified, beauty, E-Clean",
                  "Free home demo + guided installation",
                ],
                specs: [
                  { label: "Plates", value: "7 platinum-coated titanium" },
                  { label: "pH range", value: "3.5 – 10.5+" },
                  { label: "ORP estimate", value: "Up to -800 mV" },
                  { label: "Hydrogen (H₂)", value: "Up to 1,600 ppb" },
                  { label: "Connectivity", value: "Wi-Fi, app & cloud status" },
                ],
                ctaLabel: "Order on WhatsApp",
              },
              {
                name: "Aura Maxx — Smart 8-Plate Ionizer",
                imageUrl: "/wellwa/images/aura-maxx.webp",
                images: ["/wellwa/images/aura-maxx.webp"],
                mrp: "₹2,29,999",
                price: "₹1,50,000",
                badge: "Maximum performance",
                desc: "Premium connected water control for demanding routines and larger households.",
                features: [
                  "8 platinum-coated titanium plates",
                  "Remote diagnostics + OTA-ready firmware",
                  "Ideal for larger households",
                  "Free home demo + guided installation",
                ],
                specs: [
                  { label: "Plates", value: "8 platinum-coated titanium" },
                  { label: "pH range", value: "3.0 – 11.0+" },
                  { label: "ORP estimate", value: "Up to -850 mV" },
                  { label: "Hydrogen (H₂)", value: "Up to 1,800 ppb" },
                  { label: "Connectivity", value: "Wi-Fi, app & live cloud status" },
                ],
                ctaLabel: "Order on WhatsApp",
              },
              {
                name: "Aura — Smart 5-Plate Ionizer",
                imageUrl: "/wellwa/images/aura-5.webp",
                images: ["/wellwa/images/aura-5.webp"],
                mrp: "₹1,49,999",
                price: "₹90,000",
                badge: "Essential",
                desc: "Connected everyday water control in a compact countertop design.",
                features: [
                  "5 platinum-coated titanium plates",
                  "Wi-Fi + Wellwa app control",
                  "Compact countertop design",
                  "Free home demo + guided installation",
                ],
                specs: [
                  { label: "Plates", value: "5 platinum-coated titanium" },
                  { label: "pH range", value: "4.0 – 10.0+" },
                  { label: "ORP estimate", value: "Up to -750 mV" },
                  { label: "Hydrogen (H₂)", value: "Up to 1,500 ppb" },
                  { label: "Connectivity", value: "Wi-Fi & Wellwa app" },
                ],
                ctaLabel: "Order on WhatsApp",
              },
              {
                name: "Starter Pack — NMD Alkaline Drops",
                imageUrl: "/wellwa/images/nmd-drops.webp",
                images: ["/wellwa/images/nmd-drops.webp"],
                mrp: "₹11,800",
                price: "₹11,800",
                badge: "Start here",
                desc: "A simple, portable first step into the Wellwa water & wellness ecosystem.",
                features: [
                  "Two 50 ml NMD alkaline drop bottles",
                  "Portable — try alkaline-support water anywhere",
                  "Simple measured-use routine with Wellwa guidance",
                ],
                specs: [
                  { label: "Pack size", value: "2 × 50 ml bottles" },
                  { label: "Prepared pH", value: "Approx. 8.5 – 10.5" },
                  { label: "Format", value: "Portable starter pack" },
                ],
                ctaLabel: "Order on WhatsApp",
              },
            ],
          },
          {
            id: "b3",
            kind: "services",
            title: "What I offer",
            items: [
              { name: "Alkaline Water System", desc: "Ionised, mineral-rich water at home." },
              { name: "Wellness Products", desc: "Supplements and daily-health range." },
              { name: "Business Opportunity", desc: "Request and evaluate the current written plan." },
              { name: "Connected Care", desc: "App status, alerts and service support." },
            ],
          },
          { id: "b4", kind: "pdf", title: "Business opportunity presentation", fileLabel: "Wellwa-Business-Opportunity.pdf", fileUrl: "/wellwa/docs/Wellwa-Business-Opportunity.pdf" },
          {
            id: "b4o",
            kind: "about",
            title: "Confirm current commercial terms",
            body: "Published retail prices are shown. Confirm current stock, tax, installation, warranty and any written offer before placing an order.",
          },
          {
            id: "b4f",
            kind: "faq",
            title: "Common questions",
            items: [
              { q: "Kya alkaline water disease cure karta hai?", a: "Nahi. Koi medical outcome promise nahi kiya jata; product medical advice ya treatment ka substitute nahi hai." },
              { q: "Machine ki warranty kitni hai?", a: "1 year complete machine, uske baad 4 additional years electrolysis plates only. Written warranty order par confirm karein." },
              { q: "Payment kaise karna hoga?", a: "Payment poori amount ka hota hai — hamari koi EMI scheme nahi hai. Credit card se le sakte hain." },
            ],
          },
        ],
      },
      {
        id: "p-gallery",
        slug: "gallery",
        label: "Gallery",
        blocks: [
          {
            id: "b5",
            kind: "gallery",
            title: "Moments",
            images: [
              { url: "/wellwa/images/aura-plus-kitchen-hero.webp", color: "#0d8f86", label: "Aura Plus at home" },
              { url: "/wellwa/images/home-demo-consultation.webp", color: "#6e56f0", label: "Home consultation" },
              { url: "/wellwa/images/distributor-training.webp", color: "#c9781c", label: "Distributor training" },
              { url: "/wellwa/images/aura-5.webp", color: "#1f9d57", label: "Aura" },
              { url: "/wellwa/images/aura-plus-7.webp", color: "#2563eb", label: "Aura Plus" },
              { url: "/wellwa/images/aura-maxx.webp", color: "#c34141", label: "Aura Maxx" },
            ],
          },
          { id: "b6", kind: "video", title: "Aura product tour", url: "/wellwa/video/wellwa-product-tour.mp4", posterUrl: "/wellwa/images/aura-plus-kitchen-hero.webp", caption: "A short visual overview" },
        ],
      },
      {
        id: "p-contact",
        slug: "contact",
        label: "Contact",
        blocks: [
          { id: "b7", kind: "contact", title: "Get in touch" },
          {
            id: "b7h",
            kind: "hours",
            title: "Business hours",
            rows: [
              { day: "Mon – Sat", time: "10:00 – 19:00" },
              { day: "Sunday", time: "Closed" },
            ],
          },
          { id: "b7l", kind: "location", title: "Head office", address: "704, 7th Floor, Palm Court, Gurgaon 122007, Haryana" },
        ],
      },
    ],
    plan: "pro",
    active: true,
    views: 1284,
    createdAt: "2026-03-14",
  },
  {
    id: "8801",
    username: "drmehta",
    name: "Dr. Anita Mehta",
    jobTitle: "Nutrition Consultant",
    company: "Wellwa Life",
    tagline: "Personalised diet & wellness plans",
    about: "Certified nutritionist. Book a consultation to get your custom plan.",
    avatarColor: "#6d5cf5",
    themeColor: "#6d5cf5",
    template: "minimal",
    verified: false,
    links: [
      { id: "l1", type: "phone", label: "Call", value: "+919111111111" },
      { id: "l2", type: "whatsapp", label: "WhatsApp", value: "+919111111111" },
      { id: "l3", type: "email", label: "Email", value: "anita@wellwa.life" },
    ],
    pages: [
      {
        id: "p-home",
        slug: "home",
        label: "Home",
        blocks: [
          {
            id: "b1",
            kind: "about",
            title: "About",
            body: "Certified nutritionist. Book a consultation to get your custom diet and wellness plan.",
          },
          {
            id: "b2",
            kind: "highlights",
            title: "Specialties",
            items: ["Weight management", "Diabetic diets", "Family nutrition"],
          },
        ],
      },
      {
        id: "p-contact",
        slug: "contact",
        label: "Contact",
        blocks: [{ id: "b3", kind: "contact", title: "Book a consultation" }],
      },
    ],
    plan: "free",
    active: true,
    views: 342,
    createdAt: "2026-05-02",
  },
];

export const sampleLeads: Lead[] = [
  {
    id: "L1", cardId: "8796", name: "Rahul Sharma", phone: "+919812345678",
    email: "rahul@example.com", message: "Interested in the water system + business plan.",
    source: "whatsapp", status: "hot", score: 92, createdAt: "2026-08-01",
  },
  {
    id: "L2", cardId: "8796", name: "Priya Nair", phone: "+919845612300",
    email: "priya@example.com", message: "Please send the brochure.",
    source: "form", status: "warm", score: 68, createdAt: "2026-08-01",
  },
  {
    id: "L3", cardId: "8796", name: "Amit Verma", phone: "+919700011223",
    email: "", message: "Downloaded contact",
    source: "vcard", status: "new", score: 40, createdAt: "2026-07-31",
  },
  {
    id: "L4", cardId: "8796", name: "Sunita Rao", phone: "+919933344455",
    email: "sunita@example.com", message: "Booked a call for the masterclass.",
    source: "whatsapp", status: "won", score: 88, createdAt: "2026-07-30",
  },
  {
    id: "L5", cardId: "8801", name: "Karan Gupta", phone: "+919888877665",
    email: "karan@example.com", message: "Want a diet plan.",
    source: "form", status: "warm", score: 61, createdAt: "2026-07-29",
  },
];

export function getCard(id: string): Card | undefined {
  return sampleCards.find((c) => c.id === id);
}

export function getCardByUsername(username: string): Card | undefined {
  return sampleCards.find((c) => c.username === username);
}

export function getLeadsForCard(cardId: string): Lead[] {
  return sampleLeads.filter((l) => l.cardId === cardId);
}
