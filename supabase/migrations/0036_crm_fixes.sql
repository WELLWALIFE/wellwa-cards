-- CRM review fixes: service_role execute grants (chat logging was 403 without them), managers read the roster, template counter scoped to the
-- owner, and the message log keeps the agent attribution when the WhatsApp
-- echo of a CRM send lands before the direct log (race).

drop policy if exists "manager reads team" on public.crm_agents;
create policy "manager reads team" on public.crm_agents for select using (public.crm_agent_of(owner_id) = 'manager');

drop function if exists public.wa_template_used(uuid);
create or replace function public.wa_template_used(p_id uuid, p_owner uuid) returns void
language sql security definer set search_path = public as $$
  update public.wa_templates set uses = uses + 1 where id = p_id and owner_id = p_owner;
$$;
revoke all on function public.wa_template_used(uuid, uuid) from public, anon, authenticated;
grant execute on function public.wa_template_used(uuid, uuid) to service_role;

create or replace function public.wa_log_message(
  p_owner uuid, p_card uuid, p_phone text, p_name text, p_wa_id text,
  p_direction text, p_sender text, p_kind text, p_text text, p_sent_at timestamptz, p_sent_by uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_lead uuid; v_inserted boolean;
begin
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
