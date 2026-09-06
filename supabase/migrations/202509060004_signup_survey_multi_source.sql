-- Allow multi-select "how did you hear" answers (comma-separated in source).
alter table public.signup_surveys
  drop constraint if exists signup_surveys_source_check;
