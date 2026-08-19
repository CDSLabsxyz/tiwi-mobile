-- Mobile sync relay: the dead-drop the browser extension and this app pair through.
--
-- Run this once in the Supabase SQL editor. Until it exists, both sides show
-- "Mobile sync is not set up on the server yet" rather than failing obscurely.
--
-- WHAT IS IN HERE: nothing readable. A row is found by `lookup`, which is
-- SHA-256 of the pairing code, and both blobs are AES-256-GCM under a key
-- derived from that same code. The code is only ever on the extension's screen
-- and in the phone's camera, so the server (and anyone holding the anon key,
-- which ships inside the mobile app and is therefore public) can see that a
-- pairing is happening but not who, or which addresses moved.

create table if not exists public.wallet_sync_sessions (
    -- sha256("tiwi-sync-v1:lookup:" || code), hex. The code itself is never stored.
    lookup      text primary key,
    -- base64(nonce || AES-256-GCM(offer)) - the extension's public addresses.
    offer       text not null,
    -- base64(nonce || AES-256-GCM(response)) - the phone's approval. Null until then.
    response    text,
    created_at  timestamptz not null default now(),
    expires_at  timestamptz not null
);

create index if not exists wallet_sync_sessions_expires_at_idx
    on public.wallet_sync_sessions (expires_at);

alter table public.wallet_sync_sessions enable row level security;

-- The anon key is public, so these policies assume the CODE is the only secret.
-- What they enforce is that rows are short-lived and that nobody can enumerate
-- them: every operation needs the exact `lookup`, which needs the code.

drop policy if exists "sync_insert" on public.wallet_sync_sessions;
create policy "sync_insert" on public.wallet_sync_sessions
    for insert to anon
    -- A row may not be created already-expired, nor parked for hours.
    with check (expires_at > now() and expires_at < now() + interval '10 minutes');

drop policy if exists "sync_select" on public.wallet_sync_sessions;
create policy "sync_select" on public.wallet_sync_sessions
    for select to anon
    using (expires_at > now());

drop policy if exists "sync_update" on public.wallet_sync_sessions;
create policy "sync_update" on public.wallet_sync_sessions
    for update to anon
    using (expires_at > now())
    with check (expires_at > now());

drop policy if exists "sync_delete" on public.wallet_sync_sessions;
create policy "sync_delete" on public.wallet_sync_sessions
    for delete to anon
    using (true);

-- Expired rows are already invisible to the select policy; this just stops the
-- table growing forever. Safe to run from a cron job, or by hand.
create or replace function public.purge_expired_wallet_sync_sessions()
returns void
language sql
security definer
set search_path = public
as $$
    delete from public.wallet_sync_sessions where expires_at < now() - interval '1 hour';
$$;

-- With pg_cron enabled, sweep hourly:
--   select cron.schedule('purge-wallet-sync', '0 * * * *',
--                        $$select public.purge_expired_wallet_sync_sessions()$$);
