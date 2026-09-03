-- Parish-original songs (non-SA submissions) live in parish catalog until SA promotes them globally.

alter table public.parish_hymn_overrides
  add column if not exists origin text not null default 'override';

alter table public.parish_hymn_overrides
  add column if not exists language text not null default '';

alter table public.parish_hymn_overrides
  add column if not exists author text not null default '';

alter table public.parish_hymn_overrides
  add column if not exists gospel_moods jsonb not null default '[]'::jsonb;

alter table public.parish_hymn_overrides
  add column if not exists submission_id uuid references public.content_submissions(id) on delete set null;

alter table public.parish_hymn_overrides
  add column if not exists global_hymn_id text;

alter table public.parish_hymn_overrides
  drop constraint if exists parish_hymn_overrides_origin_check;

alter table public.parish_hymn_overrides
  add constraint parish_hymn_overrides_origin_check
    check (origin in ('override', 'parish'));

create index if not exists parish_hymn_overrides_origin_idx
  on public.parish_hymn_overrides (parish_id, origin);

comment on column public.parish_hymn_overrides.origin is
  'override = parish short version of a global hymn; parish = parish-only song until SA approval.';
comment on column public.parish_hymn_overrides.global_hymn_id is
  'Set when a parish-origin song is approved into the global catalog.';
