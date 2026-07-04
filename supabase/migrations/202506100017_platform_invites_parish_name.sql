-- Parish name and target parish on platform invites (set by superadmin or president).

alter table public.platform_invites
  add column if not exists community_name text,
  add column if not exists parish_id uuid references public.parishes(id) on delete set null,
  add column if not exists invite_role text not null default 'president';

alter table public.platform_invites
  drop constraint if exists platform_invites_invite_role_check;

alter table public.platform_invites
  add constraint platform_invites_invite_role_check
  check (invite_role in ('president', 'media'));
