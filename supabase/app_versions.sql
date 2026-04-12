-- ============================================
-- TIWI Auto-Update: app_versions table
-- ============================================
-- Paste this entire SQL into your Supabase SQL Editor and click "Run"
-- Supabase Dashboard → SQL Editor → New Query → Paste → Run

-- 1. Create the table
create table if not exists public.app_versions (
  id uuid default gen_random_uuid() primary key,
  version text not null,
  build_number bigint not null,
  apk_url text not null,
  release_notes text default '',
  force_update boolean default false,
  created_at timestamptz default now()
);

-- 2. Enable Row Level Security
alter table public.app_versions enable row level security;

-- 3. Allow anyone to read (the app needs to check versions without auth)
create policy "Anyone can read app versions"
  on public.app_versions
  for select
  using (true);

-- 4. Only service role can insert/update (GitHub Actions uses service key)
-- No policy needed — service role bypasses RLS automatically

-- 5. Create index for fast lookups (latest version first)
create index if not exists idx_app_versions_created_at
  on public.app_versions (created_at desc);

-- 6. Optional: Insert a starter row matching your current version
-- Uncomment and edit if you want an initial row:
-- insert into public.app_versions (version, build_number, apk_url, release_notes)
-- values ('1.0.0', 1, 'https://github.com/CDSLabsxyz/tiwi-mobile/releases/download/v1.0.0/tiwi-1.0.0.apk', 'Initial release');
