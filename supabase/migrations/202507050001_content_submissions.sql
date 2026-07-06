-- Pending song/priest submissions + superadmin audit log (Render-safe persistence).

create table if not exists public.content_submissions (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  submitted_by_user_id uuid references public.profiles(id) on delete set null,
  submitted_by_email text,
  parish_id uuid references public.parishes(id) on delete set null,
  legacy_id text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  constraint content_submissions_kind_check check (kind in ('song', 'priest')),
  constraint content_submissions_status_check check (status in ('pending', 'approved', 'rejected'))
);

create unique index if not exists content_submissions_legacy_id_uidx
  on public.content_submissions (legacy_id)
  where legacy_id is not null;

create index if not exists content_submissions_pending_kind_idx
  on public.content_submissions (kind, created_at desc)
  where status = 'pending';

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_at_idx
  on public.admin_audit_log (created_at desc);

alter table public.content_submissions enable row level security;
alter table public.content_submissions force row level security;
revoke all on table public.content_submissions from anon, authenticated;
grant all on table public.content_submissions to service_role;

alter table public.admin_audit_log enable row level security;
alter table public.admin_audit_log force row level security;
revoke all on table public.admin_audit_log from anon, authenticated;
grant all on table public.admin_audit_log to service_role;
