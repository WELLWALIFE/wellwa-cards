// "Become a franchise" (owner, 1 Nov 2026): the application a person sends from shubhora.com/franchise, reviewed by Super Admin.
// Pure module, shared by the website form, the public API and the admin panel. Table: migration 0080.
export type ApplicationStatus = "new" | "contacted" | "approved" | "rejected";
export type FranchiseApplication = {
  id: string; name: string; phone: string; email: string; company: string; city: string; state: string; area: string;
  background: string; reach: string; source: string; status: ApplicationStatus; note: string; franchise_id: string | null;
  decided_by: string | null; decided_at: string | null; created_at: string; updated_at: string;
};
export const APP_COLS = "id,name,phone,email,company,city,state,area,background,reach,source,status,note,franchise_id,decided_by,decided_at,created_at,updated_at";

export const STATUS_LABEL: Record<ApplicationStatus, { label: string; tone: "warn" | "brand" | "good" | "danger" }> = {
  new: { label: "New", tone: "warn" }, contacted: { label: "Contacted", tone: "brand" }, approved: { label: "Approved", tone: "good" }, rejected: { label: "Rejected", tone: "danger" },
};

/** What the franchise gets — one list, used on the website page and in the approval message. */
export const FRANCHISE_OFFER = [
  { title: "Your own territory", text: "A city or district is yours: every business you bring signs up on your link and stays your customer." },
  { title: "Commission on every payment", text: "A percent of each payment your customers ever make — the first one and every renewal — on the amount without GST." },
  { title: "Your franchise panel", text: "Your users, their plans, your earnings and payouts, live. Payment links for any amount, so you never chase money by hand." },
  { title: "A product that sells itself", text: "V-Card free for a year, a website in minutes, posters, WhatsApp AI and business modules — a demo on the customer's own phone closes the deal." },
  { title: "Zero stock, zero office", text: "Nothing to buy or store. A phone, your contacts and the demo link are the whole kit." },
  { title: "Training and support", text: "Onboarding call, sales material, and the Shubhora team behind you on WhatsApp for every customer question." },
];

export const FRANCHISE_STEPS = [
  { title: "Apply", text: "Two minutes: who you are, your city, what you do today." },
  { title: "We call you", text: "Within 2 working days: the territory, the commission and how it works." },
  { title: "Approval", text: "Shubhora approves the franchise and makes your login and your sign-up link." },
  { title: "Start", text: "Log in, share your link, bring the first customer. Earnings show the same day." },
];

export const FRANCHISE_FAQ = [
  { q: "Is there a franchise fee?", a: "The terms are agreed on the call and written into your franchise profile before approval. There is no stock to buy and no monthly charge for the panel." },
  { q: "Who collects the money?", a: "The customer pays Shubhora directly (online). Your commission is credited to your franchise account automatically and paid out to your bank or UPI on request." },
  { q: "Is this a multi-level or referral scheme?", a: "No. A franchise earns only on the businesses it brings. There is no team, no levels and no joining fee for your customers." },
  { q: "Can I do it part-time?", a: "Yes. Many franchises are agencies, printers, CAs or shop owners who already meet local businesses every day." },
  { q: "Do I need technical skills?", a: "No. The customer builds the card and website themselves in minutes, and Shubhora support helps them. You bring the customer and show the demo." },
];
