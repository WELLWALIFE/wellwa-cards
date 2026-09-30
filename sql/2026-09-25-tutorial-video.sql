-- Shubhora partner cards made before 25 Sep 2026: add the "make your own card" tutorial video (YouTube) to the
-- Templates page, right after "How a template becomes your card" — the same place new cards get it from the template.
-- Safe to run twice (a card that already has the video is skipped). Run in Supabase → SQL Editor.
with t as (
  select c.id, (p.ord - 1) as idx, p.page
    from public.cards c,
         jsonb_array_elements(c.data->'pages') with ordinality as p(page, ord)
   where (c.data->>'kb' = 'shubhora' or c.data->>'company' ilike '%shubhora%')
     and p.page->>'slug' = 'templates'
     and position('l7XkMpb2RLo' in p.page::text) = 0
),
nb as (
  select t.id, t.idx,
         (select jsonb_agg(x.b order by x.o)
            from (
              select b, o::numeric as o from jsonb_array_elements(t.page->'blocks') with ordinality as e(b, o)
              union all
              -- after the block titled "How a template becomes your card" (else at the end, before the contact box)
              select jsonb_build_object('id', 'vc-tutorial', 'kind', 'video',
                       'title', 'Apna card khud banaiye — step by step',
                       'url', 'https://youtu.be/l7XkMpb2RLo',
                       'caption', '4 minute ka video: account, business details, products, AI se card, edit, publish aur share — sirf phone se.'),
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

select count(*) as cards_with_tutorial from public.cards where position('l7XkMpb2RLo' in data::text) > 0;
