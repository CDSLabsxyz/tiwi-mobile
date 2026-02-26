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

                // 2. Fetch NFTs first, then their activities (following super-app pattern)
                const fetchNFTActivityData = async () => {
                    try {
                        const nfts = await apiClient.getNFTs(activeAddress);
                        if (!nfts || nfts.length === 0) return [];

                        // Parallel fetch activities for EACH NFT (singular endpoint requires contractAddress/tokenId)
                        const nftActivityPromises = nfts.map(nft =>
                            apiClient.getNFTActivity({
                                address: activeAddress,
                                chainId: nft.chainId,
                                contractAddress: nft.contractAddress,
                                tokenId: nft.tokenId,
                                limit: 10,
                            }).then(res => ({
                                nft,
                                activities: res.activities || []
                            })).catch(err => {
                                console.warn(`[useUnifiedActivities] Failed for NFT ${nft.contractAddress}:`, err);
                                return { nft, activities: [] };
                            })
                        );

                        return await Promise.all(nftActivityPromises);
                    } catch (err) {
                        console.error('[useUnifiedActivities] NFT list fetch failed:', err);
                        return [];
                    }
                };

                // 3. Fetch Local Activities (Supabase)
                const localPromise = activityService.getActivities(activeAddress, limit).catch(err => {
                    console.error('[useUnifiedActivities] Local activities fetch failed:', err);
                    return [];
                });

                const [globalData, nftActivityData, localData] = await Promise.all([
                    globalPromise,
                    fetchNFTActivityData(),
                    localPromise
                ]);

                // Map Global Transactions
                const mappedGlobal: UnifiedActivity[] = (globalData.transactions || []).map(tx => ({
                    id: tx.id,
                    type: 'transaction',
                    category: tx.type,
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

                // Map NFT Activities (Flattened)
                const mappedNFT: UnifiedActivity[] = nftActivityData.flatMap(({ nft, activities }) =>
                    activities.map(act => ({
                        id: `nft-${nft.contractAddress}-${nft.tokenId}-${act.timestamp}`,
                        type: 'transaction',
                        category: act.type.charAt(0).toUpperCase() + act.type.slice(1),
                        title: `${act.type.toUpperCase()} ${nft.name || 'NFT'}`,
                        message: `${nft.name || 'NFT'} activity`,
                        timestamp: act.timestamp,
                        date: act.date || new Date(act.timestamp).toLocaleDateString(),
                        amount: act.price || '0',
                        tokenSymbol: nft.name || 'NFT',
                        usdValue: act.priceUSD || '$0.00',
                        status: 'completed',
                        isLocal: false,
                        hash: act.transactionHash,
                        chainId: nft.chainId
                    }))
                );

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

                // Interleave and sort
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
