# Arvio v3.4.0 — Supabase Cloud Notes

Before deploying v3.4.0, run this once in Supabase SQL Editor:

```sql
alter table public.notes
  add column if not exists sort_order integer not null default 0;

create index if not exists notes_owner_parent_sort_idx
  on public.notes(owner_id, parent_id, sort_order);
```

Expected result: `Success. No rows returned`.

## What v3.4.0 adds

- Authenticated notes sync to `public.notes`.
- IndexedDB remains the offline/local cache.
- Existing local note IDs migrate to UUIDs before first cloud upload.
- New note IDs use UUIDs so they match the Postgres `uuid` primary key.
- Nested hierarchy syncs with `parent_id` and `sort_order`.
- Trash state syncs with `trashed_at`.
- Permanent deletes are queued locally and retried when the device is online.
- Returning devices hydrate from cloud; same-device unsynced rows use a simple latest-`updated_at` merge.
- Local data is not automatically merged into another signed-in account.

## Test

1. Log in to Arvio.
2. Create a note and type a unique sentence.
3. Wait until the editor says `Saved`.
4. In Supabase Table Editor → `notes`, confirm the row appears.
5. Rename/move/trash/restore the note and confirm the cloud row updates.
6. Open Arvio in another browser/device, log in with the same account, and confirm the note appears.
