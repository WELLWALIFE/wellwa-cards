-- Reviews inbox (FB/IG comments + Page reviews + Google reviews) with AI replies,
-- and Google Business Profile connection. Service-role only, like social_accounts.

alter table public.social_accounts add column if not exists auto_reply bool not null default false;

create table if not exists public.google_accounts (
  user_id          uuid primary key references public.profiles(id) on delete cascade,
  account_name     text not null default '',   -- accounts/123
  location_name    text not null default '',   -- accounts/123/locations/456
  location_title   text not null default '',
  access_token     text not null default '',
  refresh_token    text not null default '',
  token_expires_at timestamptz,
  status           text not null default 'ok' check (status in ('ok','reconnect')),
  auto_post        bool not null default false,
  auto_reply       bool not null default false,
  last_auto_post   date,
  connected_at     timestamptz not null default now()
);
alter table public.google_accounts enable row level security;
grant select, insert, update, delete on public.google_accounts to service_role;

create table if not exists public.social_replies (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  provider    text not null check (provider in ('facebook','instagram','google')),
  item_id     text not null,                       -- comment id / review name
  item_kind   text not null default 'comment' check (item_kind in ('comment','review')),
  author      text not null default '',
  text        text not null default '',
  rating      int,
  reply_text  text not null default '',
  status      text not null default 'sent' check (status in ('sent','failed','ignored')),
  auto        bool not null default false,
  error       text,
  created_at  timestamptz not null default now(),
  unique (user_id, provider, item_id)
);
create index if not exists social_replies_user_idx on public.social_replies(user_id, created_at desc);
alter table public.social_replies enable row level security;
grant select, insert, update, delete on public.social_replies to service_role;

select 'reviews + google ready' as status;
