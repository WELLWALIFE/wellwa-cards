-- 0053 — one tap = one paid render, enforced by the database.
--
-- /api/media/ad accepts an `idem` string from the phone and stores it inside
-- media_jobs.input. Before this index the duplicate check was a plain read
-- followed by a write: two requests carrying the same idem that overlap (the
-- phone's fetch times out on a slow network and retries while the first POST is
-- still running) both found no prior row, both passed the "one video at a time"
-- count, both called spend_credits and both queued a paid render. The ledger
-- could not catch it either — the spend reason is "ad-builder" with two
-- different p_refs, and credit_ledger_ad_reason_ref_uidx only covers
-- reason like 'ad-%' with a matching ref.
--
-- With this index the second insert fails, the route refunds that request and
-- hands back the first job's id with duplicate: true. Idem is a fresh UUID per
-- order, so nothing legitimate is ever blocked by it.
--
-- Partial: rows without an idem (pipeline 2, Reel Maker, anything queued by the
-- worker) are untouched, and several of them may exist for one owner.

create unique index if not exists media_jobs_owner_idem_uidx
  on public.media_jobs (owner_id, (input ->> 'idem'))
  where (input ->> 'idem') is not null;

comment on index public.media_jobs_owner_idem_uidx is
  'One paid ad per (owner, idem): stops a retried POST /api/media/ad becoming a second charge.';
