"use client";
// CRM → Lead sources (owner, 20 Nov 2026: "Google Form, IndiaMART ya jo bhi other lead platform hai, wo add karne ka option, aur kisi bhi
// website se connect kar paaye"). One card per place a lead can come from, each with two or three plain steps and a Copy button; the
// technical page (CRM → Integrations: the raw link, the webhook out) stays for developers. Every way ends at the owner's own link
// (/api/crm/hook/<token>), so a lead from anywhere lands in the same list, marked with where it came from.
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Check, ChevronDown, Copy, FileSpreadsheet, Globe, LoaderCircle, Plug, ShoppingBag, Upload, Zap } from "lucide-react";
import { api } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { Sheet } from "@/components/crm/crm";

type Info = {
  inbound_url: string;
  indiamart: { on: boolean; last4: string; at: string | null; note: string } | null;
  counts: Record<string, number>;
  error?: string;
};

function websiteForm(url: string, hi: boolean) {
  const L = hi
    ? { name: "आपका नाम", phone: "मोबाइल नंबर", msg: "आपको क्या चाहिए?", btn: "भेजें", ok: "धन्यवाद! हम जल्द आपसे संपर्क करेंगे। 🙏", bad: "कृपया सही 10 अंकों का मोबाइल नंबर लिखें।" }
    : { name: "Your name", phone: "Mobile number", msg: "What do you need?", btn: "Send", ok: "Thank you! We will contact you soon. 🙏", bad: "Please enter a valid 10-digit mobile number." };
  return `<!-- Shubhora lead form: every enquiry goes straight to your CRM -->
<form id="shubhora-lead" action="${url}" method="post" style="max-width:420px;display:grid;gap:10px;font-family:inherit">
  <input name="name" placeholder="${L.name}" required style="padding:12px;border:1px solid #ccc;border-radius:10px">
  <input name="phone" type="tel" placeholder="${L.phone}" required style="padding:12px;border:1px solid #ccc;border-radius:10px">
  <textarea name="message" rows="3" placeholder="${L.msg}" style="padding:12px;border:1px solid #ccc;border-radius:10px"></textarea>
  <input name="_hp" tabindex="-1" autocomplete="off" style="display:none">
  <button type="submit" style="padding:12px;border:0;border-radius:10px;background:#2f4bd8;color:#fff;font-weight:600">${L.btn}</button>
  <p id="shubhora-lead-msg" style="margin:0"></p>
</form>
<script>
(function(){var f=document.getElementById("shubhora-lead");if(!f)return;f.addEventListener("submit",function(e){e.preventDefault();
var d=new URLSearchParams(new FormData(f));d.append("site",location.href);var m=document.getElementById("shubhora-lead-msg");
fetch(f.action,{method:"POST",body:d}).then(function(r){return r.json()}).then(function(j){if(j&&j.ok){f.reset();m.textContent=${JSON.stringify(L.ok)};}else{m.textContent=${JSON.stringify(L.bad)};}}).catch(function(){m.textContent=${JSON.stringify(L.bad)};});});})();
</script>`;
}

function googleFormScript(url: string) {
  return `// Shubhora: every new answer of this Google Form goes to your CRM.
const HOOK = "${url}";
function onFormSubmit(e) {
  const d = { source: "google form" };
  e.response.getItemResponses().forEach(function (r) {
    const q = r.getItem().getTitle().toLowerCase();
    const a = String(r.getResponse());
    if (!d.phone && /mobile|phone|whatsapp|number|contact|मोबाइल|फ़ोन|फोन|नंबर/.test(q)) d.phone = a;
    else if (!d.name && /name|नाम/.test(q)) d.name = a;
    else if (!d.city && /city|town|area|शहर/.test(q)) d.city = a;
    else d.message = (d.message ? d.message + "\\n" : "") + r.getItem().getTitle() + ": " + a;
  });
  UrlFetchApp.fetch(HOOK, { method: "post", contentType: "application/json", payload: JSON.stringify(d), muteHttpExceptions: true });
}`;
}

