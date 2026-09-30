-- Shubhora partner cards: "free for 1 year", domain only with the website, confident plan wording (owner, 27 Sep 2026).
-- Run in Supabase → SQL Editor AFTER the deploy (the 3 new plan pictures go live with it). Safe to run twice.
--
-- On every Shubhora partner card only the template's own sentences change — anything the partner wrote stays:
--   • "free for ever" → "free for 1 year"  (Home, Why Shubhora, Features, Plans, the pop-up)
--   • own domain: no longer shown as part of the free card — a personal domain goes with the website, bought by the customer
--   • Business page: no "nobody can promise" lines — every pair pays ₹500, up to 10 pairs a day in each binary
--   • 3 plan pictures → the new ones (one-link-v2, plan-free-v3, how-it-pays-v2)
--   • the old template AI tone ("offer a callback") and the old frozen AI notes (old prices) are cleared — the AI
--     already answers from the current Shubhora facts; lines a partner wrote in "AI notes" themselves are kept
-- Next_Level (Joginder ji) is NOT changed — to include it, delete the two lines marked NEXT_LEVEL below.

-- Step 0: backups (made once; a second run keeps the first copy)
create table if not exists public.cards_backup_20260927_free1yr as
  select c.* from public.cards c where (c.data->>'kb' = 'shubhora' or (coalesce(c.data->>'kb', '') = '' and (c.data->>'company' ilike '%shubhora%' or c.data->>'jobTitle' ilike '%shubhora partner%')));
create table if not exists public.card_templates_backup_20260927_free1yr as
  select * from public.card_templates where key = 'vcard-reseller';
alter table public.cards_backup_20260927_free1yr enable row level security;
alter table public.card_templates_backup_20260927_free1yr enable row level security;

