-- Explicit staff choice at drying completion. Existing batches keep their flow.
alter table public.batches add column pickup_after_drying boolean not null default false;

create function public.finish_batch_drying(p_batch_id uuid, p_fields jsonb, p_ref text, p_ready_for_pickup boolean)
returns jsonb language plpgsql set search_path = '' as $$
declare b public.batches;
begin
  select * into b from public.batches where id = p_batch_id for update;
  if not found or b.stage <> 'drying' then raise exception 'stale_stage'; end if;
  if p_ready_for_pickup and b.ownership <> 'custom' then raise exception 'pickup_requires_custom'; end if;
  update public.batches set pickup_after_drying = p_ready_for_pickup where id = p_batch_id;
  return public.record_batch_measurement(p_batch_id, 'drying', p_fields, p_ref);
end;
$$;
revoke execute on function public.finish_batch_drying(uuid, jsonb, text, boolean) from public, anon, authenticated;
grant execute on function public.finish_batch_drying(uuid, jsonb, text, boolean) to service_role;
