-- New pricing on what is already saved (owner's call, 25 Sep 2026):
--   Free V-Card shown as "Worth ₹1,499 — FREE" (no struck price);  Pro = custom price with a dedicated account manager.
-- 1) Shubhora seller cards: the "Plans and prices" page and the plan FAQs.  2) The 3 Shubhora plan products.
-- Safe to run twice. Run in Supabase → SQL Editor.
update public.cards
   set data = replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
              data::text,
              '"price": "₹4,999 / month"', '"price": "Custom price", "badge": "Dedicated manager"'),
              '"value": "₹4,999 a month, GST included"', '"value": "Custom — as per your business"'),
              '"label": "AI credits", "value": "500 a month"', '"label": "Account manager", "value": "Dedicated"'),
              '"For teams, several brands and a lot more AI video."', '"For teams, several brands and more AI — priced for your business, with your own account manager."'),
              '"3 business profiles or brands"', '"More business profiles or brands"'),
              '"10,000 AI replies a month"', '"10,000+ AI replies a month"'),
              '"5 CRM team members"', '"CRM seats for your team"'),
              '"500 AI credits every month"', '"Dedicated account manager"'),
              '"price": "₹0"', '"price": "FREE"'),
              '"value": "₹0"', '"value": "FREE for ever (worth ₹1,499)"'),
              'No. ₹2,999 and ₹4,999 already include GST.', 'No. ₹2,999 already includes GST. Pro is priced for your business — ask me for a quote.'),
              'Pro covers three brands', 'Pro (custom price, with a dedicated manager) covers several brands'),
              -- the free plan: a "Worth ₹1,499" badge and a clear line, never a struck-through price
              '"mrp": "₹1,499", ', ''),
              '"value": "₹1,499 — FREE for ever"', '"value": "FREE for ever (worth ₹1,499)"'),
              '"badge": "Start here"', '"badge": "Worth ₹1,499"'),
              '"A complete digital V-Card on your own link — even on your own domain. No card details needed."', '"A complete digital V-Card worth ₹1,499, free for you for ever — on your own link, even on your own domain. No card details, no hidden charge."')::jsonb
 where (data->>'kb' = 'shubhora' or data->>'company' ilike '%shubhora%')
   and (position('₹4,999' in data::text) > 0 or position('"price": "₹0"' in data::text) > 0
        or position('"mrp": "₹1,499"' in data::text) > 0 or position('"badge": "Start here"' in data::text) > 0);

update public.poster_products
   set price = 'Custom — talk to us', offer = 'Priced for your business — with a dedicated manager'
 where name = 'Shubhora AI Business Assistant — Pro' and price like '4,999%';

update public.poster_products
   set price = 'FREE for ever (worth ₹1,499)', mrp = ''
 where name = 'Free Digital V-Card' and (price like '0%' or price = 'FREE for ever');

select
  (select count(*) from public.cards where position('₹4,999' in data::text) > 0 and (data->>'kb' = 'shubhora' or data->>'company' ilike '%shubhora%')) as seller_cards_still_old,
  (select count(*) from public.poster_products where name like 'Shubhora AI Business Assistant — Pro' and price like '4,999%') as pro_products_still_old;
