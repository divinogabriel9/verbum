-- Choir practice link visit tracking (unique devices + last-seen for "active now").

create table if not exists public.choir_practice_visits (
  id uuid primary key default gen_random_uuid(),
  share_token text not null,
  visitor_key text not null,
  device_id_hash text,
  ip_hash text,
  user_agent text not null default '',
  hit_count integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint choir_practice_visits_token_visitor_uniq unique (share_token, visitor_key)
);

create index if not exists choir_practice_visits_token_last_seen_idx
  on public.choir_practice_visits (share_token, last_seen_at desc);

create index if not exists choir_practice_visits_token_first_seen_idx
  on public.choir_practice_visits (share_token, first_seen_at desc);

comment on table public.choir_practice_visits is
  'Anonymous choir practice page visits. IPs are hashed; device ids hashed. Creator-only stats.';

comment on column public.choir_practice_visits.visitor_key is
  'Stable visitor identity: device hash when present, else ip hash.';

comment on column public.choir_practice_visits.ip_hash is
  'SHA-256 hex prefix of client IP (not raw IP).';

alter table public.choir_practice_visits enable row level security;
alter table public.choir_practice_visits force row level security;
revoke all on table public.choir_practice_visits from anon, authenticated;
grant all on table public.choir_practice_visits to service_role;
