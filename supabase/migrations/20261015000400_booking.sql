-- M4. Booking: future drying and milling slots.

create type public.service as enum ('drying', 'milling');
create type public.booking_channel as enum ('sms', 'staff');
create type public.booking_status as enum (
  'confirmed', 'reschedule_proposed', 'arrived', 'cancelled', 'no_show'
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id),
  ref text not null unique check (ref ~ '^[A-Z0-9]{6}$'),
  service public.service not null,
  client_id uuid not null references public.clients (id),
  booked_by_phone text not null,
  channel public.booking_channel not null,
  est_kg integer not null check (est_kg > 0),
  preferred_date date not null,
  flex_days integer not null default 0 check (flex_days >= 0),
  scheduled_date date not null,
  status public.booking_status not null default 'confirmed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bookings_scheduled_idx on public.bookings (facility_id, service, scheduled_date);
create index bookings_client_id_idx on public.bookings (client_id);

create trigger bookings_set_updated_at before update on public.bookings
for each row execute function public.set_updated_at();

alter table public.bookings enable row level security;
