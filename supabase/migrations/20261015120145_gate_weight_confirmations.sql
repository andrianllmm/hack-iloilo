-- Measurements and their prompt are saved together; delivery happens after commit.
alter type public.sms_prompt_kind add value 'weight_confirm';

create table public.batch_weight_confirmations (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  stage text not null check (stage in ('receiving', 'drying')),
  measurements jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'disputed')),
  prompt_id uuid references public.sms_prompts(id) on delete set null,
  answered_by_phone text,
  confirmed_by_staff_id uuid references public.staff(id),
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, stage)
);
create index batch_weight_confirmations_prompt_idx on public.batch_weight_confirmations(prompt_id);
create index batch_weight_confirmations_staff_idx on public.batch_weight_confirmations(confirmed_by_staff_id);
create trigger batch_weight_confirmations_set_updated_at before update on public.batch_weight_confirmations
for each row execute function public.set_updated_at();
alter table public.batch_weight_confirmations enable row level security;
revoke all on public.batch_weight_confirmations from anon, authenticated;
grant select, insert, update, delete on public.batch_weight_confirmations to service_role;

create function public.record_batch_measurement(p_batch_id uuid, p_stage text, p_fields jsonb, p_ref text)
returns jsonb language plpgsql set search_path = '' as $$
declare
  b public.batches;
  c public.batch_weight_confirmations;
  snapshot jsonb;
  owner_phone text;
  prompt_id uuid;
  changed boolean;
begin
  select * into b from public.batches where id = p_batch_id for update;
  if not found then raise exception 'stale_stage'; end if;
  if p_stage = 'receiving' and b.stage = 'received' then
    update public.batches set
      bags = (p_fields->>'bags')::integer, net_kg = (p_fields->>'net_kg')::integer,
      mc = (p_fields->>'mc')::numeric, variety_id = (p_fields->>'variety_id')::uuid,
      damaged_pct = (p_fields->>'damaged_pct')::numeric,
      immature_pct = (p_fields->>'immature_pct')::numeric,
      foreign_pct = (p_fields->>'foreign_pct')::numeric
    where id = b.id returning * into b;
    snapshot := jsonb_build_object('bags', b.bags, 'kg', b.net_kg, 'mc', b.mc);
  elsif p_stage = 'drying' and b.stage = 'drying' then
    update public.batches set stage = 'stored', dry_end = (p_fields->>'dry_end')::timestamptz,
      dried_kg = (p_fields->>'dried_kg')::integer, mc_out = (p_fields->>'mc_out')::numeric
    where id = b.id returning * into b;
    snapshot := jsonb_build_object('kg', b.dried_kg, 'mc', b.mc_out);
  else
    raise exception 'stale_stage';
  end if;
  select * into c from public.batch_weight_confirmations where batch_id = b.id and stage = p_stage;
  changed := c.id is null or c.measurements is distinct from snapshot;
  if changed then
    update public.sms_prompts set status = 'expired' where id = c.prompt_id and status = 'open';
    select phone into strict owner_phone from public.clients where id = b.client_id;
    insert into public.sms_prompts(phone, kind, ref, payload)
      values(owner_phone, 'weight_confirm', p_ref, jsonb_build_object('batchId', b.id, 'stage', p_stage))
      returning id into prompt_id;
    insert into public.batch_weight_confirmations(batch_id, stage, measurements, prompt_id)
      values(b.id, p_stage, snapshot, prompt_id)
      on conflict (batch_id, stage) do update set measurements = excluded.measurements,
        prompt_id = excluded.prompt_id, status = 'pending', answered_at = null,
        answered_by_phone = null, confirmed_by_staff_id = null;
  end if;
  return jsonb_build_object('batch', to_jsonb(b), 'promptRef', case when changed then p_ref else null end);
end;
$$;

-- Lock the batch first, as the measurement writer does, so an old reply cannot
-- confirm measurements that have been replaced or overwrite an in-person answer.
create function public.answer_batch_weight(p_prompt_id uuid, p_phone text, p_yes boolean)
returns boolean language plpgsql set search_path = '' as $$
declare
  p public.sms_prompts;
  b public.batches;
  owner_phone text;
  booker_phone text;
  updated_id uuid;
begin
  select * into strict p from public.sms_prompts where id = p_prompt_id and kind = 'weight_confirm';
  select * into strict b from public.batches where id = (p.payload->>'batchId')::uuid for update;
  select phone into strict owner_phone from public.clients where id = b.client_id;
  select coalesce(booking.booked_by_phone, offer.booked_by_phone) into booker_phone
    from public.queue_entries q
    left join public.bookings booking on booking.id = q.booking_id
    left join public.sell_offers offer on offer.id = q.offer_id
    where q.id = b.queue_entry_id;
  if p_phone is distinct from owner_phone and p_phone is distinct from booker_phone then
    raise exception 'weight_forbidden';
  end if;
  update public.batch_weight_confirmations set status = case when p_yes then 'confirmed' else 'disputed' end,
    answered_at = now(), answered_by_phone = p_phone, confirmed_by_staff_id = null
    where batch_id = b.id and stage = p.payload->>'stage' and prompt_id = p.id and status = 'pending'
      and p.expires_at > now()
    returning id into updated_id;
  return updated_id is not null;
end;
$$;

create function public.confirm_batch_weight_in_person(p_batch_id uuid, p_stage text, p_staff_id uuid, p_confirmation_updated_at timestamptz)
returns boolean language plpgsql set search_path = '' as $$
declare c public.batch_weight_confirmations;
begin
  perform 1 from public.staff where id = p_staff_id;
  if not found then raise exception 'staff_not_found'; end if;
  perform 1 from public.batches where id = p_batch_id for update;
  select * into c from public.batch_weight_confirmations
    where batch_id = p_batch_id and stage = p_stage for update;
  if c.id is null or c.updated_at is distinct from p_confirmation_updated_at then return false; end if;
  update public.batch_weight_confirmations set status = 'confirmed', answered_at = now(),
    confirmed_by_staff_id = p_staff_id, answered_by_phone = null where id = c.id;
  update public.sms_prompts set status = 'expired' where id = c.prompt_id and status = 'open';
  return true;
end;
$$;
revoke execute on function public.record_batch_measurement(uuid, text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.answer_batch_weight(uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public.confirm_batch_weight_in_person(uuid, text, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.record_batch_measurement(uuid, text, jsonb, text) to service_role;
grant execute on function public.answer_batch_weight(uuid, text, boolean) to service_role;
grant execute on function public.confirm_batch_weight_in_person(uuid, text, uuid, timestamptz) to service_role;
