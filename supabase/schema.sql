-- GuardKids production backend
-- Run this once in the target Supabase project's SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'parent' check (role = 'parent'),
  created_at timestamptz not null default now()
);

create table if not exists public.child_devices (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  paired_user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  age integer not null check (age between 0 and 21),
  avatar_color text not null default 'from-emerald-500 to-teal-600',
  device_model text not null default '',
  os_version text not null default '',
  battery_level integer not null default 0 check (battery_level between 0 and 100),
  is_charging boolean not null default false,
  network_type text not null default 'WiFi' check (network_type in ('WiFi','4G','5G')),
  wifi_ssid text not null default '',
  is_online boolean not null default false,
  last_seen_at timestamptz,
  screen_status text not null default 'unlocked' check (screen_status in ('unlocked','locked_bedtime','locked_limit','locked_manual')),
  lock_message text not null default '',
  today_screen_time_minutes integer not null default 0 check (today_screen_time_minutes >= 0),
  screen_time_date date not null default current_date,
  screen_time_limit_minutes integer not null default 120 check (screen_time_limit_minutes >= 0),
  bedtime_start text not null default '21:00',
  bedtime_end text not null default '06:00',
  is_bedtime_enabled boolean not null default true,
  current_lat double precision not null default 0,
  current_lng double precision not null default 0,
  current_address text not null default '',
  current_accuracy double precision not null default 0,
  current_location_at timestamptz,
  is_screen_mirroring_active boolean not null default false,
  is_screen_mirroring_requested boolean not null default false,
  is_camera_active boolean not null default false,
  camera_facing text not null default 'back' check (camera_facing in ('front','back')),
  is_flashlight_on boolean not null default false,
  companion_permissions jsonb not null default '{"location":false,"usageStats":false,"notificationAccess":false,"deviceAdmin":false,"batteryOptimization":false}'::jsonb,
  pairing_code_hash text,
  pairing_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.child_devices drop column if exists is_app_icon_hidden_from_launcher;
alter table public.child_devices add column if not exists screen_time_date date not null default current_date;

create table if not exists public.location_points (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_devices(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  lat double precision not null,
  lng double precision not null,
  address text not null default '',
  accuracy double precision not null default 0,
  battery integer not null default 0 check (battery between 0 and 100)
);

create index if not exists idx_location_points_child_time on public.location_points(child_id, recorded_at desc);

create table if not exists public.safe_zones (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_devices(id) on delete cascade,
  name text not null,
  address text not null default '',
  radius_meters integer not null default 150 check (radius_meters between 10 and 50000),
  lat double precision not null,
  lng double precision not null,
  is_inside boolean not null default false,
  type text not null default 'other' check (type in ('home','school','other')),
  created_at timestamptz not null default now()
);

create table if not exists public.app_usages (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_devices(id) on delete cascade,
  app_name text not null,
  package_name text not null,
  category text not null check (category in ('games','social','education','entertainment','system')),
  minutes_today integer not null default 0 check (minutes_today >= 0),
  daily_limit_minutes integer not null default 0 check (daily_limit_minutes >= 0),
  is_blocked boolean not null default false,
  icon_name text not null default 'Smartphone',
  updated_at timestamptz not null default now(),
  unique(child_id, package_name)
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_devices(id) on delete cascade,
  parent_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('geofence','battery','screen_time','request','sos')),
  title text not null,
  message text not null,
  is_read boolean not null default false,
  severity text not null default 'low' check (severity in ('low','medium','high','critical')),
  created_at timestamptz not null default now()
);

create index if not exists idx_alerts_parent_created on public.alerts(parent_id, created_at desc);

create table if not exists public.time_requests (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_devices(id) on delete cascade,
  parent_id uuid not null references public.profiles(id) on delete cascade,
  app_name text,
  requested_minutes integer not null check (requested_minutes between 1 and 480),
  reason text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.device_commands (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_devices(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  command text not null,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','completed')),
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz
);

create index if not exists idx_device_commands_child_status on public.device_commands(child_id, status, created_at);

create table if not exists public.media_items (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_devices(id) on delete cascade,
  filename text not null,
  storage_path text not null unique,
  category text not null default 'camera' check (category in ('camera','screenshot','whatsapp','download')),
  media_type text not null default 'image' check (media_type in ('image','video')),
  duration text,
  title text not null default '',
  preview_url text,
  ai_safety_score text not null default 'warning' check (ai_safety_score in ('safe','warning','flagged')),
  ai_safety_tag text not null default 'Belum dianalisis',
  file_size text,
  created_at timestamptz not null default now()
);

create index if not exists idx_media_child_created on public.media_items(child_id, created_at desc);

create table if not exists public.rtc_signals (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_devices(id) on delete cascade,
  session_id uuid not null,
  sender_role text not null check (sender_role in ('parent','child')),
  signal_type text not null check (signal_type in ('offer','answer','ice')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rtc_signals_session on public.rtc_signals(child_id, session_id, created_at);


create or replace function public.guardkids_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists child_devices_touch_updated_at on public.child_devices;
create trigger child_devices_touch_updated_at
before update on public.child_devices
for each row execute function public.guardkids_touch_updated_at();

create or replace function public.guardkids_restrict_child_device_update()
returns trigger
language plpgsql
as $$
begin
  if (select auth.uid()) = old.paired_user_id then
    if new.id is distinct from old.id
      or new.parent_id is distinct from old.parent_id
      or new.paired_user_id is distinct from old.paired_user_id
      or new.name is distinct from old.name
      or new.age is distinct from old.age
      or new.avatar_color is distinct from old.avatar_color
      or new.pairing_code_hash is distinct from old.pairing_code_hash
      or new.pairing_expires_at is distinct from old.pairing_expires_at
      or new.created_at is distinct from old.created_at
      or new.screen_time_date is distinct from old.screen_time_date
      or new.screen_time_limit_minutes is distinct from old.screen_time_limit_minutes
      or new.bedtime_start is distinct from old.bedtime_start
      or new.bedtime_end is distinct from old.bedtime_end
      or new.is_bedtime_enabled is distinct from old.is_bedtime_enabled
    then
      raise exception 'Companion tidak boleh mengubah konfigurasi kepemilikan atau kebijakan orang tua';
    end if;

    if new.screen_status is distinct from old.screen_status then
      if old.screen_status = 'unlocked' and new.screen_status in ('locked_bedtime','locked_limit') then
        null;
      elsif old.screen_status = 'locked_bedtime' and new.screen_status = 'unlocked' then
        null;
      else
        raise exception 'Companion tidak dapat melewati penguncian manual atau batas waktu yang diputuskan orang tua';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists child_devices_restrict_child_update on public.child_devices;
create trigger child_devices_restrict_child_update
before update on public.child_devices
for each row execute function public.guardkids_restrict_child_device_update();

revoke all on function public.guardkids_restrict_child_device_update() from public, anon, authenticated;
revoke all on function public.guardkids_touch_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_parent_profile() from public, anon, authenticated;

drop trigger if exists app_usages_touch_updated_at on public.app_usages;
create trigger app_usages_touch_updated_at
before update on public.app_usages
for each row execute function public.guardkids_touch_updated_at();

create or replace function public.handle_new_parent_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), 'parent')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_guardkids on auth.users;
create trigger on_auth_user_created_guardkids
after insert on auth.users
for each row execute function public.handle_new_parent_profile();

alter table public.profiles enable row level security;
alter table public.child_devices enable row level security;
alter table public.location_points enable row level security;
alter table public.safe_zones enable row level security;
alter table public.app_usages enable row level security;
alter table public.alerts enable row level security;
alter table public.time_requests enable row level security;
alter table public.device_commands enable row level security;
alter table public.media_items enable row level security;
alter table public.rtc_signals enable row level security;

-- Explicit Data API grants; RLS remains the row-level authorization boundary.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.child_devices to authenticated;
grant select, insert on public.location_points to authenticated;
grant select, insert, update, delete on public.safe_zones to authenticated;
grant select, insert, update, delete on public.app_usages to authenticated;
grant select, insert, update, delete on public.alerts to authenticated;
grant select, insert, update on public.time_requests to authenticated;
grant select, insert, update on public.device_commands to authenticated;
grant select, insert, delete on public.media_items to authenticated;
grant select, insert, delete on public.rtc_signals to authenticated;

-- Profiles: each signed-in account can read only itself.
drop policy if exists "profile_select_self" on public.profiles;
create policy "profile_select_self" on public.profiles for select to authenticated
using ((select auth.uid()) = id);

drop policy if exists "profile_insert_self" on public.profiles;
create policy "profile_insert_self" on public.profiles for insert to authenticated
with check ((select auth.uid()) = id and role = 'parent');

drop policy if exists "profile_update_self" on public.profiles;
create policy "profile_update_self" on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id and role = 'parent');

-- Parent owns the child record. The paired companion may read/update its own
-- telemetry/state but cannot change ownership to another account because the
-- pairing identity is required to remain the same.
drop policy if exists "parents_manage_children" on public.child_devices;
drop policy if exists "child_reads_own_device" on public.child_devices;
drop policy if exists "child_updates_own_device" on public.child_devices;
create policy "parents_manage_children" on public.child_devices for all to authenticated
using ((select auth.uid()) = parent_id)
with check ((select auth.uid()) = parent_id);
create policy "child_reads_own_device" on public.child_devices for select to authenticated
using ((select auth.uid()) = paired_user_id);
create policy "child_updates_own_device" on public.child_devices for update to authenticated
using ((select auth.uid()) = paired_user_id)
with check ((select auth.uid()) = paired_user_id);

-- Device telemetry/history is writable by the paired companion and readable by its parent.
drop policy if exists "parents_or_child_locations" on public.location_points;
create policy "parents_or_child_locations" on public.location_points for select to authenticated
using (exists (select 1 from public.child_devices c where c.id = child_id and ((select auth.uid()) = c.parent_id or (select auth.uid()) = c.paired_user_id)));
create policy "child_insert_locations" on public.location_points for insert to authenticated
with check (exists (select 1 from public.child_devices c where c.id = child_id and c.paired_user_id = (select auth.uid())));

-- Safe zones and app policies are parent-managed configuration.
drop policy if exists "parents_or_child_safe_zones" on public.safe_zones;
create policy "parents_manage_safe_zones" on public.safe_zones for all to authenticated
using (exists (select 1 from public.child_devices c where c.id = child_id and c.parent_id = (select auth.uid())))
with check (exists (select 1 from public.child_devices c where c.id = child_id and c.parent_id = (select auth.uid())));

create policy "child_reads_safe_zones" on public.safe_zones for select to authenticated
using (exists (select 1 from public.child_devices c where c.id = child_id and c.paired_user_id = (select auth.uid())));
create policy "child_updates_safe_zone_state" on public.safe_zones for update to authenticated
using (exists (select 1 from public.child_devices c where c.id = child_id and c.paired_user_id = (select auth.uid())))
with check (exists (select 1 from public.child_devices c where c.id = child_id and c.paired_user_id = (select auth.uid())));

create or replace function public.guardkids_restrict_child_safe_zone_update()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.child_devices c where c.id = old.child_id and c.paired_user_id = (select auth.uid())) then
    if new.id is distinct from old.id
      or new.child_id is distinct from old.child_id
      or new.name is distinct from old.name
      or new.address is distinct from old.address
      or new.radius_meters is distinct from old.radius_meters
      or new.lat is distinct from old.lat
      or new.lng is distinct from old.lng
      or new.type is distinct from old.type
      or new.created_at is distinct from old.created_at
    then
      raise exception 'Companion hanya boleh memperbarui status masuk atau keluar zona aman';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists safe_zones_restrict_child_update on public.safe_zones;
create trigger safe_zones_restrict_child_update
before update on public.safe_zones
for each row execute function public.guardkids_restrict_child_safe_zone_update();
revoke all on function public.guardkids_restrict_child_safe_zone_update() from public, anon, authenticated;

drop policy if exists "parents_or_child_app_usages" on public.app_usages;
create policy "parents_manage_app_usages" on public.app_usages for all to authenticated
using (exists (select 1 from public.child_devices c where c.id = child_id and c.parent_id = (select auth.uid())))
with check (exists (select 1 from public.child_devices c where c.id = child_id and c.parent_id = (select auth.uid())));

-- Alerts: parents read/manage their alerts; paired child may insert alerts into its parent's feed.
drop policy if exists "parents_or_child_alerts" on public.alerts;
drop policy if exists "alerts_parent_select" on public.alerts;
drop policy if exists "alerts_parent_update" on public.alerts;
drop policy if exists "alerts_parent_delete" on public.alerts;
drop policy if exists "alerts_parent_insert" on public.alerts;
drop policy if exists "alerts_child_insert" on public.alerts;
create policy "alerts_parent_select" on public.alerts for select to authenticated
using ((select auth.uid()) = parent_id);
create policy "alerts_parent_update" on public.alerts for update to authenticated
using ((select auth.uid()) = parent_id)
with check ((select auth.uid()) = parent_id);
create policy "alerts_parent_delete" on public.alerts for delete to authenticated
using ((select auth.uid()) = parent_id);
create policy "alerts_parent_insert" on public.alerts for insert to authenticated
with check ((select auth.uid()) = parent_id and exists (select 1 from public.child_devices c where c.id = child_id and c.parent_id = (select auth.uid())));
create policy "alerts_child_insert" on public.alerts for insert to authenticated
with check (exists (select 1 from public.child_devices c where c.id = child_id and c.paired_user_id = (select auth.uid()) and c.parent_id = parent_id));

-- Time requests: paired child creates; parent reads/resolves.
drop policy if exists "parents_or_child_requests" on public.time_requests;
drop policy if exists "time_requests_parent_select" on public.time_requests;
drop policy if exists "time_requests_parent_update" on public.time_requests;
drop policy if exists "time_requests_child_insert" on public.time_requests;
create policy "time_requests_parent_select" on public.time_requests for select to authenticated
using ((select auth.uid()) = parent_id);
create policy "time_requests_parent_update" on public.time_requests for update to authenticated
using ((select auth.uid()) = parent_id)
with check ((select auth.uid()) = parent_id);
create policy "time_requests_child_insert" on public.time_requests for insert to authenticated
with check (exists (select 1 from public.child_devices c where c.id = child_id and c.paired_user_id = (select auth.uid()) and c.parent_id = parent_id));

-- Commands: parents create; both sides read their own relationship; child acknowledges.
drop policy if exists "commands_parent_or_paired_child" on public.device_commands;
create policy "commands_parent_or_paired_child" on public.device_commands for select to authenticated
using (exists (select 1 from public.child_devices c where c.id = child_id and ((select auth.uid()) = c.parent_id or (select auth.uid()) = c.paired_user_id)));
drop policy if exists "commands_parent_insert" on public.device_commands;
create policy "commands_parent_insert" on public.device_commands for insert to authenticated
with check (sender_id = (select auth.uid()) and exists (select 1 from public.child_devices c where c.id = child_id and c.parent_id = (select auth.uid())));
drop policy if exists "commands_child_ack" on public.device_commands;
create policy "commands_child_ack" on public.device_commands for update to authenticated
using (exists (select 1 from public.child_devices c where c.id = child_id and c.paired_user_id = (select auth.uid())))
with check (exists (select 1 from public.child_devices c where c.id = child_id and c.paired_user_id = (select auth.uid())));

create or replace function public.guardkids_restrict_child_command_update()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.child_devices c where c.id = old.child_id and c.paired_user_id = (select auth.uid())) then
    if new.id is distinct from old.id
      or new.child_id is distinct from old.child_id
      or new.sender_id is distinct from old.sender_id
      or new.command is distinct from old.command
      or new.payload is distinct from old.payload
      or new.created_at is distinct from old.created_at
    then
      raise exception 'Companion hanya boleh mengubah status, hasil, dan waktu acknowledgement perintah';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists device_commands_restrict_child_update on public.device_commands;
