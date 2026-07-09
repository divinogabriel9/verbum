-- Helper to purge expired choir practice shares (run via cron or superadmin maintenance).

create or replace function public.purge_expired_practice_shares()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.choir_practice_shares
  where expires_at is not null
    and expires_at < now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.purge_expired_practice_shares() from public;
grant execute on function public.purge_expired_practice_shares() to service_role;
