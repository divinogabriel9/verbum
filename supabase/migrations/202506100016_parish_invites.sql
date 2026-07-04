-- Parish team invites (president invites media teammates).

create table if not exists public.parish_invites (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references public.parishes(id) on delete cascade,
  token text not null unique,
  email text,
  role text not null default 'media',
  invited_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint parish_invites_role_check check (role in ('media'))
);

create index if not exists parish_invites_token_idx on public.parish_invites (token);
create index if not exists parish_invites_parish_pending_idx
  on public.parish_invites (parish_id, expires_at)
  where accepted_at is null;

alter table public.parish_invites enable row level security;
alter table public.parish_invites force row level security;
revoke all on table public.parish_invites from anon, authenticated;
grant all on table public.parish_invites to service_role;
