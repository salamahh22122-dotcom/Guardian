create or replace function public.guardkids_heartbeat(p_child_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare uid uuid;
begin
  uid := public.guardkids_current_user_id();
  if uid is null then
    return false;
  end if;

  update public.child_devices
     set is_online = true,
         last_seen_at = now(),
         updated_at = now()
   where id = p_child_id
     and paired_user_id = uid;

  return found;
end
$$;

grant execute on function public.guardkids_heartbeat(uuid) to anon, authenticated;
