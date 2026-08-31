-- Per-user recent song activity (Song Library / Collections sidebar).

create table if not exists public.user_song_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  dedupe_key text not null,
  section text not null default '',
  hymn_id text not null default '',
  title text not null default '',
  language text not null default '',
  kind text not null default 'lyrics_updated',
  activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key),
  constraint user_song_history_kind_check
    check (kind in ('new', 'edited', 'lyrics_updated', 'saved', 'deleted'))
);

create index if not exists user_song_history_user_activity_idx
  on public.user_song_history (user_id, activity_at desc);

alter table public.user_song_history enable row level security;
alter table public.user_song_history force row level security;

drop policy if exists "user_song_history_select_own" on public.user_song_history;
drop policy if exists "user_song_history_insert_own" on public.user_song_history;
drop policy if exists "user_song_history_update_own" on public.user_song_history;
drop policy if exists "user_song_history_delete_own" on public.user_song_history;

create policy "user_song_history_select_own"
  on public.user_song_history for select
  using (auth.uid() = user_id);

create policy "user_song_history_insert_own"
  on public.user_song_history for insert
  with check (auth.uid() = user_id);

create policy "user_song_history_update_own"
  on public.user_song_history for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_song_history_delete_own"
  on public.user_song_history for delete
  using (auth.uid() = user_id);

revoke all on table public.user_song_history from anon;
grant select, insert, update, delete on table public.user_song_history to authenticated;

comment on table public.user_song_history is
  'Recent Song Library activity per user (added, edited, lyrics updated, deleted).';
