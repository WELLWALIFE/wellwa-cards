import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const TMP = "/Users/jsrao/Desktop/Wellwa Life/wellwa-cards/work/wellwa-deck";
const OUT = "/Users/jsrao/Desktop/Wellwa Life/wellwa-cards/public/wellwa/docs/Wellwa-Business-Opportunity.pptx";
const ASSET = (name) => path.join(TMP, "assets", name);

const C = {
  navy: "#102A43",
  teal: "#0E9E90",
  tealDark: "#08766D",
  tealPale: "#DFF4F1",
  copper: "#B87333",
  ink: "#12212B",
  muted: "#536471",
  cream: "#F8F6F1",
  white: "#FFFFFF",
  line: "#D9E3E7",
};

async function bytes(name) {
  const b = await fs.readFile(ASSET(name));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}

async function writeBlob(file, blob) {
  await fs.writeFile(file, new Uint8Array(await blob.arrayBuffer()));
}

function box(slide, name, position, fill = C.white, line = "none", radius = 24) {
  return slide.shapes.add({
    geometry: "roundRect",
    name,
    position,
    fill,
    line: { style: "solid", fill: line, width: line === "none" ? 0 : 1 },
    borderRadius: radius,
  });
}

function text(slide, name, value, position, style = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name,
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = value;
  shape.text.style = {
    fontFamily: "Aptos",
    fontSize: 20,
    color: C.ink,
    ...style,
  };
  return shape;
}

function title(slide, value, kicker) {
  if (kicker) text(slide, "kicker", kicker.toUpperCase(), { left: 72, top: 42, width: 430, height: 24 }, { fontSize: 14, bold: true, color: C.tealDark, letterSpacing: 1.5 });
  text(slide, "slide-title", value, { left: 72, top: 75, width: 1136, height: 58 }, { fontSize: 38, bold: true, color: C.navy });
}

function footer(slide, page) {
  text(slide, `footer-${page}`, `WELLWA LIFE  •  BUSINESS OPPORTUNITY OVERVIEW                                   ${String(page).padStart(2, "0")}`, { left: 72, top: 678, width: 1136, height: 18 }, { fontSize: 10, color: "#7A8A96" });
}

function notes(slide, sources, note = "") {
  slide.speakerNotes.textFrame.setText(`${note}${note ? "\n\n" : ""}[Sources]\n${sources.map((s) => `- ${s}`).join("\n")}`);
}

async function addImage(slide, name, file, position, fit = "cover", alt = "") {
  return slide.images.add({
    blob: await bytes(file),
    contentType: "image/png",
    alt,
    fit,
    position,
    geometry: "roundRect",
    borderRadius: 22,
  });
}

