-- Optional display name for history rows (e.g. song submitter on SA approval).

alter table public.user_song_history
  add column if not exists actor_label text not null default '';

comment on column public.user_song_history.actor_label is
  'Optional display name override (e.g. submitter on approved song). Empty = use profile name.';
