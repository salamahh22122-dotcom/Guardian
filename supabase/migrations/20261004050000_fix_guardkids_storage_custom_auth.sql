-- GuardKids custom-auth storage policies. The app does not use Supabase Auth,
-- so storage policies must resolve identity through guardkids_current_user_id().
drop policy if exists guardkids_media_insert on storage.objects;
drop policy if exists guardkids_media_select on storage.objects;
drop policy if exists guardkids_media_delete on storage.objects;

create policy guardkids_media_insert on storage.objects
for insert to public
with check (
  bucket_id = 'guardkids-media'
  and exists (
    select 1 from public.child_devices c
    where c.id::text = (storage.foldername(name))[1]
      and c.paired_user_id = public.guardkids_current_user_id()
  )
);

create policy guardkids_media_select on storage.objects
for select to public
using (
  bucket_id = 'guardkids-media'
  and exists (
    select 1 from public.child_devices c
    where c.id::text = (storage.foldername(name))[1]
      and (c.parent_id = public.guardkids_current_user_id()
        or c.paired_user_id = public.guardkids_current_user_id())
  )
);

create policy guardkids_media_delete on storage.objects
for delete to public
using (
  bucket_id = 'guardkids-media'
  and exists (
    select 1 from public.child_devices c
    where c.id::text = (storage.foldername(name))[1]
      and c.parent_id = public.guardkids_current_user_id()
  )
);
