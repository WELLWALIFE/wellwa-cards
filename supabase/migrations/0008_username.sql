-- Public-link (username) support: live availability checks + reserved names.
--
-- The editor needs to tell a user "/rajkumar is free" *before* they publish.
-- A plain select can't answer that: the "public reads active cards" policy hides
-- rows whose active flag is false, so a paused card's username would look free
-- and then fail on publish with a unique-constraint error. This function runs as
-- definer so it can see every row, while only ever leaking one boolean.

create or replace function public.username_available(p_username text, p_card_id uuid default null)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.cards
    where lower(username) = lower(trim(p_username))
      and (p_card_id is null or id <> p_card_id)   -- your own card doesn't block you
  )
  and lower(trim(p_username)) not in (
    -- routes and words we keep for the platform
    'admin','api','app','auth','billing','c','card','cards','dashboard','editor',
    'help','home','leads','login','logout','me','neural','neuraledge','new','preview',
    'pricing','privacy','settings','signup','sitemap','static','support','templates',
    'terms','tools','user','users','www'
  );
$$;

revoke all on function public.username_available(text, uuid) from public;
grant execute on function public.username_available(text, uuid) to anon, authenticated;
