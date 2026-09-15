create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'paid')),
  stripe_customer_id text,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  slug text not null unique,
  mode text not null check (mode in ('popout', 'gallery', 'upload')),
  source_image_path text,
  mind_path text,
  glb_path text,
  status text not null default 'draft'
    check (status in ('draft', 'processing', 'ready', 'error')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  step text not null check (step in ('popout_build', 'mind_compile', 'page_render')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'error')),
  payload jsonb not null default '{}'::jsonb,
  log text,
  created_at timestamptz not null default now()
);

create table public.scan_events (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  scanned_at timestamptz not null default now(),
  country text
);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.jobs enable row level security;
alter table public.scan_events enable row level security;

create policy "profiles are visible to their owner"
  on public.profiles for select using (auth.uid() = id);
create policy "owners manage projects"
  on public.projects for all using (auth.uid() = owner) with check (auth.uid() = owner);
create policy "owners view jobs"
  on public.jobs for select using (
    exists (
      select 1 from public.projects
      where projects.id = jobs.project_id and projects.owner = auth.uid()
    )
  );
create policy "anyone can record a scan"
  on public.scan_events for insert to anon, authenticated
  with check (true);
create policy "owners view scans"
  on public.scan_events for select using (
    exists (
      select 1 from public.projects
      where projects.id = scan_events.project_id and projects.owner = auth.uid()
    )
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
