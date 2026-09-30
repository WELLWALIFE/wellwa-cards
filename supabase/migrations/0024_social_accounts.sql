-- Facebook Page + Instagram Business connections for one-tap posting from
-- "Aaj Ka Poster" (and later the dashboard). Tokens are page tokens minted
-- from a long-lived user token; they only die when the user revokes the app
-- or changes their password, in which case status flips to 'reconnect'.

create table if not exists public.social_accounts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  provider         text not null check (provider in ('facebook','instagram')),
  account_id       text not null,             -- FB page id / IG business user id
  name             text not null default '',
  username         text not null default '',
  picture          text,
  page_id          text,                      -- IG: the FB page it hangs off
  access_token     text not null,
  token_expires_at timestamptz,
  status           text not null default 'ok' check (status in ('ok','reconnect')),
  connected_at     timestamptz not null default now(),
  unique (user_id, provider, account_id)
);
create index if not exists social_accounts_user_idx on public.social_accounts(user_id);

create table if not exists public.social_posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  account_id  uuid references public.social_accounts(id) on delete set null,
  provider    text,
  poster_id   uuid,
  caption     text default '',
  remote_id   text,
  status      text not null default 'ok',
  error       text,
  created_at  timestamptz not null default now()
);
create index if not exists social_posts_user_idx on public.social_posts(user_id, created_at desc);

alter table public.social_accounts enable row level security;
alter table public.social_posts    enable row level security;

-- Tokens never reach the browser: the app reads accounts through its own API
-- (service role) and strips access_token. No policy for authenticated = no
-- direct REST access to this table.
grant select, insert, update, delete on public.social_accounts to service_role;
grant select, insert, update, delete on public.social_posts    to service_role;

select 'social tables ready' as status;
