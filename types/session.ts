/**
 * Cloud Session Types
 * 
 * These types define the structure of the session tracking data in Supabase.
 * Designed to be portable between React Native and Next.js.
 */

export interface CloudSession {
    id: string;              // UUID from Supabase
    wallet_address: string;  // The primary owner of the session
    device_id: string;       // Unique hardware fingerprint (expo-device)
    device_name: string;     // e.g. "iPhone 15 Pro"
    platform: 'ios' | 'android' | 'web';
    ip_address: string;
    location: string;
    is_active: boolean;      // The "Kill Switch" flag
    last_active_at: string;  // ISO Timestamp
    created_at: string;      // ISO Timestamp
    updated_at: string;      // ISO Timestamp
}

export interface SessionMetadata {
    device_id: string;
    device_name: string;
    platform: 'ios' | 'android' | 'web';
    ip_address: string;
    location: string;
}
