-- Signup onboarding: ministry role, completion flag, attribution survey.
-- OAuth/email Auth users are gated until onboarding_completed_at is set.

alter table public.profiles
  add column if not exists ministry_role text,
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.profiles.ministry_role is
  'Self-reported parish role at signup (media_officer, choir_leader, secretary, priest, volunteer, other).';
comment on column public.profiles.onboarding_completed_at is
  'Set when the user finishes LiturgyFlow signup onboarding (name, parish, role, survey).';

create table if not exists public.signup_surveys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null,
  source_other text,
  created_at timestamptz not null default now(),
  constraint signup_surveys_user_unique unique (user_id),
  constraint signup_surveys_source_check check (
    source in (
      'parish_colleague',
      'priest_recommendation',
      'google_search',
      'facebook',
      'instagram',
      'conference',
      'other'
    )
  )
);

create index if not exists signup_surveys_source_idx
  on public.signup_surveys (source);

create index if not exists signup_surveys_created_at_idx
  on public.signup_surveys (created_at desc);

comment on table public.signup_surveys is
  'How the user heard about LiturgyFlow — collected at signup for product improvement.';

alter table public.signup_surveys enable row level security;
alter table public.signup_surveys force row level security;

revoke all on table public.signup_surveys from anon, authenticated;
grant select, insert on table public.signup_surveys to authenticated;
grant all on table public.signup_surveys to service_role;

drop policy if exists "signup_surveys_select_own" on public.signup_surveys;
drop policy if exists "signup_surveys_insert_own" on public.signup_surveys;

create policy "signup_surveys_select_own"
  on public.signup_surveys for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "signup_surveys_insert_own"
  on public.signup_surveys for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Existing users with a named parish are treated as already onboarded.
update public.profiles p
set onboarding_completed_at = coalesce(p.created_at, now())
where p.onboarding_completed_at is null
  and (
    exists (
      select 1
      from public.parish_members pm
      join public.parishes par on par.id = pm.parish_id
      where pm.user_id = p.id
        and pm.status = 'active'
        and coalesce(trim(par.community_name), '') <> ''
    )
    or exists (
      select 1
      from public.church_profiles cp
      where cp.user_id = p.id
        and coalesce(trim(cp.community_name), '') <> ''
    )
  );

-- Keep Auth signup trigger: profile + parish shell.
-- onboarding_completed_at stays null until POST /api/auth/onboarding/complete.
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
  meta_last text;
  meta_phone text;
  meta_ministry text;
  completed_at timestamptz;
begin
  community := nullif(trim(coalesce(new.raw_user_meta_data->>'community_name', '')), '');
  meta_first := coalesce(
    nullif(trim(coalesce(new.raw_user_meta_data->>'first_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'given_name', '')), '')
  );
  meta_last := coalesce(
    nullif(trim(coalesce(new.raw_user_meta_data->>'last_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'family_name', '')), '')
  );
  meta_phone := nullif(trim(coalesce(new.raw_user_meta_data->>'phone', '')), '');
  meta_ministry := nullif(trim(coalesce(new.raw_user_meta_data->>'ministry_role', '')), '');
  -- Always leave onboarding_completed_at null here; the app completes onboarding
  -- via POST /api/auth/onboarding/complete (profile + survey).
  completed_at := null;

  insert into public.profiles (
    id, email, first_name, last_name, avatar_url, phone, ministry_role, onboarding_completed_at
  )
  values (
    new.id,
    new.email,
    meta_first,
    meta_last,
    new.raw_user_meta_data->>'avatar_url',
    meta_phone,
    meta_ministry,
    completed_at
  )
  on conflict (id) do update set
    email = excluded.email,
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
