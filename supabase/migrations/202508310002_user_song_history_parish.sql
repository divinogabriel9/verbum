-- Scope recent song activity per parish; parish members can read shared parish history.

alter table public.user_song_history
  add column if not exists parish_id uuid references public.parishes(id) on delete cascade;

alter table public.user_song_history
  add column if not exists scope_key text not null default '';

update public.user_song_history
set scope_key = ''
where scope_key is null or scope_key = '';

update public.user_song_history h
set
  parish_id = pm.parish_id,
  scope_key = pm.parish_id::text
from public.parish_members pm
where pm.user_id = h.user_id
  and pm.status = 'active'
  and (h.scope_key = '' or h.parish_id is null);

alter table public.user_song_history
  drop constraint if exists user_song_history_user_id_dedupe_key_key;

drop index if exists user_song_history_user_parish_dedupe_idx;
drop index if exists user_song_history_user_dedupe_no_parish_idx;

create unique index if not exists user_song_history_user_scope_dedupe_idx
  on public.user_song_history (user_id, scope_key, dedupe_key);

create index if not exists user_song_history_parish_activity_idx
  on public.user_song_history (parish_id, activity_at desc)
  where parish_id is not null;

drop policy if exists "user_song_history_select_parish" on public.user_song_history;

create policy "user_song_history_select_parish"
  on public.user_song_history for select
  to authenticated
  using (
    parish_id is not null
    and parish_id in (
      select pm.parish_id
      from public.parish_members pm
      where pm.user_id = (select auth.uid())
        and pm.status = 'active'
    )
  );

drop policy if exists "user_song_history_insert_own" on public.user_song_history;

create policy "user_song_history_insert_own"
  on public.user_song_history for insert
  with check (
    auth.uid() = user_id
    and (
      parish_id is null
      or parish_id in (
        select pm.parish_id
        from public.parish_members pm
        where pm.user_id = (select auth.uid())
          and pm.status = 'active'
      )
    )
  );

drop policy if exists "user_song_history_update_own" on public.user_song_history;

create policy "user_song_history_update_own"
  on public.user_song_history for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      parish_id is null
      or parish_id in (
        select pm.parish_id
        from public.parish_members pm
        where pm.user_id = (select auth.uid())
          and pm.status = 'active'
      )
    )
  );

comment on column public.user_song_history.parish_id is
  'Parish scope for synced recent activity; null when user has no active parish.';
comment on column public.user_song_history.scope_key is
  'Dedupe partition: empty string without parish, else parish uuid text.';
