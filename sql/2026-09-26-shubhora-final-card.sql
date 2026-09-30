-- Shubhora partner cards → the FINAL seller card (owner's call, 26 Sep 2026).
-- Run in Supabase → SQL Editor after the deploy. Safe to run twice.
--
-- Every Shubhora card (kb = 'shubhora', or an older card whose company says Shubhora) gets the new pages:
--   Home · Why Shubhora · Features · Templates · Plans · Business · Contact
-- and keeps what belongs to the owner:
--   • their own Contact page (about me, hours, address)        • any reviews they added
--   • any page they made themselves                             • their own photos from the old Gallery page
--   • a referral code they typed into a button (it goes on the new "Register free" button)
--   • name, photo, numbers, look, AI notes — nothing outside the pages is touched, except the video link.
-- Removed: the two sample "demo" videos, the mocked phone pictures and the old business-plan PDF.
-- Step 0 keeps a copy of every card it changes (cards_backup_20260926_final) and of the saved template.

-- Step 0: backups (made once; a second run keeps the first copy)
create table if not exists public.cards_backup_20260926_final as
  select c.* from public.cards c
   where (c.data->>'kb' = 'shubhora'
        or (coalesce(c.data->>'kb', '') = '' and (c.data->>'company' ilike '%shubhora%' or c.data->>'jobTitle' ilike '%shubhora partner%')))
     and c.username is distinct from 'next_level' /* Next_Level (Joginder Yadav) is left exactly as it is */;
create table if not exists public.card_templates_backup_20260926_final as
  select * from public.card_templates where key = 'vcard-reseller';
-- backups are for the owner only: not readable through the public API
alter table public.cards_backup_20260926_final enable row level security;
alter table public.card_templates_backup_20260926_final enable row level security;

-- The final template, once (used by steps 1 and 2)
create temp table if not exists _final_tpl (data jsonb);
truncate _final_tpl;
insert into _final_tpl values ($tpl${
 "name": "Your Name",
 "jobTitle": "Shubhora Partner",
 "company": "Shubhora Digital V-Card",
 "tagline": "Your whole business on one link — card, website and an AI assistant that never sleeps.",
 "about": "I help shop owners, doctors, agents and freelancers move from a paper visiting card to a digital V-Card: one link that carries your products, photos, prices and contact details, and an AI assistant that answers customers for you.",
 "avatarColor": "#2f5bf5",
 "themeColor": "#2f5bf5",
 "template": "glass",
 "verified": false,
 "avatarUrl": "/art/brand/shubhora-logo.png",
 "avatarShape": "square",
 "coverUrl": "/art/brand/shubhora-banner.png",
 "botPersona": "A clear, friendly Shubhora advisor. Explains the digital V-Card in simple words in the visitor's own language, asks what work they do, shows how the card would help that trade, never pressures, and never promises any income. Offers a live demo and a callback whenever something needs confirming.",
 "kb": "shubhora",
 "botKnowledge": "",
 "popup": {
  "enabled": true,
  "title": "See your own card, free",
  "subtitle": "Leave your number and I will set up a free card with your name on it.",
  "ctaLabel": "Make my free card",
  "terms": "*The free plan stays free. No card details needed."
 },
 "links": [
  {
   "id": "l1",
   "type": "phone",
   "label": "Call",
   "value": "+91"
  },
  {
   "id": "l2",
   "type": "whatsapp",
   "label": "WhatsApp",
   "value": "+91"
  },
  {
   "id": "l3",
   "type": "email",
   "label": "Email",
   "value": "you@example.com"
  },
  {
   "id": "l4",
   "type": "website",
   "label": "Website",
   "value": "https://shubhora.com"
  },
  {
   "id": "l6",
   "type": "youtube",
   "label": "Watch the video",
   "value": "https://youtu.be/kQuN3OVBNl0"
  },
  {
   "id": "l5",
   "type": "location",
   "label": "Service area",
   "value": ""
  }
 ],
 "pages": [
  {
   "id": "p1",
   "slug": "home",
   "label": "Home",
   "blocks": [
    {
     "id": "vh1",
     "kind": "video",
     "title": "Shubhora in 3½ minutes",
     "url": "https://youtu.be/kQuN3OVBNl0",
     "caption": "Watch this first (in Hindi): the free digital V-Card, the website, the AI assistant, daily posters and the plans — everything on one link."
    },
    {
     "id": "vh2",
     "kind": "highlights",
     "title": "One link. Your whole business.",
     "items": [
      "📇 Digital V-Card — free for ever",
      "📥 Every enquiry saved as a lead",
      "🌐 Website on the same link (Growth)",
      "🤖 AI assistant, 24×7 (Growth)",
      "🖼️ A new poster every morning (Growth)",
      "🗣️ Card in 10 languages (Growth)"
     ]
    },
    {
     "id": "vh3",
     "kind": "image",
     "title": "Five tools, one link",
     "images": [
      {
       "url": "/api/stock/demo/shubhora-one-link.jpg",
       "caption": "The V-Card and your leads are free for ever. The website, the AI assistant and the daily posters come with Growth."
      }
     ]
    },
    {
     "id": "vh4",
     "kind": "cta",
     "title": "This page IS the product",
     "body": "Everything you are scrolling now is what your own card will look like — with your name, your products and your number. Most people have theirs live in about 10 minutes.",
     "joinUrl": "#plans",
     "joinLabel": "See plans and prices",
     "referralCode": ""
    },
    {
     "id": "vh5",
     "kind": "services",
     "title": "What you get",
     "items": [
      {
       "name": "Your own link and QR",
       "desc": "shubhora.com/c/your-name — opens on any phone. Nothing for your customer to download or install."
      },
      {
       "name": "Save contact, Call, WhatsApp, UPI, Map",
       "desc": "Every button a customer needs, one tap each — and your number goes straight into their phone."
      },
      {
       "name": "Products with real prices",
       "desc": "Photos, MRP and offer price, features and an Order on WhatsApp button. Change a price once and it changes everywhere."
      },
      {
       "name": "Leads that don't get lost",
       "desc": "Every call tap, WhatsApp tap and form is saved with the customer's name and what they asked about — on every plan."
      },
      {
       "name": "A website on the same link (Growth)",
       "desc": "On a computer the same link opens as a full website. No designer, no yearly hosting bill."
      },
      {
       "name": "AI assistant, 24×7 (Growth)",
       "desc": "Trained on your business. Replies on your card and on your own WhatsApp in the customer's language — and never invents a price."
      },
      {
       "name": "A poster every morning (Growth)",
       "desc": "A festival, greeting or offer poster with your name, logo and number, plus a short status video — posted for you."
      },
      {
       "name": "AI Studio (Growth)",
       "desc": "Product photoshoots, 10–60 second video ads, reels and explainer videos from your own text — with credits, only when you need them."
      }
     ]
    },
    {
     "id": "vh6",
     "kind": "testimonials",
     "title": "What card owners say",
     "items": []
    },
    {
     "id": "vh7",
     "kind": "offer",
     "title": "Start free",
     "text": "Your digital V-Card is worth ₹1,499 — and free for you for ever. No card details, no hidden charge. Move to Growth only when you want the website, the AI assistant and daily posters.",
     "code": "",
     "expires": ""
    },
    {
     "id": "vh8",
     "kind": "contact",
     "title": "Ask me anything",
     "note": "Tell me what work you do — I will make a demo card with your name and send you the link."
    }
   ]
  },
  {
   "id": "p8",
   "slug": "why",
   "label": "Why Shubhora",
   "blocks": [
    {
     "id": "vy1",
     "kind": "about",
     "title": "India has gone digital. Has your business?",
     "body": "Your customers already do everything on the phone — they pay by UPI, they look for shops on Google, they ask on WhatsApp. A paper visiting card does none of that.\n\nShubhora puts your business where your customers already are: one link with your card, your products, your prices and a way to reach you at any hour."
    },
    {
     "id": "vy2",
     "kind": "image",
     "title": "India, in numbers",
     "images": [
      {
       "url": "/api/stock/demo/shubhora-india-digital.jpg",
       "caption": "Sources: TRAI — internet subscribers, 31 March 2026 · NPCI — UPI, August 2026 · Ministry of MSME (PIB) — Udyam registrations, February 2026."
      }
     ]
    },
    {
     "id": "vy3",
     "kind": "highlights",
     "title": "What that means for a business",
     "items": [
      "📱 Customers search on the phone first",
      "💬 They expect a reply on WhatsApp",
      "🌙 Enquiries come at night too",
      "🔎 A business that isn't online gets skipped",
      "🗂️ Leads written on paper get lost",
      "🌐 A website no longer needs a designer"
     ]
    },
    {
     "id": "vy4",
     "kind": "compare",
     "title": "Paper visiting card vs Shubhora V-Card",
     "leftLabel": "Shubhora V-Card",
     "rightLabel": "Paper card",
     "rows": [
      {
       "feature": "Change your number or price",
       "left": "Any time, in seconds",
       "right": "Reprint everything"
      },
      {
       "feature": "Show products and photos",
       "left": "Unlimited, with prices",
       "right": "Does not fit"
      },
      {
       "feature": "Share it",
       "left": "One tap on WhatsApp",
       "right": "Only in person"
      },
      {
       "feature": "A customer asks at 11 pm",
       "left": "The AI assistant replies (Growth)",
       "right": "Nobody replies"
      },
      {
       "feature": "Keep the enquiry",
       "left": "Saved as a lead",
       "right": "Lost"
      },
      {
       "feature": "Found on Google",
       "left": "Yes — your own public page",
       "right": "No"
      },
      {
       "feature": "Cost when something changes",
       "left": "Nothing to print",
       "right": "A new print run"
      }
     ]
    },
    {
     "id": "vy5",
     "kind": "compare",
     "title": "Separate tools vs one Shubhora link",
     "leftLabel": "One Shubhora link",
     "rightLabel": "Separate tools",
     "rows": [
      {
       "feature": "Visiting card",
       "left": "Digital, always up to date",
       "right": "Printed again and again"
      },
      {
       "feature": "Website",
       "left": "Same link, no hosting bill (Growth)",
       "right": "Designer + yearly hosting"
      },
      {
       "feature": "Daily posters",
       "left": "Made every morning (Growth)",
       "right": "Designed by hand — or skipped"
      },
      {
       "feature": "WhatsApp at night",
       "left": "AI replies 24×7 (Growth)",
       "right": "The customer waits till morning"
      },
      {
       "feature": "Enquiries",
       "left": "All in one list",
       "right": "Scattered across chats and diaries"
      },
      {
       "feature": "Logins and bills",
       "left": "One account",
       "right": "A different app for each"
      },
      {
       "feature": "Time to set up",
       "left": "About 10 minutes, on a phone",
       "right": "Days or weeks"
      }
     ]
    },
    {
     "id": "vy6",
     "kind": "services",
     "title": "What makes Shubhora different",
     "items": [
      {
       "name": "Made for Indian businesses",
       "desc": "Ready templates for 78 professions, prices in ₹, UPI and WhatsApp built in."
      },
      {
       "name": "Your customer's language (Growth)",
       "desc": "Visitors read your card in 10 languages, and the AI assistant replies in their language too."
      },
      {
       "name": "An AI that knows your business (Growth)",
       "desc": "It answers from your own details — products, prices, timings — and passes every serious enquiry to you."
      },
      {
       "name": "Free for ever, not a trial",
       "desc": "The V-Card, worth ₹1,499, stays free for as long as you use it. No card details needed."
      },
      {
       "name": "Your own domain, even on Free",
       "desc": "yourbusiness.com can open your card on the free plan too."
      },
      {
       "name": "Everything from your phone",
       "desc": "Set it up, change prices, see leads and share — no computer, no designer, no technical skill."
      },
      {
       "name": "A real company behind it",
       "desc": "Shubhora is a brand of Wellwa Life India Pvt Ltd, Gurgaon — with published policies and a grievance officer."
      }
     ]
    },
    {
     "id": "vy7",
     "kind": "cta",
     "title": "See it on your own business",
     "body": "Pick your trade and preview a live card before you decide — free.",
     "joinUrl": "#templates",
     "joinLabel": "See the templates",
     "referralCode": ""
    }
   ]
  },
  {
   "id": "p7",
   "slug": "features",
   "label": "Features",
   "blocks": [
    {
     "id": "vf1",
     "kind": "video",
     "title": "Discover Shubhora — full walkthrough",
     "url": "https://youtu.be/JO2l3FCm8jY",
     "caption": "A walkthrough of the whole Shubhora suite: the card, the website, the AI assistant, the posters and the leads."
    },
    {
     "id": "vf2",
     "kind": "services",
     "title": "Everything your card does",
     "items": [
      {
       "name": "📇 Digital V-Card",
       "desc": "Your name, photo, business, products and buttons on one link — Save contact, Call, WhatsApp, Directions, UPI. Opens instantly, no app to install."
      },
      {
       "name": "🛍️ Products with prices",
       "desc": "Photos, MRP and offer price, features and specifications — with an Order on WhatsApp button. Change a price once, it changes everywhere."
      },
      {
       "name": "📥 Leads",
       "desc": "Every call tap, WhatsApp tap and form fill is saved with the customer's name and number — free on every plan. Follow-up reminders and export with Growth."
      },
      {
       "name": "🗣️ 10 languages (Growth)",
       "desc": "Visitors switch your card to Hindi, Marathi, Gujarati, Tamil, Telugu, Bengali, Kannada, Malayalam or Punjabi with one tap."
      },
      {
       "name": "🔗 Your own domain",
       "desc": "yourbusiness.com opens your card, even on the free plan. A QR code for the counter and anything you print."
      },
      {
       "name": "🌐 Website on the same link (Growth)",
       "desc": "On a computer the link opens as a full website — home, products, gallery, FAQ, contact — built from the same details."
      },
      {
       "name": "🤖 AI assistant, 24×7 (Growth)",
       "desc": "Answers customers on the card and on your own WhatsApp number, in their language — prices, timings, directions, bookings. You get the lead."
      },
      {
       "name": "🖼️ Daily poster + status video (Growth)",
       "desc": "Every morning a festival, greeting or offer poster with your name and number, and a short status video — posted to WhatsApp Status, Facebook and Instagram."
      },
      {
       "name": "🎬 AI Studio (Growth)",
       "desc": "Product photoshoots, 10–60 second video ads, reels and long explainer videos from your own text — with credits, whenever you need them."
      },
      {
       "name": "⭐ Reviews and trust",
       "desc": "Ask customers for a review with one link; the best ones show on your card, with your GST number, hours and map."
      }
     ]
    },
    {
     "id": "vf3",
     "kind": "carousel",
     "title": "Real screens",
     "images": [
      {
       "url": "/api/stock/demo/shubhora-screens-languages.jpg",
       "caption": "The language button: with Growth, visitors read your card in 10 languages."
      },
      {
       "url": "/api/stock/demo/shubhora-screens-trades.jpg",
       "caption": "Real cards from Shubhora templates: a restaurant and a doctor."
      }
     ]
    },
    {
     "id": "vf4",
     "kind": "faq",
     "title": "Good to know",
     "items": [
      {
       "q": "Do my customers need an app?",
       "a": "No. The link opens in any browser — WhatsApp, Chrome, Safari — on any phone."
      },
      {
       "q": "Can I change things myself?",
       "a": "Yes, from your phone: words, photos, prices, pages and the look. Changes go live the moment you publish."
      },
      {
       "q": "What happens if I stop paying for Growth?",
       "a": "Your card stays online, free, for ever. Only the Growth parts pause — website, AI assistant, daily posters — and they come back when you renew."
      },
      {
       "q": "Is my data safe?",
       "a": "Your card is public by design; your leads, customers and messages are private to you and never sold or shared."
      },
      {
       "q": "Can I use it for two businesses?",
       "a": "One account is one card and one business profile. For several brands or branches, Shubhora builds a custom setup — price on request, with a dedicated manager."
      },
      {
       "q": "Is there an app for me?",
       "a": "Yes, without the Play Store: open shubhora.com and tap Install app (on iPhone: Safari → Share → Add to Home Screen)."
      }
     ]
    },
    {
     "id": "vf5",
     "kind": "contact",
     "title": "Want to see it on your business?",
     "note": "Send me your name and what you do — I will set up a demo card for you today."
    }
   ]
  },
  {
   "id": "p6",
   "slug": "templates",
   "label": "Templates",
   "blocks": [
    {
     "id": "t1",
     "kind": "about",
     "title": "A ready design for your line of work",
     "body": "Pick the template made for your trade — we fill in your name, photos, products and prices, and the card is ready in minutes. Every template has its own banner, pages and sections written for that business; change any of it later. Tap a tile: the six most-used trades open a full live preview; every other tile makes your own card in that design, free — your introducer is already set."
    },
    {
     "id": "t2",
     "kind": "showcase",
     "title": "Templates by profession",
     "items": [
      {
       "imageUrl": "/api/stock/banners/doctor.jpg",
       "label": "Doctor / Clinic",
       "sub": "Specialities, timings, booking, fees",
       "url": "https://shubhora.com/templates/doctor-clinic"
      },
      {
       "imageUrl": "/api/stock/banners/realestate.jpg",
       "label": "Real estate",
       "sub": "Listings, site-visit booking, loan help",
       "url": "https://shubhora.com/templates/real-estate"
      },
      {
       "imageUrl": "/api/stock/banners/restaurant.jpg",
       "label": "Restaurant / Café",
       "sub": "Menu with prices, table booking, delivery",
       "url": "https://shubhora.com/templates/restaurant-cafe"
      },
      {
       "imageUrl": "/api/stock/banners/gym.jpg",
       "label": "Gym / Fitness",
       "sub": "Plans, transformations, free trial",
       "url": "https://shubhora.com/templates/fitness-trainer"
      },
      {
       "imageUrl": "/api/stock/banners/salon.jpg",
       "label": "Salon / Spa",
       "sub": "Service menu, bridal packages, offers",
       "url": "https://shubhora.com/templates/salon-spa"
      },
      {
       "imageUrl": "/api/stock/banners/coaching.jpg",
       "label": "Coaching / Consultant",
       "sub": "Credentials, results, discovery call",
       "url": "https://shubhora.com/templates/consultant-coach"
      },
      {
       "imageUrl": "/api/stock/banners/kirana.jpg",
       "label": "Kirana / General store",
       "sub": "Products, home delivery, UPI · tap to make yours, free",
       "url": "https://shubhora.com/signup"
      },
      {
       "imageUrl": "/api/stock/banners/jewellery.jpg",
       "label": "Jewellery",
       "sub": "Collections, gold rate, gallery · tap to make yours, free",
       "url": "https://shubhora.com/signup"
      },
      {
       "imageUrl": "/api/stock/banners/garments.jpg",
       "label": "Garments / Boutique",
       "sub": "New arrivals, sizes, order on WhatsApp · tap to make yours, free",
       "url": "https://shubhora.com/signup"
      },
      {
       "imageUrl": "/api/stock/banners/mobile.jpg",
       "label": "Mobile / Electronics",
       "sub": "Brands, EMI, repair, offers · tap to make yours, free",
       "url": "https://shubhora.com/signup"
      },
      {
       "imageUrl": "/api/stock/banners/sweets.jpg",
       "label": "Sweets / Bakery",
       "sub": "Menu, festival boxes, bulk orders · tap to make yours, free",
       "url": "https://shubhora.com/signup"
      },
      {
       "imageUrl": "/api/stock/banners/lawyer.jpg",
       "label": "Lawyer / CA",
       "sub": "Practice areas, consultation, documents · tap to make yours, free",
       "url": "https://shubhora.com/signup"
      },
      {
       "imageUrl": "/api/stock/banners/insurance.jpg",
       "label": "Insurance / Finance agent",
       "sub": "Plans, claim help, call-back form · tap to make yours, free",
       "url": "https://shubhora.com/signup"
      },
      {
       "imageUrl": "/api/stock/banners/photography.jpg",
       "label": "Photography / Events",
       "sub": "Portfolio, packages, dates · tap to make yours, free",
       "url": "https://shubhora.com/signup"
      },
      {
       "imageUrl": "/api/stock/banners/electrician.jpg",
       "label": "Electrician / Plumber",
       "sub": "Services, areas served, emergency call · tap to make yours, free",
       "url": "https://shubhora.com/signup"
      },
      {
       "imageUrl": "/api/stock/banners/school.jpg",
       "label": "School / Tuition",
       "sub": "Courses, batches, admissions · tap to make yours, free",
       "url": "https://shubhora.com/signup"
      },
      {
       "imageUrl": "/api/stock/banners/travel.jpg",
       "label": "Travel / Tours",
       "sub": "Packages, itineraries, enquiry · tap to make yours, free",
       "url": "https://shubhora.com/signup"
      },
      {
       "imageUrl": "/api/stock/banners/mlm.jpg",
       "label": "Direct selling",
       "sub": "Products, plan, join link · tap to make yours, free",
       "url": "https://shubhora.com/signup"
      }
     ]
    },
    {
     "id": "t3",
     "kind": "highlights",
     "title": "78 professions · 12 looks",
     "items": [
      "🎨 Every template comes in 12 looks — Classic, Gradient, Minimal, Dark, Photo, Bold, Royal, Glass, Corporate, Earthy, Neon, Editorial",
      "🖼️ Real banner for your trade, or upload your own",
      "📄 Pages made for the business: products, services, gallery, FAQ, booking, hours, map",
      "🌐 The same design opens as a full website on computers (Growth)",
      "✏️ Change words, photos, colours and pages any time — no designer needed",
      "🔁 Switch template or look later; your link never changes"
     ]
    },
    {
     "id": "t4",
     "kind": "services",
     "title": "How a template becomes your card",
     "items": [
      {
       "name": "1. Tell us what you do",
       "desc": "Choose your trade from 78 — the right template, banner and sections are picked for you."
      },
      {
       "name": "2. We fill it with AI",
       "desc": "Your name, photos, products and prices go in; the about, services and FAQ are written for your business."
      },
      {
       "name": "3. Pick a look and publish",
       "desc": "See your card in 12 looks, pick one, and share the link on WhatsApp the same day."
      }
     ]
    },
    {
     "id": "t7",
     "kind": "video",
     "title": "Make your card yourself — step by step",
     "url": "https://www.facebook.com/reel/1078388548446035/",
     "caption": "5-minute video (in Hindi): account, business details, products with MRP and offer price, the AI card, editing and sharing — just with your phone."
    },
    {
     "id": "t5",
     "kind": "cta",
     "title": "See the templates live",
     "body": "Open the gallery, tap any template and preview the full card — pages, products, booking — exactly as your customers would see it.",
     "joinUrl": "https://shubhora.com/templates",
     "joinLabel": "Open the template gallery",
     "referralCode": ""
    },
    {
     "id": "t6",
     "kind": "contact",
     "title": "Which template is right for you?",
     "note": "Send me your business name and city — I will make a demo card in your template and send you the link."
    }
   ]
  },
  {
   "id": "p2",
   "slug": "plans",
   "label": "Plans",
   "blocks": [
    {
     "id": "vp1",
     "kind": "product",
     "title": "Plans and prices",
     "items": [
      {
       "name": "Free — for ever",
       "images": [
        "/api/stock/demo/shubhora-plan-free-v2.jpg"
       ],
       "price": "FREE",
       "badge": "Worth ₹1,499",
       "desc": "A complete digital V-Card worth ₹1,499, free for you for ever — on your own link, even on your own domain. No card details, no hidden charge.",
       "features": [
        "Digital card with all pages, products and gallery",
        "Your own domain (yourbusiness.com) on the card",
        "Leads from your card saved in the CRM",
        "Share on WhatsApp, QR code, save-contact"
       ],
       "specs": [
        {
         "label": "Price",
         "value": "FREE for ever (worth ₹1,499)"
        },
        {
         "label": "Business profiles",
         "value": "1"
        },
        {
         "label": "Website, AI assistant, daily posters",
         "value": "With Growth"
        }
       ],
       "ctaLabel": "Make my free card"
      },
      {
       "name": "Growth",
       "images": [
        "/api/stock/demo/shubhora-plan-growth-v2.jpg"
       ],
       "price": "₹2,999 / month",
       "badge": "Recommended",
       "desc": "Everything needed to run one business online — the website, the AI assistant, the daily poster and auto-posting.",
       "features": [
        "Everything in Free",
        "Full website on the same link",
        "AI assistant on your card and your WhatsApp (fair use up to 1,000 replies a month)",
        "Daily poster + status video, made every morning",
        "Auto-posting to Facebook, Instagram and WhatsApp Status",
        "Follow-up reminders and lead export",
        "All AI tools: photoshoot, ads, reels, brand kit",
        "8 free ad storyboards a month"
       ],
       "specs": [
        {
         "label": "Price",
         "value": "₹2,999 a month, GST included"
        },
        {
         "label": "Business profiles",
         "value": "1"
        },
        {
         "label": "Billing",
         "value": "Monthly — cancel any time"
        }
       ],
       "ctaLabel": "Start Growth"
      },
      {
       "name": "Custom Solutions",
       "images": [
        "/api/stock/demo/shubhora-plan-custom-v2.jpg"
       ],
       "price": "On request",
       "badge": "Any software",
       "desc": "Need more than Growth? Shubhora builds any software, customization and automation for your business — with a dedicated manager.",
       "features": [
        "Dedicated account manager",
        "Custom software, apps and websites — built for you",
        "Shubhora customized to the way your business works",
        "Automation of daily work — WhatsApp, leads, follow-ups, billing, reports",
        "Custom CRM / ERP, dashboards and team logins",
        "AI assistants and chatbots trained on your business",
        "Integrations — payment gateway, Tally, Google Sheets, your tools"
       ],
       "specs": [
        {
         "label": "Price",
         "value": "On request — as per your need"
        },
        {
         "label": "Account manager",
         "value": "Dedicated"
        },
        {
         "label": "What we build",
         "value": "Any software, customization, automation"
        }
       ],
       "ctaLabel": "Tell me what you need"
      }
     ]
    },
    {
     "id": "vp2",
     "kind": "compare",
     "title": "Free vs Growth",
     "leftLabel": "Growth ₹2,999",
     "rightLabel": "Free",
     "rows": [
      {
       "feature": "Digital V-Card + leads",
       "left": "Yes",
       "right": "Yes",
       "leftOk": true,
       "rightOk": true
      },
      {
       "feature": "Own domain on the card",
       "left": "Yes",
       "right": "Yes",
       "leftOk": true,
       "rightOk": true
      },
      {
       "feature": "Card in 10 languages",
       "left": "Yes",
       "right": "—",
       "leftOk": true,
       "rightOk": false
      },
      {
       "feature": "Full website on computers",
       "left": "Yes",
       "right": "Card only",
       "leftOk": true,
       "rightOk": false
      },
      {
       "feature": "AI assistant on card + WhatsApp",
       "left": "Up to 1,000 replies a month",
       "right": "—",
       "leftOk": true,
       "rightOk": false
      },
      {
       "feature": "Daily poster + status video",
       "left": "Every morning, auto-posted",
       "right": "—",
       "leftOk": true,
       "rightOk": false
      },
      {
       "feature": "Follow-up reminders & export",
       "left": "Yes",
       "right": "—",
       "leftOk": true,
       "rightOk": false
      }
     ]
    },
    {
     "id": "vp3",
     "kind": "faq",
     "title": "About the plans",
     "items": [
      {
       "q": "Does the free plan really stay free?",
       "a": "Yes. The card — all its pages, products and gallery, your own domain and the leads it brings in — stays free for as long as you use it. You move up to Growth when you want the website, the WhatsApp AI assistant, the daily poster and auto-posting."
      },
      {
       "q": "Is GST extra?",
       "a": "No. ₹2,999 already includes GST. Custom software and automation is quoted as per your need."
      },
      {
       "q": "What are AI credits for?",
       "a": "Only for AI photos and videos: an AI product photo is 5 credits, a video ad 20 to 120 credits depending on its length, a long video about 10 credits a minute. Credits come in packs — from 50 credits for ₹500. The card, the website, the posters, the CRM and the WhatsApp assistant never use credits."
      },
      {
       "q": "How do I pay?",
       "a": "Online in the app — UPI, cards or net banking through a licensed payment gateway. The plan starts within minutes and you get an invoice."
      },
      {
       "q": "Can I stop any time?",
       "a": "Yes. Growth is monthly: cancel from Settings and it runs to the end of the paid month. Your card keeps working on the free plan afterwards."
      },
      {
       "q": "Refunds?",
       "a": "A double charge, or a charge after you cancelled, is refunded in full. A month already used and credits already spent are not refunded. The full policy is on shubhora.com/refund."
      },
      {
       "q": "I need something more — my own software or automation?",
       "a": "Yes. Shubhora builds all kinds of software — apps, CRM, automation, AI assistants, integrations — customized for your business, with a dedicated manager. Tell me what you need and I will get you a quote."
      }
     ]
    },
    {
     "id": "vp4",
     "kind": "contact",
     "title": "Not sure which plan?",
     "note": "Tell me your business and how many enquiries you get in a week — I will tell you honestly which plan fits."
    }
   ]
  },
  {
   "id": "p3",
   "slug": "business",
   "label": "Business",
   "blocks": [
    {
     "id": "vb1",
     "kind": "video",
     "title": "The partner plan, explained",
     "url": "https://youtu.be/RwVVwCRWxCQ",
     "caption": "In Hindi: free registration, Red and Green ID, the double binary, the daily cap, ranks and weekly payout — the whole plan, with its rules."
    },
    {
     "id": "vb2",
     "kind": "about",
     "title": "Why this business",
     "body": "Every business around you — the shop you buy from, the clinic you visit, the agent you know — needs to be found and reached on the phone, and most still hand out paper cards. Shubhora partners show them this card and set theirs up on the spot.\n\nThere is no stock to buy, nothing to deliver and nothing to store: the product is a link. Registration is free. Income comes only from real paid subscriptions and their renewals — never from just adding people — and nobody can honestly promise you an amount."
    },
    {
     "id": "vb3",
     "kind": "services",
     "title": "Why partners choose Shubhora",
     "items": [
      {
       "name": "Every business needs it",
       "desc": "India has 7.8 crore registered small businesses (Udyam, February 2026). Every one of them needs customers to find it and reach it."
      },
      {
       "name": "Easy to deliver",
       "desc": "The product is a link. A customer's card is set up on their own phone in about 10 minutes — no stock, no courier, no installation."
      },
      {
       "name": "Easy to show",
       "desc": "Your own card is the demo. Hand over your phone, let them tap around, and make theirs free on the spot."
      },
      {
       "name": "Free to start",
       "desc": "Registration is free — nobody has to buy anything to join. Your ID turns Green when your own Growth plan is active."
      },
      {
       "name": "Renewals count again",
       "desc": "When a customer renews Growth, that month's BV enters your renewal binary again — one sale keeps counting for as long as the customer stays subscribed and your own plan is active."
      },
      {
       "name": "Paid every week",
       "desc": "Pairs are matched every night. After Sunday's closing, a wallet of ₹500 or more goes to your KYC-approved bank account on Wednesday."
      },
      {
       "name": "Everything on your phone",
       "desc": "Your team, wallet, income reports, KYC and withdrawals are in the app's Business section."
      },
      {
       "name": "Everything in writing",
       "desc": "The plan, the partner agreement and the disclosures are published — read them before you decide."
      }
     ]
    },
    {
     "id": "vb4",
     "kind": "image",
     "title": "How the plan pays",
     "images": [
      {
       "url": "/api/stock/demo/shubhora-plan-how-it-pays.jpg",
       "caption": "Every paid subscription is 2,500 BV. 2,500 BV on your left + 2,500 BV on your right = one pair = ₹500. At most 10 pairs a day in each binary."
      }
     ]
    },
    {
     "id": "vb5",
     "kind": "highlights",
     "title": "The plan at a glance",
     "items": [
      "🆓 Registration free — Red ID",
      "🟢 Own Growth plan active — Green ID",
      "🎁 Green ID: 25 AI credits per direct sale",
      "⚖️ 1 pair = ₹500 (2,500 + 2,500 BV)",
      "🔁 Two binaries: new sales and renewals",
      "📏 Cap: 10 pairs a day in each binary",
      "➡️ Unmatched BV carries forward",
      "🏆 10 ranks on lifetime pairs",
      "🏦 Weekly payout, Wednesday transfer",
      "🧾 TDS as per law, no admin charge"
     ]
    },
    {
     "id": "vb6",
     "kind": "pdf",
     "title": "The Shubhora presentation (PDF)",
     "fileLabel": "Shubhora-Presentation-Sep-2026.pdf",
     "fileUrl": "/api/stock/demo/shubhora-presentation-2026-09.pdf",
     "posterUrl": "/api/stock/demo/shubhora-presentation-cover.jpg",
     "hint": "20 pages · the product, plans and prices, and the complete partner plan — BV, pairs, capping, ranks and payout rules · tap to download"
    },
    {
     "id": "vb7",
     "kind": "faq",
     "title": "Questions people ask",
     "items": [
      {
       "q": "How much will I earn?",
       "a": "Nobody can honestly promise a number. What you earn depends only on real paid subscriptions and renewals in your teams, within the plan's rules and caps. The figures in the plan are the most it can pay — not a promise."
      },
      {
       "q": "Is registration really free?",
       "a": "Yes. Nobody has to buy anything to join. Pairs are paid only while your own Growth plan is active (Green ID)."
      },
      {
       "q": "Do I have to buy stock?",
       "a": "No. The product is software — there is nothing to buy in advance, nothing to deliver and nothing left over."
      },
      {
       "q": "What exactly am I selling?",
       "a": "The card you are looking at: the free digital V-Card, and the Growth plan (₹2,999 a month) with the website, the AI assistant and the daily posters."
      },
      {
       "q": "When and how am I paid?",
       "a": "Matching runs every night. After Sunday's midnight closing, a wallet of ₹500 or more is paid out automatically and reaches your approved bank account on Wednesday. PAN and bank details (KYC) must be approved first."
      },
      {
       "q": "Is tax deducted?",
       "a": "Yes, TDS as per the Income Tax Act — 2% with PAN (20% without) once your yearly income crosses ₹20,000. There is no admin charge."
      },
      {
       "q": "What if a customer takes a refund?",
       "a": "If a payment is refunded, the commission paid on it is reversed."
      },
      {
       "q": "Do I need to be technical?",
       "a": "No. Everything happens on a phone, and the videos on this card show every step."
      }
     ]
    },
    {
     "id": "vb8",
     "kind": "cta",
     "title": "Read the rules first",
     "body": "The partner disclosures — company details, key terms, refunds, tax and the grievance officer — published under the Consumer Protection (Direct Selling) Rules, 2021.",
     "joinUrl": "https://shubhora.com/partners/legal/disclosures",
     "joinLabel": "Read the partner disclosures",
     "referralCode": ""
    },
    {
     "id": "vb9",
     "kind": "cta",
     "title": "Ready to start?",
     "body": "Registration is free and takes a few minutes: your own card and your partner ID, from your phone.",
     "joinUrl": "https://shubhora.com/signup",
     "joinLabel": "Register free",
     "referralCode": ""
    },
    {
     "id": "vb10",
     "kind": "contact",
     "title": "Talk to me about the business",
     "note": "Tell me a little about yourself — I will send you the presentation and set up a call."
    }
   ]
  },
  {
   "id": "p5",
   "slug": "contact",
   "label": "Contact",
   "blocks": [
    {
     "id": "vc1",
     "kind": "about",
     "title": "About me",
     "body": "I am a Shubhora partner. I help shops, clinics, agents and professionals near me move from a paper visiting card to a digital V-Card — and I set it up with you, on your phone, free."
    },
    {
     "id": "vc2",
     "kind": "hours",
     "title": "When you can reach me",
     "rows": [
      {
       "day": "Monday – Saturday",
       "time": "10:00 – 19:00"
      },
      {
       "day": "Sunday",
       "time": "On WhatsApp"
      }
     ]
    },
    {
     "id": "vc3",
     "kind": "location",
     "title": "Where I am",
     "address": ""
    },
    {
     "id": "vc4",
     "kind": "contact",
     "title": "Send me a message",
     "note": "I usually reply within a few hours — WhatsApp is fastest."
    }
   ]
  }
 ]
}$tpl$::jsonb);

-- Step 1: the new pages on every Shubhora card
with tpl as (
  select data->'pages' as pages from _final_tpl
),
src as (
  select c.id,
         -- the owner's own Contact page, else the template's
         coalesce(
           (select pg from jsonb_array_elements(c.data->'pages') pg where pg->>'slug' = 'contact' limit 1),
           (select pg from jsonb_array_elements(tpl.pages) pg where pg->>'slug' = 'contact')
         ) as contact_page,
         -- pages the owner made (not part of the old or the new template), in their order
         coalesce((select jsonb_agg(pg order by o)
                     from jsonb_array_elements(c.data->'pages') with ordinality x(pg, o)
                    where coalesce(pg->>'slug', '') not in ('home','why','features','inside','templates','plans','business','gallery','contact')), '[]'::jsonb) as own_pages,
         -- the old Gallery page, only if the owner put their own photos in it (our stock pictures taken out)
         (select jsonb_set(pg, '{blocks}', coalesce((
                   select jsonb_agg(case when b->>'kind' = 'gallery'
                                         then jsonb_set(b, '{images}', coalesce((select jsonb_agg(i order by io)
                                                 from jsonb_array_elements(coalesce(b->'images', '[]'::jsonb)) with ordinality z(i, io)
                                                where coalesce(i->>'url', '') <> '' and i->>'url' not like '/api/stock/%'), '[]'::jsonb))
                                         else b end order by bo)
                     from jsonb_array_elements(pg->'blocks') with ordinality w(b, bo)
                    where not (b->>'kind' = 'cta' and coalesce(b->>'joinUrl', '') = '#plans')), '[]'::jsonb))
            from jsonb_array_elements(c.data->'pages') pg
           where pg->>'slug' = 'gallery'
             and exists (select 1 from jsonb_array_elements(pg->'blocks') b2,
                                       jsonb_array_elements(coalesce(b2->'images', '[]'::jsonb)) i2
                          where coalesce(i2->>'url', '') <> '' and i2->>'url' not like '/api/stock/%')
           limit 1) as own_gallery,
         -- reviews the owner added (the first reviews block that has any)
         (select b->'items' from jsonb_array_elements(c.data->'pages') pg, jsonb_array_elements(pg->'blocks') b
           where b->>'kind' = 'testimonials' and (case when jsonb_typeof(b->'items') = 'array' then jsonb_array_length(b->'items') else 0 end) > 0
           limit 1) as reviews,
         -- a referral code the owner typed into any button
         (select b->>'referralCode' from jsonb_array_elements(c.data->'pages') pg, jsonb_array_elements(pg->'blocks') b
           where b->>'kind' = 'cta' and coalesce(b->>'referralCode', '') <> ''
           limit 1) as ref_code
    from public.cards c, tpl
   where (c.data->>'kb' = 'shubhora'
        or (coalesce(c.data->>'kb', '') = '' and (c.data->>'company' ilike '%shubhora%' or c.data->>'jobTitle' ilike '%shubhora partner%')))
     and c.username is distinct from 'next_level' /* Next_Level (Joginder Yadav) is left exactly as it is */
),
built as (
  select s.id,
         (select jsonb_agg(pg order by o) from jsonb_array_elements(tpl.pages) with ordinality x(pg, o) where pg->>'slug' <> 'contact')
           || case when s.own_gallery is null then '[]'::jsonb else jsonb_build_array(s.own_gallery) end
           || s.own_pages
           || jsonb_build_array(s.contact_page) as pages,
         s.reviews, s.ref_code
    from src s, tpl
),
final as (
  select b.id,
         -- home = page 0, its reviews block = block 5; business = page 5, its "Register free" button = block 8
         (case when b.ref_code is null then x.p1 else jsonb_set(x.p1, '{5,blocks,8,referralCode}', to_jsonb(b.ref_code)) end) as pages
    from built b,
         lateral (select case when b.reviews is null then b.pages else jsonb_set(b.pages, '{0,blocks,5,items}', b.reviews) end as p1) x
)
update public.cards c
   set data = jsonb_set(
                jsonb_set(c.data, '{pages}', f.pages),
                '{links}',
                coalesce((select jsonb_agg(case when l->>'type' = 'youtube' and (coalesce(l->>'value', '') = '' or l->>'value' ilike '%JO2l3FCm8jY%')
                                                then l || jsonb_build_object('value', 'https://youtu.be/kQuN3OVBNl0', 'label', 'Watch the video')
                                                else l end order by o)
                            from jsonb_array_elements(case when jsonb_typeof(c.data->'links') = 'array' then c.data->'links' else '[]'::jsonb end)
                                 with ordinality y(l, o)), '[]'::jsonb))
  from final f
 where c.id = f.id;

-- Step 2: a template saved in Super Admin (it wins over the built-in one) becomes the final card too
update public.card_templates
   set data = (select data from _final_tpl),
       description = 'The card that sells the card: Shubhora''s own videos, why Shubhora, every feature with real screens, 78 profession templates, plans and prices, and the partner plan with its rules — plus a trained AI advisor. Every section is editable.',
       updated_at = now()
 where key = 'vcard-reseller';

-- Check: every Shubhora card should be on the final card, with no sample videos or mocked pictures left.
select count(*) as shubhora_cards,
       count(*) filter (where c.data->'pages'->1->>'slug' = 'why') as on_final_card,
       count(*) filter (where position('vcard-ai-assistant' in c.data::text) > 0
                           or position('vcard-business-plan' in c.data::text) > 0
                           or position('/api/stock/vcard/' in c.data::text) > 0
                           or position('shubhora-business-plan.pdf' in c.data::text) > 0) as with_old_samples
  from public.cards c
 where (c.data->>'kb' = 'shubhora'
        or (coalesce(c.data->>'kb', '') = '' and (c.data->>'company' ilike '%shubhora%' or c.data->>'jobTitle' ilike '%shubhora partner%')))
     and c.username is distinct from 'next_level' /* Next_Level (Joginder Yadav) is left exactly as it is */;
