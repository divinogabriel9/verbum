-- Per-parish hymn lyric overrides (short versions). Global catalog remains source of truth.

create table if not exists public.parish_hymn_overrides (
  parish_id uuid not null references public.parishes(id) on delete cascade,
  hymn_id text not null,
  section text not null,
  lyrics text not null default '',
  title text not null default '',
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (parish_id, hymn_id, section),
  constraint parish_hymn_overrides_section_check
    check (section in ('entrance', 'offertory', 'communion', 'recessional', 'meditation'))
);

create index if not exists parish_hymn_overrides_parish_idx
  on public.parish_hymn_overrides (parish_id);

create index if not exists parish_hymn_overrides_hymn_idx
  on public.parish_hymn_overrides (hymn_id);

alter table public.parish_hymn_overrides enable row level security;
alter table public.parish_hymn_overrides force row level security;

revoke all on table public.parish_hymn_overrides from anon, authenticated;
grant all on table public.parish_hymn_overrides to service_role;

comment on table public.parish_hymn_overrides is
  'Parish-specific lyric versions. Delete row to sync back to global platform catalog.';
