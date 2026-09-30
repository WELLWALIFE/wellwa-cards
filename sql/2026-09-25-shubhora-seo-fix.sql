-- Shubhora seller cards made from an older card kept that card's Google title / description / keywords
-- (e.g. the search title still said the old shop's name). Clear the ones that do not mention Shubhora — the card
-- then uses its automatic title from the name and "Shubhora". The Google site-verification code is kept.
-- Safe to run twice. Run in Supabase → SQL Editor.
update public.cards
   set data = (data - 'seoTitle' - 'seoDescription')
              || case when coalesce(data->>'seoTitle', '') ilike '%shubhora%' then jsonb_build_object('seoTitle', data->'seoTitle') else '{}'::jsonb end
              || case when coalesce(data->>'seoDescription', '') ilike '%shubhora%' then jsonb_build_object('seoDescription', data->'seoDescription') else '{}'::jsonb end
              || case when jsonb_typeof(data->'seo') = 'object' and coalesce(data->'seo'->>'keywords', '') not ilike '%shubhora%'
                      then jsonb_build_object('seo', (data->'seo') - 'keywords')
                      else '{}'::jsonb end
 where (data->>'kb' = 'shubhora' or data->>'company' ilike '%shubhora%')
   and ((coalesce(data->>'seoTitle', '') <> '' and data->>'seoTitle' not ilike '%shubhora%')
     or (coalesce(data->>'seoDescription', '') <> '' and data->>'seoDescription' not ilike '%shubhora%')
     or (jsonb_typeof(data->'seo'->'keywords') = 'array' and jsonb_array_length(data->'seo'->'keywords') > 0 and (data->'seo'->>'keywords') not ilike '%shubhora%'));

-- Check: should be 0.
select count(*) as shubhora_cards_with_old_seo
  from public.cards
 where (data->>'kb' = 'shubhora' or data->>'company' ilike '%shubhora%')
   and coalesce(data->>'seoTitle', '') <> '' and data->>'seoTitle' not ilike '%shubhora%';
