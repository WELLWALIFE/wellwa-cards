-- FRESH START — Supabase (run in the SQL editor, project kyywwgkrbozbsyodolvj)
-- Keeps ONLY the two Wellwa cards (niteen-rajput, joginder-yadav = Dr JS Yadav) and the accounts that own them.
-- Everything else goes: every other account (admin too — wellwalife@gmail.com is admin by e-mail, so signing up
-- again with that e-mail restores admin), every other card, poster profiles, posters, products, leads, media jobs,
-- CRM, wallets… Irreversible. Take a backup first (Database → Backups → Download, or pg_dump).
--
-- STEP 1 — run only this block and READ the result: the cards and owners that will be KEPT.
-- ----------------------------------------------------------------------------------------------
select c.username as card, c.name, c.company, u.email as owner_email, u.id as owner_id
from public.cards c join auth.users u on u.id = c.owner_id
where c.username in ('niteen-rajput', 'joginder-yadav');

-- STEP 2 — the wipe. Run this whole block once. It prints what it deleted; the last query lists what is left.
-- ----------------------------------------------------------------------------------------------
do $$
declare
  KEEP_CARDS text[] := array['niteen-rajput', 'joginder-yadav'];   -- exact card usernames to keep
  r record; n bigint; total bigint := 0; pass int; changed boolean; col_list text[];
begin
  create temp table keep_cards on commit drop as
    select id, owner_id, username from public.cards where username = any(KEEP_CARDS);
  if (select count(*) from keep_cards) <> 2 then raise exception 'Expected exactly 2 kept cards, found % — stopping', (select count(*) from keep_cards); end if;
  create temp table keep_users on commit drop as select distinct owner_id as id from keep_cards;
  create temp table doomed_users on commit drop as select id from auth.users where id not in (select id from keep_users);
  create temp table doomed_cards on commit drop as select id from public.cards where id not in (select id from keep_cards);
  create temp table doomed_pprofiles on commit drop as
    select id from public.poster_profiles where user_id in (select id from doomed_users);

  raise notice 'keeping cards: %', (select string_agg(username, ', ') from keep_cards);
  raise notice 'keeping users: %', (select string_agg(email, ', ') from auth.users where id in (select id from keep_users));
  raise notice 'deleting % users, % cards', (select count(*) from doomed_users), (select count(*) from doomed_cards);

  -- Delete rows that belong to doomed users / cards / poster profiles, in every public table that has such a
  -- column (by name), in passes, so children go before parents. FK violations are simply retried next pass.
  for pass in 1..10 loop
    changed := false;
    for r in
      select c.table_name t, c.column_name col,
             case when c.column_name in ('card_id') then 'doomed_cards'
                  when c.column_name in ('profile_id') then 'doomed_pprofiles'
                  else 'doomed_users' end as src
      from information_schema.columns c
      join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
      where c.table_schema = 'public' and c.data_type = 'uuid'
        and (c.column_name in ('user_id','owner_id','owner','created_by','member_id','requested_by','assigned_to','sender_id','actor_id','card_id','profile_id')
             or (c.table_name = 'profiles' and c.column_name = 'id'))
      order by case when c.column_name in ('card_id','profile_id') then 0 else 1 end, c.table_name
    loop
      -- profile_id may point at poster_profiles OR profiles; only treat it as a poster profile when the table is a poster table
      if r.col = 'profile_id' and r.t not like 'poster%' and r.t not in ('posters','media_jobs','social_accounts','social_posts','reviews','testimonials','poster_calendar','poster_offers','poster_products','poster_devices','card_facts') then
        continue;
      end if;
      begin
        execute format('delete from public.%I where %I in (select id from %s)', r.t, r.col, r.src);
        get diagnostics n = row_count;
        if n > 0 then changed := true; total := total + n; raise notice 'pass %: % (%) -> % rows', pass, r.t, r.col, n; end if;
      exception
        when foreign_key_violation then changed := true; -- children first; retried next pass
        when undefined_table or insufficient_privilege then null;
      end;
    end loop;
    exit when not changed;
  end loop;

  -- the kept owners' OTHER cards (children went in the card_id passes above)
  delete from public.cards where id in (select id from doomed_cards);
  get diagnostics n = row_count; raise notice 'deleted % remaining cards', n;

  -- the accounts themselves (auth cascades: identities, sessions, refresh tokens; profiles cascades the rest)
  delete from auth.users where id in (select id from doomed_users);
  get diagnostics n = row_count;
  raise notice 'deleted % auth users; % other rows', n, total;
end $$;

-- STEP 3 — what is left (should be: the kept owners, the kept cards, nothing else of note)
select 'users' what, count(*)::text n, string_agg(email, ', ') detail from auth.users
union all select 'cards', count(*)::text, string_agg(username, ', ') from public.cards
union all select 'profiles', count(*)::text, '' from public.profiles
union all select 'poster_profiles', count(*)::text, '' from public.poster_profiles
union all select 'posters', count(*)::text, '' from public.posters
union all select 'leads', count(*)::text, '' from public.leads;
