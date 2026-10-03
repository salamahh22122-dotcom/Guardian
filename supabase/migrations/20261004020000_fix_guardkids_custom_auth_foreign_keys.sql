-- GuardKids uses custom profile/session authentication instead of Supabase Auth.
-- Keep application-owned user relationships inside public.profiles.

alter table public.profiles
  drop constraint if exists profiles_id_fkey;

alter table public.child_devices
  drop constraint if exists child_devices_paired_user_id_fkey;

alter table public.device_commands
  drop constraint if exists device_commands_sender_id_fkey;

alter table public.child_devices
  add constraint child_devices_paired_user_id_fkey
  foreign key (paired_user_id)
  references public.profiles(id)
  on delete set null;

alter table public.device_commands
  add constraint device_commands_sender_id_fkey
  foreign key (sender_id)
  references public.profiles(id)
  on delete cascade;
