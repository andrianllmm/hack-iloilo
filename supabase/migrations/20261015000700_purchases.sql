-- M5. Buying: purchases of IRPC-owned palay, one per batch.

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null unique references public.batches (id),
  client_id uuid not null references public.clients (id),
  price_date date not null,
  net_kg integer not null check (net_kg >= 0),
  paid_kg integer not null check (paid_kg >= 0),
  price_minor_per_kg integer not null check (price_minor_per_kg >= 0),
  total_minor bigint not null check (total_minor >= 0),
  deductions jsonb not null default '{}',
  override_reason text,
  voucher_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index purchases_client_id_idx on public.purchases (client_id);

create trigger purchases_set_updated_at before update on public.purchases
for each row execute function public.set_updated_at();

alter table public.purchases enable row level security;
