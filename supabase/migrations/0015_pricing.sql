-- New pricing: ₹1999/month list, ₹1180/month for white-label partners.
--
-- Partner pricing is now an exact amount rather than a percentage off list.
-- A percentage can't land on a round number (41% off ₹1999 is ₹1179.41), and
-- the partner should be billed the figure they were quoted, to the rupee.

alter table public.plan_rates add column if not exists partner_price_paise bigint;

comment on column public.plan_rates.partner_price_paise is
  'Exact wholesale price for white-label partners. Falls back to price_paise minus the brand discount when null.';

update public.plan_rates set price_paise = 199900, partner_price_paise = 118000 where plan = 'pro';
update public.plan_rates set price_paise = 118000, partner_price_paise = 118000 where plan = 'team';

/* Exact partner price wins; the old percentage stays as the fallback so a brand
 * on a bespoke discount keeps working. */
create or replace function public.activation_cost(p_brand uuid, p_plan text, p_months int)
returns bigint language sql stable security definer set search_path = public as $$
  select greatest(0, (
    coalesce(
      r.partner_price_paise,
      r.price_paise * (100 - coalesce(b.rate_discount_pct, 0)) / 100
    ) * greatest(p_months, 1)
  )::bigint)
  from public.plan_rates r
  cross join public.brands b
  where r.plan = p_plan and b.id = p_brand;
$$;

select plan, price_paise, partner_price_paise from public.plan_rates order by plan;
