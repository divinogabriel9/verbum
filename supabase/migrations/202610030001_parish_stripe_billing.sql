-- Parish Stripe Billing (per-parish subscriptions).
-- Pay-to-unlock: active/trialing subscription sets membership_status=approved via webhook.

alter table public.parishes
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_subscription_status text,
  add column if not exists stripe_price_id text,
  add column if not exists stripe_current_period_end timestamptz;

create unique index if not exists parishes_stripe_customer_id_uidx
  on public.parishes (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists parishes_stripe_subscription_id_uidx
  on public.parishes (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists parishes_stripe_subscription_status_idx
  on public.parishes (stripe_subscription_status);

comment on column public.parishes.stripe_customer_id is
  'Stripe Customer id for this parish (one subscription per parish)';
comment on column public.parishes.stripe_subscription_id is
  'Active Stripe Subscription id';
comment on column public.parishes.stripe_subscription_status is
  'Stripe subscription status: trialing, active, past_due, canceled, unpaid, …';
comment on column public.parishes.stripe_price_id is
  'Stripe Price id for the current subscription item';
comment on column public.parishes.stripe_current_period_end is
  'End of the current Stripe billing period (UTC)';
