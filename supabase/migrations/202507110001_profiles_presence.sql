-- User presence + location for superadmin tracking and language targeting.

alter table public.profiles
  add column if not exists last_seen_at timestamptz,
  add column if not exists last_seen_country text,
  add column if not exists last_seen_region text,
  add column if not exists last_seen_timezone text,
  add column if not exists preferred_language text;

create index if not exists profiles_last_seen_at_idx
  on public.profiles (last_seen_at desc nulls last);

comment on column public.profiles.last_seen_at is 'Last authenticated heartbeat from the app.';
comment on column public.profiles.last_seen_country is 'ISO 3166-1 alpha-2 from CDN/geo headers when available.';
comment on column public.profiles.last_seen_region is 'Optional region/city hint from client or CDN.';
comment on column public.profiles.last_seen_timezone is 'IANA timezone from the client browser.';
comment on column public.profiles.preferred_language is 'Song/UI language preference (English, Tagalog, …).';
