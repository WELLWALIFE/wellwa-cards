// What is allowed to appear on screen as a heading.
//
// The old rule was "the first seven words of the paragraph", which produced the lines the owner rejected:
// "दोस्तों, अगर आप बिज़नेस करते हैं,…", "और दूसरी — वही quality बाजार…", "**समस्या पहचानिए".
// Every one of those is a mid-sentence fragment. A heading is WRITTEN, not sliced.
//
// The planner is asked for a written title, but the planner is not trusted: this validator is what actually
// makes a fragment impossible. A line that fails any rule is dropped, and a shot with no heading simply shows
// none — an empty frame is always better than half a sentence.

/** Words that cannot END a heading under any circumstances: the line is plainly continuing into words that are
 *  not there. A joining word has nothing to join to when it is the last thing on screen. */
const TAIL = new Set([
  "और", "या", "कि", "तो", "भी", "जो", "ने", "लेकिन", "बल्कि", "व",
  // Genitives always point at a noun that is not on screen: "आपके बिज़नेस का" — का what?
  "का", "के", "की",
  "aur", "ya", "jo", "bhi", "lekin", "ki", "ka", "ke",
  "and", "or", "but", "the", "a", "an", "of", "to", "for", "with", "that", "which", "is", "are", "was",
]);
/** Postpositions. "WhatsApp पर" is a complete phrase and a good heading; "quality बाजार से" is a fragment.
 *  The difference is whether there is a noun phrase in front of it, so they are refused only on a line too
 *  short to contain one. */
const TAIL_SHORT = new Set([
  "को", "में", "से", "पर", "पे", "तक",
  "ko", "mein", "me", "se", "par", "pe", "tak",
  "in", "on", "at", "by", "from",
]);

/** Words that cannot BEGIN a heading: a vocative, a filler, or a clause that depends on a clause we do not show. */
const HEAD = new Set([
  "दोस्तों", "दोस्तो", "नमस्ते", "नमस्कार", "देखिए", "देखिये", "सुनिए", "तो", "अब", "यानी", "मतलब", "और", "लेकिन", "पर",
  "अगर", "यदि", "जब", "क्योंकि", "चूंकि", "ताकि", "जैसे", "फिर", "इसलिए", "बल्कि", "या",
  "friends", "dosto", "doston", "namaste", "so", "now", "look", "see", "agar", "jab", "kyunki", "kyonki", "lekin",
  "if", "because", "since", "while", "although", "though", "and", "but", "or", "then", "also", "yani", "matlab",
]);

