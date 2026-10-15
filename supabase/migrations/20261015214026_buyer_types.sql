-- M2. Accounts: what kind of first-hand buyer a `buyer` client is, so
-- traceability can tell a ₱20/kg program delivery from a wholesaler. Values
-- follow IRPC's Top Clients list plus the challenge's drop-points and program.

create type public.buyer_type as enum (
  'wholesaler',
  'retailer',
  'institutional',
  'cooperative',
  'drop_point',
  'subsidy_program'
);

-- Nullable: buyers registered by SMS or at the gate have no type until staff set one.
alter table public.clients
  add column buyer_type public.buyer_type,
  add constraint clients_buyer_type_kind check (buyer_type is null or kind = 'buyer');