function CopyBox({ text, label, code = false }: { text: string; label: string; code?: boolean }) {
  const [done, setDone] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800); } catch { /* the text stays selectable */ } };
  return (
    <div className="space-y-1">
      {code ? <pre className="max-h-40 overflow-auto rounded-xl bg-surface2 p-2.5 text-[10.5px] leading-snug text-ink">{text}</pre>
        : <code className="block truncate rounded-xl bg-surface2 px-2.5 py-2 text-[11px] text-ink">{text}</code>}
      <button type="button" onClick={() => void copy()} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-brand-ink">
        {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{done ? "Copied ✓" : label}
      </button>
    </div>
  );
}

function Source({ icon, title, sub, count, status, open, onToggle, children }: { icon: ReactNode; title: string; sub: string; count?: number; status?: ReactNode; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-3 py-3 text-left">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-ink">{icon}</span>
        <span className="min-w-0 flex-1"><b className="block text-sm text-ink">{title}</b><span className="block truncate text-[11px] text-muted">{sub}</span></span>
        {status}
        {!!count && <span className="shrink-0 rounded-full bg-good/15 px-2 py-0.5 text-[11px] font-bold text-good">{count}</span>}
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="space-y-2.5 border-t border-border px-3 py-3 text-xs text-muted">{children}</div>}
    </div>
  );
}

const Steps = ({ items }: { items: ReactNode[] }) => <ol className="list-decimal space-y-1 pl-4">{items.map((x, i) => <li key={i}>{x}</li>)}</ol>;

