-- 0063 — "Hi on WhatsApp → website" (owner's call, 8 Oct 2026).
--
-- Shubhora's OWN WhatsApp number (a wa_cloud_accounts row; WA_ONBOARD_OWNER_ID names its owner) runs a different
-- bot from a seller's number: it talks a new business through what the website needs (name, trade, city, owner,
-- photos, products), makes their account, builds the website and puts it live — all inside WhatsApp. After that
-- the same chat edits the live website ("phone number badlo", "timing 10-8 karo") and swaps its look.
--
-- One row per WhatsApp number: where the chat is (stage) and everything it has collected so far (data: the facts,
-- the uploaded photos, the products read off a rate list, the last messages, the looks the build offered).
-- Service role only — the app never reads it from the browser.
create table if not exists public.wa_onboard (
  phone       text primary key,                                           -- E.164, "+919876543210"
  user_id     uuid references public.profiles(id) on delete set null,     -- the account it made (or matched)
  stage       text not null default 'new',                                -- new | asking | photos | building | live
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.wa_onboard enable row level security;
create index if not exists wa_onboard_user_idx on public.wa_onboard (user_id);
