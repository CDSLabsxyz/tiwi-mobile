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
                const mappedGlobal: UnifiedActivity[] = ((globalData as any).transactions || []).map((tx: any) => {
                    const txHash = tx.hash || tx.transactionHash || tx.transaction_hash || tx.id;
                    
                    // If the backend returned a row where WE are the recipient, the sender probably 
                    // logged it as "Sent" from their end. We must treat it as "Received" here.
                    const lowerActive = activeAddress?.toLowerCase() || '';
                    const isRecipient = lowerActive && (
                        (tx.recipient_address?.toLowerCase() === lowerActive) || 
                        (tx.recipientAddress?.toLowerCase() === lowerActive) ||
                        (tx.to?.toLowerCase() === lowerActive) ||
                        (tx.to_address?.toLowerCase() === lowerActive)
                    );
                    
                    let resolvedType = tx.type || 'Transaction';
                    if (isRecipient && (resolvedType === 'Sent' || resolvedType === 'Send' || resolvedType === 'Transfer')) {
                        resolvedType = 'Received';
                    }
                    
                    // Carry the counterparty address through the mapping so
                    // the receipt viewer on past Sent rows has a recipient to
                    // show. Local rows already flow `metadata` through below.
                    const recipientAddr = tx.recipient_address || tx.recipientAddress || tx.to || tx.to_address;
                    const senderAddr = tx.sender_address || tx.senderAddress || tx.from || tx.from_address;

                    return {
                        id: tx.id || txHash || Math.random().toString(),
                        type: 'transaction',
                        category: resolvedType,
                        title: resolvedType === 'Swap' ? `Swapped ${tx.tokenSymbol || ''}`.trim() : `${resolvedType} ${tx.tokenSymbol || ''}`.trim(),
                        message: `${resolvedType} transaction on chain ${tx.chainId || '56'}`,
                        timestamp: tx.timestamp ? new Date(tx.timestamp).getTime() : Date.now(),
                        date: tx.timestamp ? new Date(tx.timestamp).toLocaleDateString() : '',
                        amount: tx.amountFormatted || tx.amount,
                        tokenSymbol: tx.tokenSymbol,
                        usdValue: tx.usdValue,
                        status: tx.status || 'completed',
                        isLocal: false,
                        hash: txHash,
                        chainId: tx.chainId || 56, // Fallback to BNB chain if indexer omits it so on-chain resolution triggers!
                        metadata: {
                            recipientAddress: recipientAddr,
                            senderAddress: senderAddr,
                        },
                    };
                });

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

                // Map Local Activities. The local rows stash amount/symbol
                // inside `metadata` (see activityService.logTransaction call
                // sites), so pull them out here — otherwise the row renders
                // "0" even though the equivalent global entry has the amount.
                const mappedLocal: UnifiedActivity[] = localData.map(act => {
                    const meta: any = act.metadata || {};
                    return {
                        id: act.id || Math.random().toString(),
                        type: act.type,
                        category: act.category,
                        title: act.title,
                        message: act.message,
                        timestamp: act.created_at ? new Date(act.created_at).getTime() : Date.now(),
                        date: act.created_at ? new Date(act.created_at).toLocaleDateString() : '',
                        amount: meta.amount ?? meta.amountFormatted,
                        tokenSymbol: meta.symbol ?? meta.tokenSymbol,
                        status: 'completed',
                        isLocal: true,
                        is_read: act.is_read,
                        // activityService persists the tx hash under
                        // metadata.txHash (see logActivity). Also check
                        // `transaction_hash` / `transactionHash` for
                        // resilience if the shape ever changes.
                        hash: (act as any).transactionHash
                            || (act as any).hash
                            || meta.txHash
                            || meta.transactionHash
                            || meta.transaction_hash,
                        chainId: (act as any).chainId || meta.chainId || meta.chain_id,
                        metadata: act.metadata,
                    };
                });

                // Interleave, then collapse entries that describe the same
                // transaction. The global log and local log assign different
                // `id`s for the same on-chain tx, so we dedupe on `hash` (when
                // present) and keep the richer record — prefer the one that
                // actually carries an amount so the list never shows "0".
                const all = [...mappedGlobal, ...mappedNFT, ...mappedLocal];
                const byHash = new Map<string, UnifiedActivity>();
                const byId = new Set<string>();
                const deduped: UnifiedActivity[] = [];
                const amountValue = (raw: unknown) => {
                    if (!raw) return 0;
                    // parseFloat (not Number) so pre-formatted strings like
                    // "1000000 TWC" still register as having a real amount.
                    const str = String(raw).trim();
                    if (str === '' || str === '0') return 0;
                    const n = parseFloat(str);
                    return Number.isFinite(n) ? n : 0;
                };

                // Pre-filter: drop any item that is a "Swap" with 0 amount entirely
                const validActivityItems = all.filter(item => {
                    const cat = (item.category || '').toLowerCase();
                    const isSwap = cat === 'swap' || (item.title || '').toLowerCase().includes('swapped');
                    const hasAmount = amountValue(item.amount) > 0 || parseFloat(String(item.usdValue || '0').replace(/[^0-9.-]+/g,"")) > 0;
                    if (isSwap && !hasAmount) {
                        return false; // drop empty swaps completely
                    }
                    return true;
                });

                for (const item of validActivityItems) {
                    const hash = (item as any).hash?.toLowerCase();
                    if (hash) {
                        const existing = byHash.get(hash);
                        const itemHasAmount = amountValue(item.amount) > 0;
                        const existingHasAmount = existing ? amountValue(existing.amount) > 0 : false;
                        if (!existing) {
                            byHash.set(hash, item);
                            deduped.push(item);
                        } else if (itemHasAmount && !existingHasAmount) {
                            const idx = deduped.indexOf(existing!);
                            if (idx >= 0) deduped[idx] = item;
                            byHash.set(hash, item);
                        }
                        continue;
                    }
                    if (byId.has(item.id)) continue;
                    byId.add(item.id);
                    deduped.push(item);
                }
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
