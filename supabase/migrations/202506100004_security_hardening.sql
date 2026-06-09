-- Verbum security hardening — run AFTER 001/002/003.
-- Addresses Supabase linter findings (mutable function search_path),
-- locks down function execution, and optimizes storage RLS predicates.

-- 1. Pin search_path on all SECURITY-sensitive functions. A mutable
--    search_path lets a caller shadow built-ins and is flagged by the linter.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. Keep trigger functions callable only by the system, never by clients.
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- 3. Belt-and-suspenders: ensure RLS is on and FORCED everywhere, so even the
--    table owner is subject to policies.
alter table public.profiles            enable row level security;
alter table public.profiles            force  row level security;
alter table public.church_profiles     enable row level security;
alter table public.church_profiles     force  row level security;
alter table public.generation_history  enable row level security;
alter table public.generation_history  force  row level security;
alter table public.user_media_assets   enable row level security;
alter table public.user_media_assets   force  row level security;

-- 4. Re-assert least privilege for the anon role (no access to app tables).
revoke all on table public.profiles            from anon;
revoke all on table public.church_profiles     from anon;
revoke all on table public.generation_history  from anon;
revoke all on table public.user_media_assets   from anon;

-- 5. Optimize storage policies: wrap auth.uid() in a scalar subselect so the
--    planner evaluates it once per statement instead of once per row.
drop policy if exists "user_uploads_select_own" on storage.objects;
drop policy if exists "user_uploads_insert_own" on storage.objects;
drop policy if exists "user_uploads_update_own" on storage.objects;
drop policy if exists "user_uploads_delete_own" on storage.objects;

create policy "user_uploads_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'user-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "user_uploads_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'user-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "user_uploads_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'user-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'user-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "user_uploads_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'user-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
