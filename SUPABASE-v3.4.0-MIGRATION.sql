-- Arvio v3.4.0 — preserve nested sibling order in Supabase
alter table public.notes
  add column if not exists sort_order integer not null default 0;

create index if not exists notes_owner_parent_sort_idx
  on public.notes(owner_id, parent_id, sort_order);
