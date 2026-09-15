-- Local demo account used by the M1/M4 smoke tests.
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'demo@kidar.local',
  crypt('demo-password', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"kidAR Demo"}'::jsonb,
  now(),
  now()
)
on conflict (id) do nothing;

insert into public.projects (
  id, owner, name, slug, mode, source_image_path, status, settings
)
values (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'Demo Drawing',
  'demo-drawing',
  'popout',
  'demo/drawing.png',
  'draft',
  '{"title":"Desenul meu AR","theme":"#6d5dfc","scale":1,"offset":{"x":0,"y":0,"z":0}}'::jsonb
)
on conflict (id) do nothing;
