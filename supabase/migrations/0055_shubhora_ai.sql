-- Shubhora AI (owner's call, 24 Sep 2026): every Shubhora partner's assistant (card chat + WhatsApp) answers from
-- Shubhora's own, always-current facts. The built-in text lives in bridge/shubhora-kb.mjs; these three columns let
-- the owner change it from Super Admin → Shubhora AI without a deploy (empty = built-in text).
alter table public.platform_settings add column if not exists shubhora_persona   text not null default '';
alter table public.platform_settings add column if not exists shubhora_knowledge text not null default '';
alter table public.platform_settings add column if not exists shubhora_faq       text not null default '';

-- Mark the Shubhora partner cards made before the marker existed (the "Promote Shubhora" template gave them the
-- Shubhora company name / title and a copy of the facts in their notes). Marked cards get the live facts.
update public.cards
   set data = jsonb_set(data, '{kb}', '"shubhora"')
 where coalesce(data->>'kb', '') = ''
   and (data->>'company' ilike '%shubhora%'
        or data->>'jobTitle' ilike '%shubhora partner%'
        or data->>'botKnowledge' like 'PRODUCT: Shubhora is a digital visiting card%');

select count(*) as shubhora_partner_cards from public.cards where data->>'kb' = 'shubhora';
