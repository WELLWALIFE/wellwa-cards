-- Third plan becomes "Custom Solutions" (owner's call, 25 Sep 2026): anything beyond Growth ₹2,999 — any software,
-- customization or automation — is quoted on request. Updates what is already saved:
--   1) Shubhora seller cards: the "Pro" item on "Plans and prices", the plan FAQs and the "(Growth / Pro)" labels.
--   2) The Shubhora Pro poster product.
-- Safe to run twice. Run in Supabase → SQL Editor.

-- 1a) The "Pro" plan item → "Custom Solutions" (its photo is kept).
update public.cards c
   set data = jsonb_set(c.data, '{pages}', (
     select coalesce(jsonb_agg(
              case when jsonb_typeof(p->'blocks') = 'array' then jsonb_set(p, '{blocks}', (
                select coalesce(jsonb_agg(
                         case when b->>'kind' = 'product' and jsonb_typeof(b->'items') = 'array' then jsonb_set(b, '{items}', (
                           select coalesce(jsonb_agg(
                                    case when i->>'name' = 'Pro' then (i - 'mrp') || jsonb_build_object(
                                      'name', 'Custom Solutions',
                                      'price', 'On request',
                                      'badge', 'Any software',
                                      'desc', 'Need more than Growth? Shubhora builds any software, customization and automation for your business — with a dedicated manager.',
                                      'features', jsonb_build_array(
                                        'Dedicated account manager',
                                        'Custom software, apps and websites — built for you',
                                        'Shubhora customized to the way your business works',
                                        'Automation of daily work — WhatsApp, leads, follow-ups, billing, reports',
                                        'Custom CRM / ERP, dashboards and team logins',
                                        'AI assistants and chatbots trained on your business',
                                        'Integrations — payment gateway, Tally, Google Sheets, your tools'),
                                      'specs', jsonb_build_array(
                                        jsonb_build_object('label', 'Price', 'value', 'On request — as per your need'),
                                        jsonb_build_object('label', 'Account manager', 'value', 'Dedicated'),
                                        jsonb_build_object('label', 'What we build', 'value', 'Any software, customization, automation')),
                                      'ctaLabel', 'Tell me what you need')
                                    else i end order by io), '[]'::jsonb)
                             from jsonb_array_elements(b->'items') with ordinality as ii(i, io)))
                         else b end order by bo), '[]'::jsonb)
                  from jsonb_array_elements(p->'blocks') with ordinality as bb(b, bo)))
              else p end order by po), '[]'::jsonb)
       from jsonb_array_elements(c.data->'pages') with ordinality as pp(p, po)))
 where (c.data->>'kb' = 'shubhora' or c.data->>'company' ilike '%shubhora%')
   and jsonb_typeof(c.data->'pages') = 'array'
   and position('"name": "Pro"' in c.data::text) > 0;

-- 1b) FAQs and labels. The new question "I need something more…" goes right after "Is GST extra?".
update public.cards
   set data = replace(replace(replace(replace(replace(replace(
              data::text,
              'No. ₹2,999 already includes GST. Pro is priced for your business — ask me for a quote.',
              'No. ₹2,999 already includes GST. Custom software and automation is quoted as per your need.'),
              'No. ₹2,999 and ₹4,999 already include GST.',
              'No. ₹2,999 already includes GST. Custom software and automation is quoted as per your need.'),
              '"q": "Is GST extra?"}',
              '"q": "Is GST extra?"}, {"a": "Yes. Shubhora builds all kinds of software — apps, CRM, automation, AI assistants, integrations — customized for your business, with a dedicated manager. Tell me what you need and I will get you a quote.", "q": "I need something more — my own software or automation?"}'),
              'Growth covers one business profile; Pro (custom price, with a dedicated manager) covers several brands with their own cards, posters and assistants.',
              'Growth covers one business profile; for several brands, Shubhora builds a custom setup (price on request, with a dedicated manager) — each with its own card, posters and assistants.'),
              '(Growth / Pro)', '(Growth)'),
              'Growth and Pro', 'Growth')::jsonb
 where (data->>'kb' = 'shubhora' or data->>'company' ilike '%shubhora%')
   and position('I need something more — my own software or automation?' in data::text) = 0
   and (position('Pro is priced for your business' in data::text) > 0 or position('₹4,999 already include' in data::text) > 0
        or position('"q": "Is GST extra?"}' in data::text) > 0 or position('(Growth / Pro)' in data::text) > 0
        or position('Pro (custom price, with a dedicated manager)' in data::text) > 0);

-- 2) The Pro poster product.
update public.poster_products
   set name = 'Shubhora Custom Solutions — Software & Automation',
       price = 'On request — contact us',
       offer = 'We make all kinds of software — tell us what you need',
       benefits = '["Dedicated account manager", "Custom software, apps and websites", "Automation of daily work", "Custom CRM / ERP and dashboards", "AI assistants trained on your business"]'::jsonb
 where name = 'Shubhora AI Business Assistant — Pro';

-- Check: both numbers should be 0.
select
  (select count(*) from public.cards where (data->>'kb' = 'shubhora' or data->>'company' ilike '%shubhora%')
      and (position('"name": "Pro"' in data::text) > 0 or position('Pro is priced for your business' in data::text) > 0)) as cards_still_old,
  (select count(*) from public.poster_products where name = 'Shubhora AI Business Assistant — Pro') as pro_products_still_old;
