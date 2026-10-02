-- Landing-page guest demo generation analytics (superadmin / service_role only).

create table if not exists public.demo_generations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_ip text not null default '',
  country text not null default '',
  region text not null default '',
  device_brand text not null default '',
  device_class text not null default '',
  os_name text not null default '',
  user_agent text not null default '',
  accept_language text not null default '',
  mass_date text not null default '',
  mass_language text not null default '',
  celebrant text not null default '',
  slide_count integer not null default 0,
  include_leaflet boolean not null default false,
  ai_poster_used boolean not null default false,
  export_stem text not null default ''
);

create index if not exists demo_generations_created_at_idx
  on public.demo_generations (created_at desc);

create index if not exists demo_generations_country_idx
  on public.demo_generations (country);

create index if not exists demo_generations_device_brand_idx
  on public.demo_generations (device_brand);

comment on table public.demo_generations is
  'Guest landing demo PPT generates. Stores IP/country/device for abuse review and funnel analytics. Service-role only.';

alter table public.demo_generations enable row level security;
alter table public.demo_generations force row level security;
revoke all on table public.demo_generations from anon, authenticated;
grant all on table public.demo_generations to service_role;
