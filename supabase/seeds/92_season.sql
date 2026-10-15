-- Season heatmap (#50): about three months of past drying batches, so the
-- heatmap's recorded half has data. Custom palay, dried and picked up by its
-- owner. Load ramps up into the wet-season harvest and is light on Sundays.
-- Days -92 to -3, so batch numbers never clash with 06_gate.sql (days 0 to -2).
with days as (
  select
    d,
    current_date + d as day,
    least(0.95, greatest(0.05,
      (0.15 + 0.75 * power((d + 92) / 89.0, 2) + (abs(d) * 7 % 5) * 0.04 - 0.08)
      * case when extract(dow from current_date + d) = 0 then 0.3 else 1 end
    )) as f
  from generate_series(-92, -3) as d
),
-- One dryer load (9.5–10 t) per batch, at most 11 a day (capacity 112 t/day).
loads as (
  select
    d, day, k,
    9500 + (k * 373 + abs(d) * 17) % 500 as net_kg,
    (day + time '06:00' + (k - 1) * interval '1 hour') at time zone 'Asia/Manila' as start
  from days, generate_series(1, floor(f * 11)::int) as k
),
dried as (
  insert into public.batches (
    facility_id, batch_no, client_id, ownership, stage, bags, net_kg, mc,
    dryer_id, dry_start, dry_end, mc_out, dried_kg
  )
  select
    'f0000000-0000-0000-0000-000000000001',
    to_char(l.day, 'YYMMDD') || '-' || lpad(l.k::text, 3, '0'),
    ('c1000000-0000-0000-0000-0000000000' || lpad(((abs(l.d) + l.k) % 24 + 1)::text, 2, '0'))::uuid,
    'custom', 'dispatched', l.net_kg / 50, l.net_kg, 23.0,
    m.id, l.start, l.start + interval '8 hours', 14.0, round(l.net_kg * 0.9)::integer
  from loads l
  join public.machines m
    on m.facility_id = 'f0000000-0000-0000-0000-000000000001'
   and m.code = 'D' || ((l.k - 1) % 5 + 1)
  returning id, client_id, dried_kg, dry_end
)
-- The owner's pickup, as in 06_gate.sql.
insert into public.dispatches (batch_id, buyer_id, kg, price_minor_per_kg, dispatched_at)
select id, client_id, dried_kg, 0, dry_end + interval '4 hours' from dried;
