-- M2. Accounts: staff logins and the base client list.
--
-- Fixed client ids (reference these from other seed files):
--   Co-ops   c0000000-0000-0000-0000-00000000000N  (1–3, all in Pototan)
--   Farmers  c1000000-0000-0000-0000-0000000000NN  (01–30; 01–10 co-op 1, 11–20 co-op 2, 21–30 co-op 3)
--   Traders  c2000000-0000-0000-0000-00000000000N  (1–3)
--   Buyers   c3000000-0000-0000-0000-0000000000NN  (01–20, IRPC Top Clients A–T)
-- Phones are fake: +63917{1 co-op, 2 farmer, 3 trader, 4 buyer}0000NN.

-- Local staff logins. Password for both: password123
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  (
    '00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
    'authenticated', 'authenticated', 'manager@irpc.test',
    extensions.crypt('password123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated', 'encoder@irpc.test',
    extensions.crypt('password123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  );

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
select gen_random_uuid(), u.id, u.id::text, 'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  now(), now(), now()
from auth.users u
where u.email in ('manager@irpc.test', 'encoder@irpc.test');

insert into public.staff (auth_user_id, name, role)
values
  ('11111111-1111-1111-1111-111111111111', 'Maria Manager', 'manager'),
  ('22222222-2222-2222-2222-222222222222', 'Eddie Encoder', 'encoder');

-- Co-ops, their member farmers, and traders.
insert into public.clients (id, name, phone, kind, municipality_id, coop_id)
select v.id::uuid, v.name, v.phone, v.kind::public.client_kind, m.id, v.coop_id::uuid
from (
  values
  ('c0000000-0000-0000-0000-000000000001', 'Amamaros Farmers Multi-Purpose Cooperative', '+639171000001', 'coop', '0603037000', null),
  ('c0000000-0000-0000-0000-000000000002', 'Lumbo Rice Growers Cooperative', '+639171000002', 'coop', '0603037000', null),
  ('c0000000-0000-0000-0000-000000000003', 'Guibuangan Irrigators Cooperative', '+639171000003', 'coop', '0603037000', null),
  ('c1000000-0000-0000-0000-000000000001', 'Rodel Panes', '+639172000001', 'farmer', '0603037000', 'c0000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000002', 'Josefina Tupas', '+639172000002', 'farmer', '0603037000', 'c0000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000003', 'Ernesto Gallego', '+639172000003', 'farmer', '0603037000', 'c0000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000004', 'Lorna Sumagaysay', '+639172000004', 'farmer', '0603037000', 'c0000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000005', 'Danilo Pama', '+639172000005', 'farmer', '0603037000', 'c0000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000006', 'Merlinda Tayco', '+639172000006', 'farmer', '0603047000', 'c0000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000007', 'Rogelio Palmares', '+639172000007', 'farmer', '0603037000', 'c0000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000008', 'Teresita Lachica', '+639172000008', 'farmer', '0603037000', 'c0000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000009', 'Arnel Sotelo', '+639172000009', 'farmer', '0603037000', 'c0000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000010', 'Nenita Pacete', '+639172000010', 'farmer', '0603037000', 'c0000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000011', 'Wilfredo Gelito', '+639172000011', 'farmer', '0603037000', 'c0000000-0000-0000-0000-000000000002'),
  ('c1000000-0000-0000-0000-000000000012', 'Corazon Doromal', '+639172000012', 'farmer', '0603037000', 'c0000000-0000-0000-0000-000000000002'),
  ('c1000000-0000-0000-0000-000000000013', 'Ramon Jaleco', '+639172000013', 'farmer', '0603037000', 'c0000000-0000-0000-0000-000000000002'),
  ('c1000000-0000-0000-0000-000000000014', 'Elena Tamayo', '+639172000014', 'farmer', '0603037000', 'c0000000-0000-0000-0000-000000000002'),
  ('c1000000-0000-0000-0000-000000000015', 'Jesus Peñaflorida', '+639172000015', 'farmer', '0603031000', 'c0000000-0000-0000-0000-000000000002'),
  ('c1000000-0000-0000-0000-000000000016', 'Marites Ledesma', '+639172000016', 'farmer', '0603037000', 'c0000000-0000-0000-0000-000000000002'),
  ('c1000000-0000-0000-0000-000000000017', 'Romeo Gonzaga', '+639172000017', 'farmer', '0603037000', 'c0000000-0000-0000-0000-000000000002'),
  ('c1000000-0000-0000-0000-000000000018', 'Virginia Parcon', '+639172000018', 'farmer', '0603037000', 'c0000000-0000-0000-0000-000000000002'),
  ('c1000000-0000-0000-0000-000000000019', 'Noel Hechanova', '+639172000019', 'farmer', '0603037000', 'c0000000-0000-0000-0000-000000000002'),
  ('c1000000-0000-0000-0000-000000000020', 'Lilia Tirol', '+639172000020', 'farmer', '0603037000', 'c0000000-0000-0000-0000-000000000002'),
  ('c1000000-0000-0000-0000-000000000021', 'Edgardo Bermejo', '+639172000021', 'farmer', '0603037000', 'c0000000-0000-0000-0000-000000000003'),
  ('c1000000-0000-0000-0000-000000000022', 'Gloria Villanueva', '+639172000022', 'farmer', '0603037000', 'c0000000-0000-0000-0000-000000000003'),
  ('c1000000-0000-0000-0000-000000000023', 'Renato Ganzon', '+639172000023', 'farmer', '0603037000', 'c0000000-0000-0000-0000-000000000003'),
  ('c1000000-0000-0000-0000-000000000024', 'Rosalinda Javelosa', '+639172000024', 'farmer', '0603016000', 'c0000000-0000-0000-0000-000000000003'),
  ('c1000000-0000-0000-0000-000000000025', 'Alfredo Patriarca', '+639172000025', 'farmer', '0603037000', 'c0000000-0000-0000-0000-000000000003'),
  ('c1000000-0000-0000-0000-000000000026', 'Cristina Sollesta', '+639172000026', 'farmer', '0603037000', 'c0000000-0000-0000-0000-000000000003'),
  ('c1000000-0000-0000-0000-000000000027', 'Bienvenido Lopez', '+639172000027', 'farmer', '0603047000', 'c0000000-0000-0000-0000-000000000003'),
  ('c1000000-0000-0000-0000-000000000028', 'Analyn Defensor', '+639172000028', 'farmer', '0603037000', 'c0000000-0000-0000-0000-000000000003'),
  ('c1000000-0000-0000-0000-000000000029', 'Ferdinand Española', '+639172000029', 'farmer', '0603037000', 'c0000000-0000-0000-0000-000000000003'),
  ('c1000000-0000-0000-0000-000000000030', 'Myrna Tingson', '+639172000030', 'farmer', '0603037000', 'c0000000-0000-0000-0000-000000000003'),
  ('c2000000-0000-0000-0000-000000000001', 'Nonoy Palay Trading', '+639173000001', 'trader', '0603037000', null),
  ('c2000000-0000-0000-0000-000000000002', 'JRS Grains Dumangas', '+639173000002', 'trader', '0603018000', null),
  ('c2000000-0000-0000-0000-000000000003', 'Passi Agri Traders', '+639173000003', 'trader', '0603035000', null)
) as v (id, name, phone, kind, psgc_code, coop_id)
left join public.municipalities m on m.psgc_code = v.psgc_code;

-- Buyers from IRPC's Top Clients list. The source anonymises names (Customer A–T),
-- so names are invented; volumes and places are real. Bacolod and Kalibo are outside Iloilo.
insert into public.clients (id, name, phone, kind, municipality_id, coop_id)
select v.id::uuid, v.name, v.phone, v.kind::public.client_kind, m.id, v.coop_id::uuid
from (
  values
  ('c3000000-0000-0000-0000-000000000001', 'Negros Grains Wholesale', '+639174000001', 'buyer', null, null), -- A: 300,000 kg/yr, Bacolod, Wholesaler
  ('c3000000-0000-0000-0000-000000000002', 'Bacolod Rice Center', '+639174000002', 'buyer', null, null), -- B: 125,000 kg/yr, Bacolod, Wholesaler
  ('c3000000-0000-0000-0000-000000000003', 'Aklan Bigasan Wholesale', '+639174000003', 'buyer', null, null), -- C: 100,000 kg/yr, Kalibo, Wholesaler
  ('c3000000-0000-0000-0000-000000000004', 'Silay Road Rice Depot', '+639174000004', 'buyer', null, null), -- D: 75,000 kg/yr, Bacolod, Wholesaler
  ('c3000000-0000-0000-0000-000000000005', 'Libertad Market Rice Stall', '+639174000005', 'buyer', null, null), -- E: 50,000 kg/yr, Bacolod, Retailer
  ('c3000000-0000-0000-0000-000000000006', 'Central Market Bigasan', '+639174000006', 'buyer', '0631800000', null), -- F: 50,000 kg/yr, Iloilo City, Retailer
  ('c3000000-0000-0000-0000-000000000007', 'La Paz Rice Store', '+639174000007', 'buyer', '0631800000', null), -- G: 50,000 kg/yr, Iloilo City, Retailer
  ('c3000000-0000-0000-0000-000000000008', 'Janiuay Public Market Rice', '+639174000008', 'buyer', '0603023000', null), -- H: 35,000 kg/yr, Janiuay, Retailer
  ('c3000000-0000-0000-0000-000000000009', 'Jaro Rice Trading', '+639174000009', 'buyer', '0631800000', null), -- I: 30,000 kg/yr, Iloilo City, Retailer
  ('c3000000-0000-0000-0000-000000000010', 'Molo Bigasan', '+639174000010', 'buyer', '0631800000', null), -- J: 30,000 kg/yr, Iloilo City, Retailer
  ('c3000000-0000-0000-0000-000000000011', 'Mandurriao Rice Mart', '+639174000011', 'buyer', '0631800000', null), -- K: 25,000 kg/yr, Iloilo City, Retailer
  ('c3000000-0000-0000-0000-000000000012', 'Guimbal Rice Retail', '+639174000012', 'buyer', '0603020000', null), -- L: 22,000 kg/yr, Guimbal, Retailer
  ('c3000000-0000-0000-0000-000000000013', 'Dingle Bigasan', '+639174000013', 'buyer', '0603016000', null), -- M: 20,000 kg/yr, Dingle, Retailer
  ('c3000000-0000-0000-0000-000000000014', 'Provincial Feeding Program', '+639174000014', 'buyer', '0631800000', null), -- N: 16,000 kg/yr, Iloilo City, Institutional Buyer
  ('c3000000-0000-0000-0000-000000000015', 'Pototan Consumers Cooperative', '+639174000015', 'buyer', '0603037000', null), -- O: 15,000 kg/yr, Pototan, Cooperative
  ('c3000000-0000-0000-0000-000000000016', 'Pototan Town Rice Store', '+639174000016', 'buyer', '0603037000', null), -- P: 12,500 kg/yr, Pototan, Retailer
  ('c3000000-0000-0000-0000-000000000017', 'Amamaros Sari-Sari Bigasan', '+639174000017', 'buyer', '0603037000', null), -- Q: 10,000 kg/yr, Pototan, Retailer
  ('c3000000-0000-0000-0000-000000000018', 'Iloilo Employees Cooperative', '+639174000018', 'buyer', '0631800000', null), -- R: 7,000 kg/yr, Iloilo City, Cooperative
  ('c3000000-0000-0000-0000-000000000019', 'Naslo Rice Retail', '+639174000019', 'buyer', '0603037000', null), -- S: 6,000 kg/yr, Pototan, Retailer
  ('c3000000-0000-0000-0000-000000000020', 'Guimbal Bigasan Annex', '+639174000020', 'buyer', '0603020000', null) -- T: 6,000 kg/yr, Guimbal, Retailer
) as v (id, name, phone, kind, psgc_code, coop_id)
left join public.municipalities m on m.psgc_code = v.psgc_code;
