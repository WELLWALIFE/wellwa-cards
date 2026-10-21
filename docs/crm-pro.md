# Shubhora CRM Pro — the spec (21 Oct 2026)

Owner's brief, 21 Oct 2026: *"CRM abhi aise hi hai. Professional CRM banao — wahi se direct call kar sake, wahi se
sab kar sake."* This document is what the next session builds from. Read `docs/HANDOFF.md` first (paths, branch,
deploy, rules), then this. Build it phase by phase (section 9); every phase ships on its own.

---

## 0. मालिक के लिए सार (Hinglish)

आज का CRM एक लंबी list है जिसमें WhatsApp chat, stage, tag, note और एक follow-up date है। "Professional" CRM का मतलब:

1. **आज क्या करना है** एक ही screen पर — overdue follow-up, आज के call, unread chat, नए lead, आज की booking, missed call।
2. **Direct call** — customer की screen से एक tap में call; call कटते ही app पूछे "क्या हुआ?" (बात हुई / नहीं उठाया / busy / गलत नंबर / बाद में call), note, अगला step, और चाहें तो call के बाद WhatsApp message — सब अपने-आप record। "Call list" mode: आज के सारे follow-up एक-एक करके, Call → outcome → अगला।
3. Phase 2 में **Exotel cloud number** से call: desktop से भी call, customer को business का नंबर दिखे, हर call की recording और duration अपने-आप CRM में, agent अपना personal नंबर छुपा कर call करे।
4. **Customer की एक screen से सब कुछ**: Call, WhatsApp, Task, Note, Booking, Payment link, (Phase 3) Quotation PDF, Sale record — और एक timeline जिसमें chat, call, task, booking, sale सब एक जगह।
5. **Task/reminder** सिर्फ़ एक date नहीं — call/WhatsApp/visit/meeting tasks, push + WhatsApp reminder, snooze।
6. **बिकने के बाद भी customer** — sale record, repeat sale, revenue report, birthday/anniversary wish।
7. **Team**: lead अपने-आप agents में बँटे (round-robin), daily call target, leaderboard।
8. **Reports**: calls, follow-up discipline, source-wise conversion, lost reasons, revenue; रोज़ शाम WhatsApp summary।
9. **पूरा Hindi/English** (आज का CRM सिर्फ़ English है) और desktop पर 3-pane layout।

Phases: Phase 1 (core + direct call + tasks + Today) ≈ 1 हफ़्ता · Phase 2 (Exotel calling + desktop + automations + reports) ≈ 5 दिन ·
Phase 3 (sales + quotation + team extras) ≈ 1 हफ़्ता। आपके काम: Exotel account (Phase 2) और migration चलाना — section 10।

---

## 1. Goal, users, rules

**Users.** A shop / clinic / agent / service business owner on a phone (Android app = Capacitor WebView, or Chrome), 20–500
leads, sometimes 1–3 sales agents (`crm_agents`, roles owner / manager / agent). A manager sometimes on a laptop.

**Rules (non-negotiable).**
- Phone-first. Every screen works at 390 px; desktop (`md:` and up) gets a wider layout, never a different product.
- One screen answers "what do I do now" (Today). Every action for a customer happens on that customer's screen.
- **Bilingual.** Every CRM string goes through the app's `useT()` dictionary (`src/lib/poster-i18n.tsx`), Hindi
  (Devanagari with everyday Hinglish words) by default, EN on toggle. The current CRM is English-only — this is a bug
  for the owner's audience, not a nice-to-have.
- Nothing is sent to a customer automatically unless the owner switched that automation on; every automation has a
  toggle and an editable template (pattern: `owner_prefs`, `src/components/poster/customer-tools.tsx`).
- Reuse what exists (section 2). New code lives beside it; old URLs keep working; the old CRM's features stay reachable
  until the new screens cover them.
- Plan gating stays as it is: viewing/adding/notes/calls work on every plan; WhatsApp sending and automations follow the
  existing checks (`waPlanExpiry` / `ownerPlanExpiry` in `src/lib/crm-server.ts`). Exotel calling = paid add-on (section 6).
- Team scope: every route takes `as=<ownerId>` and goes through `resolveScope()`; an agent sees only leads assigned to them
  (existing behaviour — keep it for tasks, calls and sales too).
- Codebase voice: comments say why, dated owner decisions, no hype; no model names in code or commits.

**Non-goals.** Not a Salesforce clone: no custom objects, no email campaigns, no multi-currency, no accounting.

---

## 2. What exists today (reuse, do not rebuild)

