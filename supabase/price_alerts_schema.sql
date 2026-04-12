-- TIWI Mobile App: Price Alert Cron Schema
-- Run this in your Supabase SQL Editor AFTER notifications_schema.sql.
--
-- Pairs with:
--   - supabase/functions/price-alert-cron  (Edge Function)
--   - services/notificationService.ts       (syncWatchedTokens writer)
--   - app/settings/notifications/price-alerts.tsx (settings writer)

-- ============================================================================
-- 1. User Price Alert Settings
-- ============================================================================

CREATE TABLE IF NOT EXISTS price_alert_settings (
    user_wallet       TEXT PRIMARY KEY,
    enabled           BOOLEAN NOT NULL DEFAULT TRUE,
    threshold_percent NUMERIC(6,2) NOT NULL DEFAULT 3,
    cooldown_minutes  INT NOT NULL DEFAULT 60,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE price_alert_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'price_alert_settings' AND policyname = 'wallet manages own settings'
    ) THEN
        CREATE POLICY "wallet manages own settings" ON price_alert_settings
            FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ============================================================================
-- 2. Watched Tokens (per user, per chain, per contract)
-- ============================================================================
--
-- The client (notificationService.syncWatchedTokens) upserts one row per
-- token the user currently holds on (user_wallet, chain_id, token_address).
-- The cron Edge Function fills in baseline_price / baseline_ts on first
-- sight, then updates them every time an alert fires.

CREATE TABLE IF NOT EXISTS user_watched_tokens (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_wallet      TEXT NOT NULL,
    chain_id         INT NOT NULL,
    token_address    TEXT NOT NULL,
    symbol           TEXT NOT NULL,
    baseline_price   NUMERIC(32,12),
    baseline_ts      TIMESTAMPTZ,
    last_alerted_at  TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_wallet, chain_id, token_address)
);

-- If the table was created by an earlier version of the client before
-- these columns existed, backfill them now. Safe to re-run.
ALTER TABLE user_watched_tokens
    ADD COLUMN IF NOT EXISTS baseline_price  NUMERIC(32,12),
    ADD COLUMN IF NOT EXISTS baseline_ts     TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_alerted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_watched_tokens_wallet
    ON user_watched_tokens(user_wallet);
CREATE INDEX IF NOT EXISTS idx_user_watched_tokens_token
    ON user_watched_tokens(chain_id, token_address);

ALTER TABLE user_watched_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'user_watched_tokens' AND policyname = 'wallet manages own watched tokens'
    ) THEN
        CREATE POLICY "wallet manages own watched tokens" ON user_watched_tokens
            FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ============================================================================
-- 3. Cron schedule (requires pg_cron + pg_net extensions)
-- ============================================================================
--
-- Run these once per project if the extensions aren't already enabled:
--
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
--   CREATE EXTENSION IF NOT EXISTS pg_net;
--
-- Then replace <PROJECT_REF> and <SERVICE_ROLE_KEY> below and run the
-- cron.schedule() block. The Edge Function must already be deployed —
-- see supabase/functions/price-alert-cron/README.md.
--
--   SELECT cron.schedule(
--       'price-alert-cron',
--       '*/5 * * * *',
--       $$
--       SELECT net.http_post(
--           url := 'https://<PROJECT_REF>.supabase.co/functions/v1/price-alert-cron',
--           headers := jsonb_build_object(
--               'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
--               'Content-Type', 'application/json'
--           ),
--           body := '{}'::jsonb
--       ) AS request_id;
--       $$
--   );
--
-- To unschedule later:
--   SELECT cron.unschedule('price-alert-cron');
