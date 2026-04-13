/**
 * Cloud Session Service
 *
 * Handles session management using Supabase.
 *
 * NOTE: The 'sessions' table does not exist yet in Supabase.
 * All methods gracefully no-op until the table is created.
 * To enable, create the table with this SQL:
 *
 *   CREATE TABLE public.sessions (
 *     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     wallet_address TEXT NOT NULL,
 *     device_id TEXT NOT NULL,
 *     device_name TEXT,
 *     platform TEXT,
 *     ip_address TEXT,
 *     location TEXT,
 *     is_active BOOLEAN DEFAULT true,
 *     last_active_at TIMESTAMPTZ DEFAULT now(),
 *     created_at TIMESTAMPTZ DEFAULT now(),
 *     updated_at TIMESTAMPTZ DEFAULT now(),
 *     UNIQUE(wallet_address, device_id)
 *   );
 *
 * Then set SESSIONS_TABLE_ENABLED = true below.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { CloudSession, SessionMetadata } from '../types/session';

const SESSIONS_TABLE_ENABLED = true;

class CloudSessionService {
    private tableName = 'sessions';

    async registerSession(
        supabase: SupabaseClient,
        walletAddress: string,
        metadata: SessionMetadata
    ): Promise<CloudSession | null> {
        if (!SESSIONS_TABLE_ENABLED) return null;
        try {
            const now = new Date().toISOString();
            const { data, error } = await supabase
                .from(this.tableName)
                .upsert({
                    wallet_address: walletAddress.toLowerCase(),
                    device_id: metadata.device_id,
                    device_name: metadata.device_name,
                    platform: metadata.platform,
                    ip_address: metadata.ip_address,
                    location: metadata.location,
                    is_active: true,
                    last_active_at: now,
                    updated_at: now
                }, {
                    onConflict: 'wallet_address,device_id'
                })
                .select()
                .single();

            if (error) throw error;
            return data as CloudSession;
        } catch (error: any) {
            if (error?.message?.includes('Network request failed')) {
                console.warn('[CloudSessionService] Network unreachable.');
            } else {
                console.warn('[CloudSessionService] Register skipped:', error?.message);
            }
            return null;
        }
    }

    async terminateSession(
        supabase: SupabaseClient,
        sessionId: string
    ): Promise<boolean> {
        if (!SESSIONS_TABLE_ENABLED) return true;
        try {
            const { error } = await supabase
                .from(this.tableName)
                .update({ is_active: false, updated_at: new Date().toISOString() })
                .eq('id', sessionId);

            if (error) throw error;
            return true;
        } catch (error: any) {
            console.warn('[CloudSessionService] Terminate skipped:', error?.message);
            return false;
        }
    }

    async terminateAllOtherSessions(
        supabase: SupabaseClient,
        walletAddress: string,
        currentDeviceId: string
    ): Promise<boolean> {
        if (!SESSIONS_TABLE_ENABLED) return true;
        try {
            const { error } = await supabase
                .from(this.tableName)
                .update({ is_active: false, updated_at: new Date().toISOString() })
                .eq('wallet_address', walletAddress.toLowerCase())
                .not('device_id', 'eq', currentDeviceId);

            if (error) throw error;
            return true;
        } catch (error: any) {
            console.warn('[CloudSessionService] Terminate All skipped:', error?.message);
            return false;
        }
    }

    async getSessions(
        supabase: SupabaseClient,
        walletAddress: string
    ): Promise<CloudSession[]> {
        if (!SESSIONS_TABLE_ENABLED) return [];
        try {
            const { data, error } = await supabase
                .from(this.tableName)
                .select('*')
                .eq('wallet_address', walletAddress.toLowerCase())
                .order('last_active_at', { ascending: false });

            if (error) throw error;
            return (data as CloudSession[]) || [];
        } catch (error: any) {
            console.warn('[CloudSessionService] Fetch skipped:', error?.message);
            return [];
        }
    }

    async isSessionAuthorized(
        _supabase: SupabaseClient,
        _walletAddress: string,
        _deviceId: string
    ): Promise<boolean> {
        if (!SESSIONS_TABLE_ENABLED) return true;
        try {
            const { data, error } = await _supabase
                .from(this.tableName)
                .select('is_active')
                .eq('wallet_address', _walletAddress.toLowerCase())
                .eq('device_id', _deviceId)
                .single();

            if (error || !data) return false;
            return data.is_active;
        } catch (error) {
            return true;
        }
    }
}

export const cloudSessionService = new CloudSessionService();
