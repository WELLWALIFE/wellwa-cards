-- App Review prep (1 Oct 2026): Meta's deauthorize / data-deletion callbacks identify the person by their Facebook
-- user id, so we keep it on every connected row; and a small log of deletion requests so /data-deletion?code=… can
-- show the status Meta asks us to provide. Safe to run on the live database: adds a column and a table, nothing else.
alter table public.social_accounts add column if not exists meta_user_id text;
create index if not exists social_accounts_meta_user_idx on public.social_accounts (meta_user_id);

create table if not exists public.data_deletion_requests (
  code        text primary key,                      -- SH-XXXXXXX-XXXXXX, shown to the user by Facebook
  provider    text not null default 'meta',
  external_id text not null,                         -- the Facebook user id the request came for
  user_ids    uuid[] not null default '{}',          -- Shubhora accounts that were linked to it
  removed     integer not null default 0,            -- connected accounts deleted
  status      text not null default 'done',
  created_at  timestamptz not null default now()
);
alter table public.data_deletion_requests enable row level security;   -- no policies: service role only
