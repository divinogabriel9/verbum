-- Monthly free-tier Mass generations (no curated AI divider posters).

alter table public.profiles
  add column if not exists free_tier_mass_month text;

alter table public.profiles
  add column if not exists free_tier_mass_used_count integer not null default 0;

comment on column public.profiles.free_tier_mass_month is
  'UTC YYYY-MM window for free_tier_mass_used_count.';

comment on column public.profiles.free_tier_mass_used_count is
  'Free-tier Mass generations used in free_tier_mass_month (no curated posters).';
