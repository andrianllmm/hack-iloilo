-- M1. Setup: IRPC, its machines, rice varieties, Iloilo municipalities.
--
-- Fixed ids (reference these from other seed files):
--   IRPC facility  f0000000-0000-0000-0000-000000000001
-- Look up machines by code (D1–D6, M1), varieties by code, municipalities by psgc_code.
--
-- Confirmed: storage 1,100 t.
-- UNCONFIRMED (flag in Settings until IRPC confirms; see PRD open questions):
--   dryers                   5 × 10 t + 1 × 6 t (spec sheet; feasibility study says 5 × 8 t)
--   mill kg_per_hour         3100    (sample run; spec sheet 400 bags/day, challenge form 50 t/day)
--   operating_hours_per_day  16      (gives mill ~50 t/day, matching the challenge form)
--   dryer cycle_hours        8       (not recorded)
--   dryer rated_kw           15 each (unknown)
--   mill rated_kw            75      (unknown)
--   base_load_kw             20      (unknown)
--   tariff                   ₱12.00/kWh (unknown)
--   labor                    ₱625/h for the crew (unknown)

insert into public.facilities (
  id, name, storage_capacity_kg, operating_hours_per_day, base_load_kw,
  tariff_minor_per_kwh, labor_minor_per_hour, dry_yield_pct, idle_threshold_pct, notify_ahead_n
)
values (
  'f0000000-0000-0000-0000-000000000001', 'Iloilo Rice Processing Complex', 1100000, 16, 20,
  1200, 62500, 89, 30, 3
);

insert into public.machines (facility_id, type, code, capacity_kg, cycle_hours, kg_per_hour, rated_kw)
values
  ('f0000000-0000-0000-0000-000000000001', 'dryer', 'D1', 10000, 8, null, 15),
  ('f0000000-0000-0000-0000-000000000001', 'dryer', 'D2', 10000, 8, null, 15),
  ('f0000000-0000-0000-0000-000000000001', 'dryer', 'D3', 10000, 8, null, 15),
  ('f0000000-0000-0000-0000-000000000001', 'dryer', 'D4', 10000, 8, null, 15),
  ('f0000000-0000-0000-0000-000000000001', 'dryer', 'D5', 10000, 8, null, 15),
  ('f0000000-0000-0000-0000-000000000001', 'dryer', 'D6', 6000, 8, null, 15),
  ('f0000000-0000-0000-0000-000000000001', 'mill', 'M1', null, null, 3100, 75);

-- Codes are what clients type by SMS (e.g. SELL 2000 RC222).
insert into public.varieties (code, name)
values
  ('RC222', 'NSIC Rc222 (Tubigan 18)'),
  ('RC160', 'NSIC Rc160'),
  ('RC216', 'NSIC Rc216'),
  ('RC218', 'NSIC Rc218'),
  ('RC300', 'NSIC Rc300'),
  ('RC402', 'NSIC Rc402'),
  ('RC480', 'NSIC Rc480'),
  ('HYBRID', 'Hybrid (any)'),
  ('OTHER', 'Other or mixed');

-- The places in the OPA planting and harvest data. 10-digit PSGC codes;
-- lat/lng are approximate town centres (for the municipality map).
insert into public.municipalities (psgc_code, name, lat, lng)
values
  ('0603001000', 'Ajuy', 11.1714, 123.0153),
  ('0603002000', 'Alimodian', 10.8197, 122.4317),
  ('0603003000', 'Anilao', 10.9786, 122.7528),
  ('0603004000', 'Badiangan', 10.9858, 122.5372),
  ('0603005000', 'Balasan', 11.4728, 123.0878),
  ('0603006000', 'Banate', 11.0000, 122.8222),
  ('0603007000', 'Barotac Nuevo', 10.8953, 122.7008),
  ('0603008000', 'Barotac Viejo', 11.0533, 122.8508),
  ('0603009000', 'Batad', 11.4194, 123.1106),
  ('0603010000', 'Bingawan', 11.2333, 122.5667),
  ('0603012000', 'Cabatuan', 10.8794, 122.4858),
  ('0603013000', 'Calinog', 11.1219, 122.5408),
  ('0603014000', 'Carles', 11.5728, 123.1339),
  ('0603015000', 'Concepcion', 11.2153, 123.1081),
  ('0603016000', 'Dingle', 11.0000, 122.6708),
  ('0603017000', 'Dueñas', 11.0667, 122.6167),
  ('0603018000', 'Dumangas', 10.8236, 122.7117),
  ('0603019000', 'Estancia', 11.4517, 123.1525),
  ('0603020000', 'Guimbal', 10.6625, 122.3228),
  ('0603021000', 'Igbaras', 10.7167, 122.2667),
  ('0631800000', 'Iloilo City', 10.7202, 122.5621),
  ('0603023000', 'Janiuay', 10.9500, 122.5000),
  ('0603025000', 'Lambunao', 11.0500, 122.4750),
  ('0603026000', 'Leganes', 10.7869, 122.5869),
  ('0603027000', 'Lemery', 11.2269, 122.9311),
  ('0603028000', 'Leon', 10.7811, 122.3894),
  ('0603029000', 'Maasin', 10.8908, 122.4342),
  ('0603030000', 'Miagao', 10.6442, 122.2353),
  ('0603031000', 'Mina', 10.9306, 122.5764),
  ('0603032000', 'New Lucena', 10.8792, 122.5947),
  ('0603034000', 'Oton', 10.6931, 122.4736),
  ('0603035000', 'Passi City', 11.1078, 122.6417),
  ('0603036000', 'Pavia', 10.7750, 122.5417),
  ('0603037000', 'Pototan', 10.9436, 122.6347),
  ('0603038000', 'San Dionisio', 11.2711, 123.0950),
  ('0603039000', 'San Enrique', 11.1003, 122.6625),
  ('0603040000', 'San Joaquin', 10.5883, 122.1417),
  ('0603041000', 'San Miguel', 10.7800, 122.4658),
  ('0603042000', 'San Rafael', 11.1772, 122.8328),
  ('0603043000', 'Santa Barbara', 10.8231, 122.5344),
  ('0603044000', 'Sara', 11.2583, 123.0139),
  ('0603045000', 'Tigbauan', 10.6747, 122.3778),
  ('0603046000', 'Tubungan', 10.7792, 122.3292),
  ('0603047000', 'Zarraga', 10.8236, 122.6097);
