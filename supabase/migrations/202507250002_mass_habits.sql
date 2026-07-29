-- Mass habit learning: parish scope on generation history + feature flag.

alter table public.generation_history
  add column if not exists parish_id uuid references public.parishes(id) on delete set null;

create index if not exists generation_history_parish_created_idx
  on public.generation_history (parish_id, created_at desc)
  where parish_id is not null;

comment on column public.generation_history.parish_id is
  'Parish of the generator at insert time; used for shared Mass Builder habit profiles.';

insert into public.platform_feature_flags (key, label, description, enabled)
values
  (
    'mass_habits',
    'Mass habit smart defaults',
    'Learn usual Mass Builder choices and pre-fill or offer Quick Mass from the last month.',
    true
  )
on conflict (key) do nothing;
