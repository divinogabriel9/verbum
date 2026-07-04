-- Fix infinite recursion: parish_members policy must not query parish_members from within itself.

drop policy if exists "parish_members_select_member" on public.parish_members;

create policy "parish_members_select_own"
  on public.parish_members for select
  to authenticated
  using (user_id = (select auth.uid()));
