-- Platform-wide home banner (superadmin-managed).

create table if not exists public.platform_announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  severity text not null default 'info',
  link_url text,
  link_label text,
  active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_announcements_severity_check
    check (severity in ('info', 'warn', 'success'))
);

create index if not exists platform_announcements_active_idx
  on public.platform_announcements (active, updated_at desc)
  where active = true;

alter table public.platform_announcements enable row level security;
alter table public.platform_announcements force row level security;
revoke all on table public.platform_announcements from anon, authenticated;
grant all on table public.platform_announcements to service_role;

-- Public read of active announcements (banner text only).
grant select on table public.platform_announcements to anon, authenticated;

create policy "platform_announcements_select_active"
  on public.platform_announcements for select
  to anon, authenticated
  using (active = true);
