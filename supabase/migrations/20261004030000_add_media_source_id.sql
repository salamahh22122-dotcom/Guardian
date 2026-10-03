alter table public.media_items
  add column if not exists source_id text;

create unique index if not exists media_items_child_source_id_uidx
  on public.media_items(child_id, source_id)
  where source_id is not null;