async function main() {
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.mkdir(path.join(TMP, "rendered"), { recursive: true });
  const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });

  // 1 — cover
  {
    const s = deck.slides.add();
    s.background.fill = C.navy;
    await addImage(s, "cover-photo", "aura-plus-kitchen-hero.png", { left: 580, top: 0, width: 700, height: 720 }, "cover", "Wellwa Aura Plus in a modern kitchen");
    s.shapes.add({ geometry: "rect", name: "cover-overlay", position: { left: 520, top: 0, width: 760, height: 720 }, fill: { color: C.navy, transparency: 38 }, line: { style: "solid", fill: "none", width: 0 } });
    box(s, "brand-chip", { left: 72, top: 64, width: 210, height: 44 }, C.white, "none", 18);
    await addImage(s, "logo", "wellwa-logo.png", { left: 94, top: 72, width: 166, height: 28 }, "contain", "Wellwa Life logo");
    text(s, "cover-title", "Smart water.\nConnected care.", { left: 72, top: 184, width: 500, height: 170 }, { fontSize: 58, bold: true, color: C.white });
    text(s, "cover-subtitle", "Wellwa distributor business opportunity overview", { left: 74, top: 380, width: 440, height: 76 }, { fontSize: 25, color: "#D8ECEA" });
    text(s, "cover-note", "Product-led • Demo-led • Service-supported", { left: 74, top: 548, width: 430, height: 30 }, { fontSize: 16, bold: true, color: "#8DDDD3" });
    text(s, "cover-date", "Verified product information • August 2026", { left: 74, top: 626, width: 390, height: 22 }, { fontSize: 12, color: "#B6C7D1" });
    notes(s, ["https://wellwalife.com/", "Official Wellwa asset: /images/wellwa-aura-plus-kitchen-hero.webp"]);
  }

  // 2 — customer proposition
  {
    const s = deck.slides.add(); s.background.fill = C.cream; title(s, "The proposition begins with a better consultation", "Customer first");
    await addImage(s, "consultation", "home-demo-consultation.png", { left: 72, top: 158, width: 620, height: 440 }, "cover", "Illustrative home water consultation");
    text(s, "lead", "A responsible distributor helps a household make an informed choice—not a medical promise.", { left: 736, top: 178, width: 455, height: 104 }, { fontSize: 28, bold: true, color: C.navy });
    const points = [
      ["01", "Review the source water", "City, source, TDS, hardness and pre-filtration affect compatibility."],
      ["02", "Compare the right model", "Use household size, daily usage and desired connected features."],
      ["03", "Set expectations clearly", "Published output varies with water quality, temperature, flow and calibration."],
    ];
    points.forEach(([n, h, b], i) => {
      const y = 314 + i * 98;
      text(s, `num-${i}`, n, { left: 736, top: y, width: 44, height: 28 }, { fontSize: 18, bold: true, color: C.copper });
      text(s, `head-${i}`, h, { left: 792, top: y - 3, width: 390, height: 30 }, { fontSize: 20, bold: true, color: C.ink });
      text(s, `body-${i}`, b, { left: 792, top: y + 30, width: 390, height: 50 }, { fontSize: 16, color: C.muted });
    });
    footer(s, 2);
    notes(s, ["https://wellwalife.com/", "OpenAI-generated illustrative asset: home-demo-consultation.png"], "The image is illustrative and does not depict a named customer or an actual Wellwa demo.");
  }

  // 3 — product line
  {
    const s = deck.slides.add(); s.background.fill = C.white; title(s, "Four entry points serve different household needs", "Product range");
    const products = [
      { img: "nmd-drops.png", name: "Starter Pack", meta: "Wellness starter", price: "₹11,800", badge: "START HERE" },
      { img: "aura-5.png", name: "Aura", meta: "Smart 5-plate ionizer", price: "₹90,000", badge: "ESSENTIAL" },
      { img: "aura-plus-7.png", name: "Aura Plus", meta: "Smart 7-plate ionizer", price: "₹1,25,000", badge: "MOST POPULAR" },
      { img: "aura-maxx.png", name: "Aura Maxx", meta: "Smart 8-plate ionizer", price: "₹1,50,000", badge: "MAX PERFORMANCE" },
    ];
    for (let i = 0; i < products.length; i++) {
      const p = products[i], x = 72 + i * 292;
      box(s, `product-bg-${i}`, { left: x, top: 160, width: 268, height: 448 }, i === 2 ? C.tealPale : C.cream, i === 2 ? C.teal : C.line, 24);
      await addImage(s, `product-image-${i}`, p.img, { left: x + 24, top: 186, width: 220, height: 220 }, "contain", p.name);
      text(s, `product-badge-${i}`, p.badge, { left: x + 24, top: 426, width: 220, height: 20 }, { fontSize: 11, bold: true, color: i === 2 ? C.tealDark : C.copper, alignment: "center" });
      text(s, `product-name-${i}`, p.name, { left: x + 20, top: 458, width: 228, height: 36 }, { fontSize: 24, bold: true, color: C.navy, alignment: "center" });
      text(s, `product-meta-${i}`, p.meta, { left: x + 18, top: 501, width: 232, height: 26 }, { fontSize: 14, color: C.muted, alignment: "center" });
      text(s, `product-price-${i}`, p.price, { left: x + 20, top: 550, width: 228, height: 30 }, { fontSize: 22, bold: true, color: C.tealDark, alignment: "center" });
    }
    text(s, "price-note", "Published retail prices shown. Confirm current stock, tax, installation and commercial terms before sale.", { left: 72, top: 624, width: 1136, height: 28 }, { fontSize: 13, color: C.muted, alignment: "center" });
    footer(s, 3);
    notes(s, ["https://wellwalife.com/", "https://wellwalife.com/products", "Official Wellwa product image assets under https://wellwalife.com/products/"]);
  }

  // 4 — comparison
  {
    const s = deck.slides.add(); s.background.fill = C.cream; title(s, "Model choice is a fit decision—not a ranking", "Aura comparison");
    const cols = [72, 430, 788];
    const models = [
      ["AURA", "5 plates", "4.0–10.0+", "Up to −750 mV", "Up to 1,500 ppb", "Compact everyday use"],
      ["AURA PLUS", "7 plates", "3.5–10.5+", "Up to −800 mV", "Up to 1,600 ppb", "Balanced family flagship"],
      ["AURA MAXX", "8 plates", "3.0–11.0+", "Up to −850 mV", "Up to 1,800 ppb", "Larger families / high usage"],
    ];
    models.forEach((m, i) => {
      const x = cols[i]; box(s, `model-${i}`, { left: x, top: 158, width: 320, height: 440 }, i === 1 ? C.navy : C.white, i === 1 ? C.navy : C.line, 24);
      text(s, `model-name-${i}`, m[0], { left: x + 28, top: 190, width: 264, height: 32 }, { fontSize: 24, bold: true, color: i === 1 ? C.white : C.navy });
      text(s, `model-fit-${i}`, m[5], { left: x + 28, top: 232, width: 264, height: 48 }, { fontSize: 16, color: i === 1 ? "#C9DCDF" : C.muted });
      const rows = [["Electrolysis", m[1]], ["Published pH", m[2]], ["ORP estimate", m[3]], ["Hydrogen H₂", m[4]]];
      rows.forEach((r, j) => {
        const y = 314 + j * 62;
        text(s, `label-${i}-${j}`, r[0], { left: x + 28, top: y, width: 122, height: 24 }, { fontSize: 13, color: i === 1 ? "#A9BEC4" : C.muted });
        text(s, `value-${i}-${j}`, r[1], { left: x + 150, top: y - 2, width: 142, height: 26 }, { fontSize: 16, bold: true, color: i === 1 ? C.white : C.ink, alignment: "right" });
      });
    });
    text(s, "variation-note", "Actual pH, ORP and dissolved hydrogen vary with source water, mineral content, temperature, flow rate and calibration.", { left: 72, top: 622, width: 1036, height: 38 }, { fontSize: 13, color: C.muted });
    footer(s, 4);
    notes(s, ["https://wellwalife.com/", "https://wellwalife.com/compare"]);
  }

  // 5 — connected care
  {
    const s = deck.slides.add(); s.background.fill = C.navy;
    text(s, "kicker", "TECHNOLOGY", { left: 72, top: 42, width: 430, height: 24 }, { fontSize: 14, bold: true, color: "#8DDDD3", letterSpacing: 1.5 });
    text(s, "slide-title", "Connected care extends the relationship after installation", { left: 72, top: 75, width: 1136, height: 58 }, { fontSize: 38, bold: true, color: C.white });
    const features = [
      ["Remote controls", "Start, stop and choose supported water modes."],
      ["Live machine health", "Connection, operating state and care alerts."],
      ["Remote diagnostics", "Service teams can review supported telemetry."],
      ["OTA-ready updates", "Supported firmware can be maintained remotely."],
    ];
    features.forEach((f, i) => {
      const x = 72 + (i % 2) * 570, y = 175 + Math.floor(i / 2) * 205;
      box(s, `feature-${i}`, { left: x, top: y, width: 530, height: 170 }, i === 0 ? C.teal : "#173B58", i === 0 ? C.teal : "#2F5068", 24);
      text(s, `feature-num-${i}`, `0${i + 1}`, { left: x + 28, top: y + 24, width: 48, height: 32 }, { fontSize: 18, bold: true, color: i === 0 ? C.white : "#82D9D0" });
      text(s, `feature-head-${i}`, f[0], { left: x + 92, top: y + 26, width: 380, height: 34 }, { fontSize: 24, bold: true, color: C.white });
      text(s, `feature-body-${i}`, f[1], { left: x + 92, top: y + 75, width: 380, height: 58 }, { fontSize: 17, color: i === 0 ? "#E4FFFB" : "#CBD9E2" });
    });
    text(s, "wifi-note", "Guided setup uses a compatible 2.4 GHz Wi‑Fi network. The machine’s water function and supported app features should be explained separately.", { left: 72, top: 610, width: 1080, height: 44 }, { fontSize: 14, color: "#AFC4CE" });
    footer(s, 5);
    notes(s, ["https://wellwalife.com/", "https://wellwalife.com/technology"]);
  }

  // 6 — journey
  {
    const s = deck.slides.add(); s.background.fill = C.white; title(s, "A clear ownership journey builds trust", "Customer experience");
    const steps = [
      ["01", "Water review", "Source, usage and compatibility"],
      ["02", "Model consultation", "Compare the Aura range"],
      ["03", "Installation", "Plumbing, setup and handover"],
      ["04", "Connected care", "App pairing, alerts and support"],
    ];
    s.shapes.add({ geometry: "line", name: "journey-line", position: { left: 168, top: 318, width: 940, height: 0 }, fill: "none", line: { style: "solid", fill: C.line, width: 4 } });
    steps.forEach((st, i) => {
      const x = 72 + i * 292;
      const circle = s.shapes.add({ geometry: "ellipse", name: `step-dot-${i}`, position: { left: x + 76, top: 272, width: 92, height: 92 }, fill: i === 3 ? C.teal : C.navy, line: { style: "solid", fill: C.white, width: 6 } });
      circle.text = st[0]; circle.text.style = { fontFamily: "Aptos", fontSize: 22, bold: true, color: C.white, alignment: "center", verticalAlignment: "middle" };
      text(s, `step-head-${i}`, st[1], { left: x, top: 398, width: 244, height: 34 }, { fontSize: 22, bold: true, color: C.navy, alignment: "center" });
      text(s, `step-body-${i}`, st[2], { left: x + 8, top: 444, width: 228, height: 66 }, { fontSize: 16, color: C.muted, alignment: "center" });
    });
    box(s, "journey-callout", { left: 205, top: 546, width: 870, height: 76 }, C.tealPale, "none", 20);
    text(s, "journey-callout-text", "The distributor owns the education and follow-up; trained service teams own technical installation and diagnostics.", { left: 250, top: 566, width: 780, height: 38 }, { fontSize: 18, bold: true, color: C.tealDark, alignment: "center" });
    footer(s, 6);
    notes(s, ["https://wellwalife.com/"]);
  }

  // 7 — distributor role
  {
    const s = deck.slides.add(); s.background.fill = C.cream; title(s, "The distributor role is local, practical and relationship-led", "Business model");
    await addImage(s, "training", "distributor-training.png", { left: 72, top: 158, width: 600, height: 446 }, "cover", "Illustrative distributor training session");
    const roles = [
      ["Educate", "Explain the product, water compatibility and connected features accurately."],
      ["Demonstrate", "Arrange consultations and product demonstrations where available."],
      ["Convert", "Help the household select a model and complete the official buying process."],
      ["Follow up", "Support app adoption, care reminders and service escalation."],
    ];
    roles.forEach((r, i) => {
      const y = 164 + i * 108;
      text(s, `role-head-${i}`, r[0], { left: 732, top: y, width: 170, height: 34 }, { fontSize: 23, bold: true, color: C.navy });
      text(s, `role-body-${i}`, r[1], { left: 902, top: y, width: 290, height: 68 }, { fontSize: 16, color: C.muted });
    });
    box(s, "compliance", { left: 732, top: 596, width: 460, height: 56 }, C.white, C.line, 16);
    text(s, "compliance-text", "No medical claims • No guaranteed income • Written terms only", { left: 752, top: 613, width: 420, height: 24 }, { fontSize: 14, bold: true, color: C.tealDark, alignment: "center" });
    footer(s, 7);
    notes(s, ["https://wellwalife.com/distributor/apply", "OpenAI-generated illustrative asset: distributor-training.png"], "The image is illustrative and does not depict a named distributor or an actual Wellwa event.");
  }

  // 8 — launch plan
  {
    const s = deck.slides.add(); s.background.fill = C.white; title(s, "Start with capability before scale", "90-day launch path");
    const phases = [
      ["DAYS 1–15", "Learn", "Product range\nWater-source basics\nClaims & compliance"],
      ["DAYS 16–30", "Practice", "Demo script\nObjection handling\nCRM follow-up"],
      ["DAYS 31–60", "Activate", "Local consultations\nReferral partners\nWeekly content"],
      ["DAYS 61–90", "Improve", "Review funnel\nStrengthen follow-up\nEscalate service well"],
    ];
    phases.forEach((p, i) => {
      const x = 72 + i * 292;
      box(s, `phase-${i}`, { left: x, top: 176, width: 268, height: 374 }, i === 0 ? C.navy : C.cream, i === 0 ? C.navy : C.line, 22);
      text(s, `phase-time-${i}`, p[0], { left: x + 26, top: 204, width: 216, height: 22 }, { fontSize: 12, bold: true, color: i === 0 ? "#8DDDD3" : C.copper });
      text(s, `phase-name-${i}`, p[1], { left: x + 26, top: 252, width: 216, height: 46 }, { fontSize: 32, bold: true, color: i === 0 ? C.white : C.navy });
      text(s, `phase-body-${i}`, p[2], { left: x + 26, top: 332, width: 216, height: 132 }, { fontSize: 18, color: i === 0 ? "#D4E1E7" : C.muted });
    });
    text(s, "terms-note", "Before investing, request the current official agreement, fees, margin/commission schedule, returns policy, territory rules and support commitments in writing.", { left: 130, top: 590, width: 1020, height: 54 }, { fontSize: 17, bold: true, color: C.tealDark, alignment: "center" });
    footer(s, 8);
    notes(s, ["https://wellwalife.com/distributor/apply"], "This launch path is a practical operating recommendation, not an official compensation plan or earnings projection.");
  }

  // 9 — close
  {
    const s = deck.slides.add(); s.background.fill = C.tealDark;
    text(s, "close-kicker", "NEXT STEP", { left: 72, top: 78, width: 250, height: 24 }, { fontSize: 14, bold: true, color: "#B8F1EB" });
    text(s, "close-title", "Experience the product.\nThen evaluate the business.", { left: 72, top: 142, width: 650, height: 160 }, { fontSize: 50, bold: true, color: C.white });
    text(s, "close-body", "Book a product consultation, review the Aura range, and request the current official distributor terms before making a decision.", { left: 72, top: 340, width: 590, height: 90 }, { fontSize: 22, color: "#D9F2EF" });
    box(s, "contact-box", { left: 72, top: 498, width: 570, height: 118 }, C.white, "none", 22);
    text(s, "contact", "wellwalife.com/distributor/apply\n+91 74109 95599  •  info@wellwalife.com", { left: 102, top: 526, width: 510, height: 64 }, { fontSize: 20, bold: true, color: C.navy });
    await addImage(s, "close-product", "aura-plus-7.png", { left: 800, top: 100, width: 370, height: 520 }, "contain", "Wellwa Aura Plus");
    notes(s, ["https://wellwalife.com/", "https://wellwalife.com/distributor/apply"]);
  }

  // Per-slide render and structural output.
  for (const [index, slide] of deck.slides.items.entries()) {
    const n = String(index + 1).padStart(2, "0");
    await writeBlob(path.join(TMP, "rendered", `slide-${n}.png`), await deck.export({ slide, format: "png", scale: 1 }));
    const layout = await slide.export({ format: "layout" });
    await fs.writeFile(path.join(TMP, "rendered", `slide-${n}.layout.json`), await layout.text());
  }
  await writeBlob(path.join(TMP, "rendered", "montage.webp"), await deck.export({ format: "webp", montage: true, scale: 1 }));
  const pptx = await PresentationFile.exportPptx(deck);
  await fs.rm(OUT, { force: true });
  await pptx.save(OUT);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
