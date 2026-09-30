// node bridge/ad-rules.test.mjs — gate unit tests (spec PR1)
import assert from "node:assert/strict";
import { runGates, estSec, slotSec, spokenUnits } from "./ad-rules.mjs";
const facts = { name: "Wellwa Alkaline Ionizer", banned_claims: ["cures", "doctor-recommended", "100% pure", "No.1", "guaranteed"], proof: [{ text: "5,000+ Indian homes", number: "5000", source: "records" }, { text: "free home demo", source: "owner" }], offers: ["Free home demo", "1 saal ki warranty"], pronunciations: { hi: { Wellwa: "वेलवा" } } };
const ctx = { tier: "realistic", length: 20, lang: "hinglish", facts, brief: { offer: "", phone: "9876543210" }, speak_number: false };
const A = () => ({ scenes: [
  { text: "Har mahine paani ki bottles par kitna kharcha?", caption: "Bottle ka kharcha?" },
  { text: "Wellwa ionizer: ek button, alkaline paani ghar par.", caption: "Ek button. Alkaline paani." },
  { text: "Har glass mein mineral-rich paani, parivaar ke liye.", caption: "Poore parivaar ke liye" },
  { text: "5,000+ gharon ka bharosa. Free home demo bhi.", caption: "5,000+ ghar · Free demo" } ],
  cta: { text: "Abhi WhatsApp karein, number screen par hai.", caption: "WhatsApp 98765 43210" } });
const gatesOf = (s, c = ctx) => [...new Set(runGates(s, c).errors.map((e) => e.gate))];
let r = runGates(A(), ctx); assert.deepEqual(r.errors, [], "script A passes: " + JSON.stringify(r.errors));
const mut = (fn) => { const s = A(); fn(s); return gatesOf(s); };
assert.deepEqual(mut((s) => s.scenes.pop()), ["G1"]);
assert.deepEqual(mut((s) => { s.scenes[2].text = "Har glass mein mineral-rich alkaline paani milta hai poore parivaar ke liye har din subah shaam"; }), ["G2"]);
assert.deepEqual(mut((s) => { s.scenes[1].caption = "Paani"; }), ["G3"]);
assert.deepEqual(mut((s) => { s.scenes[2].text = "Abhi call karein, mineral-rich paani paayein."; }), ["G4"]);
assert.deepEqual(mut((s) => { s.cta.text = "Abhi WhatsApp karein 9876543210 par."; }), ["G5"]);
assert.deepEqual(mut((s) => { s.scenes[2].text = "Guaranteed sehat, har glass mein."; }), ["G6"]);
assert.deepEqual(mut((s) => { s.scenes[3].text = "9,000+ gharon ka bharosa. Free home demo bhi."; }), ["G7"]);
assert.deepEqual(mut((s) => { s.scenes[2].text = "हर glass mein mineral-rich paani."; }), ["G8"]);
assert.deepEqual(mut((s) => { s.scenes[0].text = "Wellwa se bottle ka kharcha khatam?"; }), ["G9"]);
// word boundaries / exemptions / normalisation
assert.ok(!gatesOf({ ...A(), scenes: A().scenes.map((x, i) => i === 2 ? { ...x, text: "Secure, mineral-rich paani parivaar ke liye." } : x) }).includes("G6"), "'secure' must not trip G6");
assert.ok(!gatesOf({ ...A(), scenes: A().scenes.map((x, i) => i === 2 ? { ...x, text: "1 saal ki warranty, mineral-rich paani." } : x) }).includes("G6"));
assert.ok(!gatesOf(A()).includes("G7"), "5,000+ matches 5000");
assert.ok(!gatesOf({ ...A(), scenes: A().scenes.map((x, i) => i === 3 ? { ...x, text: "Sirf 2 din: free home demo. 5,000+ ghar." } : x) }).includes("G7"), "'2 din' passes G7");
assert.ok(slotSec(1) === 2.4 && slotSec(10) === 4.1);
assert.ok(estSec("Wellwa ionizer: ek button, alkaline paani ghar par.", "hinglish") < 3.8);
assert.ok(spokenUnits("वेलवा आयोनाइज़र") >= 5);
console.log("ad-rules: all gate tests passed");
