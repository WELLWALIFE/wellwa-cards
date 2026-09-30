// Premium product poster PoC: Gemini composes an agency-style ad scene around
// the REAL product photo + logo (both passed as reference images), a vision
// pass checks the product/logo/text fidelity, sharp adds the identity footer.
import fs from "node:fs"; import path from "node:path"; import sharp from "sharp";
const APP = "/opt/neuraledge/app";
const env = { ...process.env }; for (const l of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !(m[1] in process.env)) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const KEY = env.GEMINI_API_KEY;
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith("--") ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : "1"] : []).filter((x) => x.length));
const OUT = args.out || "/tmp/prodart"; fs.mkdirSync(OUT, { recursive: true });
async function gemini(model, body) { const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: "POST", headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json(); if (j.error) throw new Error(j.error.message); return j; }
const img = (buf, mime) => ({ inlineData: { mimeType: mime, data: buf.toString("base64") } });

const product = { name: args.name || "Wellwa Aura Maxx", tag: args.tag || "Advanced Hydrogen Water Ionizer", photo: args.photo || "public/wellwa/images/aura-maxx.webp", features: ["Hydrogen Rich Water", "Alkaline Balance", "Powerful Antioxidant", "Better Hydration"], headline: args.headline || "More Than Just Water… It's Better Living" };
const photo = await sharp(path.join(APP, product.photo)).png().toBuffer();
const logo = await sharp(path.join(APP, "public/wellwa/images/wellwa-logo.png")).png().toBuffer();

const prompt = `Design a premium, print-quality advertising poster (portrait 3:4) for the product in the FIRST reference image, using the brand logo in the SECOND reference image.
STRICT: the product must look EXACTLY like the reference photo — same shape, same white body, same black panel, same display and buttons, same hose. Do not redesign it, do not add extra units. Place it as the hero on the right, on a clean marble kitchen counter with a soft splash of crystal-clear water and a glass of sparkling water beside it. Reproduce the logo faithfully (same letterforms and blue gradient) at the top-left.
Background: bright modern Indian kitchen, soft daylight, shallow depth of field, blues and whites, a smiling Indian family (husband, wife, child) drinking water on the left, slightly out of focus.
Typography (render clearly, English only, exact spelling): top-right the product name "${product.name}" with subtitle "${product.tag}"; on the left the headline "${product.headline}"; below it a row of four round icons labelled exactly: "${product.features[0]}", "${product.features[1]}", "${product.features[2]}", "${product.features[3]}". Leave the bottom 18% of the poster as a clean deep-blue wave band with NO text (a footer will be added later). No other text, no watermark, no phone numbers.`;

let art, tries = 0, verdict = "";
while (tries < 3 && !art) {
  tries++;
  const j = await gemini("gemini-2.5-flash-image", { contents: [{ parts: [img(photo, "image/png"), img(logo, "image/png"), { text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "3:4" } } });
  const p = (j.candidates?.[0]?.content?.parts ?? []).find((x) => x.inlineData?.data); if (!p) { console.log("no image"); continue; }
  const cand = Buffer.from(p.inlineData.data, "base64"); fs.writeFileSync(path.join(OUT, `try${tries}.png`), cand);
  const q = await gemini("gemini-3.5-flash-lite", { contents: [{ parts: [img(photo, "image/png"), img(cand, "image/png"), { text: `Image 1 is the real product. Image 2 is an ad poster. Answer in JSON {"product_match":0-10,"text_ok":true/false,"issues":"..."}: does the product in image 2 match image 1 closely (shape, colours, panel)? Is all visible text spelled correctly and does it include "${product.name}" and "${product.headline.split("…")[0].trim()}"? Any phone numbers or garbled words = text_ok false.` }] }], generationConfig: { responseMimeType: "application/json", temperature: 0 } });
  verdict = q.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}"; console.log(`try ${tries}:`, verdict.slice(0, 200));
  let v = {}; try { v = JSON.parse(verdict); } catch {}
  if ((v.product_match ?? 0) >= 7 && v.text_ok !== false) art = cand;
}
if (!art) { art = fs.readFileSync(path.join(OUT, `try${tries}.png`)); console.log("using last try despite QA"); }

// identity footer (sharp): name, company, phone on the reserved band + logo
const W = 1080, H = 1440;
const base = await sharp(art).resize(W, H, { fit: "cover" }).png().toBuffer();
const DEV = "Noto Sans Devanagari, sans-serif", LAT = "Liberation Sans, DejaVu Sans, Arial, sans-serif";
const svg = `<svg width="${W}" height="${H}"><rect y="${H - 230}" width="${W}" height="230" fill="#062a5c" fill-opacity="0.55"/>
<text x="70" y="${H - 140}" font-family="${LAT}" font-size="52" font-weight="800" fill="#fff">Joginder Yadav</text>
<text x="70" y="${H - 92}" font-family="${LAT}" font-size="30" fill="#dbeafe">Wellwa Life India Pvt. Ltd.</text>
<rect x="${W - 470}" y="${H - 168}" width="400" height="86" rx="43" fill="#ffffff"/>
<text x="${W - 270}" y="${H - 132}" text-anchor="middle" font-family="${LAT}" font-size="22" font-weight="700" fill="#1d4ed8">CALL / WHATSAPP NOW</text>
<text x="${W - 270}" y="${H - 96}" text-anchor="middle" font-family="${LAT}" font-size="34" font-weight="900" fill="#062a5c">8708275430</text>
<text x="70" y="${H - 40}" font-family="${LAT}" font-size="24" fill="#bfdbfe">www.wellwalife.com</text></svg>`;
await sharp(base).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).jpeg({ quality: 90 }).toFile(path.join(OUT, "poster.jpg"));
console.log("DONE", path.join(OUT, "poster.jpg"), "tries", tries);
