-- M2. Accounts: clients (staff is in the base migration).

create type public.client_kind as enum ('farmer', 'coop', 'trader', 'buyer');

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  kind public.client_kind not null,
  municipality_id uuid references public.municipalities (id),
  -- The co-op this client belongs to.
  coop_id uuid references public.clients (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_municipality_id_idx on public.clients (municipality_id);
create index clients_coop_id_idx on public.clients (coop_id);

create trigger clients_set_updated_at before update on public.clients
for each row execute function public.set_updated_at();

alter table public.clients enable row level security;
