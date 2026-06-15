-- Verbum profiles schema (Supabase Auth)
-- Run in Supabase SQL Editor. Requires Supabase Auth (email/password or other providers).
--
-- Drops existing profile tables so user ids stay uuid (required for RLS with auth.uid()).

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;
drop table if exists public.user_media_assets cascade;
drop table if exists public.generation_history cascade;
drop table if exists public.church_profiles cascade;
drop table if exists public.profiles cascade;

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  first_name text,
  last_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.church_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  community_name text not null default '',
  logo_path text,
  celebrant_names jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists church_profiles_set_updated_at on public.church_profiles;
create trigger church_profiles_set_updated_at
  before update on public.church_profiles
  for each row execute function public.set_updated_at();

-- Auto-create profile row when a user signs up via Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
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
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.church_profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "Users read own profile" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "church_profiles_select_own" on public.church_profiles;
drop policy if exists "church_profiles_insert_own" on public.church_profiles;
drop policy if exists "church_profiles_update_own" on public.church_profiles;
drop policy if exists "church_profiles_delete_own" on public.church_profiles;
drop policy if exists "Users read own church profile" on public.church_profiles;
drop policy if exists "Users insert own church profile" on public.church_profiles;
drop policy if exists "Users update own church profile" on public.church_profiles;
drop policy if exists "Users delete own church profile" on public.church_profiles;

create policy "church_profiles_select_own"
  on public.church_profiles for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "church_profiles_insert_own"
  on public.church_profiles for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "church_profiles_update_own"
  on public.church_profiles for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "church_profiles_delete_own"
  on public.church_profiles for delete
  to authenticated
  using ((select auth.uid()) = user_id);
