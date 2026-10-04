-- Create-or-join onboarding: no blank parish on Auth signup; join requests table.

create table if not exists public.parish_join_requests (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references public.parishes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  constraint parish_join_requests_status_check
    check (status in ('pending', 'approved', 'rejected', 'cancelled'))
);

create unique index if not exists parish_join_requests_pending_user_uidx
  on public.parish_join_requests (user_id)
  where status = 'pending';

create index if not exists parish_join_requests_parish_pending_idx
  on public.parish_join_requests (parish_id, created_at desc)
  where status = 'pending';

comment on table public.parish_join_requests is
  'User asked to join an existing parish as media during signup onboarding.';

alter table public.parish_join_requests enable row level security;
alter table public.parish_join_requests force row level security;
revoke all on table public.parish_join_requests from anon, authenticated;
grant all on table public.parish_join_requests to service_role;

-- Auth signup: profile (+ legacy church_profiles stub) only — no auto parish/president.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_first text;
  meta_middle text;
  meta_last text;
  meta_phone text;
  meta_ministry text;
begin
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

  -- Legacy stub only; parish membership is created during onboarding (create or join).
  insert into public.church_profiles (user_id, community_name)
  values (new.id, '')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
