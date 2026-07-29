-- Allow superadmin renames of locked parish names via service-role RPC.
-- Also extend content_submissions for president-requested renames.

create or replace function public.parishes_lock_parish_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  jwt_role text;
  claims json;
  bypass text;
begin
  bypass := coalesce(current_setting('app.allow_parish_rename', true), '');
  if bypass = '1' then
    return new;
  end if;

  jwt_role := coalesce(current_setting('request.jwt.claim.role', true), '');
  if jwt_role = '' then
    begin
      claims := current_setting('request.jwt.claims', true)::json;
      jwt_role := coalesce(claims->>'role', '');
    exception when others then
      jwt_role := '';
    end;
  end if;
  if jwt_role = 'service_role' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.community_name_locked_at is not null
     and new.community_name is distinct from old.community_name then
    raise exception 'Parish name is locked and cannot be changed.';
  end if;
  return new;
end;
$$;

create or replace function public.church_profiles_lock_parish_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  jwt_role text;
  claims json;
  bypass text;
begin
  bypass := coalesce(current_setting('app.allow_parish_rename', true), '');
  if bypass = '1' then
    return new;
  end if;

  jwt_role := coalesce(current_setting('request.jwt.claim.role', true), '');
  if jwt_role = '' then
    begin
      claims := current_setting('request.jwt.claims', true)::json;
      jwt_role := coalesce(claims->>'role', '');
    exception when others then
      jwt_role := '';
    end;
  end if;
  if jwt_role = 'service_role' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.community_name_locked_at is not null
     and new.community_name is distinct from old.community_name then
    raise exception 'Parish name is locked and cannot be changed.';
  end if;
  return new;
end;
$$;

create or replace function public.parishes_guard_membership_and_locks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  jwt_role text;
  claims json;
  bypass text;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  bypass := coalesce(current_setting('app.allow_parish_rename', true), '');
  if bypass = '1' then
    return new;
  end if;

  jwt_role := coalesce(current_setting('request.jwt.claim.role', true), '');
  if jwt_role = '' then
    begin
      claims := current_setting('request.jwt.claims', true)::json;
      jwt_role := coalesce(claims->>'role', '');
    exception when others then
      jwt_role := '';
    end;
  end if;
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

create or replace function public.admin_rename_parish(
  p_parish_id uuid,
  p_name text
)
returns public.parishes
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned text;
  row public.parishes;
begin
  cleaned := trim(both from coalesce(p_name, ''));
  if p_parish_id is null then
    raise exception 'parish_id is required';
  end if;
  if char_length(cleaned) < 2 then
    raise exception 'Parish name must be at least 2 characters.';
  end if;

  perform set_config('app.allow_parish_rename', '1', true);

  update public.parishes
  set
    community_name = cleaned,
    community_name_locked_at = coalesce(community_name_locked_at, now()),
    updated_at = now()
  where id = p_parish_id
  returning * into row;

  if row.id is null then
    raise exception 'Parish not found.';
  end if;

  update public.church_profiles cp
  set
    community_name = cleaned,
    community_name_locked_at = coalesce(cp.community_name_locked_at, now()),
    updated_at = now()
  where cp.user_id in (
    select pm.user_id
    from public.parish_members pm
    where pm.parish_id = p_parish_id
      and pm.status = 'active'
  );

  return row;
end;
$$;

revoke all on function public.admin_rename_parish(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_rename_parish(uuid, text) to service_role;

alter table public.content_submissions
  drop constraint if exists content_submissions_kind_check;

alter table public.content_submissions
  add constraint content_submissions_kind_check
  check (kind in ('song', 'priest', 'parish_name'));