create trigger device_commands_restrict_child_update
before update on public.device_commands
for each row execute function public.guardkids_restrict_child_command_update();

revoke all on function public.guardkids_restrict_child_command_update() from public, anon, authenticated;

-- Media: parent reads/deletes; paired child uploads.
drop policy if exists "media_parent_or_child" on public.media_items;
drop policy if exists "media_parent_select" on public.media_items;
drop policy if exists "media_parent_delete" on public.media_items;
drop policy if exists "media_child_insert" on public.media_items;
create policy "media_parent_select" on public.media_items for select to authenticated
using (exists (select 1 from public.child_devices c where c.id = child_id and c.parent_id = (select auth.uid())));
create policy "media_parent_delete" on public.media_items for delete to authenticated
using (exists (select 1 from public.child_devices c where c.id = child_id and c.parent_id = (select auth.uid())));
create policy "media_child_insert" on public.media_items for insert to authenticated
with check (exists (select 1 from public.child_devices c where c.id = child_id and c.paired_user_id = (select auth.uid())));

-- RTC signaling: parent and child may create/read signaling only for their relationship.
drop policy if exists "rtc_parent_or_child" on public.rtc_signals;
create policy "rtc_parent_or_child" on public.rtc_signals for select to authenticated
using (exists (select 1 from public.child_devices c where c.id = child_id and ((select auth.uid()) = c.parent_id or (select auth.uid()) = c.paired_user_id)));
create policy "rtc_insert_parent_or_child" on public.rtc_signals for insert to authenticated
with check (
  exists (select 1 from public.child_devices c where c.id = child_id and ((select auth.uid()) = c.parent_id or (select auth.uid()) = c.paired_user_id))
  and sender_role = case when (select auth.uid()) = (select parent_id from public.child_devices where id = child_id) then 'parent' else 'child' end
);

