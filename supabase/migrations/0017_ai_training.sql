-- Three-layer AI training.
--
--   Platform (super admin)  — HOW to answer: tone, length, language, safety.
--   Brand    (white label)  — WHAT the company sells: products, specs, objections.
--   Card     (the user)     — WHO this person is: their name, area, their own goods.
--
-- Precedence at answer time is Card > Brand > Platform: the seller's own words
-- always win, the brand fills the product gaps, the platform decides the style.
-- Brand was the missing middle — a Wellwa distributor had to retype every spec
-- into their own card, so most cards answered badly.

alter table public.brands add column if not exists bot_persona   text;
alter table public.brands add column if not exists bot_knowledge text;
alter table public.brands add column if not exists bot_faq       text;

comment on column public.brands.bot_knowledge is
  'Product/company facts shared by every member card of this brand.';

-- Members need to read their brand's training to answer; it is not secret —
-- the answers are public anyway.
drop policy if exists "public reads active brands" on public.brands;
create policy "public reads active brands" on public.brands
  for select using (active = true);

/**
 * Everything the assistant needs for one card, in a single anonymous-safe call:
 * the card's own training plus its brand's.
 */
create or replace function public.card_ai_context(p_username text)
returns table (
  brand_name text, brand_persona text, brand_knowledge text, brand_faq text
)
language sql stable security definer set search_path = public as $$
  select b.name, b.bot_persona, b.bot_knowledge, b.bot_faq
  from public.cards c
  join public.brands b on b.id = c.brand_id and b.active = true
  where lower(c.username) = lower(trim(p_username))
  limit 1;
$$;
grant execute on function public.card_ai_context(text) to anon, authenticated;

select 'ai training schema ready' as status;
