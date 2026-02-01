/**
 * Cloud Session Service
 * 
 * Handles industrial-grade session management using Supabase.
 * This service is designed to be portable to a Next.js backend.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { CloudSession, SessionMetadata } from '../types/session';

class CloudSessionService {
    private tableName = 'sessions';

    /**
     * Registers a new session or updates an existing one in the cloud.
     * @param supabase The Supabase client (injectable for portability)
     * @param walletAddress The identifying wallet address
     * @param metadata Device and location information
     */
    async registerSession(
        supabase: SupabaseClient,
        walletAddress: string,
        metadata: SessionMetadata
    ): Promise<CloudSession | null> {
        try {
            const now = new Date().toISOString();

            // Upsert the session based on wallet_address and device_id
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
        } catch (error) {
            console.error('[CloudSessionService] Register Error:', error);
            return null;
        }
    }

    /**
     * Terminate a specific session remotely.
     */
    async terminateSession(
        supabase: SupabaseClient,
        sessionId: string
    ): Promise<boolean> {
        try {
            const { error } = await supabase
                .from(this.tableName)
                .update({ is_active: false, updated_at: new Date().toISOString() })
                .eq('id', sessionId);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('[CloudSessionService] Terminate Error:', error);
            return false;
        }
    }

    /**
     * Terminate all other sessions for a specific wallet.
     */
    async terminateAllOtherSessions(
        supabase: SupabaseClient,
        walletAddress: string,
        currentDeviceId: string
    ): Promise<boolean> {
        try {
            const { error } = await supabase
                .from(this.tableName)
                .update({ is_active: false, updated_at: new Date().toISOString() })
                .eq('wallet_address', walletAddress.toLowerCase())
                .not('device_id', 'eq', currentDeviceId);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('[CloudSessionService] Terminate All Error:', error);
            return false;
        }
    }

    /**
     * Fetches all sessions for a wallet, sorted by activity.
     */
    async getSessions(
        supabase: SupabaseClient,
        walletAddress: string
    ): Promise<CloudSession[]> {
        try {
            const { data, error } = await supabase
                .from(this.tableName)
                .select('*')
                .eq('wallet_address', walletAddress.toLowerCase())
                .order('last_active_at', { ascending: false });

            if (error) throw error;
            return (data as CloudSession[]) || [];
        } catch (error) {
            console.error('[CloudSessionService] Fetch Error:', error);
            return [];
        }
    }

    /**
     * Checks if a specific session is still authorized (the "Kill Switch").
     */
    async isSessionAuthorized(
        supabase: SupabaseClient,
        walletAddress: string,
        deviceId: string
    ): Promise<boolean> {
        try {
            const { data, error } = await supabase
                .from(this.tableName)
                .select('is_active')
                .eq('wallet_address', walletAddress.toLowerCase())
                .eq('device_id', deviceId)
                .single();

            if (error || !data) return false;
            return data.is_active;
        } catch (error) {
            return true;
        }
    }
}

export const cloudSessionService = new CloudSessionService();
