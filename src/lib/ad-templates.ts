// Ready-made ads: pick one, copy, post.
//
// The AI writer covers anything unusual, but most owners just want something
// proven that they can put up today. These are written for Indian small
// businesses: plain language, WhatsApp as the action, rupees, and no claim we
// can't stand behind — nothing here promises a cure or a guaranteed income.

export type ReadyAd = {
  angle: string;        // why this ad works, in the owner's words
  campaign: string;     // slug pre-filled into the link builder
  headline: string;
  primary: string;
  cta: string;
  audience: string;
  budget: string;
};

export type AdField = {
  key: string;
  label: string;
  match: RegExp;        // guesses the field from what's on the card
  ads: ReadyAd[];
};

export const AD_FIELDS: AdField[] = [
  {
    key: "water",
    label: "Water / Wellness",
    match: /water|ionizer|alkaline|wellwa|hydrogen|ph |purifier/i,
    ads: [
      {
        angle: "The free demo — easiest first ad",
        campaign: "free-water-test",
        headline: "Free water test at your home",
        primary:
          "Do you actually know what's in your drinking water?\n\nWe test it at your home, free, in about 20 minutes. You see the result yourself — no obligation, no pressure.\n\nMessage us to book a slot this week.",
        cta: "Book free test",
        audience: "Age 30–55, homeowners in your city, interests: health, family, home improvement. Radius 15–20 km.",
        budget: "₹300/day for 5 days",
      },
      {
        angle: "Cost comparison — good for price-conscious families",
        campaign: "bottled-water-cost",
        headline: "Still buying water cans every month?",
        primary:
          "₹600–800 a month on cans adds up to nearly ₹9,000 a year — and it never stops.\n\nA one-time setup at home gives your family clean water on tap. Credit card accepted.\n\nAsk us what it would cost for your home.",
        cta: "Get a price",
        audience: "Age 28–50, families, interests: home appliances, savings, groceries. Your city.",
        budget: "₹250/day for 7 days",
      },
      {
        angle: "Everyday health — soft, no medical claims",
        campaign: "daily-hydration",
        headline: "Most of us drink too little water",
        primary:
          "Tiredness in the afternoon. Dry skin. Low energy.\n\nOften it's simply not enough water — and water your family actually likes the taste of.\n\nWe'll show you the difference at your own home, free.",
        cta: "Message us",
        audience: "Age 25–50, interests: fitness, yoga, healthy living, wellness. Your city.",
        budget: "₹300/day for 5 days",
      },
      {
        angle: "Business opportunity — for recruiting distributors",
        campaign: "business-opportunity",
        headline: "Want a second income from home?",
        primary:
          "No shop. No heavy investment. Full training given.\n\nWe're looking for people who want to build a wellness business in their own area, part-time or full-time.\n\nMessage us to understand how it works.",
        cta: "Know more",
        audience: "Age 25–45, interests: business, entrepreneurship, side income, direct selling. Your city and nearby towns.",
        budget: "₹300/day for 7 days",
      },
    ],
  },
  {
    key: "clinic",
    label: "Doctor / Clinic",
    match: /clinic|doctor|dr\.|patient|physician|dental|hospital/i,
    ads: [
      {
        angle: "Appointment booking — the workhorse ad",
        campaign: "book-appointment",
        headline: "Book your appointment on WhatsApp",
        primary:
          "No phone queues, no waiting on hold.\n\nMessage us your name and preferred time — we'll confirm your slot.\n\nConsultation hours and clinic address are on our card.",
        cta: "Book now",
        audience: "Age 25–60, within 8–10 km of the clinic.",
        budget: "₹200/day, ongoing",
      },
      {
        angle: "Preventive check-up — brings in new patients",
        campaign: "health-checkup",
        headline: "When was your last full check-up?",
        primary:
          "Most problems are easier to handle when they're found early.\n\nWe offer complete health check-up packages with clear explanations — not just a report you can't read.\n\nMessage us for package details.",
        cta: "See packages",
        audience: "Age 35–60, families, interests: health, insurance, fitness. Local area.",
        budget: "₹250/day for 7 days",
      },
    ],
  },
  {
    key: "estate",
    label: "Real Estate",
    match: /property|real estate|realtor|flat|bhk|apartment|plot/i,
    ads: [
      {
        angle: "Site visit — the standard property ad",
        campaign: "site-visit",
        headline: "Ready-to-move homes in your budget",
        primary:
          "Tell us your budget and preferred area — we'll shortlist only what genuinely fits.\n\nRERA registered. Verified listings. Home-loan help included.\n\nMessage us to book a site visit.",
        cta: "Book a visit",
        audience: "Age 28–50, interests: home buying, home loans, investment. Your city.",
        budget: "₹400/day for 7 days",
      },
    ],
  },
  {
    key: "food",
    label: "Restaurant / Café",
    match: /restaurant|cafe|café|kitchen|thali|food|dining|bakery/i,
    ads: [
      {
        angle: "Table booking + delivery",
        campaign: "table-booking",
        headline: "Fresh food, made the same day",
        primary:
          "Family seating, pure veg and non-veg sections, and home delivery.\n\nMessage us to book a table or order for a party.\n\nToday's menu is on our card.",
        cta: "Book a table",
        audience: "Age 22–50, food lovers, within 5–8 km.",
        budget: "₹250/day, weekends higher",
      },
    ],
  },
  {
    key: "salon",
    label: "Salon / Spa",
    match: /salon|spa|beauty|hair|makeup|bridal|nails/i,
    ads: [
      {
        angle: "Bridal season — highest value customer",
        campaign: "bridal-package",
        headline: "Booking your bridal look?",
        primary:
          "Trial included, so there are no surprises on the day.\n\nHair, skin and makeup handled by trained stylists using premium products.\n\nMessage us for package details and dates.",
        cta: "See packages",
        audience: "Age 20–35, women, interests: weddings, bridal, beauty. Your city.",
        budget: "₹350/day for 7 days",
      },
    ],
  },
  {
    key: "gym",
    label: "Fitness / Gym",
    match: /fitness|gym|trainer|workout|yoga|transformation/i,
    ads: [
      {
        angle: "Free trial session",
        campaign: "free-session",
        headline: "First session free — see if it suits you",
        primary:
          "No pressure, no annual contract to sign on day one.\n\nCome in for one session, meet the trainer, and decide after that.\n\nMessage us to pick a time.",
        cta: "Book free session",
        audience: "Age 20–45, interests: fitness, weight loss, gym. Within 5 km.",
        budget: "₹250/day for 7 days",
      },
    ],
  },
  {
    key: "consultant",
    label: "Consultant / Coach",
    match: /consult|coach|strategy|advisor|mentor|business/i,
    ads: [
      {
        angle: "Free discovery call",
        campaign: "discovery-call",
        headline: "A 20-minute call, no charge",
        primary:
          "Tell me where your business is stuck. If I can help, I'll tell you how. If I can't, I'll say so.\n\nPractical steps you can act on this week — not a theory deck.\n\nMessage me to book the call.",
        cta: "Book a call",
        audience: "Age 28–55, small business owners, interests: entrepreneurship, business growth.",
        budget: "₹300/day for 7 days",
      },
    ],
  },
];

/** Best-guess field from whatever the owner has written on the card. */
export function guessField(text: string): AdField {
  return AD_FIELDS.find((f) => f.match.test(text)) ?? AD_FIELDS[0];
}
