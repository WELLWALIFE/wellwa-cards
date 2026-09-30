-- Product category (offers can target a category), nothing else.
alter table public.poster_products add column if not exists category text not null default '';
alter table public.poster_offers drop constraint if exists poster_offers_scope_check;
alter table public.poster_offers add constraint poster_offers_scope_check check (scope in ('all','products','category'));
alter table public.poster_offers add column if not exists categories text[] not null default '{}';
