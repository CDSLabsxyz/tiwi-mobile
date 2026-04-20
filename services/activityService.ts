import { supabase } from '@/lib/supabase';
import type { PostgrestResponse } from '@supabase/supabase-js';
import { notificationService } from './notificationService';

export type ActivityType = 'transaction' | 'reward' | 'governance' | 'security' | 'system';

export interface UserActivity {
    id?: string;
    user_wallet: string;
    type: ActivityType;
    category: string;
    title: string;
    message: string;
    metadata?: Record<string, any>;
    is_read?: boolean;
    created_at?: string;
}

/**
 * Maps to tiwi_transactions table columns:
 * id, wallet_address, transaction_hash, chain_id, transaction_type,
 * from_token_address, from_token_symbol, to_token_address, to_token_symbol,
 * amount, amount_formatted, usd_value, router_name, created_at,
 * block_number, block_timestamp, recipient_address
 */
interface TransactionRow {
    wallet_address: string;
    transaction_hash: string;
    chain_id: number;
    transaction_type: string;
    from_token_address?: string;
    from_token_symbol?: string;
    to_token_address?: string;
    to_token_symbol?: string;
    amount?: string;
    amount_formatted?: string;
    usd_value?: number;
    router_name?: string;
    recipient_address?: string;
}

class ActivityService {
    private readonly TABLE_NAME = 'tiwi_transactions';

    /**
     * Log a transaction to Supabase tiwi_transactions table
     */
    async logActivity(activity: UserActivity): Promise<boolean> {
        try {
            const meta = activity.metadata || {};

            // Normalize transaction_type to match DB check constraint (capitalized: Swap, Sent, Received, etc.)
            const rawType = (activity.category || activity.type || 'Transaction').toLowerCase();
            const typeMap: Record<string, string> = {
                'swap': 'Swap',
                'sent': 'Sent',
                'send': 'Sent',
                'received': 'Received',
                'receive': 'Received',
                'stake': 'Stake',
                'unstake': 'Unstake',
                'approve': 'Approve',
                // Claim / Harvest = user receiving reward tokens. Mapped to
                // 'Received' so the DB check constraint + UI filters treat
                // them as incoming TWC instead of silently falling through
                // to 'Swap' (the default below), which mislabels the row.
                'claim': 'Received',
                'harvest': 'Received',
                'transfer': 'Transfer',
                'mint': 'Mint',
                'burn': 'Burn',
                'transaction': 'Swap',
            };
            const transactionType = typeMap[rawType] || 'Swap';

            // Skip insert if no transaction_hash (the table requires it)
            const txHash = meta.txHash || meta.transaction_hash;
            if (!txHash) {
                return false;
            }

            const payload: TransactionRow = {
                wallet_address: activity.user_wallet.toLowerCase(),
                transaction_hash: txHash,
                chain_id: meta.chainId || meta.chain_id || 1,
                transaction_type: transactionType,
                from_token_address: meta.fromTokenAddress || meta.from_token_address,
                from_token_symbol: meta.fromSymbol || meta.symbol,
                to_token_address: meta.toTokenAddress || meta.to_token_address,
                to_token_symbol: meta.toSymbol,
                amount: meta.amount?.toString(),
                amount_formatted: meta.amountFormatted || meta.amount_formatted,
                usd_value: meta.usdValue ? parseFloat(meta.usdValue) : undefined,
                router_name: meta.routerName || meta.router_name,
                recipient_address: meta.recipientAddress || meta.recipient_address,
            };

            const { error } = await supabase
                .from(this.TABLE_NAME)
                .upsert([payload], { onConflict: 'transaction_hash,chain_id', ignoreDuplicates: true });

            if (error) throw error;
            return true;
        } catch (error: any) {
            // Duplicate key — transaction already logged, not an error
            if (error?.code === '23505' || error?.message?.includes('duplicate key')) {
                return true;
            }
            if (error?.message?.includes('Network request failed')) {
                console.warn('[ActivityService] Log: Network unreachable.');
            } else {
                console.error('[ActivityService] Exception logging activity:', error);
            }
            return false;
        }
    }

