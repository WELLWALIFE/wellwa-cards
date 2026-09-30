-- BUG: none of the paid paths updated plan_source, so a member whose partner
-- had just paid ₹14,160 (or a customer who paid by card) kept seeing the
-- "free trial — X days left" banner and the renewal prompt. The plan was
-- right; only the label was wrong, which is worse — it looks like the money
-- didn't register.

create or replace function public.partner_activate(
  p_member_email text, p_plan text, p_months int
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_brand   uuid := public.my_brand();
  v_member  uuid;
  v_cost    bigint;
  v_balance bigint;
  v_from    timestamptz;
begin
  if v_brand is null then
    return jsonb_build_object('ok', false, 'error', 'You are not a partner administrator.');
  end if;
  if p_plan not in ('pro','team') then
    return jsonb_build_object('ok', false, 'error', 'Unknown plan.');
  end if;
  p_months := greatest(coalesce(p_months, 1), 1);

  select u.id into v_member from auth.users u
   where lower(u.email) = lower(trim(p_member_email)) limit 1;
  if v_member is null then
    return jsonb_build_object('ok', false, 'error', 'No user with that email. Ask them to sign up first.');
  end if;

  if (select brand_id from public.profiles where id = v_member) is distinct from v_brand then
    return jsonb_build_object('ok', false, 'error', 'That user is not one of your members.');
  end if;

  v_cost := public.activation_cost(v_brand, p_plan, p_months);

  select balance_paise into v_balance from public.partner_wallets
   where brand_id = v_brand for update;
  if v_balance is null then
    insert into public.partner_wallets (brand_id, balance_paise) values (v_brand, 0);
    v_balance := 0;
  end if;
  if v_balance < v_cost then
    return jsonb_build_object('ok', false, 'error', 'Not enough balance. Add funds and try again.',
                              'cost', v_cost, 'balance', v_balance);
  end if;

  v_balance := v_balance - v_cost;
  update public.partner_wallets set balance_paise = v_balance, updated_at = now()
   where brand_id = v_brand;

  select greatest(coalesce(plan_expires_at, now()), now()) into v_from
    from public.profiles where id = v_member;

  update public.profiles
     set plan = p_plan,
         plan_source = 'partner',          -- <- was left on 'trial'
         plan_expires_at = v_from + (p_months || ' months')::interval
   where id = v_member;

  insert into public.wallet_ledger (brand_id, kind, amount_paise, balance_after,
                                    member_id, member_email, plan, months, note)
  values (v_brand, 'activation', -v_cost, v_balance, v_member, lower(trim(p_member_email)),
          p_plan, p_months, 'Activated by partner');

  return jsonb_build_object('ok', true, 'cost', v_cost, 'balance', v_balance,
                            'expires', v_from + (p_months || ' months')::interval);
end $$;
grant execute on function public.partner_activate(text, text, int) to authenticated;

create or replace function public.record_payment(p_plan text, p_months int, p_ref text, p_amount int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_from timestamptz; v_user uuid := auth.uid();
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'Not signed in.'); end if;
  if p_plan not in ('pro','team') then return jsonb_build_object('ok', false, 'error', 'Unknown plan.'); end if;

  select greatest(coalesce(plan_expires_at, now()), now()) into v_from
    from public.profiles where id = v_user;

  update public.profiles
     set plan = p_plan,
         plan_source = 'paid',             -- <- was left on 'trial'
         plan_expires_at = v_from + (greatest(coalesce(p_months,1),1) || ' months')::interval
   where id = v_user;

  insert into public.subscriptions (owner_id, plan, status, provider, provider_ref, amount, current_end)
  values (v_user, p_plan, 'active', 'razorpay', p_ref, p_amount,
          v_from + (greatest(coalesce(p_months,1),1) || ' months')::interval);

  return jsonb_build_object('ok', true, 'plan', p_plan);
end $$;
grant execute on function public.record_payment(text, int, text, int) to authenticated;

create or replace function public.admin_set_plan(p_user uuid, p_plan text, p_months int default 12)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_from timestamptz;
begin
  if p_plan not in ('free','pro','team') then
    return jsonb_build_object('ok', false, 'error', 'Unknown plan.');
  end if;
  if p_plan = 'free' then
    update public.profiles set plan = 'free', plan_source = 'admin', plan_expires_at = null where id = p_user;
    return jsonb_build_object('ok', true, 'plan', 'free');
  end if;

  select greatest(coalesce(plan_expires_at, now()), now()) into v_from
    from public.profiles where id = p_user;
  update public.profiles
     set plan = p_plan, plan_source = 'admin',
         plan_expires_at = v_from + (greatest(coalesce(p_months,12),1) || ' months')::interval
   where id = p_user;

  return jsonb_build_object('ok', true, 'plan', p_plan);
end $$;
revoke all on function public.admin_set_plan(uuid, text, int) from public, anon, authenticated;

select 'plan_source fix applied' as status;
