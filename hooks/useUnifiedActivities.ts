import { activityService, ActivityType, UserActivity } from '@/services/activityService';
import { apiClient } from '@/services/apiClient';
import { useWalletStore } from '@/store/walletStore';
import { useQuery } from '@tanstack/react-query';

export interface UnifiedActivity extends Partial<UserActivity> {
    id: string;
    type: ActivityType;
    category: string;
    title: string;
    message: string;
    timestamp: number;
    date: string;
    amount?: string;
    tokenSymbol?: string;
    usdValue?: string;
    status: 'completed' | 'pending' | 'failed';
    isLocal?: boolean;
    hash?: string;
    chainId?: number;
}

/**
 * Hook to fetch and unify activities from both local Supabase and Global Tiwi API
 */
export function useUnifiedActivities(limit = 100) {
    const { activeAddress } = useWalletStore();

    return useQuery({
        queryKey: ['unifiedActivities', activeAddress, limit],
        queryFn: async (): Promise<UnifiedActivity[]> => {
            if (!activeAddress) {
                console.log('[useUnifiedActivities] No active address found, skipping fetch');
                return [];
            }

            try {
                // 1. Fetch Global Transactions (Swaps, Transfers, etc.)
                const globalPromise = apiClient.getTransactionHistory({
                    address: activeAddress,
                    limit,
                }).catch(err => {
                    console.error('[useUnifiedActivities] Global transactions fetch failed:', err);
                    return { transactions: [] };
                });

                // 2. Fetch NFT Activities (Mints, Sales, Transfers)
                const nftPromise = apiClient.getNFTActivities({
                    address: activeAddress,
                    limit,
                }).catch(err => {
                    console.error('[useUnifiedActivities] NFT activities fetch failed:', err);
                    return { activities: [] };
                });

                // 3. Fetch Local Activities (Rewards, Security Notifications from Supabase)
                const localPromise = activityService.getActivities(activeAddress, limit).catch(err => {
                    console.error('[useUnifiedActivities] Local activities fetch failed:', err);
                    return [];
                });

                const [globalData, nftData, localData] = await Promise.all([
                    globalPromise,
                    nftPromise,
                    localPromise
                ]);

                // Map Global Transactions
                const mappedGlobal: UnifiedActivity[] = (globalData.transactions || []).map(tx => ({
                    id: tx.id,
                    type: 'transaction',
                    category: tx.type, // "Swap", "Sent", "Received", "Stake", etc.
                    title: tx.type === 'Swap' ? `Swapped ${tx.tokenSymbol}` : `${tx.type} ${tx.tokenSymbol}`,
                    message: `${tx.type} transaction on chain ${tx.chainId}`,
                    timestamp: tx.timestamp,
                    date: new Date(tx.timestamp).toLocaleDateString(),
                    amount: tx.amountFormatted,
                    tokenSymbol: tx.tokenSymbol,
                    usdValue: tx.usdValue,
                    status: tx.status,
                    isLocal: false,
                    hash: tx.hash,
                    chainId: tx.chainId
                }));

                // Map NFT Activities
                const mappedNFT: UnifiedActivity[] = (nftData.activities || []).map(nft => ({
                    id: nft.id,
                    type: 'transaction',
                    category: nft.type, // "Mint", "Sale", "Listing", "NFT_Transfer", etc.
                    title: `${nft.type} NFT`,
                    message: `${nft.tokenSymbol || 'NFT'} activity`,
                    timestamp: nft.timestamp,
                    date: new Date(nft.timestamp).toLocaleDateString(),
                    amount: nft.amountFormatted,
                    tokenSymbol: nft.tokenSymbol,
                    usdValue: nft.usdValue,
                    status: nft.status,
                    isLocal: false,
                    hash: nft.hash,
                    chainId: nft.chainId
                }));

                // Map Local Activities
                const mappedLocal: UnifiedActivity[] = localData.map(act => ({
                    id: act.id || Math.random().toString(),
                    type: act.type,
                    category: act.category,
                    title: act.title,
                    message: act.message,
                    timestamp: act.created_at ? new Date(act.created_at).getTime() : Date.now(),
                    date: act.created_at ? new Date(act.created_at).toLocaleDateString() : '',
                    status: 'completed',
                    isLocal: true,
                    is_read: act.is_read,
                    metadata: act.metadata
                }));

                // Interleave and sort by newest first
                return [...mappedGlobal, ...mappedNFT, ...mappedLocal].sort((a, b) => b.timestamp - a.timestamp);
            } catch (error) {
                console.error('[useUnifiedActivities] Unification critical failure:', error);
                return [];
            }
        },
        enabled: !!activeAddress,
        staleTime: 10000,
    });
}
