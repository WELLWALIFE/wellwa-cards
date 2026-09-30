-- 0045: weekly social content plan (daily Story, 4 product posts, 3 reels per week on Facebook / Instagram).
-- Greetings stay on WhatsApp Status; Facebook and Instagram get business content only.
alter table public.social_accounts
  add column if not exists plan_on   bool not null default true,   -- run the weekly content plan on this account
  add column if not exists last_story date,
  add column if not exists last_feed  date,
  add column if not exists last_reel  date;

alter table public.social_posts
  add column if not exists kind text not null default 'feed',      -- feed | story | reel | status
  add column if not exists media_job_id uuid;                      -- the reel/ad this post came from (never posted twice)
create index if not exists social_posts_job_idx on public.social_posts(media_job_id) where media_job_id is not null;

select 'ok' as status;
