-- DB guardrails for membership approval + immutable lock timestamps.
-- Also pins search_path on remaining SECURITY DEFINER functions and
-- removes end-user delete on church_profiles rows.

-- 1) SECURITY DEFINER hardening: immutable search_path.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, first_name, last_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'given_name'),
    coalesce(new.raw_user_meta_data->>'last_name', new.raw_user_meta_data->>'family_name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    updated_at = now();

  insert into public.church_profiles (user_id, community_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'community_name', '')
  )
  on conflict (user_id) do update set
    community_name = case
      when coalesce(public.church_profiles.community_name, '') = ''
        then excluded.community_name
      else public.church_profiles.community_name
    end,
    updated_at = now();

  return new;
end;
$$;

create or replace function public.is_superadmin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = coalesce(uid, auth.uid())
      and role = 'superadmin'
  );
$$;

revoke all on function public.is_superadmin(uuid) from public, anon, authenticated;
grant execute on function public.is_superadmin(uuid) to service_role;

create or replace function public.profiles_guard_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  jwt_role text;
begin
  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    jwt_role := coalesce(current_setting('request.jwt.claim.role', true), '');
    if jwt_role = 'service_role' then
      return new;
    end if;
    if auth.uid() is not null and public.is_superadmin() then
      return new;
    end if;
    raise exception 'Cannot change profile role without superadmin privileges.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.profiles_guard_role() from public, anon, authenticated;

-- 2) Guard membership status + lock columns from user JWT updates.
create or replace function public.church_profiles_guard_membership_and_locks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  jwt_role text;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  jwt_role := coalesce(current_setting('request.jwt.claim.role', true), '');
  if jwt_role = 'service_role' then
    return new;
  end if;

  if new.membership_status is distinct from old.membership_status then
    raise exception 'Only superadmin service workflows may change membership status.'
      using errcode = '42501';
  end if;
  if new.community_name_locked_at is distinct from old.community_name_locked_at then
    raise exception 'community_name_locked_at cannot be changed by clients.'
      using errcode = '42501';
  end if;
  if new.logo_locked_at is distinct from old.logo_locked_at then
    raise exception 'logo_locked_at cannot be changed by clients.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.church_profiles_guard_membership_and_locks() from public, anon, authenticated;

drop trigger if exists church_profiles_guard_membership_and_locks on public.church_profiles;
create trigger church_profiles_guard_membership_and_locks
  before update on public.church_profiles
  for each row execute function public.church_profiles_guard_membership_and_locks();

-- 3) Prevent users from deleting/recreating their church profile row.
drop policy if exists "church_profiles_delete_own" on public.church_profiles;
revoke delete on table public.church_profiles from authenticated;
