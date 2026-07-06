-- Public choir-practice share links (frozen song lyrics for upcoming Mass).

create table if not exists public.choir_practice_shares (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  parish_id uuid references public.parishes(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  mass_date date not null,
  mass_title text not null default '',
  parish_name text not null default '',
  celebrant text not null default '',
  song_snapshot jsonb not null default '[]'::jsonb,
  optional_pin text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists choir_practice_shares_token_idx
  on public.choir_practice_shares (token);

create index if not exists choir_practice_shares_parish_created_idx
  on public.choir_practice_shares (parish_id, created_at desc);

alter table public.choir_practice_shares enable row level security;
alter table public.choir_practice_shares force row level security;
revoke all on table public.choir_practice_shares from anon, authenticated;
grant all on table public.choir_practice_shares to service_role;
