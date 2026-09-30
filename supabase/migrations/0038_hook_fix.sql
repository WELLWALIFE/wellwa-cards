-- Fix: cards has no updated_at column (crm_inbound_lead failed with 42703).
-- Incoming hook: create-or-update a lead by token (service role, called by the API route).
create or replace function public.crm_inbound_lead(p_token text, p_name text, p_phone text, p_message text, p_source text, p_city text, p_tags text[])
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_card uuid; v_lead uuid;
begin
  select owner_id into v_owner from public.crm_integrations where inbound_token = p_token;
  if v_owner is null then raise exception 'BAD_TOKEN'; end if;
  select id into v_card from public.cards where owner_id = v_owner order by created_at desc limit 1;
  select id into v_lead from public.leads where owner_id = v_owner and phone = p_phone order by created_at limit 1;
  if v_lead is null then
    insert into public.leads (owner_id, card_id, phone, name, message, source, city, tags, status)
    values (v_owner, v_card, p_phone, left(coalesce(p_name,''),80), left(coalesce(p_message,''),500), left(coalesce(nullif(p_source,''),'webhook'),30), left(coalesce(p_city,''),60), coalesce(p_tags,'{}'), 'new')
    returning id into v_lead;
    insert into public.lead_events (owner_id, lead_id, kind, text) values (v_owner, v_lead, 'created', 'From ' || coalesce(nullif(p_source,''),'webhook'));
  else
    update public.leads set message = case when coalesce(p_message,'') <> '' then left(p_message,500) else message end,
      name = case when coalesce(name,'') = '' then left(coalesce(p_name,''),80) else name end, updated_at = now()
    where id = v_lead;
    insert into public.lead_events (owner_id, lead_id, kind, text) values (v_owner, v_lead, 'note', 'New enquiry via ' || coalesce(nullif(p_source,''),'webhook') || case when coalesce(p_message,'') <> '' then ': ' || left(p_message,200) else '' end);
  end if;
  return v_lead;
end $$;
revoke all on function public.crm_inbound_lead(text,text,text,text,text,text,text[]) from public, anon, authenticated;
grant execute on function public.crm_inbound_lead(text,text,text,text,text,text,text[]) to service_role;
revoke all on function public.crm_queue(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.crm_queue(uuid,text,jsonb) to service_role;
