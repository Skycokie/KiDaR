insert into storage.buckets (id, name, public)
values ('project-assets', 'project-assets', false)
on conflict (id) do update set public = excluded.public;

create policy "owners can upload project assets"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-assets'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "owners can read project assets"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'project-assets'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "owners can replace project assets"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'project-assets'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'project-assets'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "owners can delete project assets"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'project-assets'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
