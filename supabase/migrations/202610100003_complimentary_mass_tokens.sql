-- Four complimentary Mass generation tokens (count-based).

alter table public.profiles
  add column if not exists complimentary_mass_used_count integer not null default 0;

comment on column public.profiles.complimentary_mass_used_count is
  'How many complimentary Mass generations this user has redeemed (cap enforced in app).';

-- Carry over anyone who already used the single complimentary Mass.
update public.profiles
set complimentary_mass_used_count = 1
where complimentary_mass_used_at is not null
  and complimentary_mass_used_count = 0;
