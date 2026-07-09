-- Defense-in-depth RLS deny policies, lyric read audit, normalized hymn metadata/lyrics.

-- Explicit deny-all policies (belt-and-suspenders with REVOKE).
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'platform_hymn_catalog',
    'choir_practice_shares',
    'content_submissions'
  ]
  loop
    execute format(
      'drop policy if exists deny_all_authenticated on public.%I',
      tbl
    );
    execute format(
      'create policy deny_all_authenticated on public.%I as restrictive for all to authenticated using (false)',
      tbl
    );
    execute format(
      'drop policy if exists deny_all_anon on public.%I',
      tbl
    );
    execute format(
      'create policy deny_all_anon on public.%I as restrictive for all to anon using (false)',
      tbl
    );
  end loop;
end $$;

-- Audit trail for lyric API reads.
create table if not exists public.lyric_read_audit (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  hymn_id text not null,
  section text,
  source text not null default 'catalog_api',
  read_at timestamptz not null default now()
);

create index if not exists lyric_read_audit_user_read_at_idx
  on public.lyric_read_audit (user_id, read_at desc);

create index if not exists lyric_read_audit_hymn_read_at_idx
  on public.lyric_read_audit (hymn_id, read_at desc);

alter table public.lyric_read_audit enable row level security;
alter table public.lyric_read_audit force row level security;
revoke all on table public.lyric_read_audit from anon, authenticated;
grant all on table public.lyric_read_audit to service_role;

-- Normalized hymn metadata (no lyrics) + separate lyrics table.
create table if not exists public.hymn_songs (
  id text primary key,
  section text not null,
  title text not null default '',
  author text not null default '',
  language text not null default '',
  gospel_moods jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.hymn_song_lyrics (
  hymn_id text primary key references public.hymn_songs(id) on delete cascade,
  lyrics text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.hymn_songs enable row level security;
alter table public.hymn_songs force row level security;
alter table public.hymn_song_lyrics enable row level security;
alter table public.hymn_song_lyrics force row level security;

revoke all on table public.hymn_songs from anon, authenticated;
revoke all on table public.hymn_song_lyrics from anon, authenticated;
grant all on table public.hymn_songs to service_role;
grant all on table public.hymn_song_lyrics to service_role;

create policy deny_all_authenticated on public.hymn_songs
  as restrictive for all to authenticated using (false);
create policy deny_all_anon on public.hymn_songs
  as restrictive for all to anon using (false);
create policy deny_all_authenticated on public.hymn_song_lyrics
  as restrictive for all to authenticated using (false);
create policy deny_all_anon on public.hymn_song_lyrics
  as restrictive for all to anon using (false);

create index if not exists hymn_songs_section_idx on public.hymn_songs (section);
