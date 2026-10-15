-- Spectrum database setup. Run this once in the Supabase SQL Editor.

-- Projects belong to one user
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Each file's manifest its chunks are stored in the chunks bucket
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  path text not null,
  version integer not null default 1,
  size integer not null,
  sha256 text not null,
  compressed boolean not null default false,
  chunks jsonb not null default '[]'jsonb,
  updated_at timestamptz not null default now(),
  unique (project_id, path)
);

-- Row-level security users only see their own rows
alter table public.projects enable row level security;
alter table public.files enable row level security;

drop policy if exists own projects on public.projects;
create policy own projects on public.projects
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists own files on public.files;
create policy own files on public.files
  for all
  using (exists (
    select 1 from public.projects p
    where p.id = files.project_id and p.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.projects p
    where p.id = files.project_id and p.owner_id = auth.uid()
  ));

-- Private bucket for file chunks. Chunks are stored as user idhash.
insert into storage.buckets (id, name, public)
values ('chunks', 'chunks', false)
on conflict (id) do nothing;

drop policy if exists own chunks read on storage.objects;
create policy own chunks read on storage.objects
  for select
  using (bucket_id = 'chunks' and (storage.foldername(name))[1] = auth.uid()text);

drop policy if exists own chunks write on storage.objects;
create policy own chunks write on storage.objects
  for insert
  with check (bucket_id = 'chunks' and (storage.foldername(name))[1] = auth.uid()text);

drop policy if exists own chunks delete on storage.objects;
create policy own chunks delete on storage.objects
  for delete
  using (bucket_id = 'chunks' and (storage.foldername(name))[1] = auth.uid()text);