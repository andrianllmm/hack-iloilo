-- M6. Gate: record a dispatch atomically. Locking the batch row and checking
-- the remaining kg, inserting the dispatch, and flipping the batch to
-- `dispatched` all happen in one transaction, so two concurrent dispatches
-- can't both pass the "what's left" check and overshoot the stock.

create function public.dispatch_from_batch(
  p_batch_id uuid,
  p_buyer_id uuid,
  p_kg integer,
  p_price_minor_per_kg integer,
  p_or_ref text
)
returns public.dispatches
language plpgsql
set search_path = ''
as $$
declare
  v_batch public.batches;
  v_dispatchable integer;
  v_already integer;
  v_remaining integer;
  v_row public.dispatches;
begin
  -- Lock the batch so concurrent dispatches serialize on this row.
  select * into v_batch from public.batches where id = p_batch_id for update;
  if not found then
    raise exception 'batch_not_found';
  end if;

  -- Dispatchable kg, mirroring dispatchableKg() in logic.ts: milled rice once
  -- milled, else a stored/dispatched custom batch's dried palay. The DB holds
  -- the authoritative check; logic.ts is only for the UI.
  if v_batch.rice_kg is not null then
    v_dispatchable := v_batch.rice_kg;
  elsif v_batch.ownership = 'custom'
        and v_batch.dried_kg is not null
        and v_batch.stage in ('stored', 'dispatched') then
    v_dispatchable := v_batch.dried_kg;
  else
    v_dispatchable := 0;
  end if;

  if v_dispatchable = 0 then
    raise exception 'not_dispatchable';
  end if;

  select coalesce(sum(kg), 0) into v_already
  from public.dispatches where batch_id = p_batch_id;
  v_remaining := v_dispatchable - v_already;
  if p_kg > v_remaining then
    raise exception 'over_dispatch:%', v_remaining;
  end if;

  insert into public.dispatches (batch_id, buyer_id, kg, price_minor_per_kg, or_ref)
  values (p_batch_id, p_buyer_id, p_kg, p_price_minor_per_kg, p_or_ref)
  returning * into v_row;

  if v_already + p_kg >= v_dispatchable then
    update public.batches set stage = 'dispatched' where id = p_batch_id;
  end if;

  return v_row;
end;
$$;

-- Server-side only (service role), like every other table.
revoke execute on function public.dispatch_from_batch (uuid, uuid, integer, integer, text) from public, anon, authenticated;
