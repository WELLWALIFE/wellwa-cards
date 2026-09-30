-- Ad Builder: template-rendered ads are a new media_jobs kind.
alter table public.media_jobs drop constraint if exists media_jobs_kind_check;
alter table public.media_jobs add constraint media_jobs_kind_check check (kind in ('banner','reel','ad'));
select 'ad kind ready' as status;
