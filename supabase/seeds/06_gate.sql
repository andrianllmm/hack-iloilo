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

-- Earlier batches partway through drying and milling, for the batches list and
-- the storage snapshot. Numbered on the previous Manila day so they don't clash
-- with today's queue-opened batches. No queue entry (that line is long closed).
with d1 as (
  select id from public.machines
  where facility_id = 'f0000000-0000-0000-0000-000000000001' and code = 'D1'
),
m1 as (
  select id from public.machines
  where facility_id = 'f0000000-0000-0000-0000-000000000001' and code = 'M1'
),
yday as (
  select to_char((now() at time zone 'Asia/Manila') - interval '1 day', 'YYMMDD') as ymd
)
insert into public.batches (
  facility_id, batch_no, client_id, ownership, stage, bags, net_kg, mc,
  dryer_id, dry_start, dry_end, mc_out, dried_kg,
  mill_id, mill_start, mill_end, mill_in_kg, rice_kg, byproducts
)
values
  -- Drying in progress (custom): in the dryer, not yet out.
  ('f0000000-0000-0000-0000-000000000001', (select ymd from yday) || '-001',
   'c1000000-0000-0000-0000-000000000003', 'custom', 'drying', 50, 2500, 23.4,
   (select id from d1), now() - interval '3 hours', null, null, null,
   null, null, null, null, null, '{}'),
  -- Stored, IRPC-owned, dried (counts in the storage snapshot by dried kg).
  ('f0000000-0000-0000-0000-000000000001', (select ymd from yday) || '-002',
   'c0000000-0000-0000-0000-000000000001', 'irpc', 'stored', 180, 9000, 24.0,
   (select id from d1), now() - interval '28 hours', now() - interval '20 hours', 13.8, 8600,
   null, null, null, null, null, '{}'),
  -- Stored, IRPC-owned, drying skipped (counts by net kg).
  ('f0000000-0000-0000-0000-000000000001', (select ymd from yday) || '-003',
   'c0000000-0000-0000-0000-000000000002', 'irpc', 'stored', 120, 6000, 13.5,
   null, null, null, null, null,
   null, null, null, null, null, '{}'),
  -- Milling in progress (custom): dried, now in the mill.
  ('f0000000-0000-0000-0000-000000000001', (select ymd from yday) || '-004',
   'c1000000-0000-0000-0000-000000000005', 'custom', 'milling', 80, 4000, 22.0,
   (select id from d1), now() - interval '26 hours', now() - interval '18 hours', 13.9, 3850,
   (select id from m1), now() - interval '2 hours', null, null, null, '{}'),
  -- Milled (custom): full trail, recovery computes to 65.5%.
  ('f0000000-0000-0000-0000-000000000001', (select ymd from yday) || '-005',
   'c1000000-0000-0000-0000-000000000011', 'custom', 'milled', 40, 2000, 21.5,
   (select id from d1), now() - interval '30 hours', now() - interval '22 hours', 13.5, 1920,
   (select id from m1), now() - interval '16 hours', now() - interval '15 hours', 1900, 1245,
   '{"bran_kg": 190, "husk_kg": 420}');

-- Dispatched and part-dispatched batches, two Manila days back so their numbers
-- don't clash. Fixed ids so the dispatches below can reference them.
--   b..01 IRPC, milled, sold out (5,400 kg rice) -> stage 'dispatched'
--   b..02 IRPC, milled, part-sold (1,800 of 3,000 kg) -> stays 'milled'
--   b..03 custom, dried, picked up by its owner (2,300 kg) -> stage 'dispatched'
with d1 as (
  select id from public.machines
  where facility_id = 'f0000000-0000-0000-0000-000000000001' and code = 'D1'
),
m1 as (
  select id from public.machines
  where facility_id = 'f0000000-0000-0000-0000-000000000001' and code = 'M1'
),
yday2 as (
  select to_char((now() at time zone 'Asia/Manila') - interval '2 days', 'YYMMDD') as ymd
)
insert into public.batches (
  id, facility_id, batch_no, client_id, ownership, stage, bags, net_kg, mc,
  dryer_id, dry_start, dry_end, mc_out, dried_kg,
  mill_id, mill_start, mill_end, mill_in_kg, rice_kg, byproducts
)
values
  ('b6000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001',
   (select ymd from yday2) || '-001',
   'c1000000-0000-0000-0000-000000000006', 'irpc', 'dispatched', 180, 9000, 24.5,
   (select id from d1), now() - interval '54 hours', now() - interval '46 hours', 14.0, 7800,
   (select id from m1), now() - interval '40 hours', now() - interval '39 hours', 7800, 5400,
   '{"bran_kg": 780, "husk_kg": 1560}'),
  ('b6000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001',
   (select ymd from yday2) || '-002',
   'c2000000-0000-0000-0000-000000000001', 'irpc', 'milled', 100, 5000, 23.0,
   (select id from d1), now() - interval '52 hours', now() - interval '44 hours', 14.0, 4300,
   (select id from m1), now() - interval '38 hours', now() - interval '37 hours', 4300, 3000,
   '{"bran_kg": 430, "husk_kg": 850}'),
  ('b6000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001',
   (select ymd from yday2) || '-003',
   'c1000000-0000-0000-0000-000000000008', 'custom', 'dispatched', 56, 2800, 22.0,
   (select id from d1), now() - interval '50 hours', now() - interval '42 hours', 13.8, 2300,
   null, null, null, null, null, '{}');

-- Sales to buyers and the owner's pickup. Price is centavos per kg.
insert into public.dispatches (
  id, batch_id, buyer_id, kg, price_minor_per_kg, or_ref, dispatched_at
)
values
  ('d6000000-0000-0000-0000-000000000001', 'b6000000-0000-0000-0000-000000000001',
   'c3000000-0000-0000-0000-000000000001', 3000, 3800, '4471', now() - interval '3 hours'),
  ('d6000000-0000-0000-0000-000000000002', 'b6000000-0000-0000-0000-000000000001',
   'c3000000-0000-0000-0000-000000000002', 2400, 3750, '4472', now() - interval '2 hours'),
  ('d6000000-0000-0000-0000-000000000003', 'b6000000-0000-0000-0000-000000000002',
   'c3000000-0000-0000-0000-000000000006', 1800, 3900, '4480', now() - interval '90 minutes'),
  ('d6000000-0000-0000-0000-000000000004', 'b6000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000008', 2300, 0, null, now() - interval '30 minutes');
