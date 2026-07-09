-- Phase 3: global + per-parish feature flags.

create table if not exists public.platform_feature_flags (
  key text primary key,
  label text not null default '',
  description text not null default '',
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.parish_feature_flag_overrides (
  parish_id uuid not null references public.parishes(id) on delete cascade,
  flag_key text not null references public.platform_feature_flags(key) on delete cascade,
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  primary key (parish_id, flag_key)
);

create index if not exists parish_feature_flag_overrides_parish_idx
  on public.parish_feature_flag_overrides (parish_id);

insert into public.platform_feature_flags (key, label, description, enabled)
values
  (
    'ai_image_generation',
    'AI image generation',
    'Gemini / OpenAI gospel and poster imagery in Mass Builder and Theme Lab.',
    true
  ),
  (
    'choir_practice_shares',
    'Choir practice shares',
    'Public share links and QR codes for frozen hymn lyrics before Mass.',
    true
  ),
  (
    'social_poster_export',
    'Social poster export',
    'Square and story poster downloads from the Mass flow.',
    true
  ),
  (
    'catholic_news_feed',
    'Catholic news feed',
    'Home page news cards (Catholic and WYD headlines).',
    true
  )
on conflict (key) do nothing;

alter table public.platform_feature_flags enable row level security;
alter table public.platform_feature_flags force row level security;
alter table public.parish_feature_flag_overrides enable row level security;
alter table public.parish_feature_flag_overrides force row level security;

revoke all on table public.platform_feature_flags from anon, authenticated;
revoke all on table public.parish_feature_flag_overrides from anon, authenticated;
grant all on table public.platform_feature_flags to service_role;
grant all on table public.parish_feature_flag_overrides to service_role;

grant select on table public.platform_feature_flags to anon, authenticated;

create policy "feature_flags_select_global"
  on public.platform_feature_flags for select
  to anon, authenticated
  using (true);
