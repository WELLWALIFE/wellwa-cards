-- A card made by a white-label member belongs to that member's brand.
-- Until now cards.brand_id was only ever set by hand, so a distributor who
-- signed up on join.wellwalife.com and created a card got no
-- <user>.wellwalife.com address — resolve_brand_host() joins on cards.brand_id.

create or replace function public.card_inherit_brand()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.brand_id is null then
    select p.brand_id into new.brand_id from public.profiles p where p.id = new.owner_id;
  end if;
  return new;
end;
$$;

drop trigger if exists cards_inherit_brand on public.cards;
create trigger cards_inherit_brand
  before insert on public.cards
  for each row execute function public.card_inherit_brand();

-- Backfill cards already created by brand members.
update public.cards c
   set brand_id = p.brand_id
  from public.profiles p
 where p.id = c.owner_id
   and c.brand_id is null
   and p.brand_id is not null;
