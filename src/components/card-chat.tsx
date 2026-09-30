"use client";

import { useEffect, useRef, useState } from "react";
import { onTheme } from "@/lib/color";
import { Bot, X, Send, LoaderCircle, Sparkles, FileText, RotateCcw } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string; at?: number };
/** What the server says this card's chat box should look like (a Shubhora partner's card with the new AI: Hindi). */
type Meta = { v2: boolean; title?: string; subtitle?: string; greeting?: string; chips?: string[]; placeholder?: string };

// The AI marks shareable files as "[MEDIA] url" lines (same convention as the
// WhatsApp bridge). Here they render inline — video plays right in the chat.
const URL_RE = /(https?:\/\/[^\s]+)/g;

function AssistantBubble({ text }: { text: string }) {
  const clean = text.replace(/^\s*\[MEDIA\]\s*/gim, "");
  return (
    <>
      {clean.split(URL_RE).map((part, i) => {
        if (!/^https?:\/\//.test(part)) return <span key={i}>{part}</span>;
        const url = part.replace(/[.,!?)]+$/, "");
        if (/\.(mp4|mov)([?#]|$)/i.test(url)) {
          return <video key={i} src={url} controls playsInline preload="metadata" className="mt-1.5 w-full rounded-lg" />;
        }
        if (/\.(jpe?g|png|webp)([?#]|$)/i.test(url)) {
          // eslint-disable-next-line @next/next/no-img-element
          return <img key={i} src={url} alt="" className="mt-1.5 w-full rounded-lg" />;
        }
        if (/\.pdf([?#]|$)/i.test(url)) {
          const name = decodeURIComponent(url.split("/").pop()?.split("?")[0] ?? "document.pdf");
          const label = /^shubhora-presentation/i.test(name) ? "Shubhora Presentation (PDF)" : name;
          return (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
              className="mt-1.5 flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2 font-medium no-underline">
              <FileText className="h-4 w-4 shrink-0" /> <span className="truncate">{label}</span>
            </a>
          );
        }
        return <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="underline break-all">{url}</a>;
      })}
    </>
  );
}

// A returning visitor (new AI only) finds their conversation where they left it, for 30 days.
const KEEP_MS = 30 * 24 * 3600 * 1000;
/** When a message was written (sent with the chat, so the assistant knows a visitor came back days later). */
const stampNow = () => Date.now();
const storeKey = (username: string) => `sh-chat:${username}`;
function loadSaved(username: string): Msg[] {
  try {
    const raw = localStorage.getItem(storeKey(username));
    if (!raw) return [];
    const saved = JSON.parse(raw) as { at?: number; messages?: Msg[] };
    if (!saved?.at || Date.now() - saved.at > KEEP_MS || !Array.isArray(saved.messages)) return [];
    return saved.messages.filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string").slice(-40);
  } catch { return []; }
}
function save(username: string, messages: Msg[]) {
  try {
    if (!messages.length) localStorage.removeItem(storeKey(username));
    else localStorage.setItem(storeKey(username), JSON.stringify({ at: Date.now(), messages: messages.slice(-40) }));
  } catch { /* private mode / storage full */ }
}

export function CardChat({
  username, name, theme,
}: {
  username: string;
  name: string;
  theme: string;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState<Meta | null>(null);
  const first = name.split(" ")[0];
  const scroller = useRef<HTMLDivElement>(null);

  const v2 = !!meta?.v2;
  const suggestions = v2 && meta?.chips?.length ? meta.chips : ["Products & prices?", "Book a free demo", "Business opportunity"];

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, open]);

  // The first time the box opens, ask how it should look (and bring back a saved conversation on the new AI).
  useEffect(() => {
    if (!open || meta) return;
    let gone = false;
    fetch(`/api/chat/${username}`).then((r) => r.json()).catch(() => ({ v2: false })).then((m: Meta) => {
      if (gone) return;
      setMeta(m?.v2 ? m : { v2: false });
      if (m?.v2) setMessages((cur) => (cur.length ? cur : loadSaved(username)));
    });
    return () => { gone = true; };
  }, [open, meta, username]);

  useEffect(() => { if (v2) save(username, messages); }, [v2, messages, username]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next = [...messages, { role: "user" as const, content: q, at: stampNow() }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const r = await fetch(`/api/chat/${username}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await r.json();
      setMessages((m) => [...m, { role: "assistant", content: data.reply ?? (v2 ? "माफ़ कीजिए, फिर से भेजिए।" : "Sorry, please try again."), at: stampNow() }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: v2 ? "नेटवर्क की दिक्कत है — फिर से भेजिए।" : "Network issue — please try again.", at: stampNow() }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full pl-3 pr-4 py-3 shadow-float hover:-translate-y-0.5 transition-transform motion-reduce:transform-none"
          style={{ background: `linear-gradient(135deg, ${theme}, color-mix(in srgb, ${theme} 80%, #0b1214))`, color: onTheme(theme) }}
        >
          <Bot className="h-5 w-5" />
          <span className="text-sm font-semibold">Ask {first}</span>
        </button>
      )}

      {/* panel */}
      {open && (
        <div data-overlay-open className="fixed bottom-5 right-5 z-40 w-[min(92vw,380px)] rounded-2xl border border-border bg-surface shadow-float overflow-hidden flex flex-col max-h-[70vh]">
          <div className="flex items-center gap-2.5 px-4 py-3" style={{ background: `linear-gradient(135deg, ${theme}, color-mix(in srgb, ${theme} 80%, #0b1214))`, color: onTheme(theme) }}>
            <span className="h-8 w-8 rounded-full bg-white/20 grid place-items-center"><Bot className="h-4.5 w-4.5" /></span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">{v2 && meta?.title ? meta.title : <>{first}&apos;s AI assistant</>}</p>
              <p className="text-[11px] opacity-80 leading-tight flex items-center gap-1"><Sparkles className="h-3 w-3" /> {v2 && meta?.subtitle ? meta.subtitle : <>Answers about {name.split(" ")[0]}&apos;s services</>}</p>
            </div>
            {v2 && messages.length > 0 && (
              <button onClick={() => setMessages([])} className="p-1 rounded-lg hover:bg-white/15" title="नई बातचीत" aria-label="New chat"><RotateCcw className="h-4 w-4" /></button>
            )}
            <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-white/15"><X className="h-4 w-4" /></button>
          </div>

          <div ref={scroller} className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-bg">
            {messages.length === 0 && (
              <div className="text-center py-4">
                {!meta
                  ? <LoaderCircle className="h-4 w-4 animate-spin text-muted mx-auto" />
                  : <p className="text-sm text-muted">{v2 && meta.greeting ? meta.greeting : <>Hi! 👋 Ask me anything about {name.split(" ")[0]}&apos;s products, prices, or how to book a demo.</>}</p>}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap ${m.role === "user" ? "rounded-br-sm" : "bg-surface border border-border rounded-bl-sm"}`}
                  style={m.role === "user" ? { background: theme, color: onTheme(theme) } : undefined}
                >
                  {m.role === "assistant" ? <AssistantBubble text={m.content} /> : m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-surface border border-border px-3.5 py-2.5">
                  <LoaderCircle className="h-4 w-4 animate-spin text-muted" />
                </div>
              </div>
            )}
          </div>

          {messages.length === 0 && meta && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted hover:bg-surface2">
                  {s}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-2 p-3 border-t border-border">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={v2 && meta?.placeholder ? meta.placeholder : "Type your question…"}
              className="flex-1 rounded-full border border-border bg-surface px-3.5 py-2 text-sm outline-none focus:border-brand"
            />
            <button type="submit" disabled={busy || !input.trim()}
              className="grid h-9 w-9 place-items-center rounded-full disabled:opacity-50" style={{ background: theme, color: onTheme(theme) }}>
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
