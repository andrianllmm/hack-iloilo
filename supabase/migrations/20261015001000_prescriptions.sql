-- M10. Prescriptions: only decisions and cached explanations are stored;
-- suggestions are recomputed from capacity.

create type public.prescription_kind as enum (
  'move_bookings', 'fill_idle', 'mill_full_loads', 'store_mill_later'
);
create type public.prescription_status as enum ('accepted', 'dismissed');

create table public.prescription_decisions (
  id uuid primary key default gen_random_uuid(),
  kind public.prescription_kind not null,
  -- Hash of the suggestion's inputs.
  key text not null unique,
  status public.prescription_status not null,
  decided_by uuid not null references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.prescription_notes (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger prescription_decisions_set_updated_at before update on public.prescription_decisions
for each row execute function public.set_updated_at();
create trigger prescription_notes_set_updated_at before update on public.prescription_notes
for each row execute function public.set_updated_at();

alter table public.prescription_decisions enable row level security;
alter table public.prescription_notes enable row level security;
