-- Notifications: web push (browser) + WhatsApp, switched on/off by the Super Admin.
-- Run once in Supabase → SQL editor. Safe to run again.

-- One row of switches. `types` holds, per notification type, whether push and WhatsApp are on:
--   { "new_lead": { "push": true, "whatsapp": true }, ... }
create table if not exists public.notification_settings (
  id          smallint primary key default 1,
  enabled     boolean not null default true,      -- master switch: all notifications
  push        boolean not null default true,      -- channel switch: web push
  whatsapp    boolean not null default true,      -- channel switch: WhatsApp
  types       jsonb   not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  constraint notification_settings_singleton check (id = 1)
);
insert into public.notification_settings (id) values (1) on conflict (id) do nothing;

-- Browsers that allowed notifications (one row per browser/device).
create table if not exists public.push_subscriptions (
  endpoint    text primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);

-- What was sent, so a notification is never sent twice for the same thing and the admin can see counts.
create table if not exists public.notification_log (
  id          bigserial primary key,
  user_id     uuid references public.profiles(id) on delete cascade,
  type        text not null,
  channel     text not null check (channel in ('push', 'whatsapp')),
  ref         text,                                  -- e.g. lead id or date, for de-duplication
  ok          boolean not null,
  error       text,
  created_at  timestamptz not null default now()
);
create index if not exists notification_log_recent_idx on public.notification_log(created_at desc);
create unique index if not exists notification_log_once_idx
  on public.notification_log(user_id, type, channel, ref) where ref is not null and ok;

-- Only the server (service role) reads or writes these tables.
alter table public.notification_settings enable row level security;
alter table public.push_subscriptions   enable row level security;
alter table public.notification_log     enable row level security;
