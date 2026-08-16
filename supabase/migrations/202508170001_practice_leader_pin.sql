-- Auto-generated leader PIN (hashed) for choir practice shares.
-- Distinct from optional_pin (choir member PIN). Leaders unlock edit mode
-- from the shared practice link using this password on any device.

alter table public.choir_practice_shares
  add column if not exists leader_pin text;

comment on column public.choir_practice_shares.leader_pin is
  'Hashed 6-digit leader password; unlocks edit mode from the shared practice URL.';
