-- LiturgyFlow Distribution: internal church acquisition CRM.
-- Access is via FastAPI + service_role after require_superadmin.
-- RLS enabled with no authenticated policies (deny-by-default for clients).

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- distribution_churches — prospect / pipeline records (may predate a parish)
-- ---------------------------------------------------------------------------
create table if not exists public.distribution_churches (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid references public.parishes(id) on delete set null,
  parish_name text not null default '',
  diocese text,
  country text,
  state_province text,
  city text,
  address text,
  website text,
  contact_person text,
  contact_role text,
  email text,
  phone text,
  messaging_platform text,
  language text,
  mass_language text,
  has_english_mass boolean,
  has_filipino_community boolean,
  has_media_ministry boolean,
  current_presentation_method text,
  current_software text,
  pipeline_status text not null default 'discovered'
    check (pipeline_status in (
      'discovered', 'contacted', 'interested', 'demo',
      'trial', 'activated', 'paid', 'referral'
    )),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  assigned_to uuid references public.profiles(id) on delete set null,
  notes text,
  referral_source text,
  referral_code text,
  lead_score integer,
  lead_score_factors jsonb not null default '{}'::jsonb,
  stage_entered_at timestamptz not null default now(),
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  next_follow_up_note text,
  contact_count integer not null default 0,
  demo_status text,
  trial_start_at timestamptz,
  trial_expires_at timestamptz,
  subscription_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists distribution_churches_parish_name_idx
  on public.distribution_churches (parish_name);
create index if not exists distribution_churches_parish_name_trgm_idx
  on public.distribution_churches using gin (parish_name gin_trgm_ops);
create index if not exists distribution_churches_city_idx
  on public.distribution_churches (city);
create index if not exists distribution_churches_country_idx
  on public.distribution_churches (country);
create index if not exists distribution_churches_status_idx
  on public.distribution_churches (pipeline_status);
create index if not exists distribution_churches_email_idx
  on public.distribution_churches (email);
create index if not exists distribution_churches_follow_up_idx
  on public.distribution_churches (next_follow_up_at);
create index if not exists distribution_churches_trial_expires_idx
  on public.distribution_churches (trial_expires_at);
create index if not exists distribution_churches_parish_id_idx
  on public.distribution_churches (parish_id);
create index if not exists distribution_churches_priority_idx
  on public.distribution_churches (priority);
create index if not exists distribution_churches_diocese_idx
  on public.distribution_churches (diocese);

create unique index if not exists distribution_churches_referral_code_uidx
  on public.distribution_churches (referral_code)
  where referral_code is not null and referral_code <> '';

-- ---------------------------------------------------------------------------
-- distribution_activities — chronological timeline / stage moves / notes
-- ---------------------------------------------------------------------------
create table if not exists public.distribution_activities (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.distribution_churches(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  activity_type text not null,
  summary text not null default '',
  detail jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists distribution_activities_church_idx
  on public.distribution_activities (church_id, occurred_at desc);
create index if not exists distribution_activities_type_idx
  on public.distribution_activities (activity_type);

-- ---------------------------------------------------------------------------
-- distribution_interactions — manual outreach log
-- ---------------------------------------------------------------------------
create table if not exists public.distribution_interactions (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.distribution_churches(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  interaction_type text not null
    check (interaction_type in (
      'email', 'phone', 'kakaotalk', 'facebook', 'in_person', 'demo', 'other'
    )),
  summary text not null default '',
  result text,
  next_action text,
  interacted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists distribution_interactions_church_idx
  on public.distribution_interactions (church_id, interacted_at desc);

-- ---------------------------------------------------------------------------
-- distribution_campaigns
-- ---------------------------------------------------------------------------
create table if not exists public.distribution_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  country text,
  city text,
  diocese text,
  language text,
  target_church_type text,
  start_date date,
  end_date date,
  status text not null default 'active'
    check (status in ('draft', 'active', 'paused', 'completed')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists distribution_campaigns_status_idx
  on public.distribution_campaigns (status);

create table if not exists public.distribution_campaign_churches (
  campaign_id uuid not null references public.distribution_campaigns(id) on delete cascade,
  church_id uuid not null references public.distribution_churches(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (campaign_id, church_id)
);

create index if not exists distribution_campaign_churches_church_idx
  on public.distribution_campaign_churches (church_id);

-- ---------------------------------------------------------------------------
-- distribution_invites — personalized onboarding links (wraps platform_invites)
-- ---------------------------------------------------------------------------
create table if not exists public.distribution_invites (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.distribution_churches(id) on delete cascade,
  platform_invite_id uuid references public.platform_invites(id) on delete set null,
  slug text not null,
  token text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired', 'revoked')),
  max_uses integer not null default 1,
  use_count integer not null default 0,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists distribution_invites_slug_uidx
  on public.distribution_invites (slug);
create index if not exists distribution_invites_church_idx
  on public.distribution_invites (church_id);
create index if not exists distribution_invites_status_idx
  on public.distribution_invites (status);

-- ---------------------------------------------------------------------------
-- distribution_referrals
-- ---------------------------------------------------------------------------
create table if not exists public.distribution_referrals (
  id uuid primary key default gen_random_uuid(),
  referring_church_id uuid not null references public.distribution_churches(id) on delete cascade,
  referred_church_id uuid not null references public.distribution_churches(id) on delete cascade,
  referral_code text not null,
  status text not null default 'pending'
    check (status in ('pending', 'signed_up', 'activated', 'rewarded', 'cancelled')),
  reward_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint distribution_referrals_no_self check (referring_church_id <> referred_church_id)
);

create index if not exists distribution_referrals_referring_idx
  on public.distribution_referrals (referring_church_id);
create index if not exists distribution_referrals_referred_idx
  on public.distribution_referrals (referred_church_id);
create index if not exists distribution_referrals_code_idx
  on public.distribution_referrals (referral_code);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.distribution_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists distribution_churches_set_updated_at on public.distribution_churches;
create trigger distribution_churches_set_updated_at
  before update on public.distribution_churches
  for each row execute function public.distribution_set_updated_at();

drop trigger if exists distribution_interactions_set_updated_at on public.distribution_interactions;
create trigger distribution_interactions_set_updated_at
  before update on public.distribution_interactions
  for each row execute function public.distribution_set_updated_at();

drop trigger if exists distribution_campaigns_set_updated_at on public.distribution_campaigns;
create trigger distribution_campaigns_set_updated_at
  before update on public.distribution_campaigns
  for each row execute function public.distribution_set_updated_at();

drop trigger if exists distribution_invites_set_updated_at on public.distribution_invites;
create trigger distribution_invites_set_updated_at
  before update on public.distribution_invites
  for each row execute function public.distribution_set_updated_at();

drop trigger if exists distribution_referrals_set_updated_at on public.distribution_referrals;
create trigger distribution_referrals_set_updated_at
  before update on public.distribution_referrals
  for each row execute function public.distribution_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — deny client access; FastAPI uses service_role
-- ---------------------------------------------------------------------------
alter table public.distribution_churches enable row level security;
alter table public.distribution_activities enable row level security;
alter table public.distribution_interactions enable row level security;
alter table public.distribution_campaigns enable row level security;
alter table public.distribution_campaign_churches enable row level security;
alter table public.distribution_invites enable row level security;
alter table public.distribution_referrals enable row level security;

revoke all on public.distribution_churches from anon, authenticated;
revoke all on public.distribution_activities from anon, authenticated;
revoke all on public.distribution_interactions from anon, authenticated;
revoke all on public.distribution_campaigns from anon, authenticated;
revoke all on public.distribution_campaign_churches from anon, authenticated;
revoke all on public.distribution_invites from anon, authenticated;
revoke all on public.distribution_referrals from anon, authenticated;

grant all on public.distribution_churches to service_role;
grant all on public.distribution_activities to service_role;
grant all on public.distribution_interactions to service_role;
grant all on public.distribution_campaigns to service_role;
grant all on public.distribution_campaign_churches to service_role;
grant all on public.distribution_invites to service_role;
grant all on public.distribution_referrals to service_role;
