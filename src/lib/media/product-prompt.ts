// What a product IS, for the AI that draws it (owner, 19 Oct 2026: "AI ko product kya hai, actual me wo hi banana chahiye" — a software plan
// came out as a speaker). A software / digital product is shown in use on a screen, never as a made-up gadget.
const DIGITAL = /shubhora|software|digital|\bapp\b|website|online|saas|subscription|service|\bplan\b|seo|assistant|v-?card|visiting card/i;

export const isDigitalProduct = (name: string, category = "", brand = "", about = "") => DIGITAL.test(`${name} ${category} ${brand} ${about}`);

/** The brand, category and the owner's own lines, in one clause for the prompt. */
export const productDetail = (brand = "", category = "", about = "") =>
  [brand && `brand: ${brand}`, category && `category: ${category}`, about && `what it is: ${about}`].filter(Boolean).join("; ");

export const digitalProductPrompt = (name: string, detail: string) =>
  `Photorealistic modern marketing photograph of a DIGITAL product, "${name}"${detail ? ` (${detail})` : ""}. It is software, not a physical object: show it IN USE on a smartphone screen held in a hand (a laptop beside it is fine), the screen showing a clean modern app or website interface that fits the product (for a digital business card: a profile card with photo, name and call/WhatsApp buttons; for a website product: a business website; for an AI assistant: a WhatsApp-style chat). Indian small-business setting, bright and tidy, soft natural daylight, shallow depth of field. Readable, believable UI; no gibberish text, no logos of other companies, no random gadgets, speakers, cameras or appliances.`;
