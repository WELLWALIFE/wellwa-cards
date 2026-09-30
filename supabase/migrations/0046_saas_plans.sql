-- 0046: the all-in-one SaaS subscription (Growth / Pro) with monthly credits.
--   • monthly credits come with the plan and expire with it; bought credit packs never expire
--   • spending always uses the monthly credits first, so the packs the customer paid for survive
alter table public.profiles
  add column if not exists saas_tier       text not null default 'none' check (saas_tier in ('none','growth','pro')),
  add column if not exists saas_expires_at timestamptz,
  add column if not exists saas_started_at timestamptz;

alter table public.user_credits
  add column if not exists monthly_balance    int not null default 0 check (monthly_balance >= 0),
  add column if not exists monthly_expires_at timestamptz;

-- ---------- spend: monthly first, then the packs ----------
create or replace function public.spend_credits(p_user uuid, p_amount int, p_reason text, p_ref text default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_pack int; v_month int; v_exp timestamptz; v_take int;
begin
  if p_amount <= 0 then raise exception 'Invalid amount'; end if;
  insert into public.user_credits(user_id, balance) values (p_user, 0) on conflict (user_id) do nothing;
  select balance, monthly_balance, monthly_expires_at into v_pack, v_month, v_exp
    from public.user_credits where user_id = p_user for update;
  if v_exp is not null and v_exp < now() then v_month := 0; end if;   -- this month's credits have lapsed
  if v_pack + v_month < p_amount then raise exception 'INSUFFICIENT_CREDITS'; end if;
  v_take := least(v_month, p_amount);
  update public.user_credits
     set monthly_balance = v_month - v_take,
         balance = balance - (p_amount - v_take),
         updated_at = now()
   where user_id = p_user;
  insert into public.credit_ledger(user_id, delta, reason, ref) values (p_user, -p_amount, p_reason, p_ref);
  return v_pack + v_month - p_amount;
end $$;
revoke all on function public.spend_credits(uuid,int,text,text) from public, anon, authenticated;
grant execute on function public.spend_credits(uuid,int,text,text) to service_role;

-- ---------- what the customer can spend right now ----------
create or replace function public.my_credits()
returns int language sql stable security definer set search_path = public as $$
  select coalesce((select balance + (case when monthly_expires_at is null or monthly_expires_at > now() then monthly_balance else 0 end)
                     from public.user_credits where user_id = auth.uid()), 0);
$$;
grant execute on function public.my_credits() to authenticated;

-- ---------- this month's allowance (replaces whatever is left, never adds up) ----------
create or replace function public.grant_monthly_credits(p_user uuid, p_amount int, p_until timestamptz)
returns int language plpgsql security definer set search_path = public as $$
declare v_old int;
begin
  insert into public.user_credits(user_id, balance) values (p_user, 0) on conflict (user_id) do nothing;
  select monthly_balance into v_old from public.user_credits where user_id = p_user for update;
  update public.user_credits set monthly_balance = greatest(0, p_amount), monthly_expires_at = p_until, updated_at = now() where user_id = p_user;
  insert into public.credit_ledger(user_id, delta, reason, ref) values (p_user, p_amount - coalesce(v_old, 0), 'plan-credits', to_char(p_until, 'YYYY-MM'));
  return p_amount;
end $$;
revoke all on function public.grant_monthly_credits(uuid,int,timestamptz) from public, anon, authenticated;
grant execute on function public.grant_monthly_credits(uuid,int,timestamptz) to service_role;

-- ---------- one verified subscription payment ----------
create or replace function public.apply_saas_payment(p_user uuid, p_tier text, p_ref text, p_order_ref text, p_amount int, p_credits int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_from timestamptz; v_end timestamptz;
begin
  if p_user is null or p_tier not in ('growth','pro') or coalesce(trim(p_ref),'') = '' or coalesce(trim(p_order_ref),'') = '' or p_amount <= 0 then
    raise exception 'Invalid verified payment';
  end if;
  if exists (select 1 from public.subscriptions where provider = 'razorpay' and provider_ref = p_ref) then
    select current_end into v_end from public.subscriptions where provider = 'razorpay' and provider_ref = p_ref;
    return jsonb_build_object('ok', true, 'replayed', true, 'expires', v_end);
  end if;
  select greatest(coalesce(saas_expires_at, now()), now()) into v_from from public.profiles where id = p_user for update;
  v_end := v_from + interval '1 month';
  update public.profiles
     set saas_tier = p_tier,
         saas_expires_at = v_end,
         saas_started_at = coalesce(saas_started_at, now()),
         plan = 'pro', plan_source = 'paid', plan_expires_at = v_end,          -- card + CRM + WhatsApp
         poster_plan = 'business', poster_plan_expires_at = v_end               -- posters + studio
   where id = p_user;
  insert into public.subscriptions(owner_id, plan, status, provider, provider_ref, amount, period, current_end)
    values (p_user, 'pro', 'active', 'razorpay', p_ref, p_amount, 'monthly', v_end);
  perform public.grant_monthly_credits(p_user, p_credits, v_end);
  return jsonb_build_object('ok', true, 'tier', p_tier, 'expires', v_end, 'credits', p_credits);
end $$;
revoke all on function public.apply_saas_payment(uuid,text,text,text,int,int) from public, anon, authenticated;
grant execute on function public.apply_saas_payment(uuid,text,text,text,int,int) to service_role;

-- ---------- what the app shows the customer ----------
create or replace function public.my_saas()
returns table(tier text, expires_at timestamptz, days_left int, state text, monthly_credits int, pack_credits int)
language sql stable security definer set search_path = public as $$
  select p.saas_tier,
         p.saas_expires_at,
         greatest(0, extract(day from coalesce(p.saas_expires_at, now()) - now())::int),
         case when p.saas_tier = 'none' or p.saas_expires_at is null then 'none'
              when p.saas_expires_at > now() then 'active'
              when p.saas_expires_at > now() - interval '7 days' then 'grace'   -- 7 days: everything keeps working, no new credits
              else 'expired' end,
         coalesce((select case when c.monthly_expires_at is null or c.monthly_expires_at > now() then c.monthly_balance else 0 end
                     from public.user_credits c where c.user_id = p.id), 0),
         coalesce((select c.balance from public.user_credits c where c.user_id = p.id), 0)
    from public.profiles p where p.id = auth.uid();
$$;
grant execute on function public.my_saas() to authenticated;

select 'ok' as status;
