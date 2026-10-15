-- M6. Gate: today's live queue for the demo.
--
-- Drying: one client being served (batch -003) and four waiting.
-- Milling: one client being served (batch -002) and two waiting.
-- Plus one client already done this morning (batch -001). Times are relative to now().
-- Batch numbers use today's Manila date: YYMMDD-NNN.

insert into public.queue_entries (
  id, facility_id, service, client_id, ownership, est_kg,
  checked_in_at, started_at, finished_at, status
)
values
  -- Drying line
  ('a6000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'drying',
   'c1000000-0000-0000-0000-000000000006', 'irpc', 3000,
   now() - interval '95 minutes', now() - interval '40 minutes', null, 'serving'),
  ('a6000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 'drying',
   'c1000000-0000-0000-0000-000000000002', 'custom', 2500,
   now() - interval '80 minutes', null, null, 'waiting'),
  ('a6000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001', 'drying',
   'c1000000-0000-0000-0000-000000000017', 'custom', 1200,
   now() - interval '65 minutes', null, null, 'waiting'),
  ('a6000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000001', 'drying',
   'c0000000-0000-0000-0000-000000000002', 'irpc', 9000,
   now() - interval '50 minutes', null, null, 'waiting'),
  ('a6000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000001', 'drying',
   'c1000000-0000-0000-0000-000000000024', 'custom', 3000,
   now() - interval '20 minutes', null, null, 'waiting'),
  -- Milling line
  ('a6000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000001', 'milling',
   'c0000000-0000-0000-0000-000000000001', 'custom', 6000,
   now() - interval '130 minutes', now() - interval '110 minutes', null, 'serving'),
  ('a6000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000001', 'milling',
   'c2000000-0000-0000-0000-000000000001', 'custom', 4000,
   now() - interval '75 minutes', null, null, 'waiting'),
  ('a6000000-0000-0000-0000-000000000008', 'f0000000-0000-0000-0000-000000000001', 'milling',
   'c1000000-0000-0000-0000-000000000011', 'custom', 800,
   now() - interval '40 minutes', null, null, 'waiting'),
  -- Done earlier
  ('a6000000-0000-0000-0000-000000000009', 'f0000000-0000-0000-0000-000000000001', 'drying',
   'c1000000-0000-0000-0000-000000000008', 'custom', 2000,
   now() - interval '200 minutes', now() - interval '180 minutes', now() - interval '100 minutes', 'done');

insert into public.batches (facility_id, batch_no, queue_entry_id, client_id, ownership, stage)
select e.facility_id,
  to_char(now() at time zone 'Asia/Manila', 'YYMMDD') || '-' || v.seq,
  e.id, e.client_id, e.ownership, 'received'
from (
  values
  ('a6000000-0000-0000-0000-000000000009', '001'),
  ('a6000000-0000-0000-0000-000000000006', '002'),
  ('a6000000-0000-0000-0000-000000000001', '003')
) as v (entry_id, seq)
join public.queue_entries e on e.id = v.entry_id::uuid;