-- The replacements, once (used by steps 1 and 3). Whole template sentences only, so a partner's own text is never hit.
create or replace function public._shubhora_fix_1yr(t text) returns text language sql immutable as $f$
  select replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(t,
    $q$"📇 Digital V-Card — free for ever"$q$,
    $q$"📇 Digital V-Card — free for 1 year"$q$),
    $q$"The V-Card and your leads are free for ever. The website, the AI assistant and the daily posters come with Growth."$q$,
    $q$"The V-Card and your leads are free for your first year. The website, the AI assistant and the daily posters come with Growth."$q$),
    $q$"Your digital V-Card is worth ₹1,499 — and free for you for ever. No card details, no hidden charge. Move to Growth only when you want the website, the AI assistant and daily posters."$q$,
    $q$"Your digital V-Card is worth ₹1,499 — and free for you for 1 year. No card details, no hidden charge. Add Growth whenever you want the website, the AI assistant and daily posters."$q$),
    $q$"Free for ever, not a trial"$q$,
    $q$"Free for a full year, not a trial"$q$),
    $q$"The V-Card, worth ₹1,499, stays free for as long as you use it. No card details needed."$q$,
    $q$"The V-Card, worth ₹1,499, is free for you for 1 year. No card details needed."$q$),
    $q$"Your own domain, even on Free"$q$,
    $q$"Your website, live from day one"$q$),
    $q$"yourbusiness.com can open your card on the free plan too."$q$,
    $q$"With Growth your full website opens on your Shubhora link. Want a personal domain like yourbusiness.com? Buy it and connect it."$q$),
    $q$"🔗 Your own domain"$q$,
    $q$"🔗 Your own link + QR code"$q$),
    $q$"yourbusiness.com opens your card, even on the free plan. A QR code for the counter and anything you print."$q$,
    $q$"shubhora.com/c/your-name, with a QR code for the counter and anything you print. Want a personal domain for your website? Buy it and connect it."$q$),
    $q$"Your card stays online, free, for ever. Only the Growth parts pause — website, AI assistant, daily posters — and they come back when you renew."$q$,
    $q$"Your card keeps working. Only the Growth parts pause — website, AI assistant, daily posters — and they come back when you renew."$q$),
    $q$"Free — for ever"$q$,
    $q$"Free — for 1 year"$q$),
    $q$"A complete digital V-Card worth ₹1,499, free for you for ever — on your own link, even on your own domain. No card details, no hidden charge."$q$,
    $q$"A complete digital V-Card worth ₹1,499, free for you for 1 year — on your own link. No card details, no hidden charge."$q$),
    $q$"Your own domain (yourbusiness.com) on the card"$q$,
    $q$"“Order on WhatsApp” button on every product"$q$),
    $q$"FREE for ever (worth ₹1,499)"$q$,
    $q$"FREE for 1 year (worth ₹1,499)"$q$),
    $q$"Own domain on the card"$q$,
    $q$"Personal domain (you buy it)"$q$),
    $q$"Does the free plan really stay free?"$q$,
    $q$"Is the V-Card really free?"$q$),
    $q$"Yes. The card — all its pages, products and gallery, your own domain and the leads it brings in — stays free for as long as you use it. You move up to Growth when you want the website, the WhatsApp AI assistant, the daily poster and auto-posting."$q$,
    $q$"Yes — free for you for 1 year: the card with all its pages, products and gallery, and the leads it brings in. No card details, no hidden charge. Add Growth when you want the website, the WhatsApp AI assistant, the daily poster and auto-posting."$q$),
    $q$Income comes only from real paid subscriptions and their renewals — never from just adding people — and nobody can honestly promise you an amount.$q$,
    $q$Income comes from real paid subscriptions and their renewals — every pair pays ₹500, and every renewal pays again. That is what makes it a lasting business.$q$),
    $q$"Every paid subscription is 2,500 BV. 2,500 BV on your left + 2,500 BV on your right = one pair = ₹500. At most 10 pairs a day in each binary."$q$,
    $q$"Every paid subscription is 2,500 BV. 2,500 BV on your left + 2,500 BV on your right = one pair = ₹500. Up to 10 pairs a day in each binary — paid every week."$q$),
    $q$"📏 Cap: 10 pairs a day in each binary"$q$,
    $q$"📏 Up to 10 pairs a day in each binary"$q$),
    $q$"Nobody can honestly promise a number. What you earn depends only on real paid subscriptions and renewals in your teams, within the plan's rules and caps. The figures in the plan are the most it can pay — not a promise."$q$,
    $q$"Every pair pays ₹500. There are two binaries — new sales and renewals — each up to 10 pairs a day (₹5,000): up to ₹10,000 a day and ₹3,00,000 a month, paid every week to your bank. The more real businesses your team brings and keeps, the more you earn."$q$),
    $q$"Yes. Nobody has to buy anything to join. Pairs are paid only while your own Growth plan is active (Green ID)."$q$,
    $q$"Yes. Nobody has to buy anything to join. Turn your own Growth plan on (Green ID) and every pair is paid."$q$),
    $q$"*The free plan stays free. No card details needed."$q$,
    $q$"*Free for 1 year. No card details needed."$q$),
    $q$"/api/stock/demo/shubhora-one-link.jpg"$q$,
    $q$"/api/stock/demo/shubhora-one-link-v2.jpg"$q$),
    $q$"/api/stock/demo/shubhora-plan-free-v2.jpg"$q$,
    $q$"/api/stock/demo/shubhora-plan-free-v3.jpg"$q$),
    $q$"/api/stock/demo/shubhora-plan-how-it-pays.jpg"$q$,
    $q$"/api/stock/demo/shubhora-plan-how-it-pays-v2.jpg"$q$)
$f$;

-- Step 1: texts and pictures on the partner cards
update public.cards c
   set data = public._shubhora_fix_1yr(c.data::text)::jsonb
 where (c.data->>'kb' = 'shubhora' or (coalesce(c.data->>'kb', '') = '' and (c.data->>'company' ilike '%shubhora%' or c.data->>'jobTitle' ilike '%shubhora partner%')))
   and c.username is distinct from 'next_level'   -- NEXT_LEVEL: delete this line to include Joginder ji's card
   and public._shubhora_fix_1yr(c.data::text) <> c.data::text;

