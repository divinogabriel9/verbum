-- In-app notifications for members (song approval, etc.).

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'info',
  message text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  constraint user_notifications_kind_check check (
    kind in ('info', 'ok', 'error', 'warn', 'song_approved', 'song_rejected')
  )
);

create index if not exists user_notifications_user_unseen_idx
  on public.user_notifications (user_id, created_at desc)
  where seen_at is null;

create index if not exists user_notifications_user_created_idx
  on public.user_notifications (user_id, created_at desc);

alter table public.user_notifications enable row level security;
alter table public.user_notifications force row level security;
revoke all on table public.user_notifications from anon, authenticated;
grant all on table public.user_notifications to service_role;

drop policy if exists deny_all_authenticated on public.user_notifications;
create policy deny_all_authenticated on public.user_notifications
  as restrictive for all to authenticated using (false);
drop policy if exists deny_all_anon on public.user_notifications;
create policy deny_all_anon on public.user_notifications
  as restrictive for all to anon using (false);
