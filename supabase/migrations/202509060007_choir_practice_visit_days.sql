-- Daily choir practice online log (one row per visitor per UTC day per share).

create table if not exists public.choir_practice_visit_days (
  id uuid primary key default gen_random_uuid(),
  visit_day date not null,
  share_token text not null,
  visitor_key text not null,
  hit_count integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint choir_practice_visit_days_uniq unique (visit_day, share_token, visitor_key)
);

create index if not exists choir_practice_visit_days_day_idx
  on public.choir_practice_visit_days (visit_day desc);

create index if not exists choir_practice_visit_days_token_day_idx
  on public.choir_practice_visit_days (share_token, visit_day desc);

comment on table public.choir_practice_visit_days is
  'UTC-day presence for choir practice links. Used for SA online log by date.';

alter table public.choir_practice_visit_days enable row level security;
alter table public.choir_practice_visit_days force row level security;
revoke all on table public.choir_practice_visit_days from anon, authenticated;
grant all on table public.choir_practice_visit_days to service_role;

-- Backfill from existing visit rows (first-seen and last-seen UTC days only).
insert into public.choir_practice_visit_days (
  visit_day, share_token, visitor_key, hit_count, first_seen_at, last_seen_at
)
select
  (v.first_seen_at at time zone 'utc')::date,
  v.share_token,
  v.visitor_key,
  greatest(1, v.hit_count),
  v.first_seen_at,
  v.first_seen_at
from public.choir_practice_visits v
on conflict (visit_day, share_token, visitor_key) do nothing;

insert into public.choir_practice_visit_days (
  visit_day, share_token, visitor_key, hit_count, first_seen_at, last_seen_at
)
select
  (v.last_seen_at at time zone 'utc')::date,
  v.share_token,
  v.visitor_key,
  1,
  v.last_seen_at,
  v.last_seen_at
from public.choir_practice_visits v
where (v.last_seen_at at time zone 'utc')::date
   is distinct from (v.first_seen_at at time zone 'utc')::date
on conflict (visit_day, share_token, visitor_key) do nothing;
