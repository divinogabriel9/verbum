-- Profile phone number from signup metadata.

alter table public.profiles
  add column if not exists phone text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, last_name, avatar_url, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'given_name'),
    coalesce(new.raw_user_meta_data->>'last_name', new.raw_user_meta_data->>'family_name'),
    new.raw_user_meta_data->>'avatar_url',
    nullif(trim(coalesce(new.raw_user_meta_data->>'phone', '')), '')
  )
  on conflict (id) do update set
    email = excluded.email,
    phone = coalesce(excluded.phone, public.profiles.phone),
    updated_at = now();

  insert into public.church_profiles (user_id, community_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'community_name', '')
  )
  on conflict (user_id) do update set
    community_name = case
      when coalesce(church_profiles.community_name, '') = ''
        then excluded.community_name
      else church_profiles.community_name
    end,
    updated_at = now();

  return new;
end;
$$;
