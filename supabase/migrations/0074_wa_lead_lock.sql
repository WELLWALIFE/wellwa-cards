-- 0074: no more duplicate WhatsApp leads made in the same second (owner, 23 Oct 2026: two pairs on 8708275430's CRM, each
-- pair created at the same minute). Two writers raced: wa_log_message() and the bridge's saveLead() both looked for the
-- contact's lead, both found none, both inserted. Now both take the same per-contact lock first, so the second one finds
-- the lead the first one made. Safe to run more than once.

create or replace function public.wa_log_message(
  p_owner uuid, p_card uuid, p_phone text, p_name text, p_wa_id text,
  p_direction text, p_sender text, p_kind text, p_text text, p_sent_at timestamptz, p_sent_by uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_lead uuid; v_inserted boolean;
begin
  -- One lead per contact per owner, even when two messages (or the bridge's saveLead) arrive in the same instant: whoever
  -- comes second waits here until the first has made the lead, then finds it (owner, 23 Oct 2026: pairs made in the same second).
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text || '|' || p_phone, 0));
  insert into public.wa_messages (owner_id, card_id, phone, wa_id, direction, sender, kind, text, sent_at, sent_by)
  values (p_owner, p_card, p_phone, p_wa_id, p_direction, p_sender, p_kind, left(coalesce(p_text,''), 4000), coalesce(p_sent_at, now()), p_sent_by)
  on conflict (owner_id, wa_id) do update set
    sent_by = coalesce(public.wa_messages.sent_by, excluded.sent_by),
    text = case when excluded.sender = 'owner' and excluded.text <> '' then excluded.text else public.wa_messages.text end,
    sender = case when excluded.sender = 'owner' then 'owner' else public.wa_messages.sender end
  returning (xmax = 0) into v_inserted;
  select id into v_lead from public.leads where owner_id = p_owner and phone = p_phone order by created_at limit 1;
  if v_lead is null then
    insert into public.leads (card_id, owner_id, phone, name, source, message, last_message_at, unread)
    values (p_card, p_owner, p_phone, coalesce(p_name,''), 'whatsapp', left(coalesce(p_text,''), 500), coalesce(p_sent_at, now()),
            case when p_direction = 'in' then 1 else 0 end)
    returning id into v_lead;
    insert into public.lead_events (owner_id, lead_id, kind, text) values (p_owner, v_lead, 'created', 'Lead created from WhatsApp');
  elsif v_inserted then
    update public.leads set
      message = case when coalesce(p_text,'') <> '' then left(p_text, 500) else message end,
      name = case when coalesce(name,'') = '' and coalesce(p_name,'') <> '' then p_name else name end,
      last_message_at = greatest(coalesce(last_message_at, 'epoch'::timestamptz), coalesce(p_sent_at, now())),
      unread = case when p_direction = 'in' then unread + 1 when p_sender = 'owner' then 0 else unread end,
      updated_at = now()
    where id = v_lead;
  end if;
  return v_lead;
end $$;
revoke all on function public.wa_log_message(uuid,uuid,text,text,text,text,text,text,text,timestamptz,uuid) from public, anon, authenticated;
-- The bridge calls this with the service key; "revoke from public" also strips service_role, so grant it back explicitly.
grant execute on function public.wa_log_message(uuid,uuid,text,text,text,text,text,text,text,timestamptz,uuid) to service_role;

-- The bridge's saveLead() (name + latest text) goes through here instead of its own look-up-then-insert.
create or replace function public.wa_save_lead(p_owner uuid, p_card uuid, p_phone text, p_name text, p_message text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_lead uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text || '|' || p_phone, 0));
  select id into v_lead from public.leads where owner_id = p_owner and phone = p_phone order by created_at limit 1;
  if v_lead is null then
    insert into public.leads (card_id, owner_id, phone, name, source, message)
    values (p_card, p_owner, p_phone, coalesce(p_name,''), 'whatsapp', left(coalesce(p_message,''), 500))
    returning id into v_lead;
  else
    -- A name the owner already has (typed in, or from an earlier message) is kept; an empty one is filled.
    update public.leads set name = case when coalesce(name,'') = '' then coalesce(p_name,'') else name end, message = left(coalesce(p_message,''), 500), updated_at = now() where id = v_lead;
  end if;
  return v_lead;
end $$;
revoke all on function public.wa_save_lead(uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.wa_save_lead(uuid,uuid,text,text,text) to service_role;
