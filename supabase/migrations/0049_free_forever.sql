-- Free forever: new accounts start on the free plan (no trial). They keep the full card and website on a
-- Shubhora link, the daily poster and the welcome credits; the paid plan can be taken any time.
-- Running trials keep the end date they were given. Run once in Supabase → SQL editor.
alter table public.profiles drop constraint if exists profiles_plan_source_check;
alter table public.profiles add constraint profiles_plan_source_check
  check (plan_source in ('free','trial','paid','partner','admin'));
alter table public.profiles alter column plan_source set default 'free';

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, plan, plan_source, trial_started_at, plan_expires_at)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), 'free', 'free', null, null);
  return new;
end; $$;

select 'free forever ready' as status;
