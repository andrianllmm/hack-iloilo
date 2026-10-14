-- M6. Gate and Batches: queue, batch record, dispatch.

create type public.queue_status as enum ('waiting', 'serving', 'done', 'left');

create table public.queue_entries (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id),
  service public.service not null,
  client_id uuid not null references public.clients (id),
  booking_id uuid references public.bookings (id),
  offer_id uuid references public.sell_offers (id),
  checked_in_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  status public.queue_status not null default 'waiting',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index queue_entries_live_idx on public.queue_entries (facility_id, service, status, checked_in_at);

create type public.batch_ownership as enum ('custom', 'irpc');
create type public.batch_stage as enum (
  'received', 'drying', 'stored', 'milling', 'milled', 'dispatched'
);

create table public.batches (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id),
  batch_no text not null unique,
  queue_entry_id uuid unique references public.queue_entries (id),
  client_id uuid not null references public.clients (id),
  ownership public.batch_ownership not null,
  stage public.batch_stage not null default 'received',
  variety_id uuid references public.varieties (id),
  -- Receiving
  bags integer check (bags >= 0),
  net_kg integer check (net_kg >= 0),
  mc numeric(4, 1) check (mc between 0 and 100),
  damaged_pct numeric(5, 2) check (damaged_pct between 0 and 100),
  immature_pct numeric(5, 2) check (immature_pct between 0 and 100),
  foreign_pct numeric(5, 2) check (foreign_pct between 0 and 100),
  doc_refs jsonb not null default '{}',
  -- Drying
  dryer_id uuid references public.machines (id),
  dry_start timestamptz,
  dry_end timestamptz,
  mc_out numeric(4, 1) check (mc_out between 0 and 100),
  dried_kg integer check (dried_kg >= 0),
  -- Milling
  mill_id uuid references public.machines (id),
  mill_start timestamptz,
  mill_end timestamptz,
  mill_in_kg integer check (mill_in_kg >= 0),
  rice_kg integer check (rice_kg >= 0),
  byproducts jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index batches_stage_idx on public.batches (facility_id, stage);
create index batches_client_id_idx on public.batches (client_id);

create table public.dispatches (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id),
  buyer_id uuid not null references public.clients (id),
  kg integer not null check (kg > 0),
  price_minor_per_kg integer not null check (price_minor_per_kg >= 0),
  or_ref text,
  dispatched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index dispatches_batch_id_idx on public.dispatches (batch_id);

create trigger queue_entries_set_updated_at before update on public.queue_entries
for each row execute function public.set_updated_at();
create trigger batches_set_updated_at before update on public.batches
for each row execute function public.set_updated_at();
create trigger dispatches_set_updated_at before update on public.dispatches
for each row execute function public.set_updated_at();

alter table public.queue_entries enable row level security;
alter table public.batches enable row level security;
alter table public.dispatches enable row level security;
