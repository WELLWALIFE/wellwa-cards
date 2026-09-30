-- Shubhora partner cards (live): the "make your own card" tutorial is now the new video on the Shubhora Facebook page
-- (owner's call, 26 Sep 2026). Run in Supabase → SQL Editor. Safe to run twice.
--   Step 1: every card that has the old YouTube tutorial → the new Facebook video, with the new English title and caption.
--   Step 2: a Shubhora card that has neither → the video is added to its Templates page, after
--           "How a template becomes your card" (else at the end) — the same place new cards get it from the template.

-- Step 1
update public.cards
   set data = replace(replace(replace(data::text,
         'https://youtu.be/l7XkMpb2RLo', 'https://www.facebook.com/reel/1078388548446035/'),
         'Apna card khud banaiye — step by step', 'Make your card yourself — step by step'),
         '4 minute ka video: account, business details, products, AI se card, edit, publish aur share — sirf phone se.',
         '5-minute video (in Hindi): account, business details, products with MRP and offer price, the AI card, editing and sharing — just with your phone.')::jsonb
 where position('l7XkMpb2RLo' in data::text) > 0;

-- Step 2
with t as (
  select c.id, (p.ord - 1) as idx, p.page
    from public.cards c,
         jsonb_array_elements(c.data->'pages') with ordinality as p(page, ord)
   where (c.data->>'kb' = 'shubhora' or c.data->>'company' ilike '%shubhora%')
     and p.page->>'slug' = 'templates'
     and position('1078388548446035' in c.data::text) = 0
),
nb as (
  select t.id, t.idx,
         (select jsonb_agg(x.b order by x.o)
            from (
              select b, o::numeric as o from jsonb_array_elements(t.page->'blocks') with ordinality as e(b, o)
              union all
              select jsonb_build_object('id', 'vc-tutorial', 'kind', 'video',
                       'title', 'Make your card yourself — step by step',
                       'url', 'https://www.facebook.com/reel/1078388548446035/',
                       'caption', '5-minute video (in Hindi): account, business details, products with MRP and offer price, the AI card, editing and sharing — just with your phone.'),
                     coalesce((select o2 + 0.5 from jsonb_array_elements(t.page->'blocks') with ordinality as e2(b2, o2)
                                where b2->>'title' = 'How a template becomes your card' limit 1),
                              jsonb_array_length(t.page->'blocks') - 0.5)
            ) x) as blocks
    from t
)
update public.cards c
   set data = jsonb_set(c.data, array['pages', nb.idx::text, 'blocks'], nb.blocks)
  from nb
 where c.id = nb.id;

-- Step 3: a template saved in Super Admin (it wins over the built-in one) gets the same change
update public.card_templates
   set data = replace(replace(replace(data::text,
         'https://youtu.be/l7XkMpb2RLo', 'https://www.facebook.com/reel/1078388548446035/'),
         'Apna card khud banaiye — step by step', 'Make your card yourself — step by step'),
         '4 minute ka video: account, business details, products, AI se card, edit, publish aur share — sirf phone se.',
         '5-minute video (in Hindi): account, business details, products with MRP and offer price, the AI card, editing and sharing — just with your phone.')::jsonb
 where position('l7XkMpb2RLo' in data::text) > 0;

-- Check: the first number should be how many Shubhora cards you have; the second should be 0.
select count(*) filter (where position('1078388548446035' in data::text) > 0) as cards_with_new_video,
       count(*) filter (where position('l7XkMpb2RLo' in data::text) > 0)      as cards_with_old_video
  from public.cards;
