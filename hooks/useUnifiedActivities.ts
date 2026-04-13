import { activityService, ActivityType, UserActivity } from '@/services/activityService';
import { api } from '@/lib/mobile/api-client';
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
                return [];
            }

            try {
                // 1. Fetch Global Transactions (Swaps, Transfers, etc.)
                const globalPromise = api.wallet.transactions({
                    address: activeAddress,
                    limit,
                }).catch(err => {
                    console.error('[useUnifiedActivities] Global transactions fetch failed:', err);
                    return { transactions: [] };
                });

                // 2. Fetch NFTs Activity (Flattened)
                const fetchNFTActivityData = async () => {
                    try {
                        const response = await api.nfts.list({ address: activeAddress });
                        const nfts = response.nfts || [];
                        if (nfts.length === 0) return [];

                        // Parallel fetch activities for EACH NFT
                        const nftActivityPromises = nfts.map(nft =>
                            api.nfts.get(activeAddress, nft.contractAddress, nft.tokenId).then(res => ({
                                nft,
                                activities: (res as any).activities || []
                            })).catch(err => {
                                console.warn(`[useUnifiedActivities] Failed for NFT ${nft.contractAddress}:`, err);
                                return { nft, activities: [] };
                            })
                        );

                        return await Promise.all(nftActivityPromises);
                    } catch (err: any) {
                        // Suppress 404 errors as they usually mean the endpoint isn't implemented or no NFTs found
                        if (err?.message?.includes('404')) {
                            console.warn('[useUnifiedActivities] NFT activity endpoint not found (404)');
                        } else {
                            console.error('[useUnifiedActivities] NFT activity fetch failed:', err);
                        }
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
                const mappedGlobal: UnifiedActivity[] = ((globalData as any).transactions || []).map((tx: any) => ({
                    id: tx.id || tx.hash || Math.random().toString(),
                    type: 'transaction',
                    category: tx.type || 'Transaction',
                    title: tx.type === 'Swap' ? `Swapped ${tx.tokenSymbol}` : `${tx.type} ${tx.tokenSymbol || ''}`,
                    message: `${tx.type || 'Activity'} transaction on chain ${tx.chainId || ''}`,
                    timestamp: tx.timestamp ? new Date(tx.timestamp).getTime() : Date.now(),
                    date: tx.timestamp ? new Date(tx.timestamp).toLocaleDateString() : '',
                    amount: tx.amountFormatted || tx.amount,
                    tokenSymbol: tx.tokenSymbol,
                    usdValue: tx.usdValue,
                    status: tx.status || 'completed',
                    isLocal: false,
                    hash: tx.hash,
                    chainId: tx.chainId
                }));

                // Map NFT Activities (Flattened)
                const mappedNFT: UnifiedActivity[] = nftActivityData.flatMap(({ nft, activities }) =>
                    activities.map((act: any) => ({
                        id: `nft-${nft.contractAddress}-${nft.tokenId}-${act.timestamp}`,
                        type: 'transaction',
                        category: act.type?.charAt(0).toUpperCase() + act.type?.slice(1) || 'NFT Activity',
                        title: `${(act.type || '').toUpperCase()} ${nft.name || 'NFT'}`,
                        message: `${nft.name || 'NFT'} activity`,
                        timestamp: act.timestamp ? new Date(act.timestamp).getTime() : Date.now(),
                        date: act.date || (act.timestamp ? new Date(act.timestamp).toLocaleDateString() : ''),
                        amount: act.price || '0',
                        tokenSymbol: nft.name || 'NFT',
                        usdValue: act.usdValue || act.priceUSD || '$0.00',
                        status: 'completed',
                        isLocal: false,
                        hash: act.transactionHash || act.hash,
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

                // Interleave, deduplicate by id, and sort
                const all = [...mappedGlobal, ...mappedNFT, ...mappedLocal];
                const seen = new Set<string>();
                const deduped = all.filter(item => {
                    if (seen.has(item.id)) return false;
                    seen.add(item.id);
                    return true;
                });
                return deduped.sort((a, b) => b.timestamp - a.timestamp);
            } catch (error) {
                console.error('[useUnifiedActivities] Unification critical failure:', error);
                return [];
            }

        },
        enabled: !!activeAddress,
        staleTime: 10000,
    });
}
