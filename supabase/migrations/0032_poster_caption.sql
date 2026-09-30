-- Auto-written professional caption per poster (used by FB/IG/Status posts).
alter table public.posters add column if not exists caption text;
select 'poster caption ready' as status;
