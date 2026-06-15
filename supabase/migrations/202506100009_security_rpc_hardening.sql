-- Security RPC hardening: apply missing logo lock + close public function exposure.
-- Addresses Supabase linter findings for mutable search_path and anon/authenticated RPC access.

-- 1. Logo lock (from 007 — not yet applied on remote)
alter table public.church_profiles
  add column if not exists logo_locked_at timestamptz;

update public.church_profiles
set logo_locked_at = coalesce(logo_locked_at, community_name_locked_at, updated_at, now())
where community_name_locked_at is not null
  and coalesce(trim(logo_path), '') <> '';

create or replace function public.church_profiles_lock_logo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and old.logo_locked_at is not null
     and new.logo_path is distinct from old.logo_path then
    raise exception 'Parish logo is locked and cannot be changed.';
  end if;
  return new;
end;
$$;

revoke all on function public.church_profiles_lock_logo() from public, anon, authenticated;

drop trigger if exists church_profiles_lock_logo on public.church_profiles;
create trigger church_profiles_lock_logo
  before update on public.church_profiles
  for each row execute function public.church_profiles_lock_logo();

-- 2. Pin search_path on parish name lock trigger (linter: function_search_path_mutable)
create or replace function public.church_profiles_lock_parish_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and old.community_name_locked_at is not null
     and new.community_name is distinct from old.community_name then
    raise exception 'Parish name is locked and cannot be changed.';
  end if;
  return new;
end;
$$;

revoke all on function public.church_profiles_lock_parish_name() from public, anon, authenticated;

-- 3. is_superadmin is internal-only (used by profiles_guard_role trigger, not client RPC)
revoke all on function public.is_superadmin(uuid) from public, anon, authenticated;
grant execute on function public.is_superadmin(uuid) to service_role;

-- 4. Supabase platform helper — not for client RPC
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
grant execute on function public.rls_auto_enable() to service_role;
