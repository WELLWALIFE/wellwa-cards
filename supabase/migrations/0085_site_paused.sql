-- Super Admin → Websites → Pause (owner, 2 Nov 2026): a website held for visitors (the card shows) until Resume; the 24-hour
-- clock does not make it live meanwhile. A column, not a field in cards.data: the owner's app rewrites the whole data JSON on
-- every publish and would drop it. Only the service role (the admin API) may change it.
alter table public.cards add column if not exists site_paused boolean not null default false;

create or replace function public.cards_keep_site_paused() returns trigger
language plpgsql as $$
begin
  if new.site_paused is distinct from old.site_paused and coalesce(auth.role(), '') <> 'service_role' then
    new.site_paused := old.site_paused;
  end if;
  return new;
end $$;

drop trigger if exists cards_keep_site_paused on public.cards;
create trigger cards_keep_site_paused before update on public.cards
  for each row execute function public.cards_keep_site_paused();
