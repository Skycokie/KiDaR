insert into storage.buckets (id, name, public)
values ('source-drawings', 'source-drawings', false)
on conflict (id) do update set public = excluded.public;

create policy "owners can upload source drawings"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'source-drawings'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "owners can read source drawings"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'source-drawings'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "owners can replace source drawings"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'source-drawings'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'source-drawings'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "owners can delete source drawings"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'source-drawings'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create or replace function public.set_project_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_updated_at
  before update on public.projects
  for each row execute procedure public.set_project_updated_at();
