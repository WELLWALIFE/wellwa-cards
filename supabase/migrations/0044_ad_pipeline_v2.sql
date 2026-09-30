-- 0044: "right the first time" ad pipeline (docs/ad-video-one-shot-spec.md §3.1 + §8.1)
-- Product facts ("Visual Bible") + multi-photo products
alter table public.poster_products
  add column if not exists photos jsonb not null default '[]'::jsonb,   -- [{url, view, role, w, h, generated_crop?}]
  add column if not exists facts jsonb not null default '{}'::jsonb,
  add column if not exists facts_version int not null default 0,
  add column if not exists facts_confirmed_at timestamptz;
update public.poster_products set photos = jsonb_build_array(jsonb_build_object('url', photo_url, 'view','front','role','identity'))
  where photos = '[]'::jsonb and coalesce(photo_url,'') <> '';

-- Jobs: storyboard-before-money state machine
alter table public.media_jobs drop constraint if exists media_jobs_status_check;
alter table public.media_jobs add constraint media_jobs_status_check check (status in ('queued','running','review','done','failed'));
alter table public.media_jobs
  add column if not exists pipeline int not null default 1,
  add column if not exists phase text not null default 'animate',
  add column if not exists stage text not null default '',
  add column if not exists progress jsonb not null default '{}'::jsonb,
  add column if not exists assets jsonb not null default '{}'::jsonb,
  add column if not exists attempts int not null default 0;

create table if not exists public.media_job_scenes (
  job_id uuid not null references public.media_jobs(id) on delete cascade, i int not null,
  status text not null default 'pending',          -- pending|pass|pass_with_notes|safe_shot|needs_owner|line_too_long
  preview_url text, original_key text,
  owner_summary text, notes jsonb not null default '[]'::jsonb, tap_visible boolean, visible_objects jsonb,
  redraw_requested boolean not null default false, redraw_mode text, redraw_note text, own_photo_url text, redraws int not null default 0,
  line jsonb,
  clip jsonb, clip_pending jsonb,
  updated_at timestamptz default now(), primary key (job_id, i));
alter table public.media_job_scenes enable row level security;
drop policy if exists "own job scenes" on public.media_job_scenes;
create policy "own job scenes" on public.media_job_scenes for select using (exists (select 1 from public.media_jobs j where j.id = job_id and j.owner_id = auth.uid()));
revoke all on public.media_job_scenes from anon, authenticated;
grant select (job_id,i,status,preview_url,owner_summary,notes,redraws,line,clip) on public.media_job_scenes to authenticated;
grant all on public.media_job_scenes to service_role;

create table if not exists public.media_job_qc (id bigserial primary key, job_id uuid not null, scene int, stage text, attempt int, model text, verdict jsonb, ms int, created_at timestamptz default now());
alter table public.media_job_qc enable row level security;
grant all on public.media_job_qc to service_role;
grant usage, select on sequence public.media_job_qc_id_seq to service_role;

create table if not exists public.media_worker_status (id int primary key, caps jsonb not null default '{}'::jsonb, beat_at timestamptz);
alter table public.media_worker_status enable row level security;
grant all on public.media_worker_status to service_role;

create unique index if not exists credit_ledger_ad_reason_ref_uidx on public.credit_ledger(reason, ref) where ref is not null and reason like 'ad-%';
insert into storage.buckets (id, name, public) values ('ad-work','ad-work', false) on conflict do nothing;

select 'ok' as status;
