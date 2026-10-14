-- M5. Buying: sell offers. Purchases follow batches (M6).

create type public.sell_offer_status as enum (
  'offered', 'accepted', 'declined', 'arrived', 'withdrawn'
);

create table public.sell_offers (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id),
  ref text not null unique check (ref ~ '^[A-Z0-9]{6}$'),
  client_id uuid not null references public.clients (id),
  booked_by_phone text not null,
  variety_id uuid references public.varieties (id),
  est_kg integer not null check (est_kg > 0),
  harvest_date date not null,
  status public.sell_offer_status not null default 'offered',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sell_offers_harvest_idx on public.sell_offers (facility_id, status, harvest_date);
create index sell_offers_client_id_idx on public.sell_offers (client_id);

create trigger sell_offers_set_updated_at before update on public.sell_offers
for each row execute function public.set_updated_at();

alter table public.sell_offers enable row level security;
