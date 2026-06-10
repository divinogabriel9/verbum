-- Lock parish logo after first submit (same lifecycle as parish name)

alter table public.church_profiles
  add column if not exists logo_locked_at timestamptz;

-- Existing locked parishes with a logo: treat logo as locked too.
update public.church_profiles
set logo_locked_at = coalesce(logo_locked_at, community_name_locked_at, updated_at, now())
where community_name_locked_at is not null
  and coalesce(trim(logo_path), '') <> '';

create or replace function public.church_profiles_lock_logo()
returns trigger
language plpgsql
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

drop trigger if exists church_profiles_lock_logo on public.church_profiles;
create trigger church_profiles_lock_logo
  before update on public.church_profiles
  for each row execute function public.church_profiles_lock_logo();
