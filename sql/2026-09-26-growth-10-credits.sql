-- Growth: 10 AI credits a month, and the monthly credits are no longer written anywhere (owner's call, 26 Sep 2026).
-- Run in Supabase → SQL Editor AFTER the deploy. Safe to run twice.

-- 1) Everyone who has more than 10 plan (monthly) credits this month → 10. Bought packs are not touched.
update public.user_credits
   set monthly_balance = 10, updated_at = now()
 where monthly_balance > 10;

-- 2) Shubhora seller cards + a template saved in Super Admin: remove "50 AI credits every month",
--    the "AI credits: 50 a month" row and the "AI credits — 50 every month" comparison row.
create or replace function public.tmp_strip_credits(j jsonb) returns jsonb language plpgsql immutable as $$
declare r jsonb;
begin
  if jsonb_typeof(j) = 'object' then
    select coalesce(jsonb_object_agg(k, public.tmp_strip_credits(v)), '{}'::jsonb) into r from jsonb_each(j) as e(k, v);
    return r;
  elsif jsonb_typeof(j) = 'array' then
    select coalesce(jsonb_agg(public.tmp_strip_credits(v) order by o), '[]'::jsonb) into r
      from jsonb_array_elements(j) with ordinality as a(v, o)
     where not (v = '"50 AI credits every month"'::jsonb
             or (jsonb_typeof(v) = 'object' and v->>'label' = 'AI credits' and v->>'value' = '50 a month')
             or (jsonb_typeof(v) = 'object' and v->>'feature' = 'AI credits' and v->>'left' = '50 every month'));
    return r;
  end if;
  return j;
end $$;

update public.cards set data = public.tmp_strip_credits(data)
 where position('50 AI credits every month' in data::text) > 0 or position('50 every month' in data::text) > 0
    or position('"50 a month"' in data::text) > 0;

update public.card_templates set data = public.tmp_strip_credits(data)
 where position('50 AI credits every month' in data::text) > 0 or position('50 every month' in data::text) > 0
    or position('"50 a month"' in data::text) > 0;

drop function public.tmp_strip_credits(jsonb);

-- 3) The "Shubhora AI Business Assistant — Growth" products: drop the credits line from their benefits.
do $$
begin
  if (select data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'poster_products' and column_name = 'benefits') = 'ARRAY' then
    execute $q$update public.poster_products set benefits = array_remove(benefits, '50 AI credits every month')
               where '50 AI credits every month' = any(benefits)$q$;
  else
    execute $q$update public.poster_products set benefits = benefits - '50 AI credits every month'
               where benefits ? '50 AI credits every month'$q$;
  end if;
end $$;

-- Check: all three should be 0.
select
  (select count(*) from public.user_credits where monthly_balance > 10) as users_over_10,
  (select count(*) from public.cards where position('50 AI credits every month' in data::text) > 0
                                        or position('50 every month' in data::text) > 0) as cards_still_old,
  (select count(*) from public.poster_products where position('50 AI credits every month' in benefits::text) > 0) as products_still_old;
