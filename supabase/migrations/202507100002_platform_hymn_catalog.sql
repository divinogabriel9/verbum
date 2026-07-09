-- Global hymn catalog (superadmin source of truth, shared across all app instances).

create table if not exists public.platform_hymn_catalog (
  key text primary key default 'global',
  catalog jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.platform_hymn_catalog enable row level security;
alter table public.platform_hymn_catalog force row level security;
revoke all on table public.platform_hymn_catalog from anon, authenticated;
grant all on table public.platform_hymn_catalog to service_role;
