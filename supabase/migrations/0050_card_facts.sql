-- Card facts: one saved place for what the owner tells us while making the V-Card, so a rebuild
-- starts from every earlier answer and the website and posters see the same details.
--   poster_products: price, MRP and brand exactly as the owner typed them (text, never parsed).
--   poster_profiles.card_facts: timings, UPI, since, offer, areas, photos, social links, etc.
--   (shape and limits: src/lib/card-facts.ts → normalizeFacts).
-- Additive and safe to run twice: nothing is deleted or changed. Existing RLS policies cover the
-- new columns. Run once in Supabase → SQL editor.
alter table public.poster_products
  add column if not exists price text not null default '',
  add column if not exists mrp   text not null default '',
  add column if not exists brand text not null default '';

alter table public.poster_profiles
  add column if not exists card_facts jsonb not null default '{}'::jsonb;

-- PostgREST caches the schema; tell it about the new columns straight away.
notify pgrst, 'reload schema';

select 'card facts ready' as status;
