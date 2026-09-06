-- Extra onboarding profile fields.

alter table public.profiles
  add column if not exists ministry_role_other text,
  add column if not exists preferred_language text,
  add column if not exists primary_use text;

comment on column public.profiles.ministry_role_other is
  'Free-text role when ministry_role = other (max ~60 chars from app).';
comment on column public.profiles.preferred_language is
  'Mass language preference from signup (english, tagalog, korean, other).';
comment on column public.profiles.primary_use is
  'Primary product use from signup (sunday_mass_slides, choir_practice, posters, all).';
