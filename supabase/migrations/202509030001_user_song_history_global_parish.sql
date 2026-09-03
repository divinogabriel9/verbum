-- Global (superadmin catalog) vs parish recent song history scopes.

-- Ensure scope_key can represent platform-wide superadmin activity.
comment on column public.user_song_history.scope_key is
  'Dedupe partition: ''global'' for superadmin/platform catalog activity, else parish uuid text.';

comment on column public.user_song_history.parish_id is
  'Parish scope for team activity; null for global (superadmin) rows.';

-- Migrate prior empty-scope rows from superadmins into global.
update public.user_song_history h
set
  parish_id = null,
  scope_key = 'global'
from public.profiles p
where p.id = h.user_id
  and p.role = 'superadmin'
  and (h.scope_key = '' or h.scope_key is null);

create index if not exists user_song_history_global_activity_idx
  on public.user_song_history (activity_at desc)
  where scope_key = 'global';

drop policy if exists "user_song_history_select_global" on public.user_song_history;
create policy "user_song_history_select_global"
  on public.user_song_history for select
  to authenticated
  using (scope_key = 'global');

-- Recreate insert/update so superadmins can write global rows.
drop policy if exists "user_song_history_insert_own" on public.user_song_history;
create policy "user_song_history_insert_own"
  on public.user_song_history for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and (
      (
        scope_key = 'global'
        and parish_id is null
        and exists (
          select 1 from public.profiles p
          where p.id = (select auth.uid())
            and p.role = 'superadmin'
        )
      )
      or (
        scope_key <> 'global'
        and parish_id is not null
        and parish_id in (
          select pm.parish_id
          from public.parish_members pm
          where pm.user_id = (select auth.uid())
            and pm.status = 'active'
        )
      )
    )
  );

drop policy if exists "user_song_history_update_own" on public.user_song_history;
create policy "user_song_history_update_own"
  on public.user_song_history for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      (
        scope_key = 'global'
        and parish_id is null
        and exists (
          select 1 from public.profiles p
          where p.id = (select auth.uid())
            and p.role = 'superadmin'
        )
      )
      or (
        scope_key <> 'global'
        and parish_id is not null
        and parish_id in (
          select pm.parish_id
          from public.parish_members pm
          where pm.user_id = (select auth.uid())
            and pm.status = 'active'
        )
      )
    )
  );
