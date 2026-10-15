-- M4: failed ref + phone tries on the public /track page. A phone with too
-- many recent failures is locked out for a while (basic abuse guard).

create table public.track_attempts (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index track_attempts_phone_created_idx
  on public.track_attempts (phone, created_at desc);

create trigger track_attempts_set_updated_at before update on public.track_attempts
for each row execute function public.set_updated_at();

alter table public.track_attempts enable row level security;
