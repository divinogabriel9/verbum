-- Verbum RLS hardening (Supabase Auth) — run AFTER 202506100001_profiles.sql

alter table public.profiles force row level security;
alter table public.church_profiles force row level security;

create table if not exists public.generation_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  mass_date date not null,
  celebrant text,
  output_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists generation_history_user_id_idx
  on public.generation_history (user_id, created_at desc);

create table if not exists public.user_media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  asset_type text not null check (asset_type in ('logo', 'poster', 'divider', 'announcement')),
  storage_path text not null,
  original_name text,
  byte_size integer check (byte_size is null or byte_size >= 0),
  created_at timestamptz not null default now()
);

create index if not exists user_media_assets_user_id_idx
  on public.user_media_assets (user_id, created_at desc);

alter table public.generation_history enable row level security;
alter table public.generation_history force row level security;

alter table public.user_media_assets enable row level security;
alter table public.user_media_assets force row level security;

drop policy if exists "generation_history_select_own" on public.generation_history;
drop policy if exists "generation_history_insert_own" on public.generation_history;
drop policy if exists "generation_history_delete_own" on public.generation_history;

create policy "generation_history_select_own"
  on public.generation_history for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "generation_history_insert_own"
  on public.generation_history for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "generation_history_delete_own"
  on public.generation_history for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "user_media_assets_select_own" on public.user_media_assets;
drop policy if exists "user_media_assets_insert_own" on public.user_media_assets;
drop policy if exists "user_media_assets_update_own" on public.user_media_assets;
drop policy if exists "user_media_assets_delete_own" on public.user_media_assets;

create policy "user_media_assets_select_own"
  on public.user_media_assets for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_media_assets_insert_own"
  on public.user_media_assets for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "user_media_assets_update_own"
  on public.user_media_assets for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "user_media_assets_delete_own"
  on public.user_media_assets for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.profiles from anon;
revoke all on table public.church_profiles from anon;
revoke all on table public.generation_history from anon;
revoke all on table public.user_media_assets from anon;

grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.church_profiles to authenticated;
grant select, insert, delete on table public.generation_history to authenticated;
grant select, insert, update, delete on table public.user_media_assets to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-uploads',
  'user-uploads',
  false,
  8388608,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "user_uploads_select_own" on storage.objects;
drop policy if exists "user_uploads_insert_own" on storage.objects;
drop policy if exists "user_uploads_update_own" on storage.objects;
drop policy if exists "user_uploads_delete_own" on storage.objects;

create policy "user_uploads_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'user-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "user_uploads_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'user-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "user_uploads_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'user-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'user-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "user_uploads_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'user-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
