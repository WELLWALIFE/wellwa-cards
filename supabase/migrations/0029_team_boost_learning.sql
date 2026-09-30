-- Team mode: a brand (company) can publish products that every member with
-- that brand_id inherits when they have none of their own.
alter table public.poster_products add column if not exists brand_id uuid references public.brands(id) on delete cascade;
create index if not exists poster_products_brand_idx on public.poster_products(brand_id);

-- Boost: paid ads need the member's own long-lived user token (page tokens
-- can't create campaigns) and the ad account they picked.
alter table public.social_accounts add column if not exists user_token text;
alter table public.social_accounts add column if not exists ad_account_id text;

-- Learning loop: when the owner answers a customer by hand, the pair is
-- captured here; approving it appends to the card's bot knowledge.
create table if not exists public.bot_learning (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  question    text not null,
  answer      text not null,
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at  timestamptz not null default now()
);
create index if not exists bot_learning_user_idx on public.bot_learning(user_id, status);
alter table public.bot_learning enable row level security;
drop policy if exists "own bot learning" on public.bot_learning;
create policy "own bot learning" on public.bot_learning for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.bot_learning to authenticated, service_role;
select 'team boost learning ready' as status;