export function LeadSourcesSheet({ onClose, onImport }: { onClose: () => void; onImport: () => void }) {
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const [info, setInfo] = useState<Info | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState("website");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState<{ k: string; text: string; bad?: boolean } | null>(null);

  const load = useCallback(async () => {
    const r = await api<Info>("/api/crm/integrations").catch(() => null);
    if (!r?.ok) { setErr(r?.data.error || T("Could not load. Please try again.", "Load नहीं हुआ। दोबारा try करें।")); return; }
    setInfo(r.data);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { void load(); }, [load]);

  const toggle = (k: string) => setOpen((o) => (o === k ? "" : k));
  const n = (...ks: string[]) => ks.reduce((a, k) => a + (info?.counts[k] ?? 0), 0);

  async function sendTest() {
    if (!info) return;
    setBusy("test"); setNote(null);
    const r = await fetch(info.inbound_url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Test lead (delete me)", phone: "9999999999", message: "This is a test from Lead sources.", source: "test" }) }).then((x) => x.json()).catch(() => null);
    setBusy("");
    setNote(r?.ok ? { k: "test", text: T("✅ A test lead is in your list — “Test lead (delete me)”. Delete it after you see it.", "✅ Test lead आपकी list में आ गई — “Test lead (delete me)”। देखकर delete कर दें।") } : { k: "test", text: T("The test did not arrive. Please try again.", "Test नहीं पहुँचा। दोबारा try करें।"), bad: true });
  }

  async function saveKey(off = false) {
    setBusy("im"); setNote(null);
    const r = await api<{ ok?: boolean; error?: string }>("/api/crm/integrations", { method: "PUT", json: { indiamart_key: off ? "" : key.trim() } }).catch(() => null);
    setBusy("");
    if (!r?.ok) { setNote({ k: "im", text: r?.data.error || T("Could not save. Please try again.", "Save नहीं हुआ। दोबारा try करें।"), bad: true }); return; }
    setKey("");
    setNote({ k: "im", text: off ? T("IndiaMART is disconnected.", "IndiaMART हटा दिया गया।") : T("✅ Connected. New IndiaMART enquiries come in every 15 minutes.", "✅ जुड़ गया। IndiaMART की नई enquiries हर 15 मिनट में आएँगी।") });
    void load();
  }

  const url = info?.inbound_url ?? "";
  const im = info?.indiamart;
  const noteOf = (k: string) => note?.k === k && <p className={`text-xs font-semibold ${note.bad ? "text-danger" : "text-good"}`}>{note.text}</p>;

  return (
    <Sheet title={T("Lead sources", "Leads कहाँ से आएँ")} onClose={onClose}>
      {!info ? (err ? <p className="text-xs text-danger">{err}</p> : <LoaderCircle className="mx-auto h-5 w-5 animate-spin text-muted" />) : (
        <div className="space-y-2.5">
          <p className="text-xs text-muted">{T("Connect a place once — every enquiry from it comes into this CRM by itself, marked with where it came from, and you get an alert. The numbers show leads from each place in the last 30 days.",
            "एक बार जोड़ दें — वहाँ की हर enquiry अपने-आप इस CRM में आएगी, साथ में लिखा होगा कि कहाँ से आई, और आपको alert मिलेगा। नंबर = पिछले 30 दिन में वहाँ से आई leads।")}</p>

          <Source icon={<Globe className="h-4 w-4" />} title={T("Any website", "कोई भी website")} sub={T("A ready form, or your own form", "तैयार form, या आपका अपना form")} count={n("website")} open={open === "website"} onToggle={() => toggle("website")}>
            <p className="font-semibold text-ink">{T("A — Ready form (easiest)", "A — तैयार form (सबसे आसान)")}</p>
            <Steps items={[
              T("Copy the code below.", "नीचे का code copy करें।"),
              T("On your website, add an “HTML” / “Custom code” block where the form should be (WordPress: Custom HTML block; Wix: Embed code; Blogger: HTML gadget) and paste it.", "अपनी website में जहाँ form चाहिए वहाँ “HTML” / “Custom code” block लगाएँ (WordPress: Custom HTML block; Wix: Embed code; Blogger: HTML gadget) और paste करें।"),
              T("Publish. Fill it once yourself — the lead shows here.", "Publish करें। एक बार खुद भरकर देखें — lead यहाँ दिखेगी।"),
            ]} />
            <CopyBox text={websiteForm(url, hi)} label={T("Copy form code", "Form code copy करें")} code />
            <p className="pt-1 font-semibold text-ink">{T("B — Your own form", "B — आपका अपना form")}</p>
            <p>{T("If your website already has a form, set its “send to / action / webhook URL” to this link. Field names: name, phone (needed), message, city.", "अगर आपकी website पर पहले से form है, तो उसके “send to / action / webhook URL” में यह link डालें। Field के नाम: name, phone (ज़रूरी), message, city।")}</p>
            <CopyBox text={url} label={T("Copy my lead link", "मेरा lead link copy करें")} />
            <p className="text-[11px] text-faint">{T("WordPress: Contact Form 7 → “CF7 to Webhook” plugin, or WPForms / Elementor Forms → Webhook action → paste the link.", "WordPress: Contact Form 7 → “CF7 to Webhook” plugin, या WPForms / Elementor Forms → Webhook action → link paste करें।")}</p>
          </Source>

          <Source icon={<FileSpreadsheet className="h-4 w-4" />} title="Google Forms" sub={T("Every new answer becomes a lead", "हर नया जवाब एक lead बनेगा")} count={n("google form")} open={open === "gform"} onToggle={() => toggle("gform")}>
            <Steps items={[
              T("Open your Google Form → ⋮ (top right) → “Apps Script”.", "अपना Google Form खोलें → ⋮ (ऊपर दाएँ) → “Apps Script”।"),
              T("Delete what is there, paste the code below, press Save (💾).", "वहाँ जो लिखा है हटाएँ, नीचे का code paste करें, Save (💾) दबाएँ।"),
              T("Left side ⏰ “Triggers” → “Add trigger” → function onFormSubmit, event source “From form”, event type “On form submit” → Save → allow access.", "बाएँ ⏰ “Triggers” → “Add trigger” → function onFormSubmit, event source “From form”, event type “On form submit” → Save → access allow करें।"),
              T("The form must ask for a mobile number (a question with “mobile” or “phone” in it).", "Form में mobile number का सवाल होना चाहिए (जिसमें “mobile” या “phone” लिखा हो)।"),
            ]} />
            <CopyBox text={googleFormScript(url)} label={T("Copy script", "Script copy करें")} code />
          </Source>

          <Source icon={<ShoppingBag className="h-4 w-4" />} title="IndiaMART" sub={im?.on ? (im.note || T("Connected", "जुड़ा हुआ है")) : T("Direct connect with your IndiaMART key", "आपकी IndiaMART key से सीधे जुड़ें")} count={n("indiamart")}
            status={im?.on ? <span className="shrink-0 rounded-full bg-good/15 px-2 py-0.5 text-[10px] font-bold text-good">{T("ON", "चालू")}</span> : undefined} open={open === "im"} onToggle={() => toggle("im")}>
            {im === null ? <p className="text-danger">{T("This needs a small server update first (migration 0091). Ask Shubhora support.", "इसके लिए पहले server update चाहिए (migration 0091)। Shubhora support से कहें।")}</p> : im?.on ? (
              <>
                <p>{T(`Connected with the key ending …${im.last4}.`, `…${im.last4} वाली key से जुड़ा है।`)}{im.at ? ` ${T("Last check", "पिछली जाँच")}: ${new Date(im.at).toLocaleString(hi ? "hi-IN" : "en-IN", { hour: "numeric", minute: "2-digit", day: "numeric", month: "short" })}.` : ""}</p>
                {im.note && <p className={/wrong|expired|error|could not/i.test(im.note) ? "font-semibold text-danger" : ""}>{im.note}</p>}
                <p className="text-[11px] text-faint">{T("IndiaMART stops a key that is not used for 7 days, and a new key replaces the old one — if you make a new key, paste it here again.", "IndiaMART 7 दिन इस्तेमाल न हुई key बंद कर देता है, और नई key बनाने पर पुरानी बंद हो जाती है — नई key बनाएँ तो यहाँ फिर paste करें।")}</p>
                <div className="flex gap-2">
                  <input value={key} onChange={(e) => setKey(e.target.value)} placeholder={T("New key (optional)", "नई key (ज़रूरी नहीं)")} className="min-w-0 flex-1 rounded-xl border border-border bg-bg px-3 py-2 font-mono text-xs outline-none focus:border-brand" />
                  <button type="button" onClick={() => void saveKey()} disabled={!!busy || key.trim().length < 12} className="rounded-xl grad-brand px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{T("Save", "Save")}</button>
                </div>
                <button type="button" onClick={() => void saveKey(true)} disabled={!!busy} className="text-xs font-semibold text-danger underline">{T("Disconnect IndiaMART", "IndiaMART हटाएँ")}</button>
              </>
            ) : (
              <>
                <Steps items={[
                  <>{T("Log in at", "यहाँ login करें:")} <a href="https://seller.indiamart.com/leadmanager/crmapi" target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-ink underline">seller.indiamart.com → Lead Manager → Pull API</a></>,
                  T("Press “Generate Key” and copy the key (it also comes to your email).", "“Generate Key” दबाएँ और key copy करें (key आपके email पर भी आती है)।"),
                  T("Paste it here and press Connect.", "यहाँ paste करें और Connect दबाएँ।"),
                ]} />
                <div className="flex gap-2">
                  <input value={key} onChange={(e) => setKey(e.target.value)} placeholder={T("Paste your IndiaMART key", "अपनी IndiaMART key paste करें")} className="min-w-0 flex-1 rounded-xl border border-border bg-bg px-3 py-2 font-mono text-xs outline-none focus:border-brand" />
                  <button type="button" onClick={() => void saveKey()} disabled={!!busy || key.trim().length < 12} className="rounded-xl grad-brand px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy === "im" ? "…" : T("Connect", "Connect")}</button>
                </div>
                <p className="text-[11px] text-faint">{T("The Pull API is for paid IndiaMART sellers. Keep the key private — anyone with it can read your IndiaMART leads.", "Pull API paid IndiaMART sellers के लिए है। Key किसी को न दें — इससे आपकी IndiaMART leads पढ़ी जा सकती हैं।")}</p>
              </>
            )}
            {noteOf("im")}
          </Source>

          <Source icon={<Zap className="h-4 w-4" />} title={T("Facebook / Instagram Lead Ads", "Facebook / Instagram Lead Ads")} sub={T("Through Zapier, Make or Pabbly", "Zapier, Make या Pabbly से")} count={n("facebook", "instagram", "meta")} open={open === "fb"} onToggle={() => toggle("fb")}>
            <Steps items={[
              T("In Zapier / Make / Pabbly Connect: trigger “Facebook Lead Ads → New lead”, pick your page and form.", "Zapier / Make / Pabbly Connect में: trigger “Facebook Lead Ads → New lead”, अपना page और form चुनें।"),
              T("Action “Webhooks → POST” (Make: HTTP → Make a request) to your lead link.", "Action “Webhooks → POST” (Make: HTTP → Make a request) — आपके lead link पर।"),
              T("Send these fields: name, phone, city, message — and source = facebook.", "ये fields भेजें: name, phone, city, message — और source = facebook।"),
            ]} />
            <CopyBox text={url} label={T("Copy my lead link", "मेरा lead link copy करें")} />
          </Source>

          <Source icon={<Plug className="h-4 w-4" />} title={T("JustDial, TradeIndia, Sulekha, 99acres, others", "JustDial, TradeIndia, Sulekha, 99acres, बाकी")} sub={T("Any platform that can send a lead to a link", "कोई भी platform जो lead किसी link पर भेज सके")} count={n("justdial", "tradeindia", "sulekha", "99acres", "webhook", "zapier", "make", "pabbly")} open={open === "other"} onToggle={() => toggle("other")}>
            <Steps items={[
              T("If the platform has “Webhook / Lead URL / CRM integration” in its settings, paste your lead link there.", "अगर platform की settings में “Webhook / Lead URL / CRM integration” है, तो वहाँ अपना lead link paste करें।"),
              T("If not (JustDial mostly sends leads by email / SMS): use Zapier or Pabbly “Email Parser” → Webhooks POST to your lead link.", "अगर नहीं है (JustDial ज़्यादातर email / SMS से lead भेजता है): Zapier या Pabbly का “Email Parser” → Webhooks POST आपके lead link पर।"),
              T("Add source = the platform's name (justdial, tradeindia…) so you see where each lead came from.", "source = platform का नाम (justdial, tradeindia…) भेजें, ताकि पता चले lead कहाँ से आई।"),
            ]} />
            <CopyBox text={url} label={T("Copy my lead link", "मेरा lead link copy करें")} />
          </Source>

          <Source icon={<Upload className="h-4 w-4" />} title={T("Excel / CSV file", "Excel / CSV file")} sub={T("Old leads from a sheet", "Sheet से पुरानी leads")} count={n("import", "csv")} open={open === "csv"} onToggle={() => toggle("csv")}>
            <p>{T("Upload a sheet with name and mobile columns — all of them come in at once.", "Name और mobile वाली sheet upload करें — सारी leads एक साथ आ जाएँगी।")}</p>
            <button type="button" onClick={onImport} className="rounded-xl grad-brand px-3 py-2 text-xs font-semibold text-white">{T("Import leads", "Leads import करें")}</button>
          </Source>

          <div className="space-y-1.5 rounded-2xl bg-surface2/60 p-3">
            <p className="text-xs text-muted">{T("Check that it works: a test lead goes to your own link and shows in the list.", "जाँच लें: एक test lead आपके link पर जाएगी और list में दिखेगी।")}</p>
            <button type="button" onClick={() => void sendTest()} disabled={!!busy} className="rounded-xl border border-brand px-3 py-2 text-xs font-semibold text-brand-ink disabled:opacity-50">{busy === "test" ? "…" : T("Send a test lead", "Test lead भेजें")}</button>
            {noteOf("test")}
          </div>
          <p className="text-[11px] text-faint">{T("Keep your lead link private. If it ever leaks, make a new one in CRM → Integrations (the old one stops).", "अपना lead link किसी को न दें। अगर कहीं leak हो जाए, CRM → Integrations में नया बना लें (पुराना बंद हो जाएगा)।")}</p>
        </div>
      )}
    </Sheet>
  );
}
