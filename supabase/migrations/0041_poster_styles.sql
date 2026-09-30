-- Daily poster: style variants, quick-editor overrides, political/organisation
-- mode, business category, status video.
alter table public.poster_profiles add column if not exists style text not null default 'classic';
alter table public.poster_profiles add column if not exists layout jsonb not null default '{}'::jsonb;   -- {title,sub,custom,accent,nameSize,photoSide,hideLine,hidePhone,hideLogo,hidePhoto}
alter table public.poster_profiles add column if not exists category text not null default '';
alter table public.poster_profiles add column if not exists party jsonb;                                 -- {name,symbol_url,colors[2],slogan,leaders[{name,photo_url}]}
alter table public.poster_profiles drop constraint if exists poster_profiles_mode_check;
alter table public.poster_profiles add constraint poster_profiles_mode_check check (mode in ('greeting','product','testimonial'));
alter table public.posters add column if not exists style text not null default 'classic';
alter table public.posters add column if not exists video_url text not null default '';
alter table public.posters add column if not exists music text not null default '';
alter table public.posters add column if not exists voice_text text not null default '';
alter table public.posters add column if not exists voice_gender text not null default '';
grant all on public.posters to service_role;
grant all on public.poster_profiles to service_role;
