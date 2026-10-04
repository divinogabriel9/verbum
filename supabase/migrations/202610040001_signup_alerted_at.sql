-- Track first-login signup ops alerts (fires before onboarding form completion).

alter table public.profiles
  add column if not exists signup_alerted_at timestamptz;

comment on column public.profiles.signup_alerted_at is
  'Set when operators were alerted that this Auth user first appeared (Google/email signup).';
