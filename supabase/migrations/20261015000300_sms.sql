-- M3. SMS: message log and open yes/no prompts.

create type public.sms_direction as enum ('inbound', 'outbound');
create type public.sms_status as enum ('received', 'processed', 'queued', 'sent', 'failed');

create table public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  direction public.sms_direction not null,
  phone text not null,
  body text not null,
  -- SMSGate message id (inbound: payload.messageId); dedupes webhooks.
  gateway_id text unique,
  parsed jsonb,
  via_ai boolean not null default false,
  status public.sms_status not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sms_messages_phone_idx on public.sms_messages (phone, created_at desc);

create type public.sms_prompt_kind as enum ('ai_confirm', 'reschedule');
create type public.sms_prompt_status as enum ('open', 'accepted', 'declined', 'expired');

create table public.sms_prompts (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  ref text not null,
  kind public.sms_prompt_kind not null,
  payload jsonb not null default '{}',
  expires_at timestamptz not null default now() + interval '24 hours',
  status public.sms_prompt_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One open prompt per ref.
create unique index sms_prompts_open_ref_idx on public.sms_prompts (ref) where status = 'open';

create trigger sms_messages_set_updated_at before update on public.sms_messages
for each row execute function public.set_updated_at();
create trigger sms_prompts_set_updated_at before update on public.sms_prompts
for each row execute function public.set_updated_at();

alter table public.sms_messages enable row level security;
alter table public.sms_prompts enable row level security;
