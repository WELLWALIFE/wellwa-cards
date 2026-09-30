// The service catalogue behind /solutions/<slug>.
// One entry = one SEO landing page. Keep every claim honest — no invented
// client counts, no "#1 company" language; specific capability beats bragging.

export type Service = {
  slug: string;
  tag: string;                 // short eyebrow, also used on homepage tiles
  name: string;                // H1
  short: string;               // tile/summary copy
  metaTitle: string;           // <60 chars where possible
  metaDescription: string;     // ~150-160 chars
  heroBody: string;
  painTitle: string;
  pains: string[];             // the problems this service removes
  modulesTitle: string;
  modules: { title: string; body: string }[];
  faqs: { q: string; a: string }[];
  /** Optional plan-type grid (currently unused). */
  planTypes?: { name: string; body: string }[];
  /** A real deployment we can show — honest proof beats claimed numbers. */
  liveBuild?: {
    eyebrow: string; title: string; body: string;
    points: string[];
    links: { label: string; href: string }[];
  };
};

export const SERVICES: Service[] = [
  {
    slug: "ai-software",
    tag: "AI",
    name: "AI Applications & Agent Development",
    short: "Knowledge assistants, support agents, document workflows and business-specific AI tools connected to your data.",
    metaTitle: "AI Software Development Company — Shubhora",
    metaDescription: "Custom AI application and agent development: knowledge assistants, WhatsApp AI support, document automation and copilots built on your business data.",
    heroBody: "We build AI that does a specific job inside your business — answering customers on your website and WhatsApp, qualifying leads, reading documents, drafting follow-ups — always connected to your approved knowledge, never guessing in public.",
    painTitle: "Where AI actually pays for itself",
    pains: [
      "Customers ask the same 30 questions every day and a human answers each one by hand.",
      "Leads arrive at night and go cold before anyone replies.",
      "Quotations, reports and follow-up messages are typed fresh every time.",
    ],
    modulesTitle: "What we build",
    modules: [
      { title: "Customer-facing AI assistants", body: "Trained on your products, prices and policies. Answers in the customer's own language and hands hot leads to your team." },
      { title: "WhatsApp AI auto-reply", body: "24/7 first response, lead capture and follow-up on the number your customers already message." },
      { title: "Document intelligence", body: "Extract data from invoices, KYC documents, forms and reports into your systems automatically." },
      { title: "Lead qualification agents", body: "Score and route every enquiry, so your salespeople spend time only on buyers." },
      { title: "Internal copilots", body: "Staff-side assistants that draft replies, summarise history and pull answers from company knowledge." },
      { title: "AI content workflows", body: "On-brand product descriptions, ad copy and social posts generated with human approval steps." },
    ],
    faqs: [
      { q: "Will the AI give wrong answers to my customers?", a: "We train it only on knowledge you approve, add guard rules for what it must never claim, and route anything uncertain to a human. You review its behaviour before it goes live." },
      { q: "Which languages can the assistant reply in?", a: "It mirrors the customer's language automatically — English, Hindi, Hinglish and most major languages, in the same script the customer used." },
      { q: "Do I need my own ChatGPT or Claude account?", a: "No. The AI runs inside your system; you pay one predictable cost instead of managing API accounts yourself." },
      { q: "How long does an AI assistant take to launch?", a: "A trained assistant on your website and WhatsApp typically goes live in days, not months, because we start from a proven base and add your knowledge." },
    ],
  },
  {
    slug: "business-automation",
    tag: "Automation",
    name: "Business & Workflow Automation",
    short: "Replace repetitive work with connected approvals, alerts, follow-ups, reporting and API integrations.",
    metaTitle: "Business Automation Software — Shubhora",
    metaDescription: "Workflow automation for Indian businesses: lead routing, approvals, WhatsApp and email flows, payment reminders, reports and API integrations without manual work.",
    heroBody: "Most teams lose hours daily to copying data between tools, chasing approvals and remembering follow-ups. We connect your forms, sheets, apps, messages and payments so the work moves itself — and people only handle decisions.",
    painTitle: "The manual work we remove",
    pains: [
      "Enquiries are copied by hand from forms into sheets, then forgotten.",
      "Approvals travel over calls and chats with no record of who cleared what.",
      "Renewals, payments and follow-ups depend on someone's memory.",
    ],
    modulesTitle: "Automations we build",
    modules: [
      { title: "Lead routing & follow-up", body: "Every enquiry assigned, acknowledged and chased automatically until closed." },
      { title: "Approval workflows", body: "Purchase, leave, discount and document approvals with clear trails." },
      { title: "WhatsApp & email flows", body: "Welcome series, reminders, status updates and re-engagement on schedule." },
      { title: "Payment & renewal reminders", body: "Invoices, dues and subscription renewals chased without awkward calls." },
      { title: "Service-ticket automation", body: "Complaints logged, assigned, escalated and reported without a spreadsheet." },
      { title: "Scheduled reports", body: "The numbers that matter, delivered to owners daily — not requested weekly." },
    ],
    faqs: [
      { q: "Do we have to replace our current software?", a: "Usually no. Automation connects what you already use — forms, sheets, Tally exports, CRMs, WhatsApp — and replaces only the manual copying between them." },
      { q: "What does automation typically cost?", a: "It is scoped by workflow, not by seat. A single high-value workflow (like lead follow-up) is a small fixed project; a connected operations system is phased so cost follows value." },
      { q: "How do we know it is working?", a: "Every automation logs what it did. You see counts, failures and time saved on a dashboard instead of trusting that 'it runs'." },
      { q: "Can automation include AI decisions?", a: "Yes — AI can qualify leads, draft replies and summarise documents inside the flow, with human approval wherever money or commitments move." },
    ],
  },
  {
    slug: "crm-software",
    tag: "Operations",
    name: "CRM, Portals & Dashboards",
    short: "One operating view for leads, customers, teams, inventory, service, payments and management reporting.",
    metaTitle: "Custom CRM Software Development — Shubhora",
    metaDescription: "Custom CRM, portals and dashboards: pipelines, follow-ups, customer history, team tasks and management reports built around how your business actually sells.",
    heroBody: "A CRM only works when it matches how your team actually sells. We build pipelines, follow-up discipline, customer history and management reporting around your process — not a generic tool your team stops filling after a month.",
    painTitle: "Signs your business has outgrown spreadsheets",
    pains: [
      "Nobody can say how many live deals exist or what stage they are in.",
      "Customer history lives in individual phones and leaves with the employee.",
      "Owners get numbers weekly, from memory, instead of live from the system.",
    ],
    modulesTitle: "What the system covers",
    modules: [
      { title: "Sales pipeline", body: "Stages, values, next actions and overdue follow-ups that actually get chased." },
      { title: "Customer 360", body: "Every call note, order, payment and complaint on one customer page." },
      { title: "Team tasks & targets", body: "Who is doing what, against which target, visible without asking." },
      { title: "Customer & partner portals", body: "Self-service views for orders, statements, tickets and documents." },
      { title: "Inventory & service", body: "Stock, AMC, warranties and service visits tied to the same records." },
      { title: "Owner dashboards", body: "Sales, collections, service and team performance — live, not month-end." },
    ],
    faqs: [
      { q: "Our team never fills CRMs. How is this different?", a: "We design entry to take seconds (or happen automatically from WhatsApp and forms), and make the CRM the place work is assigned — so using it is easier than avoiding it." },
      { q: "Can it work with Tally / our billing software?", a: "Yes. We integrate or import from existing billing, accounting and inventory tools so records stay consistent instead of duplicated." },
      { q: "Is our data safe with role-based access?", a: "Yes — roles decide who sees which customers, columns and reports; exports can be restricted; and every sensitive action is logged." },
      { q: "Web, mobile or both?", a: "Both. The same system runs as a responsive web app and installable mobile experience, so field teams and office teams share one truth." },
    ],
  },
  {
    slug: "whatsapp-automation",
    tag: "Conversations",
    name: "WhatsApp Automation for Business",
    short: "Multi-user auto-reply, lead capture, follow-up flows and AI-assisted customer conversations.",
    metaTitle: "WhatsApp Automation & AI Chatbot — Shubhora",
    metaDescription: "WhatsApp automation for business: AI auto-reply on your own number, lead capture, hot-lead alerts and follow-up flows that turn chats into customers.",
    heroBody: "Your customers already live on WhatsApp. We make your number answer instantly — in the customer's language, with your real product knowledge — capture every lead, alert you when a buyer is hot, and follow up until the deal closes.",
    painTitle: "What unanswered WhatsApp costs you",
    pains: [
      "Enquiries at night get replies next afternoon — after the customer bought elsewhere.",
      "Every conversation lives in one phone; the business has no record of it.",
      "Follow-ups stop after one message because nobody tracks who to chase.",
    ],
    modulesTitle: "The system in parts",
    modules: [
      { title: "AI auto-reply", body: "Instant first response with your prices, offers and FAQs — in the customer's own language." },
      { title: "Per-user connections", body: "Every team member or card holder links their own number separately — no shared inbox chaos." },
      { title: "Lead capture", body: "Every new chat becomes a lead record with source, message and status automatically." },
      { title: "Hot-lead alerts", body: "When intent is high, the owner gets pinged immediately with context." },
      { title: "Follow-up flows", body: "Scheduled, polite persistence that stops the moment the customer replies." },
      { title: "Campaign attribution", body: "Know which ad or card produced which WhatsApp conversation and sale." },
    ],
    faqs: [
      { q: "Does this need the official WhatsApp Business API?", a: "No — it runs on your existing number through secure device linking, like WhatsApp Web. For high-volume broadcast use cases we also build on the official API." },
      { q: "Will it reply to my personal chats?", a: "No. Rules decide what it answers, it ignores your own outgoing messages, and you can pause it any time from your dashboard." },
      { q: "Can multiple team members each have their own auto-reply?", a: "Yes — each signed-in user links their own WhatsApp with an isolated session, knowledge and follow-up queue. Nothing is shared between accounts." },
      { q: "What happens to the leads it captures?", a: "They land in your CRM pipeline with the full first message, get AI-scored, and enter follow-up — nothing depends on someone remembering to save a number." },
    ],
  },
  {
    slug: "web-mobile-apps",
    tag: "Custom build",
    name: "Website & Mobile App Development",
    short: "Secure customer apps, internal tools, SaaS platforms, PWA experiences and integrations built around your process.",
    metaTitle: "Web & Mobile App Development — Shubhora",
    metaDescription: "Custom website and app development: business websites, customer apps, PWAs, SaaS platforms and internal tools with payments, logins and admin panels.",
    heroBody: "From a fast business website that actually ranks, to a full customer app with logins, payments and an admin panel — we build software that is secure, quick to load and easy for your team to run without a developer on call.",
    painTitle: "What we replace",
    pains: [
      "A template website that looks like everyone else's and converts nobody.",
      "An app idea stuck in quotations for months with no working first version.",
      "Internal tools held together by one spreadsheet only one person understands.",
    ],
    modulesTitle: "Build types",
    modules: [
      { title: "Business websites", body: "Fast, SEO-ready sites with enquiry capture, WhatsApp integration and analytics." },
      { title: "Customer web apps", body: "Logins, profiles, bookings, orders and payments on any device." },
      { title: "Progressive web apps", body: "Installable app experiences without app-store friction or double budgets." },
      { title: "SaaS platforms", body: "Multi-tenant products with plans, billing, trials and admin control — like our own Shubhora Cards." },
      { title: "Internal tools", body: "Purpose-built operations screens that replace fragile spreadsheets." },
      { title: "APIs & integrations", body: "Payment gateways, logistics, ERPs, government portals and legacy systems connected cleanly." },
    ],
    faqs: [
      { q: "How fast can a first version go live?", a: "We scope the smallest useful release first — typically weeks, not months — then grow it in modules while it is already working for you." },
      { q: "Who owns the code and data?", a: "You do. The system runs on infrastructure in your name wherever possible, and you receive access and documentation — no lock-in by design." },
      { q: "Do you also handle hosting and maintenance?", a: "Yes — deployment, SSL, backups, monitoring and updates can be part of the engagement so you never chase a separate vendor." },
      { q: "Can AI features be added to our app?", a: "Yes. Assistants, document reading, smart search and content generation plug into the same build — see our AI development service." },
    ],
  },
  {
    slug: "social-media-management",
    tag: "Growth",
    name: "Social Media Management & Marketing",
    short: "Account handling, AI-assisted content, posting calendars and ad campaigns that turn followers into enquiries.",
    metaTitle: "Social Media Management Company — Shubhora",
    metaDescription: "Social media account management: profile setup, AI-assisted content calendars, consistent posting, and Facebook/Instagram/Google ads measured to actual leads.",
    heroBody: "Most businesses post for a week and stop. We run your profiles like an operation — a content calendar that ships on schedule, creatives your brand can be proud of, and ads measured all the way to WhatsApp enquiries, not just likes.",
    painTitle: "Why business pages go quiet",
    pains: [
      "Nobody in the team has time to design, write and post consistently.",
      "Boosted posts spend money but nobody can connect them to actual sales.",
      "The page looks abandoned, which quietly costs trust with every visitor who checks.",
    ],
    modulesTitle: "What the service includes",
    modules: [
      { title: "Profile setup & branding", body: "Consistent naming, bios, highlights, covers and link-in-bio across platforms." },
      { title: "Content calendar", body: "A planned monthly mix of product, proof, education and offers — approved by you, then shipped on schedule." },
      { title: "AI-assisted creatives", body: "On-brand posts, reels scripts and ad copy produced fast, reviewed by humans." },
      { title: "Ad campaigns", body: "Facebook, Instagram and Google campaigns pointed at WhatsApp and lead forms." },
      { title: "Lead-first tracking", body: "Every campaign tagged, so you see which post produced which enquiry — the same attribution engine as our card platform." },
      { title: "Monthly review", body: "Plain-language reporting: what ran, what it cost, what it brought, what changes next month." },
    ],
    faqs: [
      { q: "Which platforms do you manage?", a: "Facebook, Instagram, Google Business Profile and LinkedIn are the usual core; YouTube and others are added where your customers actually are." },
      { q: "Do you also run the ads or just post?", a: "Both. Organic posting keeps the profile alive; managed ad campaigns bring enquiries. We report them together so you see one cost per lead." },
      { q: "Will you need my account passwords?", a: "No. Platforms support proper access sharing (Meta Business partner access, manager roles) so you keep ownership and can revoke access any time." },
      { q: "How do I know it is bringing business?", a: "Campaign links carry tracking into WhatsApp and lead forms, so the monthly report shows enquiries and cost per enquiry — not just reach and likes." },
    ],
  },
];

export function getService(slug: string): Service | undefined {
  return SERVICES.find((s) => s.slug === slug);
}
