-- One complimentary Mass generation for newly signed-in parish users
-- before they must start a Stripe trial / add billing.

alter table public.profiles
  add column if not exists complimentary_mass_used_at timestamptz;

comment on column public.profiles.complimentary_mass_used_at is
  'When the user redeemed their one complimentary Mass generation. NULL = credit still available.';