| Area | Where | Notes |
|---|---|---|
| CRM UI | `src/components/crm/crm.tsx` (1,080 lines, one file) | inbox list, pipeline (kanban), thread (WhatsApp chat), AI insight + "write reply", profile sheet (name, city, stage, tags, deal value, follow-up, notes, timeline), add lead, quick replies (`/shortcut`), analytics sheet, team sheet, import (CSV/paste), export CSV, payment request (UPI deep link), menu bot (flow builder), integrations (inbound webhook, outbound webhook, Google Sheets) |
| Entry point | `src/app/poster/leads/page.tsx` | tabs Customers · Bookings · Phone · WhatsApp · Teach bot; `CustomerTools` (festival wishes, review ask, offer to everyone) above the inbox |
| API | `src/app/api/crm/{inbox,thread,lead,send,ai,templates,team,analytics,flow,integrations,upload,customers,hook}` | bearer; `src/lib/crm-server.ts` (`STAGES`, `LEAD_COLS`, `inbox`, `leadById`, `messagesFor`, `eventsFor`, `addEvent`, `resolveScope`, `agentsFor`, `bridge`) |
| Tables | `leads` (0001 + 0014 utm + 0018 notes/next_follow_up/value_paise/lost_reason + 0034 tags/unread/ai_* /city + 0035 assigned_to + 0039 opted_out), `wa_messages`, `lead_events`, `wa_templates`, `crm_agents` (0035), `wa_flows`, `crm_integrations`, `crm_outbox` (0037), `bookings` (0064), `owner_prefs` (0065), `phone_lines`, `phone_calls` (0067) | RLS patterns to copy are in 0035 (team read) and 0064 (owner manages) |
| WhatsApp sending | bridge (Baileys, QR-linked, `bridge/index.mjs`, manager on 127.0.0.1:8787) and Cloud API (`src/lib/wa-cloud.ts`) | `sendCustomer()` in `src/lib/customer-send.ts`; attachments (image / PDF) already go through `/api/crm/send` |
| Crons | `bridge/crm-reminders.mjs` (follow-up reminders every 15 min: owner's WhatsApp + FCM push, once per `reminded_at`), `bridge/crm-webhooks.mjs` (outbox), `bridge/wa-broadcast.mjs`, booking reminders (`/api/cron/booking-reminders`), festival wishes, weekly report | extend these, do not add parallel ones |
| Customer messaging | `src/lib/customer-send.ts` | review ask after Won / booking done, festival wish, offer to everyone (paced, from the owner's number) |
| AI | `/api/crm/ai` (insight refresh, suggested reply), `src/lib/wa-ai.ts` (shared assistant prompt), Gemini via `src/lib/gemini.ts` | |
| Phone receptionist | `bridge/phone-worker.mjs`, `/api/phone`, `/api/phone/call`, `docs/phone-receptionist.md`, Phone tab | Exotel/Twilio inbound audio → Gemini Live; a finished call becomes a lead + booking + owner notify. Not set up by the owner yet |
| Bookings | `src/components/poster/bookings.tsx`, `src/lib/bookings*.ts`, `/api/bookings` | calendar + reminders |
| Products | `poster_products` (`src/lib/card-inputs.ts` → `ProductRow`: name, price, mrp, photo_url, photos, offer, category) | for product interest, sales and quotes |
| Notifications | `src/lib/notify.ts` (push + owner WhatsApp), `/api/poster/devices` (FCM tokens from the Android app) | |
| Android app | Capacitor WebView with a remote `server.url` (`src/components/poster/native-bridge.tsx`) | `tel:` links open the dialer; `visibilitychange` fires on return |

**Why the owner calls it "aise hi" (the gaps to close).** English only · everything in one file · buried behind five tabs · a call is
just a `tel:` link that writes "📞 Called" · one follow-up date, no task list, no snooze · no Today screen · calls, bookings, sales
are not in the lead's timeline · nothing after Won (no sale record, no repeat business) · no quotation · the inbox loads 500 rows
and searches in the browser · desktop is a phone column · adding a lead needs a card (`card_id not null`) · no merge of duplicates ·
no birthday/anniversary · no call list / dialer · analytics has no calls · a lead "value" but no revenue.

---

## 3. The product — screens

New route **`/poster/crm`** (the bottom tab "Customers" points here). `/poster/leads` keeps working: its "Customers" tab renders the
new CRM; Bookings / Phone / WhatsApp / Teach bot tabs stay where they are (later they move under CRM → Calendar / Settings).

Sections (segmented control on phone, left rail on desktop): **Today · Customers · Calendar · Reports · Settings**.

### 3.1 Today (default screen)
Header: date (IST), "नमस्ते {first name}", workspace switcher (existing team pills).
Blocks, in this order, each collapsible, each row with **Call · WhatsApp · Done** actions:
1. **Overdue** follow-ups / tasks (red) — oldest first.
2. **Due today** — tasks by time; kind icon (call / WhatsApp / visit / meeting).
3. **Unread chats** (existing `unread`).
4. **New leads, untouched** — created in the last 24 h with no outgoing message, call or task.
5. **Today's bookings** (from `bookings`).
6. **Missed / AI-answered calls** needing a call back (`phone_calls` with intent callback, or any call not yet linked to a task).
7. **Going cold** — stage interested/follow_up, no activity 3+ days.
Top button: **"Start calling (N)"** → Call list mode (3.5). Counters at the top: due · unread · new · hot (existing `Stat`).
API: `GET /api/crm/today` returns these buckets in one call (section 5).

### 3.2 Customers (list)
- **Server-side** search (`ilike` on name / phone / city / tags / ai_intent) and pagination (50 per page, "load more"); sort: recent
  activity (default, `last_activity_at`), newest, follow-up date, value, score.
- Filters (chips + a filter sheet): stage, lifecycle (`kind` lead / customer / lost), tag, source, assigned (mine / unassigned / @agent),
  city, "task due", "no activity N days", opted-out hidden by default.
- **Pipeline** view (existing kanban) stays; on desktop cards drag between columns; on phone the stage picker.
- **Bulk select** (long-press / checkbox) → assign · stage · add tag · send a quick reply to all (through the existing broadcast pacing,
  skips `opted_out`, max 3 broadcasts a day as today) · export CSV of the selection.
- Row: avatar, name (or number), stage pill, lifecycle dot, last activity line, due chip, unread badge, 🔥 when score ≥ 70, @agent;
  swipe right = Call, swipe left = WhatsApp (phone), hover buttons (desktop).
- Saved filters ("segments", owner names them) — Phase 3.

### 3.3 Customer screen — "sab kuch yahin se"
Phone: header (avatar, name, number, stage pill, assigned) → **action bar** → tabs **Chat · Activity · Details · Sales**.
Desktop: three panes = list | chat | details + timeline.

Action bar (icons with labels, always visible): **Call · WhatsApp · Task · Note · Book · Pay · Quote (Phase 3) · ⋯**
(⋯ = edit, change stage, merge, opt-out, delete, open in WhatsApp app, copy number).

- **Chat** = the existing thread (messages, AI insight, composer, attachments, quick replies, payment request). Keep as is; add delivery
  ticks when the bridge reports them, and an attachments strip.
- **Activity** = one timeline merging `wa_messages` (collapsed: "12 messages today"), `lead_events`, `crm_calls`, `crm_tasks` (created/done),
  `bookings`, `crm_sales`. Filter chips: All · Calls · Chats · Tasks · Notes. Each item: icon, text, time, who (agent name).
- **Details** = the profile form, fields in section 4.1; product interest = multi-select from `poster_products`; "Next action" strip at the
  top (next open task: Done / Snooze / Edit) — this replaces the single follow-up date in the owner's mind, `next_follow_up` stays in sync.
- **Sales** = sales list (Phase 3), total revenue, "New sale".

### 3.4 Calendar
Day / week list of tasks + bookings (bookings component reused). Tap a task → done / snooze / open customer. "Add" → task or booking.

### 3.5 Call list (dialer mode)
From Today "Start calling (N)" or Customers → filter → "Call these". Full-screen card, one lead at a time, counter "3 / 12":
name, city, stage, product interest, last 2 messages, **AI talking points** (`ai_summary`, `ai_next`, open task text), buttons
**Call · WhatsApp · Skip**. After the call, the outcome sheet (3.6) → next card. Order: overdue → due today → new untouched → hot.
Agents get their assigned leads only. Pauses/resumes if the app is backgrounded.

### 3.6 Direct call — Phase 1 (works today: Android app, Chrome, Safari)
1. Tap **Call** → `window.location.href = tel:+91…` (the WebView opens the dialer). Before that, the app stores
   `pendingCall = { leadId, startedAt }` in `sessionStorage`.
2. On return — `visibilitychange` → visible (or Capacitor `App.appStateChange` when the plugin is present) — if `pendingCall` exists and
   ≥ 5 s passed, open the **Call outcome sheet**:
   - Outcome chips: **बात हुई / Connected · नहीं उठाया / No answer · Busy · Switched off · गलत नंबर / Wrong number · बाद में / Call back later**.
   - Duration: pre-filled from elapsed time, editable (mm:ss).
   - Note: text, with a 🎤 button using the browser `SpeechRecognition` (lang `hi-IN`) where available.
   - Next step chips: follow-up (Today 6 pm · Tomorrow 11 am · 3 days · Next week · pick), **send a WhatsApp now** (quick-reply picker; the
     default template "Aapko call kiya tha…" is editable in Settings → Calling), stage suggestion (Connected → Interested / Follow-up),
     create booking.
   - Save → `crm_calls` row, `lead_events` "call" line, optional `crm_tasks`, `leads.last_activity_at / last_call_at / calls_count`.
   - "No answer" with the Settings toggle on → an automatic **"Call again" task in 3 h** (time configurable) and, if switched on, the
     WhatsApp "missed you" message.
   - Dismissing the sheet still logs the call with outcome `unknown` (so nothing is lost); the sheet can be reopened from the timeline.
3. Desktop / no `tel:` handler: the Call button opens the outcome sheet directly with "Dial on your phone: +91 …" and a copy button.
   Phase 2 makes desktop calling real.
4. Incoming calls on the owner's own SIM cannot be seen by a web app; the AI receptionist (Phase 2 line) covers missed calls.

### 3.7 Direct call — Phase 2 (Exotel click-to-call, the "professional" way)
Why: call from desktop; the customer sees the **business's virtual number**, not the agent's personal one; every call is **recorded and
logged automatically** with the real duration; incoming calls on that number go to the AI receptionist (already built) or ring the owner.
- Flow: Call → `POST /api/crm/call { lead_id }` → Exotel **Connect** API (`POST https://<subdomain>/v1/Accounts/<sid>/Calls/connect`,
  `From` = the agent's registered mobile (`crm_agents.phone`, owner's from the card), `To` = customer, `CallerId` = the tenant's virtual
  number (`phone_lines.number`), `Record=true`, `StatusCallback` = `https://shubhora.com/api/phone/status`). The agent's phone rings first;
  on answer Exotel dials the customer.
- UI state: "आपका फ़ोन बज रहा है — उठाइए, फिर customer से जुड़ेगा" → "Connected 01:12" (poll `GET /api/crm/calls/<id>` every 3 s) → on
  end, the same outcome sheet, duration and recording pre-filled.
- `POST /api/phone/status` (Exotel callback; verify the Exotel IP list or a shared token in the URL): upsert `crm_calls` by `provider_sid`:
  status, seconds, `recording_url`. A cron (`bridge/call-recordings.mjs`, hourly) copies recordings into the `media` bucket at
  `calls/<owner>/<call id>.mp3` and keeps them 90 days (Exotel URLs are not permanent).
- Tables/env: `phone_lines` gains `caller_id` (the number shown to customers) and `outbound` boolean; env `EXOTEL_SID`, `EXOTEL_API_KEY`,
  `EXOTEL_API_TOKEN`, `EXOTEL_SUBDOMAIN` (`api.exotel.com` / `api.in.exotel.com`). One Exotel account for Shubhora; one virtual number per
  tenant (or a shared pool later).
- Cost and gating: Exotel ≈ ₹0.6–1.2 per minute (both legs) + number rent; sell as a **Calling add-on** (minutes wallet on the existing
  `credit_ledger`, e.g. 300 min / month) or inside Pro. Default off until a `phone_lines` row with `outbound=true` exists for the tenant;
  without it the Call button behaves like Phase 1. Owner decides the price (section 10).
- Not possible / not planned: WhatsApp voice calls through the API (no such API); reading the phone's call log in the Play-Store app
  (`READ_CALL_LOG` is restricted to default-dialer apps; possible only as a "dialer role" opt-in in the Android app — Phase 4, owner's call).

### 3.8 Tasks and reminders
- `crm_tasks` (section 4.2): kind **call / whatsapp / visit / meeting / other**, title, `due_at`, `assigned_to`, `remind_via` push / WhatsApp,
  `done_at`, `outcome`, `source` manual / auto / ai.
- Quick chips everywhere a task is made (Today 6 pm · Tomorrow 11 am · 3 days · Next week · pick date/time).
- `leads.next_follow_up` = the earliest open task's `due_at` (kept in sync by the tasks API) so the existing reminder cron, inbox badges and
  analytics keep working; when a task is done, the next open one becomes `next_follow_up`, or null.
- `bridge/crm-reminders.mjs` extended: one reminder per task at `remind_at` (default = due time; "30 min before" for visits/meetings),
  push (FCM, with a `url` to the customer) + the owner's WhatsApp line; snooze from the Today screen (1 h · tomorrow 11 am).
- Auto tasks (each a toggle in Settings → Automations): new lead from ad / form / webhook → "Call within 10 min" (assigned round-robin
  in Phase 3); no answer → retry in 3 h; Won → "Ask for review" (existing) + "30-day check-in"; booking done → "Feedback".
- A `whatsapp` task with text = a **scheduled message**: the reminder cron sends it through `sendCustomer()` at `due_at` when the owner's
  number is linked (and marks it done), otherwise reminds the owner with the text ready to forward (existing pattern in bookings).

### 3.9 Sales after Won, payments (Phase 3)
- Stage → **Won** opens "क्या बिका?": products multi-select from `poster_products` (qty, price editable), amount prefilled from
  `value_paise`, payment method, paid now / later → `crm_sales` row; `leads.kind = 'customer'`.
- A customer's screen → Sales tab → **New sale** (repeat business). Payment: UPI deep link (existing `PaySheet`), **Mark paid**, "payment
  due" task. Razorpay payment links per tenant are out of scope (Shubhora's Razorpay is Shubhora's own account).
- Revenue reports by month / product / source (section 3.12). Review ask stays tied to Won (existing).

### 3.10 Quotation (Phase 3)
Pick products (qty, rate, discount, optional GST %), validity, note → PDF (render with `puppeteer-core` + the Chrome already used by
`scripts/trade-check`, or `@react-pdf/renderer`; business name, logo, address from the card) → stored in `media` at
`quotes/<owner>/<id>.pdf` → sent on WhatsApp as a document through `/api/crm/send` (`fileUrl`) → `crm_quotes` status sent / accepted /
rejected / expired; **Accept** → creates the sale. Hindi or English per the card's language.

### 3.11 Lead capture (where leads come from)
Existing: card form, QR / vCard, WhatsApp bot, website chat `[[ORDER]]`, AI phone receptionist, inbound webhook (Zapier/Make: Facebook
Lead Ads, IndiaMART, JustDial, Google Forms), CSV / paste import. Add:
- **Import from phone contacts** (Capacitor `@capacitor-community/contacts` in the Android app; browser: the Contact Picker API where it exists).
- **Duplicate handling**: the existing normalised-phone check on add; a **Merge** action (`POST /api/crm/merge { keep, drop }`: moves messages,
  events, tasks, calls, sales, bookings to `keep`, unions tags, keeps the older `created_at`).
- Meta Lead Ads direct (webhook `leadgen` + `leads_retrieval` permission) — after the current App Review, as its own request. Later.
- Voice add ("naam aur number bolo") — Phase 3, nice-to-have.

### 3.12 Reports
Existing analytics sheet (30 days: new leads, won, conversion, reply times, 14-day chart, funnel, sources, agents) → becomes the Reports
section with a period picker (7 / 30 / 90 days) and these additions: **Calls** (made, connected %, average duration, by agent, by day),
**follow-up discipline** (tasks done on time %, overdue count), funnel **by source**, **lost reasons**, **revenue** (sales, by product), export CSV.
**Daily WhatsApp summary** to the owner at 8 pm IST (toggle): calls made / connected, leads added, won, tomorrow's due list — reuse the
weekly report script's sending.

### 3.13 Automations (Settings → Automations)
One screen of switches with editable templates (store in `owner_prefs.crm` jsonb): welcome to a new lead (the bot already does this — show the
state), auto task on new lead, no-answer retry + "missed you" WhatsApp, follow-up reminders (push / WhatsApp), review ask (existing),
festival wishes (existing), **birthday / anniversary wish** (new fields; cron daily 09:00 IST alongside festivals), stale-lead nudge
(no activity 7 days → remind the owner), Won → thank-you + 30-day check-in, daily summary. Each switch shows "last ran / last sent".

### 3.14 Team
Existing: agents with join codes, roles, assignment, team inbox, agent stats. Add (Phase 3): **round-robin** auto-assign of new leads among
active agents (toggle), per-agent **daily call target** with progress on Today, **leaderboard** in Reports (calls, connected, won), and in
Phase 2 the agent's registered mobile as the Exotel `From` so agents never show their own number.

### 3.15 Bilingual, desktop, performance, structure
- All strings in `src/components/crm/i18n.ts` (`{ hi, en }` per key) used through `useT().lang`; default Hindi. Dates/times in IST
  (`fmtWhen` from `src/lib/bookings.ts`).
- Desktop `md:` three-pane layout for Customers; Today and Reports as two columns. Keyboard: `/` focus search, `n` new lead (optional).
- Lists are paginated and searched on the server; optimistic updates; keep the 20 s poll (SSE later).
- Split the code: `src/components/crm/{today,list,customer,call,tasks,sales,quote,reports,settings,automations,i18n}.tsx` and
  `src/lib/crm/{today,tasks,calls,sales,reports}.ts`; `crm.tsx` keeps thread / templates / team / import / flow / integrations until moved.

---

## 4. Data model — `supabase/migrations/0068_crm_pro.sql` (owner runs it)

### 4.1 `leads` — new columns
```sql
alter table public.leads
  add column if not exists kind              text not null default 'lead',   -- lead | customer | lost
  add column if not exists alt_phone         text not null default '',
  add column if not exists business          text not null default '',
  add column if not exists address           text not null default '',
  add column if not exists pincode           text not null default '',
  add column if not exists birthday          date,
  add column if not exists anniversary       date,
  add column if not exists lang              text not null default '',       -- '' | hi | en (customer's preference)
  add column if not exists product_ids       uuid[] not null default '{}',   -- poster_products of interest
  add column if not exists budget_paise      bigint not null default 0,
  add column if not exists last_activity_at  timestamptz,
  add column if not exists last_call_at      timestamptz,
  add column if not exists calls_count       int not null default 0;
update public.leads set last_activity_at = greatest(coalesce(last_message_at, created_at), coalesce(updated_at, created_at)) where last_activity_at is null;
update public.leads set kind = 'customer' where status in ('converted', 'won') and kind = 'lead';
update public.leads set kind = 'lost' where status = 'lost' and kind = 'lead';
create index if not exists leads_owner_activity_idx on public.leads (owner_id, last_activity_at desc nulls last);
create index if not exists leads_owner_phone_idx on public.leads (owner_id, phone);
```
`card_id` becomes nullable (`alter table public.leads alter column card_id drop not null`) so a lead can be added before the card exists.

### 4.2 `crm_tasks`
```sql
create table if not exists public.crm_tasks (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  lead_id     uuid references public.leads(id) on delete cascade,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by  uuid references public.profiles(id) on delete set null,
  kind        text not null default 'call',        -- call | whatsapp | visit | meeting | other
  title       text not null default '',
  text        text not null default '',            -- whatsapp: the message to send at due_at
  due_at      timestamptz not null,
  remind_at   timestamptz,
  reminded_at timestamptz,
  done_at     timestamptz,
  outcome     text not null default '',
  source      text not null default 'manual',      -- manual | auto | ai
  created_at  timestamptz not null default now()
);
create index if not exists crm_tasks_due_idx on public.crm_tasks (owner_id, due_at) where done_at is null;
create index if not exists crm_tasks_lead_idx on public.crm_tasks (lead_id);
```

### 4.3 `crm_calls`
```sql
create table if not exists public.crm_calls (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  lead_id       uuid references public.leads(id) on delete set null,
  agent_id      uuid references public.profiles(id) on delete set null,
  direction     text not null default 'out',        -- out | in
  channel       text not null default 'phone',      -- phone (tel:) | exotel | ai (phone_calls)
  provider_sid  text,                               -- Exotel call sid (unique when set)
  status        text not null default 'done',       -- ringing | in_progress | done | failed
  started_at    timestamptz not null default now(),
  seconds       int not null default 0,
  outcome       text not null default 'unknown',    -- connected | no_answer | busy | switched_off | wrong_number | call_back | unknown
  note          text not null default '',
  recording_url text,
  created_at    timestamptz not null default now()
);
create unique index if not exists crm_calls_sid_idx on public.crm_calls (provider_sid) where provider_sid is not null;
create index if not exists crm_calls_owner_idx on public.crm_calls (owner_id, started_at desc);
create index if not exists crm_calls_lead_idx on public.crm_calls (lead_id, started_at desc);
```

### 4.4 `crm_sales` and `crm_quotes` (Phase 3)
```sql
create table if not exists public.crm_sales (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles(id) on delete cascade,
  lead_id        uuid not null references public.leads(id) on delete cascade,
  agent_id       uuid references public.profiles(id) on delete set null,
  items          jsonb not null default '[]',       -- [{product_id, name, qty, rate_paise}]
  amount_paise   bigint not null default 0,
  paid_paise     bigint not null default 0,
  status         text not null default 'open',      -- open | partial | paid | refunded
  method         text not null default '',          -- upi | cash | card | bank | other
  sold_at        timestamptz not null default now(),
  note           text not null default '',
  created_at     timestamptz not null default now()
);
create table if not exists public.crm_quotes (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  lead_id      uuid not null references public.leads(id) on delete cascade,
  number       text not null,                        -- Q-2026-0001 per owner
  items        jsonb not null default '[]',
  subtotal_paise bigint not null default 0,
  discount_paise bigint not null default 0,
  gst_pct      numeric(5,2) not null default 0,
  total_paise  bigint not null default 0,
  valid_till   date,
  pdf_url      text,
  status       text not null default 'draft',        -- draft | sent | accepted | rejected | expired
  sale_id      uuid references public.crm_sales(id) on delete set null,
  created_at   timestamptz not null default now()
);
```

### 4.5 Other
- `owner_prefs` add `crm jsonb not null default '{}'` (automation switches + templates + calling settings:
  `{ auto_task_new_lead, retry_after_min, missed_call_wa, missed_call_text, daily_summary, birthday_wish, stale_days, round_robin, call_target }`).
- `phone_lines` add `caller_id text`, `outbound boolean not null default false`.
- RLS on every new table: owner full access (`owner_id = auth.uid()`), team read/write through the `crm_agents` membership pattern of
  migration 0035; the service role bypasses as today. Grants as in 0002 / 0021.
- `member-wipe.ts`: add the new tables to the account-deletion list.

---

## 5. API (bearer, `/api/crm/*`, all accept `as=<ownerId>` and go through `resolveScope`)

| Route | Method | Purpose |
|---|---|---|
| `/api/crm/today` | GET | the Today buckets (section 3.1) + counters; agent = own leads only |
| `/api/crm/leads` | GET `?q&stage&kind&tag&source&assigned&city&due&idle&sort&page` | paginated list (50); `/api/crm/inbox` stays for the old UI |
| `/api/crm/lead` | POST / PATCH (existing) + new fields of 4.1 | PATCH also sets `last_activity_at`; `kind` follows status |
| `/api/crm/lead/[id]` | GET | lead + open tasks + last calls + sales + timeline page (merged, newest first, cursor) |
| `/api/crm/tasks` | GET / POST / PATCH / DELETE | `{lead_id, kind, title, text, due_at, assigned_to, remind_via}`; PATCH `{done, snooze_to}`; keeps `leads.next_follow_up` in sync |
| `/api/crm/calls` | GET / POST / PATCH | log a call (Phase 1) / set outcome, note, next task; writes `lead_events` + lead counters |
| `/api/crm/call` | POST `{lead_id}` | Phase 2: Exotel connect → `crm_calls` row `ringing` |
| `/api/crm/calls/[id]` | GET | live status for the calling UI |
| `/api/phone/status` | POST (Exotel callback, token in URL) | upsert by `provider_sid` |
| `/api/crm/sales` | GET / POST / PATCH | Phase 3 |
| `/api/crm/quotes` | GET / POST / PATCH, `/api/crm/quotes/[id]/pdf` | Phase 3 |
| `/api/crm/merge` | POST `{keep, drop}` | |
| `/api/crm/bulk` | POST `{ids, action, value}` | assign / stage / tag / template |
| `/api/crm/automations` | GET / PUT | `owner_prefs.crm` |
| `/api/crm/reports` | GET `?days=` | the analytics payload + calls, discipline, lost reasons, revenue |

Rules: validate like `lead/route.ts` (`S()`, `cleanPhone`, length caps); friendly errors in the user's language; service-role writes only for
counters/unread; every mutation adds a `lead_events` line (kind: `call`, `task`, `task_done`, `sale`, `quote`, `merge`).

---

## 6. Calling settings (Settings → Calling)
- "After a call, ask me what happened" (default on) · "No answer → remind me to call again after [3 h]" · "No answer → send this WhatsApp"
  (template, default off) · "Call list order" · Phase 2: "Call through my Shubhora number" (shows the line, minutes left, recordings on/off).

---

## 7. Notifications
Push (FCM, Android app) and the owner's WhatsApp line for: new lead (existing), unread after 10 min (existing bot pattern), task due,
missed / AI-answered call, daily summary. Every push carries a `url` to the exact customer or Today (`native-bridge.tsx` opens it).

---

## 8. Acceptance tests (what "done" means)
Phase 1
- [ ] `/poster/crm` opens on Today in Hindi; EN toggle switches every CRM string; nothing is left in English on the phone.
- [ ] A lead with an overdue task shows under Overdue with Call / WhatsApp / Done; Done marks the task and moves the next task up.
- [ ] Tap Call on Android → dialer opens → back in the app the outcome sheet appears; saving writes `crm_calls`, a timeline line, the task.
- [ ] "No answer" creates a "Call again" task in 3 h; the reminder arrives (push + WhatsApp) at that time.
- [ ] Call list: 12 due leads → Call → outcome → next; counter and order correct; works for an agent with assigned leads.
- [ ] Customers list searches on the server (type a name of a lead beyond the first 50) and pages.
- [ ] Customer screen: Chat / Activity / Details / Sales tabs; Activity shows messages, calls, tasks, bookings, notes in one order.
- [ ] A lead can be added without a card.
- [ ] Old `/poster/leads?tab=wa|bookings|phone|learn` still work. `npx tsc --noEmit -p .` and eslint clean; `npx next build` passes.
Phase 2
- [ ] Desktop: three panes; Call from desktop rings the owner's phone through Exotel, the call is recorded, the row shows duration and a
      playable recording; the outcome sheet appears after hang-up.
- [ ] Bulk: select 3 leads → tag + assign; broadcast a quick reply to a filtered segment respects opt-out and the 3-a-day cap.
- [ ] Automations screen saves and the daily 8 pm summary arrives on WhatsApp.
- [ ] Reports show calls per agent and lost reasons for the chosen period.
Phase 3
- [ ] Won → sale with products; Sales tab totals; revenue report by month.
- [ ] Quote PDF opens, is sent on WhatsApp as a document, Accept creates the sale.
- [ ] Birthday wish sent on the day (toggle on); round-robin assigns alternately; leaderboard counts calls from `crm_calls`.

---

## 9. Phases (each deployable on its own)

**Phase 1 — core + direct call (≈ 1 week).** Migration 0068 (4.1–4.3, 4.5 prefs); `/poster/crm` with Today, Customers (server list), Customer
screen (action bar, Activity timeline, Details), tasks + reminders (cron extension), Phase-1 calling (outcome sheet, call list), i18n, file
split, `card_id` nullable, `/api/crm/{today,leads,lead/[id],tasks,calls}`, bottom tab → `/poster/crm`.

**Phase 2 — professional calling + desktop + automations (≈ 5 days).** Exotel connect + status callback + recordings cron; desktop panes;
bulk actions; Automations screen (`owner_prefs.crm`); Reports v2; daily summary; stale-lead nudge; Calling settings.

**Phase 3 — after the sale + team (≈ 1 week).** Sales, products on the customer, quotes PDF, birthday/anniversary wishes, phone-contacts
import, merge, round-robin, call targets, leaderboard, scheduled WhatsApp tasks, segments.

**Later / owner's call.** Meta Lead Ads direct (new permission), Android dialer-role call-log sync, SSE realtime, custom fields, voice add.

---

## 10. What the owner has to do (non-code)
1. Run `supabase/migrations/0068_crm_pro.sql` in Supabase (Phase 1) — the session writes it, the owner runs it, as always.
2. Phase 2: open an **Exotel** account (KYC, ~1–2 days), buy one virtual number for the first tenant (Shubhora's own account first), create an
   API key/token; give the session `EXOTEL_SID / EXOTEL_API_KEY / EXOTEL_API_TOKEN / EXOTEL_SUBDOMAIN` for the server `.env.local`.
   Decide the price of the Calling add-on (suggested: included minutes in Pro, or ₹499 / 200 min as an add-on).
3. Decide which plan gets what: suggestion — Standard = full CRM Pro except cloud calling and quotes; Premium/Pro = everything.
4. Test on the Android app after each phase (tap-to-call and the outcome sheet need a real phone).

---

## 11. Other open items (as of 21 Oct 2026, so the next session knows)
- **Meta App Review** (docs/meta-app-review.md): 7 of 11 permissions complete; waiting on (a) Meta's Testing page to show the API test calls
  for ads_read, ads_management, pages_manage_engagement, instagram_manage_comments (up to 24 h after 21 Oct), (b) screencast "Video 2"
  (Reviews inbox: reply to a Facebook comment and an Instagram comment — needs one comment on each, made by someone other than the Page /
  the @shubhora_india account, with auto-reply OFF — then upload the MP4 to those three permissions), (c) a `metareview` Business-plan
  test login in the Reviewer instructions "access codes" box, (d) Submit. Auto-reply for FB and Instagram was switched OFF on 21 Oct
  for the recording — switch it back ON after Video 2.
- Real ad "Shubhora — AI Business Assistant" (act_2888671581268363, wa.me/918949551684, ₹200/day × 5) is Active since 21 Oct 2026;
  `13fa137` fixed Start so the ad set and ad switch on with the campaign. A campaign deleted in Ads Manager still shows in "My ads"
  until hidden (filter `effective_status` DELETED/ARCHIVED — small fix).
- From HANDOFF: owner setups (Cloud API number + `WA_ONBOARD_OWNER_ID`, Embedded Signup, Exotel line), bot "owner-style training" last.