drop policy if exists "rtc_delete_parent_or_child" on public.rtc_signals;
create policy "rtc_delete_parent_or_child" on public.rtc_signals for delete to authenticated
using (exists (select 1 from public.child_devices c where c.id = child_id and ((select auth.uid()) = c.parent_id or (select auth.uid()) = c.paired_user_id)));

-- Storage: private bucket, scoped to the child folder.
insert into storage.buckets (id, name, public) values ('guardkids-media', 'guardkids-media', false) on conflict (id) do update set public = false;

drop policy if exists "guardkids_media_select" on storage.objects;
create policy "guardkids_media_select" on storage.objects for select to authenticated
using (bucket_id = 'guardkids-media' and exists (
  select 1 from public.child_devices c
  where c.id::text = (storage.foldername(name))[1]
  and ((select auth.uid()) = c.parent_id or (select auth.uid()) = c.paired_user_id)
));

drop policy if exists "guardkids_media_insert" on storage.objects;
create policy "guardkids_media_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'guardkids-media' and exists (
  select 1 from public.child_devices c
  where c.id::text = (storage.foldername(name))[1]
  and c.paired_user_id = (select auth.uid())
));

drop policy if exists "guardkids_media_delete" on storage.objects;
create policy "guardkids_media_delete" on storage.objects for delete to authenticated
using (bucket_id = 'guardkids-media' and exists (
  select 1 from public.child_devices c
  where c.id::text = (storage.foldername(name))[1]
  and c.parent_id = (select auth.uid())
));

-- Realtime must watch the persisted data used by the two clients.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'child_devices') then
    alter publication supabase_realtime add table public.child_devices;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'alerts') then
    alter publication supabase_realtime add table public.alerts;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'time_requests') then
    alter publication supabase_realtime add table public.time_requests;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'device_commands') then
    alter publication supabase_realtime add table public.device_commands;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rtc_signals') then
    alter publication supabase_realtime add table public.rtc_signals;
  end if;
end $$;
