-- Marketing contact list + promo campaigns (superadmin outreach).

-- Allow promo push notifications in the existing in-app inbox.
alter table public.user_notifications
  drop constraint if exists user_notifications_kind_check;

alter table public.user_notifications
  add constraint user_notifications_kind_check check (
    kind in (
      'info', 'ok', 'error', 'warn',
      'song_approved', 'song_rejected',
      'promo'
    )
  );

create table if not exists public.marketing_contacts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_normalized text not null,
  user_id uuid references public.profiles(id) on delete set null,
  first_name text not null default '',
  last_name text not null default '',
  parish_name text not null default '',
  source text not null default 'signup',
  subscribed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_contacts_email_normalized_unique unique (email_normalized),
  constraint marketing_contacts_source_check check (
    source in ('signup', 'profile_sync', 'import', 'manual')
  )
);

create index if not exists marketing_contacts_subscribed_idx
  on public.marketing_contacts (subscribed, updated_at desc);

create index if not exists marketing_contacts_user_id_idx
  on public.marketing_contacts (user_id)
  where user_id is not null;

create index if not exists marketing_contacts_created_at_idx
  on public.marketing_contacts (created_at desc);

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  link_url text,
  channels text[] not null default '{}',
  audience text not null default 'subscribed',
  sent_by uuid references public.profiles(id) on delete set null,
  in_app_sent integer not null default 0,
  email_sent integer not null default 0,
  email_failed integer not null default 0,
  recipient_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint marketing_campaigns_audience_check check (
    audience in ('subscribed', 'all')
  )
);

create index if not exists marketing_campaigns_created_at_idx
  on public.marketing_campaigns (created_at desc);

alter table public.marketing_contacts enable row level security;
alter table public.marketing_contacts force row level security;
revoke all on table public.marketing_contacts from anon, authenticated;
grant all on table public.marketing_contacts to service_role;

drop policy if exists deny_all_authenticated on public.marketing_contacts;
create policy deny_all_authenticated on public.marketing_contacts
  as restrictive for all to authenticated using (false);
drop policy if exists deny_all_anon on public.marketing_contacts;
create policy deny_all_anon on public.marketing_contacts
  as restrictive for all to anon using (false);

alter table public.marketing_campaigns enable row level security;
alter table public.marketing_campaigns force row level security;
revoke all on table public.marketing_campaigns from anon, authenticated;
grant all on table public.marketing_campaigns to service_role;

drop policy if exists deny_all_authenticated on public.marketing_campaigns;
create policy deny_all_authenticated on public.marketing_campaigns
  as restrictive for all to authenticated using (false);
drop policy if exists deny_all_anon on public.marketing_campaigns;
create policy deny_all_anon on public.marketing_campaigns
  as restrictive for all to anon using (false);
