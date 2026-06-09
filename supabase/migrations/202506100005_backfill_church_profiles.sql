-- Backfill church_profiles for users created before signup trigger added church rows.

insert into public.church_profiles (user_id, community_name)
select p.id, ''
from public.profiles p
where not exists (
  select 1 from public.church_profiles cp where cp.user_id = p.id
)
on conflict (user_id) do nothing;
