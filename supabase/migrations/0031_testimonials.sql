-- Customer testimonials → testimonial posters ("💬" calendar kind) and
-- "ask for a review" WhatsApp links.
create table if not exists public.poster_testimonials (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  customer_name text not null default '',
  text          text not null default '' check (char_length(text) <= 320),
  rating        int  not null default 5 check (rating between 1 and 5),
  city          text not null default '',
  photo_url     text,
  approved      bool not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists poster_testimonials_user_idx on public.poster_testimonials(user_id, created_at);
alter table public.poster_testimonials enable row level security;
drop policy if exists "own poster testimonials" on public.poster_testimonials;
create policy "own poster testimonials" on public.poster_testimonials for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.poster_testimonials to authenticated, service_role;

-- calendar: new day kind
alter table public.poster_calendar drop constraint if exists poster_calendar_kind_check;
alter table public.poster_calendar add constraint poster_calendar_kind_check check (kind in ('auto','festival','product','offer','greeting','testimonial','skip'));
select 'testimonials ready' as status;
