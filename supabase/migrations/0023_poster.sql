-- "Aaj Ka Poster": daily personalised posters for everyone (business,
-- personal, home business, community, student, professional).
--
-- A user can hold several profiles (one household, one subscription):
-- papa's shop, mummy's boutique, the child's school. Each profile gets its own
-- poster every day. Posters are composed on the server from one shared piece
-- of AI artwork per day; only the row (date, occasion, url) is stored here.

create table if not exists public.poster_profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  persona     text not null default 'personal'
              check (persona in ('business','personal','home','community','student','professional')),
  name        text not null default '',
  tagline     text default '',            -- shop name / designation / school / "Proud Wellwa Distributor"
  phone       text default '',
  photo_url   text,                        -- round photo on the poster
  logo_url    text,                        -- brand logo (business/community)
  lang        text not null default 'hi'  check (lang in ('hi','en','hinglish','mr','gu','pa','bn','ta','te','kn','ml','or')),
  city        text default '',
  is_default  bool not null default false,
  kids_mode   bool not null default false, -- student persona: greetings/invites only, never sales text
  created_at  timestamptz not null default now()
);
create index if not exists poster_profiles_user_idx on public.poster_profiles(user_id);

create table if not exists public.posters (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.poster_profiles(id) on delete cascade,
  for_date      date not null,
  occasion_slug text,
  title         text default '',
  url           text not null,
  shares        int  not null default 0,
  created_at    timestamptz not null default now(),
  unique (profile_id, for_date)
);
create index if not exists posters_profile_date_idx on public.posters(profile_id, for_date desc);

-- Push tokens (FCM) for the 7 AM "aaj ka poster taiyaar hai" nudge.
create table if not exists public.poster_devices (
  token       text primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  platform    text not null default 'android',
  lang        text not null default 'hi',
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);
create index if not exists poster_devices_user_idx on public.poster_devices(user_id);

alter table public.poster_profiles enable row level security;
alter table public.posters         enable row level security;
alter table public.poster_devices  enable row level security;

drop policy if exists "own poster profiles" on public.poster_profiles;
create policy "own poster profiles" on public.poster_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own posters" on public.posters;
create policy "own posters" on public.posters
  for select using (exists (select 1 from public.poster_profiles p where p.id = profile_id and p.user_id = auth.uid()));

drop policy if exists "own poster devices" on public.poster_devices;
create policy "own poster devices" on public.poster_devices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- New tables get no privileges by default on this project (learned the hard way).
grant select, insert, update, delete on public.poster_profiles to authenticated, service_role;
grant select on public.posters to authenticated;
grant select, insert, update, delete on public.posters to service_role;
grant select, insert, update, delete on public.poster_devices to authenticated, service_role;

-- Referral: "ek dost ko jodo, dono ko ek mahina free". Code lives on the profile.
alter table public.profiles add column if not exists referral_code text unique;
alter table public.profiles add column if not exists referred_by   uuid references public.profiles(id) on delete set null;
alter table public.profiles add column if not exists poster_plan   text not null default 'free'
  check (poster_plan in ('free','personal','business'));
alter table public.profiles add column if not exists poster_plan_expires_at timestamptz;

create or replace function public.ensure_referral_code()
returns trigger language plpgsql as $$
begin
  if new.referral_code is null then
    new.referral_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  end if;
  return new;
end $$;
drop trigger if exists profiles_referral_code on public.profiles;
create trigger profiles_referral_code before insert or update on public.profiles
  for each row execute function public.ensure_referral_code();
update public.profiles set referral_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)) where referral_code is null;

select 'poster tables ready' as status;
