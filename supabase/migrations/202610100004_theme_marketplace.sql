-- Theme Marketplace: designer packs + time-limited parish licenses.
-- App subscription (LiturgyFlow) stays separate; themes are optional add-ons.

alter table public.parishes
  add column if not exists active_deck_source text not null default 'default',
  add column if not exists active_theme_pack_id uuid;

comment on column public.parishes.active_deck_source is
  'Mass deck look source: default | parish_dna | marketplace';
comment on column public.parishes.active_theme_pack_id is
  'Active marketplace theme_packs.id when active_deck_source=marketplace';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'parishes_active_deck_source_check'
  ) then
    alter table public.parishes
      add constraint parishes_active_deck_source_check
      check (active_deck_source in ('default', 'parish_dna', 'marketplace'));
  end if;
end $$;

create table if not exists public.theme_sellers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null default '',
  bio text not null default '',
  status text not null default 'pending',
  payout_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  constraint theme_sellers_status_check
    check (status in ('pending', 'approved', 'rejected', 'suspended'))
);

create unique index if not exists theme_sellers_user_id_uidx
  on public.theme_sellers (user_id);

create index if not exists theme_sellers_status_idx
  on public.theme_sellers (status, created_at desc);

create table if not exists public.theme_packs (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  subtitle text not null default '',
  description text not null default '',
  designer_label text not null default 'LiturgyFlow',
  seller_id uuid references public.theme_sellers(id) on delete set null,
  status text not null default 'draft',
  is_free boolean not null default false,
  is_official boolean not null default false,
  season_tags text[] not null default '{}',
  preview_image_path text,
  master_storage_path text,
  slide_map jsonb,
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint theme_packs_status_check
    check (status in ('draft', 'pending_review', 'published', 'rejected', 'archived'))
);

create unique index if not exists theme_packs_slug_uidx
  on public.theme_packs (slug);

create index if not exists theme_packs_published_idx
  on public.theme_packs (status, sort_order, published_at desc)
  where status = 'published';

alter table public.parishes
  drop constraint if exists parishes_active_theme_pack_id_fkey;

alter table public.parishes
  add constraint parishes_active_theme_pack_id_fkey
  foreign key (active_theme_pack_id) references public.theme_packs(id)
  on delete set null;

create table if not exists public.theme_licenses (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references public.parishes(id) on delete cascade,
  pack_id uuid not null references public.theme_packs(id) on delete cascade,
  term text not null,
  currency text not null default 'php',
  amount_cents int not null default 0,
  status text not null default 'active',
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  purchased_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint theme_licenses_term_check
    check (term in ('monthly', 'quarterly', 'semiannual', 'annual', 'free')),
  constraint theme_licenses_status_check
    check (status in ('active', 'expired', 'refunded', 'canceled'))
);

create index if not exists theme_licenses_parish_pack_idx
  on public.theme_licenses (parish_id, pack_id, expires_at desc);

create index if not exists theme_licenses_active_idx
  on public.theme_licenses (parish_id, status, expires_at)
  where status = 'active';

create unique index if not exists theme_licenses_checkout_session_uidx
  on public.theme_licenses (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

alter table public.theme_sellers enable row level security;
alter table public.theme_sellers force row level security;
revoke all on table public.theme_sellers from anon, authenticated;
grant all on table public.theme_sellers to service_role;

alter table public.theme_packs enable row level security;
alter table public.theme_packs force row level security;
revoke all on table public.theme_packs from anon, authenticated;
grant all on table public.theme_packs to service_role;

alter table public.theme_licenses enable row level security;
alter table public.theme_licenses force row level security;
revoke all on table public.theme_licenses from anon, authenticated;
grant all on table public.theme_licenses to service_role;

-- Parishes that already uploaded DNA keep using it (if DNA columns exist).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'parishes'
      and column_name = 'deck_dna_path'
  ) then
    update public.parishes
    set active_deck_source = 'parish_dna'
    where deck_dna_path is not null
      and nullif(trim(deck_dna_path), '') is not null
      and active_deck_source = 'default';
  end if;
end $$;

-- Seed: free LiturgyFlow classic + sample paid packs (no master file yet).
insert into public.theme_packs (
  slug, title, subtitle, description, designer_label,
  status, is_free, is_official, season_tags, sort_order, published_at
) values
  (
    'liturgyflow-classic',
    'LiturgyFlow Classic',
    'Included with your plan',
    'The default Mass deck look. Always available with LiturgyFlow — no theme add-on required.',
    'LiturgyFlow',
    'published', true, true, array['all']::text[], 1, now()
  ),
  (
    'ordinary-green-calm',
    'Ordinary Green Calm',
    'Quiet green for Ordinary Time',
    'Soft liturgical green backgrounds and clear lyric hierarchy. Sample marketplace pack.',
    'LiturgyFlow Studio',
    'published', false, true, array['ordinary']::text[], 10, now()
  ),
  (
    'advent-violet-light',
    'Advent Violet Light',
    'Expectant violet for Advent',
    'Gentle violet washes for Advent Sundays. Sample marketplace pack.',
    'LiturgyFlow Studio',
    'published', false, true, array['advent']::text[], 20, now()
  ),
  (
    'lent-solemn-ash',
    'Lent Solemn Ash',
    'Quiet Lent atmosphere',
    'Muted ash and violet tones for Lenten Masses. Sample marketplace pack.',
    'LiturgyFlow Studio',
    'published', false, true, array['lent']::text[], 30, now()
  )
on conflict (slug) do nothing;
