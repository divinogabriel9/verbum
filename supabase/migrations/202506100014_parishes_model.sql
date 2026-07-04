-- Shared parish model: 1 parish, up to 3 active members (1 president + 2 media).
-- Migrates existing church_profiles rows into parishes + parish_members.

create table if not exists public.parishes (
  id uuid primary key default gen_random_uuid(),
  community_name text not null default '',
  logo_path text,
  celebrant_names jsonb not null default '[]'::jsonb,
  membership_status text not null default 'draft',
  community_name_locked_at timestamptz,
  logo_locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parishes_membership_status_check
    check (membership_status in ('draft', 'pending', 'approved', 'rejected'))
);

create table if not exists public.parish_members (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references public.parishes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'president',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id),
  constraint parish_members_role_check check (role in ('president', 'media')),
  constraint parish_members_status_check check (status in ('active', 'removed'))
);

create index if not exists parish_members_parish_id_idx
  on public.parish_members (parish_id);

create index if not exists parish_members_active_parish_idx
  on public.parish_members (parish_id)
  where status = 'active';

create unique index if not exists parish_members_one_president_per_parish
  on public.parish_members (parish_id)
  where role = 'president' and status = 'active';

-- Backfill: each legacy church_profiles row becomes one parish + president member.
insert into public.parishes (
  id,
  community_name,
  logo_path,
  celebrant_names,
  membership_status,
  community_name_locked_at,
  logo_locked_at,
  created_at,
  updated_at
)
select
  cp.id,
  cp.community_name,
  cp.logo_path,
  cp.celebrant_names,
  cp.membership_status,
  cp.community_name_locked_at,
  cp.logo_locked_at,
  cp.created_at,
  cp.updated_at
from public.church_profiles cp
where not exists (select 1 from public.parishes p where p.id = cp.id);

insert into public.parish_members (parish_id, user_id, role, status, created_at, updated_at)
select
  cp.id,
  cp.user_id,
  'president',
  'active',
  cp.created_at,
  cp.updated_at
from public.church_profiles cp
where not exists (
  select 1 from public.parish_members pm where pm.user_id = cp.user_id
);

drop trigger if exists parishes_set_updated_at on public.parishes;
create trigger parishes_set_updated_at
  before update on public.parishes
  for each row execute function public.set_updated_at();

drop trigger if exists parish_members_set_updated_at on public.parish_members;
create trigger parish_members_set_updated_at
  before update on public.parish_members
  for each row execute function public.set_updated_at();

-- Max 3 active members per parish.
create or replace function public.parish_members_enforce_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_count integer;
begin
  if coalesce(new.status, 'active') <> 'active' then
    return new;
  end if;

  select count(*)::integer into active_count
  from public.parish_members pm
  where pm.parish_id = new.parish_id
    and pm.status = 'active'
    and pm.id is distinct from coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if active_count >= 3 then
    raise exception 'Parish cannot have more than 3 active members.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.parish_members_enforce_capacity() from public, anon, authenticated;

drop trigger if exists parish_members_enforce_capacity on public.parish_members;
create trigger parish_members_enforce_capacity
  before insert or update on public.parish_members
  for each row execute function public.parish_members_enforce_capacity();

-- Parish name / logo lock guards (mirror church_profiles).
create or replace function public.parishes_lock_parish_name()
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

revoke all on function public.parishes_lock_parish_name() from public, anon, authenticated;

drop trigger if exists parishes_lock_parish_name on public.parishes;
create trigger parishes_lock_parish_name
  before update on public.parishes
  for each row execute function public.parishes_lock_parish_name();

create or replace function public.parishes_lock_logo()
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

revoke all on function public.parishes_lock_logo() from public, anon, authenticated;

drop trigger if exists parishes_lock_logo on public.parishes;
create trigger parishes_lock_logo
  before update on public.parishes
  for each row execute function public.parishes_lock_logo();

create or replace function public.parishes_guard_membership_and_locks()
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

revoke all on function public.parishes_guard_membership_and_locks() from public, anon, authenticated;

drop trigger if exists parishes_guard_membership_and_locks on public.parishes;
create trigger parishes_guard_membership_and_locks
  before update on public.parishes
  for each row execute function public.parishes_guard_membership_and_locks();

-- Signup: create parish + president membership (keep legacy church_profiles row).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parish_id uuid;
  community text;
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

  community := coalesce(new.raw_user_meta_data->>'community_name', '');

  insert into public.parishes (community_name)
  values (community)
  returning id into parish_id;

  insert into public.parish_members (parish_id, user_id, role, status)
  values (parish_id, new.id, 'president', 'active')
  on conflict (user_id) do nothing;

  insert into public.church_profiles (user_id, community_name)
  values (new.id, community)
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

alter table public.parishes enable row level security;
alter table public.parishes force row level security;
alter table public.parish_members enable row level security;
alter table public.parish_members force row level security;

revoke all on table public.parishes from anon;
revoke all on table public.parish_members from anon;

grant select, update on table public.parishes to authenticated;
grant select on table public.parish_members to authenticated;

drop policy if exists "parishes_select_member" on public.parishes;
drop policy if exists "parishes_update_president" on public.parishes;
drop policy if exists "parish_members_select_member" on public.parish_members;

create policy "parishes_select_member"
  on public.parishes for select
  to authenticated
  using (
    exists (
      select 1
      from public.parish_members pm
      where pm.parish_id = parishes.id
        and pm.user_id = (select auth.uid())
        and pm.status = 'active'
    )
  );

create policy "parishes_update_president"
  on public.parishes for update
  to authenticated
  using (
    exists (
      select 1
      from public.parish_members pm
      where pm.parish_id = parishes.id
        and pm.user_id = (select auth.uid())
        and pm.role = 'president'
        and pm.status = 'active'
    )
  )
  with check (
    exists (
      select 1
      from public.parish_members pm
      where pm.parish_id = parishes.id
        and pm.user_id = (select auth.uid())
        and pm.role = 'president'
        and pm.status = 'active'
    )
  );

create policy "parish_members_select_own"
  on public.parish_members for select
  to authenticated
  using (user_id = (select auth.uid()));
