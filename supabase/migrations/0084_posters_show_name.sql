-- 0084 — posters lead with the business's NAME (2 Nov 2026, seen live: a restaurant's posters said "Restaurant / dhaba" at the top).
-- The set-up writes the trade into poster_profiles.tagline, and the poster shows the tagline as the big name unless layout.showName.
-- The set-up now sets showName; this fixes the profiles made before. Shubhora partners (category mlm) keep "Shubhora Partner" on top.
-- Safe to run more than once.
update public.poster_profiles
   set layout = coalesce(layout, '{}'::jsonb) || '{"showName": true}'::jsonb
 where coalesce(category, '') not in ('', 'mlm')
   and persona <> 'personal'
   and coalesce(tagline, '') <> ''
   and coalesce(name, '') <> ''
   and lower(name) <> lower(tagline)
   and not (coalesce(layout, '{}'::jsonb) ? 'showName');
select 'ok' as status;
