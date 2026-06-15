-- Parish name lock + superadmin membership approval

alter table public.profiles
  add column if not exists role text not null default 'member';

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('member', 'superadmin'));

alter table public.church_profiles
  add column if not exists membership_status text not null default 'draft';

alter table public.church_profiles
  drop constraint if exists church_profiles_membership_status_check;

alter table public.church_profiles
  add constraint church_profiles_membership_status_check
  check (membership_status in ('draft', 'pending', 'approved', 'rejected'));

alter table public.church_profiles
  add column if not exists community_name_locked_at timestamptz;

-- Existing parishes with a name: treat as already approved and locked.
update public.church_profiles
set
  membership_status = 'approved',
  community_name_locked_at = coalesce(community_name_locked_at, updated_at, now())
where coalesce(trim(community_name), '') <> '';

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

drop trigger if exists church_profiles_lock_parish_name on public.church_profiles;
create trigger church_profiles_lock_parish_name
  before update on public.church_profiles
  for each row execute function public.church_profiles_lock_parish_name();
