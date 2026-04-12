-- TIWI Mobile App: Admin Announcement Push Fan-out Schema
-- Run this in your Supabase SQL Editor AFTER notifications_schema.sql.
--
-- Pairs with: supabase/functions/announcement-push-cron (Edge Function)
--
-- The cron polls https://app.tiwiprotocol.xyz/api/v1/notifications?status=live,
-- dedupes against this table, and pushes anything new to every active row
-- in user_push_tokens.

-- ============================================================================
-- 1. Announcement push log (dedup of what we've already fanned out)
-- ============================================================================
--
-- `announcement_id` is PRIMARY KEY — this is the race guard. Two overlapping
-- cron runs both attempt to claim the same id with ON CONFLICT DO NOTHING,
-- and only the run that actually inserts a new row proceeds to dispatch.

CREATE TABLE IF NOT EXISTS announcement_push_log (
    announcement_id TEXT PRIMARY KEY,
    title           TEXT,
    pushed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    token_count     INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_announcement_push_log_pushed_at
    ON announcement_push_log(pushed_at DESC);

ALTER TABLE announcement_push_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'announcement_push_log' AND policyname = 'service role manages log'
    ) THEN
        CREATE POLICY "service role manages log" ON announcement_push_log
            FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ============================================================================
-- 2. Cron schedule (requires pg_cron + pg_net extensions)
-- ============================================================================
--
-- Extensions should already be enabled from price_alerts_schema.sql:
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
--   CREATE EXTENSION IF NOT EXISTS pg_net;
--
-- Replace <PROJECT_REF> and <SERVICE_ROLE_KEY> below and run:
--
--   SELECT cron.schedule(
--       'announcement-push-cron',
--       '*/5 * * * *',
--       $$
--       SELECT net.http_post(
--           url := 'https://<PROJECT_REF>.supabase.co/functions/v1/announcement-push-cron',
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
--   SELECT cron.unschedule('announcement-push-cron');
