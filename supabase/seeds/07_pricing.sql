-- M7. Pricing and Cost: today's prices for the IRPC facility.
--
-- Facility id f0000000-0000-0000-0000-000000000001 (see 01_setup.sql).
-- Money is integer centavos: ₱21.00 = 2100. Effective today so a PRICE text
-- and receiving both read it. buy_reference_mc and buy_rules use column defaults
-- (25% MC; damaged 0.25, immature 0.10, foreign 1.0, sack_kg 0.1, proportional).

insert into public.prices (
  facility_id, effective_date,
  buy_base_minor_per_kg, drying_fee_minor_per_kg, milling_fee_minor_per_kg, rice_minor_per_kg
)
values (
  'f0000000-0000-0000-0000-000000000001', (now() at time zone 'Asia/Manila')::date,
  2100, 160, 330, 4700
);
