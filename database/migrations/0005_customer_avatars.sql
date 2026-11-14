-- 0005_customer_avatars.sql
-- Optional customer profile photo, kept in Supabase Storage.
--
-- One private bucket, "avatars", and one object per customer, named
-- "<the customer's auth user id>/avatar". The storefront uploads, reads and
-- removes it with the signed-in customer's own session (the authenticated
-- role), so these policies decide who may touch what:
--   - a customer can create, read, replace and delete only their own object;
--   - nobody can read or change another customer's object;
--   - signed-out visitors (anon) can do nothing in this bucket;
--   - no other object name is accepted, so a customer cannot fill the bucket.
-- The bucket is private: there is no public URL. The storefront serves the
-- photo to its owner through /account/photo/<version>.
--
-- The bucket limits (2 MB; JPEG, PNG or WebP) are enforced by Storage itself,
-- in addition to the storefront's own checks.
--
-- Needs Supabase Storage (the storage schema) and auth.uid(). It does not
-- depend on migrations 0001-0004 and can be applied on its own. Safe to run
-- again. Row Level Security is already on for storage.objects in Supabase.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_owner_select" on storage.objects;
create policy "avatars_owner_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar');

drop policy if exists "avatars_owner_insert" on storage.objects;
create policy "avatars_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar');

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar')
  with check (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar');

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar');