-- Step 2: the old template AI tone and the old frozen AI notes (the partner's own lines stay)
update public.cards c
   set data = c.data
     || jsonb_build_object('botPersona', case when c.data->>'botPersona' = $q$A clear, friendly Shubhora advisor. Explains the digital V-Card in simple words in the visitor's own language, asks what work they do, shows how the card would help that trade, never pressures, and never promises any income. Offers a live demo and a callback whenever something needs confirming.$q$ then '' else coalesce(c.data->>'botPersona', '') end)
     || jsonb_build_object('botKnowledge', coalesce((
          select string_agg(u.l, E'\n' order by u.n)
            from unnest(string_to_array(coalesce(c.data->>'botKnowledge', ''), E'\n')) with ordinality as u(l, n)
           where u.l !~ $q$^\s*(PRODUCT|THE LINK|WHAT IS ON A CARD|AI ASSISTANT|LEADS AND CRM|WEBSITE|POSTERS AND VIDEOS[^:]*|PLANS[^:]*|CREDITS|WHO IT IS FOR|AGAINST A PAPER CARD|BUSINESS OPPORTUNITY|SAMPLE CONTENT|SAFETY):$q$ and btrim(u.l) <> ''), ''))
 where (c.data->>'kb' = 'shubhora' or (coalesce(c.data->>'kb', '') = '' and (c.data->>'company' ilike '%shubhora%' or c.data->>'jobTitle' ilike '%shubhora partner%')))
   and c.username is distinct from 'next_level'   -- NEXT_LEVEL: delete this line to include Joginder ji's card
   and (c.data->>'botPersona' = $q$A clear, friendly Shubhora advisor. Explains the digital V-Card in simple words in the visitor's own language, asks what work they do, shows how the card would help that trade, never pressures, and never promises any income. Offers a live demo and a callback whenever something needs confirming.$q$
        or coalesce(c.data->>'botKnowledge', '') ~ $q$(^|\n)\s*(PRODUCT|THE LINK|WHAT IS ON A CARD|AI ASSISTANT|LEADS AND CRM|WEBSITE|POSTERS AND VIDEOS[^:]*|PLANS[^:]*|CREDITS|WHO IT IS FOR|AGAINST A PAPER CARD|BUSINESS OPPORTUNITY|SAMPLE CONTENT|SAFETY):$q$);

-- Step 3: the template saved in Super Admin (it wins over the built-in one for new cards)
update public.card_templates
   set data = public._shubhora_fix_1yr(data::text)::jsonb
            || case when data->>'botPersona' = $q$A clear, friendly Shubhora advisor. Explains the digital V-Card in simple words in the visitor's own language, asks what work they do, shows how the card would help that trade, never pressures, and never promises any income. Offers a live demo and a callback whenever something needs confirming.$q$ then jsonb_build_object('botPersona', '') else '{}'::jsonb end,
       updated_at = now()
 where key = 'vcard-reseller'
   and (public._shubhora_fix_1yr(data::text) <> data::text or data->>'botPersona' = $q$A clear, friendly Shubhora advisor. Explains the digital V-Card in simple words in the visitor's own language, asks what work they do, shows how the card would help that trade, never pressures, and never promises any income. Offers a live demo and a callback whenever something needs confirming.$q$);

-- The helper is not needed any more
drop function if exists public._shubhora_fix_1yr(text);

-- Check: every changed card shows 0, 0, true, true (next_level keeps its old text unless you included it)
select c.username,
       (length(c.data::text) - length(replace(c.data::text, 'for ever', ''))) / length('for ever') as free_for_ever_left,
       (length(c.data::text) - length(replace(c.data::text, 'promise', ''))) / length('promise') as promise_left,
       c.data::text like '%shubhora-plan-free-v3.jpg%' as new_pictures,
       coalesce(c.data->>'botPersona', '') <> $q$A clear, friendly Shubhora advisor. Explains the digital V-Card in simple words in the visitor's own language, asks what work they do, shows how the card would help that trade, never pressures, and never promises any income. Offers a live demo and a callback whenever something needs confirming.$q$ as old_tone_gone
  from public.cards c
 where (c.data->>'kb' = 'shubhora' or (coalesce(c.data->>'kb', '') = '' and (c.data->>'company' ilike '%shubhora%' or c.data->>'jobTitle' ilike '%shubhora partner%')))
 order by c.username;
