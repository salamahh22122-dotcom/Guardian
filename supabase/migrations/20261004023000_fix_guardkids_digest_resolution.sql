-- Fix custom GuardKids session hashing when pgcrypto is installed in the extensions schema.
-- Explicitly qualify digest() so RLS policies and child pairing do not depend on search_path resolution.

create or replace function public.guardkids_current_user_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public, extensions, pg_catalog
as $function$
declare token text; uid uuid;
begin
  token := current_setting('request.headers', true)::json->>'x-guardkids-session';
  if token is null or token = '' then return null; end if;

  select user_id into uid
  from public.app_sessions
  where token_hash = encode(extensions.digest(token::text, 'sha256'), 'hex')
    and expires_at > now()
  limit 1;

  return uid;
end
$function$;

create or replace function public.guardkids_pair_child(
  p_pairing_code text,
  p_device_model text,
  p_os_version text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $function$
declare
  c child_devices%rowtype;
  uid uuid;
  token text;
begin
  select * into c
  from child_devices
  where pairing_code_hash = encode(extensions.digest(trim(p_pairing_code)::text, 'sha256'), 'hex')
    and pairing_expires_at > now()
    and paired_user_id is null
  limit 1;

  if c.id is null then
    raise exception 'Kode pemasangan tidak valid atau sudah kedaluwarsa';
  end if;

  insert into profiles(full_name, role)
  values(c.name || ' • Companion', 'child')
  returning id into uid;

  update child_devices
  set paired_user_id = uid,
      device_model = coalesce(nullif(trim(p_device_model), ''), device_model),
      os_version = coalesce(nullif(trim(p_os_version), ''), os_version),
      pairing_code_hash = null,
      pairing_expires_at = null,
      is_online = true,
      last_seen_at = now(),
      updated_at = now()
  where id = c.id;

  token := encode(gen_random_bytes(32), 'hex');

  insert into app_sessions(user_id, token_hash, expires_at)
  values(
    uid,
    encode(extensions.digest(token::text, 'sha256'), 'hex'),
    now() + interval '90 days'
  );

  return jsonb_build_object(
    'child_id', c.id,
    'user_id', uid,
    'session_token', token
  );
end
$function$;