/** Marks that mean the line came from a document, not from an editor. */
const MARKUP = /[*_`#>|~]|\[|\]|\{|\}|<|>/;

const visible = (s) => [...String(s).replace(/\p{M}/gu, "")].length;
const clean = (s) => String(s ?? "")
  .replace(/\s+/g, " ")
  .replace(/^[\s"'“”‘’(\[-]+/, "")
  .replace(/[\s"'“”‘’)\],;:.।—–-]+$/, "")
  .trim();

/**
 * The one gate every on-screen heading passes.
 * Returns the heading to draw, or "" when nothing should be drawn.
 */
export function validateHeadline(raw, { maxWords = 5, maxChars = 32, used = null, script = null } = {}) {
  const t = clean(raw);
  if (!t) return "";
  if (MARKUP.test(t)) return "";
  // Same script as the owner's text. A Hinglish film (Roman letters, Roman subtitles) got Devanagari headings from
  // the planner — two scripts on one frame. A heading in the other script is no heading.
  if (script === "latin" && INDIC.test(t)) return "";
  if (script === "indic" && !INDIC.test(t) && !/^[A-Z0-9₹%.&+\- ]+$/i.test(t)) return "";
  if (/…|\.\.\./.test(t)) return "";                       // an ellipsis IS the fragment admitting itself
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > maxWords) return "";
  if (visible(t) > maxChars) return "";
  // Keep combining marks: in Devanagari a matra is category M, not L, so stripping "everything but letters"
  // turns का into क and no Hindi word ever matches the lists below.
  const bare = (w) => w.toLowerCase().replace(/[\p{P}\p{S}\p{Z}]/gu, "");
  const first = bare(words[0]);
  const last = bare(words[words.length - 1]);
  if (HEAD.has(first)) return "";
  if (TAIL.has(last)) return "";
  if (TAIL_SHORT.has(last) && words.length < 3) return "";
  // Unbalanced quotes or brackets read as a cut-off line.
  for (const [a, b] of [["(", ")"], ["“", "”"], ["‘", "’"]]) {
    if ((t.split(a).length - 1) !== (t.split(b).length - 1)) return "";
  }
  if ((t.split('"').length - 1) % 2 !== 0) return "";
  if (used && used.has(t.toLowerCase())) return "";        // the same title twice reads as a stuck video
  if (used) used.add(t.toLowerCase());
  return t;
}

/** Any Indic letter (Devanagari through Malayalam). */
const INDIC = /[\u0900-\u0D7F]/;
/** Which script the owner wrote in: "indic" when Indic letters carry the text, "latin" when Roman letters do. */
export function scriptOf(text) {
  const t = String(text ?? "");
  const indic = (t.match(/[\u0900-\u0D7F]/g) ?? []).length, latin = (t.match(/[A-Za-z]/g) ?? []).length;
  if (!indic && !latin) return null;
  return indic >= latin * 0.5 ? "indic" : "latin";
}

/** heading → keyword → nothing. There is deliberately no "first clause" fallback: that is the old bug. */
export function pickHeadline(shot, used, script = null) {
  return validateHeadline(shot?.heading, { used, script })
    || validateHeadline(shot?.keyword, { maxWords: 2, maxChars: 22, used, script })
    || "";
}

/** The instruction handed to the planner. Kept here, next to the validator that enforces it. */
export const HEADLINE_RULES = `For each entry write "heading": the words that appear on screen while those sentences are spoken.
- Write a TITLE for the point, the way a chapter heading is written — not a quotation of the sentence, and not its opening words. You may use words that are not in the sentences.
- 2 to 5 words. At most 32 characters.
- It must be COMPLETE and meaningful read entirely on its own, with nothing before it and nothing after it: a noun phrase or a short full statement. Someone who reads only this line must understand the point.
- Same language and same script the owner wrote. Hinglish (Roman letters) gets headings in Roman letters — "Follow-up ab WhatsApp par", never "फॉलो-अप अब WhatsApp पर"; Devanagari stays Devanagari; English stays English. Never translate, never change the script.
- NEVER end on a joining word: और, या, का, के, की, को, में, से, पर, कि, तो, भी, जो, aur, ya, ka, ki, ke, ko, mein, se, par, and, or, but, the, a, of, to, for, with.
- NEVER begin with a vocative, a filler or a subordinating word: दोस्तों, नमस्ते, देखिए, तो, अब, यानी, मतलब, और, लेकिन, अगर, यदि, जब, क्योंकि, friends, so, now, look, agar, jab, kyunki, if, because. A line that opens with "if" or "and" is unfinished however it ends.
- Every idea must come from THESE sentences. Invent no number, no price, no claim and no offer the owner did not say. If these sentences state a number or a price, that number belongs in the heading.
- Plain text only. No *, #, _, quotes, brackets, emoji, ellipsis, numbering, no trailing full stop, no trailing comma or dash.
- Write an EMPTY heading when this entry has no title worth writing. Empty is a correct and welcome answer.
Also write "keyword": one or two words naming this entry's subject, under the same rules, or empty.
Good (Devanagari text): क्वालिटी वही, दाम कम · फॉलो-अप अब WhatsApp पर · मुनाफ़ा कहाँ जाता है · हर महीने ₹2,999
Good (Hinglish text): Quality wahi, daam kam · Follow-up ab WhatsApp par · Munafa kahan jata hai · Har mahine ₹2,999
Bad, and these are real rejected ones: दोस्तों, अगर आप बिज़नेस करते हैं,… · और दूसरी — वही quality बाजार… · **समस्या पहचानिए · Follow-up, और WhatsApp CRM के जरिए…`;
