-- Theme designer accounts: parish vs designer-only login.
-- Designers skip parish onboarding and are locked to /themes (seller studio).

alter table public.profiles
  add column if not exists account_kind text not null default 'parish';

comment on column public.profiles.account_kind is
  'Account type: parish (default Mass app) or theme_designer (Themes tab / seller studio only).';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_account_kind_check'
  ) then
    alter table public.profiles
      add constraint profiles_account_kind_check
      check (account_kind in ('parish', 'theme_designer'));
  end if;
end $$;

create index if not exists profiles_account_kind_idx
  on public.profiles (account_kind)
  where account_kind = 'theme_designer';
