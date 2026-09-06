-- Optional middle name on profiles for signup onboarding.

alter table public.profiles
  add column if not exists middle_name text;

comment on column public.profiles.middle_name is
  'Optional middle name collected at signup.';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parish_id uuid;
  community text;
  meta_first text;
  meta_middle text;
  meta_last text;
  meta_phone text;
  meta_ministry text;
begin
  community := nullif(trim(coalesce(new.raw_user_meta_data->>'community_name', '')), '');
  meta_first := coalesce(
    nullif(trim(coalesce(new.raw_user_meta_data->>'first_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'given_name', '')), '')
  );
  meta_middle := nullif(trim(coalesce(new.raw_user_meta_data->>'middle_name', '')), '');
  meta_last := coalesce(
    nullif(trim(coalesce(new.raw_user_meta_data->>'last_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'family_name', '')), '')
  );
  meta_phone := nullif(trim(coalesce(new.raw_user_meta_data->>'phone', '')), '');
  meta_ministry := nullif(trim(coalesce(new.raw_user_meta_data->>'ministry_role', '')), '');

  insert into public.profiles (
    id, email, first_name, middle_name, last_name, avatar_url, phone, ministry_role, onboarding_completed_at
  )
  values (
    new.id,
    new.email,
    meta_first,
    meta_middle,
    meta_last,
    new.raw_user_meta_data->>'avatar_url',
    meta_phone,
    meta_ministry,
    null
  )
  on conflict (id) do update set
    email = excluded.email,
    middle_name = coalesce(excluded.middle_name, public.profiles.middle_name),
    phone = coalesce(excluded.phone, public.profiles.phone),
    ministry_role = coalesce(excluded.ministry_role, public.profiles.ministry_role),
    updated_at = now();

  insert into public.parishes (community_name)
  values (coalesce(community, ''))
  returning id into parish_id;

  insert into public.parish_members (parish_id, user_id, role, status)
  values (parish_id, new.id, 'president', 'active')
  on conflict (user_id) do nothing;

  insert into public.church_profiles (user_id, community_name)
  values (new.id, coalesce(community, ''))
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

revoke all on function public.handle_new_user() from public, anon, authenticated;
