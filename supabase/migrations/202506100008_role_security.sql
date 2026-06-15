-- Role security: prevent self-escalation to superadmin via profiles.role

create or replace function public.is_superadmin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
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
set search_path = public
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

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.profiles_guard_role();
