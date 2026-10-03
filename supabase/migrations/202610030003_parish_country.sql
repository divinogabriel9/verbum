-- Parish registration country (ISO 3166-1 alpha-2) for local billing currency.
alter table public.parishes
  add column if not exists country_code text;

comment on column public.parishes.country_code is
  'ISO 3166-1 alpha-2 country chosen at parish registration / signup.';
