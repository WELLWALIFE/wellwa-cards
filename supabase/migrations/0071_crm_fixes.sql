-- 0071 — CRM fixes (code review, Oct 2026). Safe to run more than once.
--
-- crm_merge_leads (0070) wrote last_message_at = 1970-01-01 when neither lead had a WhatsApp message (imported or
-- hand-added duplicates): greatest(coalesce(a, 'epoch'), coalesce(b, 'epoch')) is 'epoch', not null. Such a lead then sorted
-- as "last message in 1970" and showed that date in the inbox. The function now keeps null, and the rows already merged
-- that way are put back to null.

create or replace function public.crm_merge_leads(p_owner uuid, p_keep uuid, p_drop uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare k public.leads; d public.leads;
begin
  if p_keep = p_drop then raise exception 'SAME_LEAD'; end if;
  select * into k from public.leads where id = p_keep and owner_id = p_owner for update;
  select * into d from public.leads where id = p_drop and owner_id = p_owner for update;
  if k.id is null or d.id is null then raise exception 'NOT_FOUND'; end if;

  update public.wa_messages set phone = k.phone where owner_id = p_owner and phone = d.phone and d.phone <> k.phone;
  update public.lead_events set lead_id = k.id where lead_id = d.id;
  update public.crm_tasks set lead_id = k.id where lead_id = d.id;
  update public.crm_calls set lead_id = k.id where lead_id = d.id;
  update public.crm_sales set lead_id = k.id where lead_id = d.id;
  update public.crm_quotes set lead_id = k.id where lead_id = d.id;
  update public.bookings set lead_id = k.id where lead_id = d.id;
  update public.phone_calls set lead_id = k.id where lead_id = d.id;

  update public.leads set
    name        = case when coalesce(name, '') = '' then d.name else name end,
    email       = case when coalesce(email, '') = '' then d.email else email end,
    city        = case when coalesce(city, '') = '' then d.city else city end,
    business    = case when coalesce(business, '') = '' then d.business else business end,
    address     = case when coalesce(address, '') = '' then d.address else address end,
    alt_phone   = case when coalesce(alt_phone, '') = '' and d.phone <> phone then d.phone else alt_phone end,
    notes       = trim(both E'\n' from coalesce(notes, '') || case when coalesce(d.notes, '') <> '' then E'\n' || d.notes else '' end),
    tags        = (select coalesce(array_agg(distinct t), '{}') from unnest(coalesce(tags, '{}') || coalesce(d.tags, '{}')) t),
    value_paise = greatest(value_paise, d.value_paise),
    score       = greatest(score, d.score),
    unread      = unread + d.unread,
    calls_count = calls_count + d.calls_count,
    birthday    = coalesce(birthday, d.birthday),
    anniversary = coalesce(anniversary, d.anniversary),
    assigned_to = coalesce(assigned_to, d.assigned_to),
    created_at  = least(created_at, d.created_at),
    last_message_at  = nullif(greatest(coalesce(last_message_at, 'epoch'), coalesce(d.last_message_at, 'epoch')), 'epoch'::timestamptz),
    last_activity_at = greatest(last_activity_at, d.last_activity_at, now()),
    updated_at  = now()
  where id = k.id;

  delete from public.leads where id = d.id;
  insert into public.lead_events (owner_id, lead_id, kind, text) values (p_owner, k.id, 'merge', 'Merged with ' || coalesce(nullif(d.name, ''), d.phone));
  return k.id;
end $$;
revoke all on function public.crm_merge_leads(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.crm_merge_leads(uuid, uuid, uuid) to service_role;

update public.leads set last_message_at = null where last_message_at = 'epoch'::timestamptz;

select 'crm fixes 0071 ready' as status;
