-- M2. Accounts: buyer types for the Top Clients buyers, plus a ₱20/kg program
-- buyer and a municipal drop-point.
--
-- Fixed client ids: c3000000-0000-0000-0000-000000000021 (₱20/kg program),
-- c3000000-0000-0000-0000-000000000022 (drop-point).

-- Types from IRPC's Top Clients list (see the comments in 02_accounts.sql).
update public.clients c
set buyer_type = v.buyer_type::public.buyer_type
from (
  values
  ('c3000000-0000-0000-0000-000000000001', 'wholesaler'), -- A
  ('c3000000-0000-0000-0000-000000000002', 'wholesaler'), -- B
  ('c3000000-0000-0000-0000-000000000003', 'wholesaler'), -- C
  ('c3000000-0000-0000-0000-000000000004', 'wholesaler'), -- D
  ('c3000000-0000-0000-0000-000000000005', 'retailer'), -- E
  ('c3000000-0000-0000-0000-000000000006', 'retailer'), -- F
  ('c3000000-0000-0000-0000-000000000007', 'retailer'), -- G
  ('c3000000-0000-0000-0000-000000000008', 'retailer'), -- H
  ('c3000000-0000-0000-0000-000000000009', 'retailer'), -- I
  ('c3000000-0000-0000-0000-000000000010', 'retailer'), -- J
  ('c3000000-0000-0000-0000-000000000011', 'retailer'), -- K
  ('c3000000-0000-0000-0000-000000000012', 'retailer'), -- L
  ('c3000000-0000-0000-0000-000000000013', 'retailer'), -- M
  ('c3000000-0000-0000-0000-000000000014', 'institutional'), -- N
  ('c3000000-0000-0000-0000-000000000015', 'cooperative'), -- O
  ('c3000000-0000-0000-0000-000000000016', 'retailer'), -- P
  ('c3000000-0000-0000-0000-000000000017', 'retailer'), -- Q
  ('c3000000-0000-0000-0000-000000000018', 'cooperative'), -- R
  ('c3000000-0000-0000-0000-000000000019', 'retailer'), -- S
  ('c3000000-0000-0000-0000-000000000020', 'retailer') -- T
) as v (id, buyer_type)
where c.id = v.id::uuid;

-- Names are invented; phones are fake like the other buyers.
insert into public.clients (id, name, phone, kind, buyer_type, municipality_id)
select v.id::uuid, v.name, v.phone, 'buyer', v.buyer_type::public.buyer_type, m.id
from (
  values
  ('c3000000-0000-0000-0000-000000000021', 'Iloilo ₱20/kg Rice Program', '+639174000021', 'subsidy_program', '0631800000'),
  ('c3000000-0000-0000-0000-000000000022', 'Oton Municipal Drop-Point', '+639174000022', 'drop_point', '0603034000')
) as v (id, name, phone, buyer_type, psgc_code)
left join public.municipalities m on m.psgc_code = v.psgc_code;
