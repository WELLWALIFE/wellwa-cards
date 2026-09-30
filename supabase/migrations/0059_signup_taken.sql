-- Sign-up form: "is this mobile / email already registered?" — checked live while the person types
-- (owner's call, 28 Sep 2026: one account per mobile and per email).
-- A mobile counts as taken when it is an account's login (p91XXXXXXXXXX@phone.neuraledge.me) or the phone saved on
-- any account; an email when it is an account's login email (email or Google sign-up) or the contact email saved on
-- a mobile account. Answers only true / false. Called by the server (service role) — never by the browser.

create or replace function public.signup_taken(p_mobile text, p_email text)
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  select jsonb_build_object(
    'mobile', case when coalesce(p_mobile, '') ~ '^[6-9][0-9]{9}$' then exists (
      select 1 from auth.users u
      where u.deleted_at is null
        and (u.email = 'p91' || p_mobile || '@phone.neuraledge.me'
          or right(regexp_replace(coalesce(u.raw_user_meta_data->>'phone', ''), '\D', '', 'g'), 10) = p_mobile
          or right(regexp_replace(coalesce(u.phone, ''), '\D', '', 'g'), 10) = p_mobile)
    ) else false end,
    'email', case when coalesce(trim(p_email), '') like '%_@_%' then exists (
      select 1 from auth.users u
      where u.deleted_at is null
        and (lower(u.email) = lower(trim(p_email))
          or lower(u.raw_user_meta_data->>'contact_email') = lower(trim(p_email)))
    ) else false end
  );
$$;

revoke all on function public.signup_taken(text, text) from public, anon, authenticated;
grant execute on function public.signup_taken(text, text) to service_role;

select 'ok' as signup_taken_ready;
