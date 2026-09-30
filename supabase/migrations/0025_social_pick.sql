-- One account per provider per user: after Facebook OAuth every Page comes
-- back as a candidate; the user picks one (is_active) and the rest are dropped.
alter table public.social_accounts add column if not exists is_active bool not null default false;
alter table public.social_accounts add column if not exists auto_post bool not null default false;
alter table public.social_accounts add column if not exists auto_post_profile uuid references public.poster_profiles(id) on delete set null;
alter table public.social_accounts add column if not exists last_auto_post date;
select 'social pick ready' as status;
