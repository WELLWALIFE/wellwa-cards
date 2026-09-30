-- Product poster mode: daily poster = the member's product + a rotating
-- benefit/offer line (+ festival title on occasion days). Plus WhatsApp
-- Status as a third auto-post channel.
create table if not exists public.poster_products (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null default '',
  photo_url   text,
  benefits    jsonb not null default '[]'::jsonb,   -- ["line", ...] rotated daily
  offer       text default '',
  sort        int  not null default 0,
  active      bool not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists poster_products_user_idx on public.poster_products(user_id);
alter table public.poster_products enable row level security;
drop policy if exists "own poster products" on public.poster_products;
create policy "own poster products" on public.poster_products for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.poster_products to authenticated, service_role;

alter table public.poster_profiles add column if not exists mode text not null default 'greeting' check (mode in ('greeting','product'));

alter table public.social_accounts drop constraint if exists social_accounts_provider_check;
alter table public.social_accounts add constraint social_accounts_provider_check check (provider in ('facebook','instagram','whatsapp'));
select 'product posters ready' as status;