    /**
     * Fetch activities for a specific wallet from tiwi_transactions
     */
    async getActivities(walletAddress: string, limit = 20): Promise<UserActivity[]> {
        try {
            const { data, error } = await supabase
                .from(this.TABLE_NAME)
                .select('*')
                .eq('wallet_address', walletAddress.toLowerCase())
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;

            // Map tiwi_transactions rows to UserActivity format for UI consumption
            return (data || []).map((row: any) => ({
                id: row.id,
                user_wallet: row.wallet_address,
                type: 'transaction' as ActivityType,
                category: row.transaction_type || 'unknown',
                title: buildTitle(row),
                message: buildMessage(row),
                metadata: {
                    txHash: row.transaction_hash,
                    chainId: row.chain_id,
                    fromTokenAddress: row.from_token_address,
                    symbol: row.from_token_symbol,
                    toTokenAddress: row.to_token_address,
                    toSymbol: row.to_token_symbol,
                    amount: row.amount_formatted || row.amount,
                    usdValue: row.usd_value,
                    routerName: row.router_name,
                    recipientAddress: row.recipient_address,
                    blockNumber: row.block_number,
                },
                is_read: true, // no is_read column in tiwi_transactions
                created_at: row.created_at,
            }));
        } catch (error: any) {
            if (error?.message?.includes('Network request failed')) {
                console.warn('[ActivityService] Fetch: Network unreachable.');
            } else {
                console.error('[ActivityService] Exception fetching activities:', error);
            }
            return [];
        }
    }

    /**
     * Mark as read — no-op (tiwi_transactions has no is_read column)
     */
    async markAsRead(_activityId: string): Promise<boolean> {
        return true;
    }

    /**
     * Mark all as read — no-op (tiwi_transactions has no is_read column)
     */
    async markAllAsRead(_walletAddress: string): Promise<boolean> {
        return true;
    }

    /**
     * Helper: Log a transaction activity
     */
    async logTransaction(
        walletAddress: string,
        txType: string,
        title: string,
        message: string,
        txHash?: string,
        metadata: Record<string, any> = {}
    ): Promise<boolean> {
        // Fire local push notification for transaction events
        const notifType = txType === 'swap' ? 'swap'
            : txType === 'received' ? 'received'
            : txType === 'sent' ? 'sent'
            : txType === 'failed' ? 'failed'
            : txType === 'confirmed' ? 'confirmed'
            : null;

        if (notifType) {
            notificationService.sendTransactionNotification(notifType, {
                symbol: metadata?.symbol,
                amount: metadata?.amount,
                txHash,
            });
        }

        return this.logActivity({
            user_wallet: walletAddress,
            type: 'transaction',
            category: txType,
            title,
            message,
            metadata: { ...metadata, txHash }
        });
    }

    /**
     * Helper: Log a security activity — no-op for tiwi_transactions
     * Security events don't fit the transaction schema
     */
    async logSecurityEvent(
        _walletAddress: string,
        _event: string,
        _title: string,
        _message: string,
        _metadata: Record<string, any> = {}
    ): Promise<boolean> {
        return true;
    }
}

/** Build a human-readable title from a transaction row */
function buildTitle(row: any): string {
    const type = row.transaction_type || 'Transaction';
    const symbol = row.from_token_symbol || '';
    const typeCap = type.charAt(0).toUpperCase() + type.slice(1);
    return symbol ? `${typeCap} ${symbol}` : typeCap;
}

/** Build a human-readable message from a transaction row */
function buildMessage(row: any): string {
    const amount = row.amount_formatted || row.amount || '';
    const from = row.from_token_symbol || '';
    const to = row.to_token_symbol || '';

    if (row.transaction_type === 'swap' && from && to) {
        return `Swapped ${amount ? amount + ' ' : ''}${from} → ${to}`;
    }
    if (amount && from) {
        return `${amount} ${from}`;
    }
    return row.transaction_hash ? `TX: ${row.transaction_hash.slice(0, 10)}...` : 'Transaction recorded';
}

export const activityService = new ActivityService();
