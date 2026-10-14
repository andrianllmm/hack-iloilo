-- M7. Pricing and Cost: one price row per effective date.

create table public.prices (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id),
  effective_date date not null,
  buy_base_minor_per_kg integer not null check (buy_base_minor_per_kg >= 0),
  buy_reference_mc numeric(4, 1) not null default 25,
  -- Deduction factors, sack weight and the MC adjustment rule.
  buy_rules jsonb not null default
    '{"damaged": 0.25, "immature": 0.10, "foreign": 1.0, "sack_kg": 0.1, "mc_rule": "proportional"}',
  drying_fee_minor_per_kg integer not null check (drying_fee_minor_per_kg >= 0),
  milling_fee_minor_per_kg integer not null check (milling_fee_minor_per_kg >= 0),
  rice_minor_per_kg integer not null check (rice_minor_per_kg >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (facility_id, effective_date)
);

create trigger prices_set_updated_at before update on public.prices
for each row execute function public.set_updated_at();

alter table public.prices enable row level security;
