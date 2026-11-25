// The Shubhora tag (owner, 26 Nov 2026: "website hamari wahi rahegi, aap growth plan ke saath sab maintain karo"): ONE line on a
// website the customer already has — <script src="https://shubhora.com/api/crm/tag/<token>" async></script> — and every enquiry
// form on it also lands in their CRM. The site's own form keeps working exactly as before: the tag only listens and copies.
// Same idea as other CRMs' "external tracking" scripts. Sent to the owner's own lead link (/api/crm/hook/<token>).
//   Copied: forms with a 10-digit mobile number. Never: forms with a password, card, CVV, OTP or UPI field, or a search box.
import { SITE_URL } from "@/lib/site-url";

export const dynamic = "force-dynamic";

/** The browser code; `HOOK` is filled per owner. Plain ES5-ish so old phones run it. */
const TAG_JS = `(function(){
  if (window.__shubhoraTag) return; window.__shubhoraTag = 1;
  var HOOK = "__HOOK__";
  var SKIP = /pass|card|cvv|cvc|otp|upi|pin\\b|captcha|coupon/i;
  var PHONE = /phone|mobile|mob\\b|whats|contact|number|tel|फोन|मोबाइल|नंबर/i;
  var NAME = /name|नाम/i, MAIL = /mail/i, CITY = /city|town|location|area|pincode|शहर/i, MSG = /message|msg|query|enquiry|inquiry|requirement|comment|know|detail|note|question|संदेश|जानकारी/i;
  function label(el){
    var t = [el.name, el.id, el.placeholder, el.getAttribute("aria-label"), el.autocomplete];
    if (el.id) { var l = document.querySelector('label[for="' + el.id + '"]'); if (l) t.push(l.textContent); }
    var p = el.closest && el.closest("label"); if (p) t.push(p.textContent);
    return t.filter(Boolean).join(" ").slice(0, 200);
  }
  function digits(v){ var d = String(v || "").replace(/\\D/g, ""); if (d.length === 12 && d.indexOf("91") === 0) d = d.slice(2); if (d.length === 11 && d[0] === "0") d = d.slice(1); return d.length === 10 ? d : ""; }
  function read(form){
    if (!form || form.id === "shubhora-lead" || form.getAttribute("data-shubhora") === "off") return null;
    var els = form.querySelectorAll("input,select,textarea"), out = { name: "", phone: "", email: "", city: "", message: "" }, extra = [], seen = 0;
    for (var i = 0; i < els.length; i++) {
      var el = els[i], type = (el.type || "").toLowerCase(), lab = label(el), v = (el.value || "").trim();
      if (type === "password" || SKIP.test(lab) || /^cc-/.test(el.autocomplete || "")) return null;
      if (type === "hidden" || type === "submit" || type === "button" || type === "file" || ((type === "checkbox" || type === "radio") && !el.checked) || !v) continue;
      seen++;
      if (type === "search") return null;
      if (!out.phone && (type === "tel" || PHONE.test(lab)) && digits(v)) { out.phone = digits(v); continue; }
      if (!out.email && (type === "email" || MAIL.test(lab))) { out.email = v.slice(0, 120); continue; }
      if (!out.name && NAME.test(lab) && !MAIL.test(lab)) { out.name = v.slice(0, 80); continue; }
      if (!out.city && CITY.test(lab)) { out.city = v.slice(0, 60); continue; }
      if (el.tagName === "TEXTAREA" || MSG.test(lab)) { out.message = (out.message ? out.message + " · " : "") + v; continue; }
      var tag = lab.trim().split(/\\s+/)[0]; extra.push((tag ? tag + ": " : "") + v.slice(0, 80));
    }
    if (!out.phone) for (var j = 0; j < els.length; j++) { var d = digits(els[j].value); if (d && els[j].type !== "hidden") { out.phone = d; break; } }
    if (!out.phone || !seen) return null;
    if (extra.length) out.message = (out.message ? out.message + " · " : "") + extra.slice(0, 4).join(" · ");
    out.message = out.message.slice(0, 480);
    return out;
  }
  function send(form){
    try {
      var f = read(form); if (!f) return;
      var key = "shtag:" + f.phone + ":" + location.pathname, now = Date.now();
      try { var last = +sessionStorage.getItem(key) || 0; if (now - last < 120000) return; sessionStorage.setItem(key, String(now)); } catch (e) {}
      var b = new URLSearchParams();
      for (var k in f) if (f[k]) b.append(k, f[k]);
      b.append("source", "website"); b.append("site", location.href.split("#")[0].slice(0, 300));
      var q = new URLSearchParams(location.search); ["utm_source","utm_medium","utm_campaign"].forEach(function(u){ var v = q.get(u); if (v) b.append("tags", u.slice(4) + "-" + v.slice(0, 16)); });
      if (!(navigator.sendBeacon && navigator.sendBeacon(HOOK, b))) fetch(HOOK, { method: "POST", body: b, keepalive: true, mode: "no-cors" });
    } catch (e) {}
  }
  document.addEventListener("submit", function(e){ send(e.target); }, true);
})();`;

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = token.replace(/\.js$/, "");
  const headers = { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*" };
  // A wrong token gets harmless code (and the hook would refuse it anyway): the customer's site must never show an error because of us.
  if (!/^[a-f0-9]{36}$/.test(t)) return new Response("/* Shubhora tag: this link is not valid. Copy it again from CRM → Lead sources. */", { headers });
  return new Response(TAG_JS.replace("__HOOK__", `${SITE_URL}/api/crm/hook/${t}`), { headers });
}
