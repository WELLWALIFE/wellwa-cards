-- 0052: close the media-bucket listing leak.
--
-- WHAT IS WRONG TODAY
-- 0001_init.sql:146-148 created:
--     create policy "public reads media" on storage.objects for select using (bucket_id = 'media');
-- There is no "to" clause, so the policy also covers the anon role, and there is no path scoping,
-- so it covers every object in the bucket. Supabase's list endpoint checks exactly this select
-- policy, so with only the public anon key that ships inside the browser bundle:
--     POST /storage/v1/object/list/media
-- returns EVERY owner's folder — their user ids, and from there their product photos, face
-- photos, posters and finished videos. Confirmed by hand against the live project.
-- (0018_security_crm.sql:93-97 tightened INSERT to the owner's own folder, but select was left
-- wide open.)
--
-- WHY REMOVING THAT POLICY IS SAFE
-- The media bucket is public (0001_init.sql:142-144). A public bucket serves
--     /storage/v1/object/public/media/<key>
-- WITHOUT consulting RLS at all, and that public path is the only read path this app uses:
-- src/lib/cloud.ts (getPublicUrl after every upload), src/lib/card-inputs.ts, the poster upload /
-- brand-kit / photoshoot routes, src/lib/media/ai-image.ts and bridge/media-worker.mjs:796.
-- So public card pages, posters and videos keep loading for logged-out visitors exactly as today.
-- Writes are untouched: server routes and the worker upload with the service role (RLS does not
-- apply to it), and browser uploads still go through the insert policy from 0018 plus the update
-- policy from 0001.
--
-- WHAT REPLACES IT
-- A select policy for signed-in users over their OWN first path segment only — the same
-- (storage.foldername(name))[1] = auth.uid()::text rule the insert policy already uses. A user can
-- therefore list and fetch their own <uid>/... objects and nothing else; anon can list nothing.
-- Keeping a scoped select (rather than no select at all) is also what keeps browser uploads
-- working: supabase-js uploads with upsert:true insert/update the row RETURNING it, and a
-- RETURNING clause needs a select policy that matches the row — for the owner's own folder it does.
--
-- Idempotent: each policy is dropped before it is created, so the file can be run again. No object
-- is moved or deleted and no URL changes. Run once in Supabase → SQL editor.

-- 1) Remove the bucket-wide read policy. This one statement is the leak.
drop policy if exists "public reads media" on storage.objects;

-- 2) A signed-in owner may list and read only their own folder.
drop policy if exists "own media listing" on storage.objects;
create policy "own media listing" on storage.objects
  for select to authenticated using (
    bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3) The public URLs above only keep working while the bucket stays public. It already is
--    (0001_init.sql), so this line is a no-op today; it is here so the dependency is explicit and
--    so a re-run can never leave the app with unreadable photos.
update storage.buckets set public = true where id = 'media';

-- NOTES
-- * Worker output is uploaded to ai-media/<owner_id>/... , whose first path segment is the literal
--   'ai-media', so after this migration nobody can list it — only the service role. The finished
--   video is still delivered to the owner through its public URL, which is how the app shows it.
-- * The 'ad-work' bucket (0044_ad_pipeline_v2.sql:48) is private and has no policies at all, so
--   only the service role can reach it. Nothing here changes that.
--
-- HOW TO CHECK AFTER RUNNING (use the ANON key, never the service key):
--   POST <project>/storage/v1/object/list/media  body {"prefix":"","limit":100}  → must be []
--   open <project>/storage/v1/object/public/media/<uid>/<file> in a browser        → must still load
--   sign in, then list again                                                      → only own <uid>/ rows

select 'media listing locked' as status;
