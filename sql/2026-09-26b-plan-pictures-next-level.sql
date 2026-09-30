-- Follow-up to 2026-09-26-shubhora-final-card.sql. Run in Supabase → SQL Editor after the deploy. Safe to run twice.
--   Step 1: the three plan pictures are replaced by fixed ones (the plan badge covered the plan's name).
--   Step 2: Next_Level (Joginder Yadav's card) goes back exactly as it was before today's update — it is not to be
--           changed by us. It is copied back from the backup that the first SQL made.

-- Step 1: new plan pictures on the Shubhora cards and on a template saved in Super Admin
update public.cards
   set data = replace(replace(replace(data::text,
         '/api/stock/demo/shubhora-plan-free.jpg',   '/api/stock/demo/shubhora-plan-free-v2.jpg'),
         '/api/stock/demo/shubhora-plan-growth.jpg', '/api/stock/demo/shubhora-plan-growth-v2.jpg'),
         '/api/stock/demo/shubhora-plan-custom.jpg', '/api/stock/demo/shubhora-plan-custom-v2.jpg')::jsonb
 where username is distinct from 'next_level'
   and (position('/api/stock/demo/shubhora-plan-free.jpg' in data::text) > 0
     or position('/api/stock/demo/shubhora-plan-growth.jpg' in data::text) > 0
     or position('/api/stock/demo/shubhora-plan-custom.jpg' in data::text) > 0);

update public.card_templates
   set data = replace(replace(replace(data::text,
         '/api/stock/demo/shubhora-plan-free.jpg',   '/api/stock/demo/shubhora-plan-free-v2.jpg'),
         '/api/stock/demo/shubhora-plan-growth.jpg', '/api/stock/demo/shubhora-plan-growth-v2.jpg'),
         '/api/stock/demo/shubhora-plan-custom.jpg', '/api/stock/demo/shubhora-plan-custom-v2.jpg')::jsonb,
       updated_at = now()
 where key = 'vcard-reseller';

-- Step 2: Next_Level back exactly as it was (from the backup)
update public.cards c
   set data = b.data
  from public.cards_backup_20260926_final b
 where c.id = b.id
   and c.username = 'next_level';

-- Check: each Shubhora card and its pages now
select c.username,
       (select string_agg(p->>'slug', ', ' order by o) from jsonb_array_elements(c.data->'pages') with ordinality x(p, o)) as pages,
       position('shubhora-plan-free-v2.jpg' in c.data::text) > 0 as new_plan_pictures
  from public.cards c
 where c.data->>'kb' = 'shubhora'
    or (coalesce(c.data->>'kb', '') = '' and (c.data->>'company' ilike '%shubhora%' or c.data->>'jobTitle' ilike '%shubhora partner%'))
 order by 1;
