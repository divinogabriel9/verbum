-- Platform invite tokens for invite-only account creation.

create table if not exists public.platform_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  email text,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists platform_invites_token_idx
  on public.platform_invites (token);

create index if not exists platform_invites_pending_idx
  on public.platform_invites (expires_at)
  where accepted_at is null;

alter table public.platform_invites enable row level security;
alter table public.platform_invites force row level security;

revoke all on table public.platform_invites from anon, authenticated;
grant all on table public.platform_invites to service_role;
