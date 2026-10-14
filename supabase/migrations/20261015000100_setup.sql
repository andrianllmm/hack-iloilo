-- M1. Setup: facility settings, machines, varieties, municipalities.

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  storage_capacity_kg integer not null check (storage_capacity_kg >= 0),
  operating_hours_per_day numeric(4, 1) not null check (operating_hours_per_day between 0 and 24),
  base_load_kw numeric(8, 2) not null default 0 check (base_load_kw >= 0),
  tariff_minor_per_kwh integer not null default 0 check (tariff_minor_per_kwh >= 0),
  labor_minor_per_hour integer not null default 0 check (labor_minor_per_hour >= 0),
  -- Dried kg per wet kg (%), for forward projections only.
  dry_yield_pct numeric(5, 2) not null default 89 check (dry_yield_pct between 0 and 100),
  idle_threshold_pct numeric(5, 2) not null default 30 check (idle_threshold_pct between 0 and 100),
  notify_ahead_n integer not null default 3 check (notify_ahead_n >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.machine_type as enum ('dryer', 'mill');

create table public.machines (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id) on delete cascade,
  type public.machine_type not null,
  code text not null,
  -- Dryers: kg per load and hours per cycle.
  capacity_kg integer check (capacity_kg > 0),
  cycle_hours numeric(4, 1) check (cycle_hours > 0),
  -- Mills: throughput.
  kg_per_hour integer check (kg_per_hour > 0),
  rated_kw numeric(8, 2) not null default 0 check (rated_kw >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (facility_id, code),
  check (
    (type = 'dryer' and capacity_kg is not null and cycle_hours is not null)
    or (type = 'mill' and kg_per_hour is not null)
  )
);

create table public.varieties (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.municipalities (
  id uuid primary key default gen_random_uuid(),
  psgc_code text not null unique,
  name text not null,
  lat numeric(9, 6),
  lng numeric(9, 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger facilities_set_updated_at before update on public.facilities
for each row execute function public.set_updated_at();
create trigger machines_set_updated_at before update on public.machines
for each row execute function public.set_updated_at();
create trigger varieties_set_updated_at before update on public.varieties
for each row execute function public.set_updated_at();
create trigger municipalities_set_updated_at before update on public.municipalities
for each row execute function public.set_updated_at();

alter table public.facilities enable row level security;
alter table public.machines enable row level security;
alter table public.varieties enable row level security;
alter table public.municipalities enable row level security;
