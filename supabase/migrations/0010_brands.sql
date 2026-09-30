-- White label: a reseller runs the whole card platform under their own domain
-- and their own name.
--
-- Wellwa Life is the motivating case: they point *.wellwalife.com here once,
-- and every distributor who signs up under them gets <name>.wellwalife.com
-- automatically, with Wellwa's logo instead of NeuralEdge's.

create table if not exists public.brands (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,            -- 'wellwa'
  name          text not null,                   -- 'Wellwa Life'
  base_domain   text not null unique,            -- 'wellwalife.com' → <user>.wellwalife.com
  logo_url      text,
  theme_color   text not null default '#0e9e90',
  support_email text,
  -- White-label proper: hide "Powered by NeuralEdge" on their members' cards.
  hide_platform_branding bool not null default true,
  -- Flipped on once the wildcard DNS record is confirmed pointing at us.
  active        bool not null default false,
  dns_verified_at timestamptz,
  last_error    text,
  created_at    timestamptz not null default now()
);

-- Which brand a card belongs to. Null = plain NeuralEdge card.
alter table public.cards add column if not exists brand_id uuid references public.brands(id) on delete set null;
create index if not exists cards_brand_idx on public.cards(brand_id);

alter table public.brands enable row level security;

-- Anyone may read an active brand: the public card page needs its logo and
-- name to render, and middleware needs base_domain to route.
drop policy if exists "public reads active brands" on public.brands;
create policy "public reads active brands" on public.brands
  for select using (active = true);

grant select on public.brands to anon, authenticated;

-- Resolve <sub>.<base_domain> to a card in one round trip. Definer so it can
-- see the card row regardless of who is asking; only ever returns a username.
create or replace function public.resolve_brand_host(p_host text)
returns table (username text, brand_slug text, brand_name text, logo_url text,
               theme_color text, hide_branding bool)
language sql
stable
security definer
set search_path = public
as $$
  select c.username, b.slug, b.name, b.logo_url, b.theme_color, b.hide_platform_branding
  from public.brands b
  join public.cards c
    on c.brand_id = b.id
   and lower(c.username) = lower(split_part(lower(trim(p_host)), '.', 1))
  where b.active = true
    and lower(trim(p_host)) like '%.' || lower(b.base_domain)
    and c.active = true
  limit 1;
$$;

revoke all on function public.resolve_brand_host(text) from public;
grant execute on function public.resolve_brand_host(text) to anon, authenticated;
