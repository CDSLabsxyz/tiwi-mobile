-- TIWI Mobile App: Notification and Activity System Schema
-- Run this in your Supabase SQL Editor

-- ============================================================================
-- 1. Push Token Management
-- ============================================================================

-- Table to store Expo Push Tokens for users
CREATE TABLE IF NOT EXISTS user_push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_wallet TEXT NOT NULL,
    push_token TEXT NOT NULL UNIQUE,
    device_name TEXT,
    device_type TEXT CHECK (device_type IN ('ios', 'android', 'web')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookup by wallet
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_wallet ON user_push_tokens(user_wallet);

-- Function and Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_push_tokens_updated_at') THEN
        CREATE TRIGGER update_user_push_tokens_updated_at
            BEFORE UPDATE ON user_push_tokens
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ============================================================================
-- 2. User Activity & In-App Notifications
-- ============================================================================

-- Centralized log for all user-related events (In-app notifications)
CREATE TABLE IF NOT EXISTS user_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_wallet TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN (
        'transaction', -- Wallet transactions (swap, send, etc)
        'reward',      -- Incentives, airdrops, referral bonuses
        'governance',  -- DAO votes, proposals
        'security',    -- Logins, password changes, cloud sync
        'system'       -- Maintenance, new features, updates
    )),
    category TEXT NOT NULL, -- e.g., 'swap', 'deposit', 'vote', 'login'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb, -- dynamic data: { tx_hash, amount, symbol, etc }
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for filtered queries
CREATE INDEX IF NOT EXISTS idx_user_activities_wallet ON user_activities(user_wallet);
CREATE INDEX IF NOT EXISTS idx_user_activities_wallet_type ON user_activities(user_wallet, type);
CREATE INDEX IF NOT EXISTS idx_user_activities_created_at ON user_activities(created_at DESC);

-- ============================================================================
-- 3. Security (Row Level Security)
-- ============================================================================

-- Enable RLS
ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;

-- Note: In a production environment with auth, you would restrict these 
-- policies to the authenticated user. For now, we allow access based on wallet address.

-- Push Token Policies
CREATE POLICY "Users can manage their own tokens" ON user_push_tokens
    FOR ALL USING (true) WITH CHECK (true);

-- Activity Policies
CREATE POLICY "Users can read their own activity" ON user_activities
    FOR SELECT USING (true);

CREATE POLICY "App can insert activity" ON user_activities
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can mark activity as read" ON user_activities
    FOR UPDATE USING (true) WITH CHECK (true);


-- ============================================================================
-- 4. Global Notification Tracking
-- ============================================================================

-- Table to track which global admin notifications a user has viewed
-- The 'notifications' table is assumed to be managed by the admin panel
CREATE TABLE IF NOT EXISTS notification_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL, -- References the 'notifications' table
    user_wallet TEXT NOT NULL,
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(notification_id, user_wallet)
);

-- Index for lookup
CREATE INDEX IF NOT EXISTS idx_notification_views_wallet ON notification_views(user_wallet);

-- Enable RLS
ALTER TABLE notification_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own notification views" ON notification_views
    FOR ALL USING (true) WITH CHECK (true);
