/**
 * Back-fills activity rows whose stored amount is 0 or missing by reading
 * the corresponding tx receipt on-chain. Covers Received (incoming), Sent
 * (outgoing), and Swap (takes the output leg = what the user actually got).
 * Results are cached by hash so repeated renders stay cheap.
 *
 * Returns a map keyed by `${chainId}:${hash.toLowerCase()}` so the
 * consumer can overlay the on-chain truth onto each row at render time.
 */

import { useEffect, useState } from 'react';
import type { UnifiedActivity } from '@/hooks/useUnifiedActivities';
import { resolveReceivedAmount, type ReceivedAmountResult, type TxDirection } from '@/services/receivedAmountResolver';

export type ResolvedReceivedMap = Record<string, ReceivedAmountResult | null>;

function directionFor(item: UnifiedActivity): TxDirection | null {
    const cat = (item.category || '').toLowerCase();
    const title = (item.title || '').toLowerCase();
    if (cat === 'received' || cat === 'receive' || title.includes('received')) return 'received';
    // Swaps show the output token (what the user got) — same side as a receive.
    if (cat === 'swap' || title.includes('swapped')) return 'received';
    if (cat === 'sent' || cat === 'send' || cat === 'transfer' || title.includes('sent')) return 'sent';
    return null;
}

function needsResolve(item: UnifiedActivity): boolean {
    if (!directionFor(item)) return false;
    if (!item.hash || !item.chainId) return false;
    // Always resolve — loggers are inconsistent about what they store
    // (some write the input amount for a swap, some write 0, some omit the
    // symbol entirely). Pulling the receipt is cheap (cached by hash) and
    // ground-truth; the render site decides whether to prefer on-chain
    // over stored.
    return true;
}

export function useResolvedReceivedAmounts(
    activities: UnifiedActivity[],
    userAddress: string | null | undefined,
): ResolvedReceivedMap {
    const [resolved, setResolved] = useState<ResolvedReceivedMap>({});

    useEffect(() => {
        if (!userAddress) return;
        const targets = activities.filter(needsResolve);
        if (targets.length === 0) return;

        let cancelled = false;
        const pending: Promise<void>[] = [];

        for (const item of targets) {
            const direction = directionFor(item)!;
            const key = `${item.chainId}:${item.hash!.toLowerCase()}:${direction}`;
            if (resolved[key] !== undefined) continue;

            pending.push(
                resolveReceivedAmount({
                    hash: item.hash!,
                    chainId: item.chainId!,
                    userAddress,
                    direction,
                })
                    .then((res) => {
                        if (cancelled) return;
                        setResolved((prev) => ({ ...prev, [key]: res }));
                    })
                    .catch(() => { /* resolver already warns internally */ })
            );
        }

        return () => { cancelled = true; };
    }, [activities, userAddress, resolved]);

    return resolved;
}
