-- Staff inbox: one event, with independent read state for every staff member.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('sell_offer_created', 'booking_created', 'booking_cancelled', 'reschedule_accepted', 'reschedule_declined', 'suggestion_created', 'sms_failed', 'sms_attention')),
  title text not null,
  href text not null check (href in ('/buying', '/bookings', '/suggestions', '/sms')),
  role public.staff_role,
  entity_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, entity_id)
);
create index notifications_role_created_idx on public.notifications (role, created_at desc, id desc);

create table public.notification_reads (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_id, staff_id)
);
create index notification_reads_staff_idx on public.notification_reads (staff_id, notification_id);

create trigger notifications_set_updated_at before update on public.notifications
for each row execute function public.set_updated_at();
create trigger notification_reads_set_updated_at before update on public.notification_reads
for each row execute function public.set_updated_at();
alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;

-- Service-only helpers apply role visibility to counts, items and writes alike.
create function public.staff_notification_inbox(p_staff_id uuid)
returns jsonb language sql stable set search_path = '' as $$
  with visible as (
    select n.id, n.kind, n.title, n.href, n.created_at, r.read_at
    from public.notifications n
    join public.staff s on s.id = p_staff_id
    left join public.notification_reads r on r.notification_id = n.id and r.staff_id = s.id
    where n.role is null or n.role = s.role
  ), recent as (
    select * from visible order by created_at desc, id desc limit 20
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(recent) order by created_at desc, id desc) from recent), '[]'::jsonb),
    'unreadCount', (select count(*) from visible where read_at is null)
  );
$$;

create function public.read_staff_notifications(p_staff_id uuid, p_notification_id uuid default null)
returns void language sql set search_path = '' as $$
  insert into public.notification_reads (notification_id, staff_id)
  select n.id, s.id from public.notifications n
  join public.staff s on s.id = p_staff_id
  where (n.role is null or n.role = s.role)
    and (p_notification_id is null or n.id = p_notification_id)
  on conflict (notification_id, staff_id) do nothing;
$$;

revoke execute on function public.staff_notification_inbox(uuid) from public, anon, authenticated;
revoke execute on function public.read_staff_notifications(uuid, uuid) from public, anon, authenticated;
grant execute on function public.staff_notification_inbox(uuid) to service_role;
grant execute on function public.read_staff_notifications(uuid, uuid) to service_role;
grant all on public.notifications, public.notification_reads to service_role;
