-- Shared helpers and staff accounts (TRD: Rules for all code, Auth, M2).

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create type public.staff_role as enum ('encoder', 'manager');

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null,
  role public.staff_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger staff_set_updated_at
before update on public.staff
for each row execute function public.set_updated_at();

-- All access is server-side via the service role; no public policies.
alter table public.staff enable row level security;
