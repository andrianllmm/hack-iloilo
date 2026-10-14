-- M8. Forecast: imported expected arrivals (already × IRPC's share) and metrics.

create type public.forecast_source as enum ('opa-2025', 'demo-synthetic');

create table public.forecast_arrivals (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null references public.municipalities (id),
  date date not null,
  kg_low integer not null check (kg_low >= 0),
  kg_mid integer not null check (kg_mid >= kg_low),
  kg_high integer not null check (kg_high >= kg_mid),
  source public.forecast_source not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, municipality_id, date)
);

create index forecast_arrivals_date_idx on public.forecast_arrivals (date);

create table public.forecast_metrics (
  id uuid primary key default gen_random_uuid(),
  trained_on timestamptz not null,
  metrics jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger forecast_arrivals_set_updated_at before update on public.forecast_arrivals
for each row execute function public.set_updated_at();
create trigger forecast_metrics_set_updated_at before update on public.forecast_metrics
for each row execute function public.set_updated_at();

alter table public.forecast_arrivals enable row level security;
alter table public.forecast_metrics enable row level security;
