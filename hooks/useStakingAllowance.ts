import { stakingService } from '@/services/stakingService';
import { useWalletStore } from '@/store/walletStore';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useStakingAllowance - High-frequency polling for ERC20 allowance.
 * Crucial for the "Fast-Flow" UX where the button updates immediately after approval.
 *
 * IMPORTANT: pass the CORRECT `spenderAddress`. For V2 per-pool contracts
 * that's the pool contract itself (the pool does `transferFrom` during
 * deposit). For legacy factory-style pools it's the factory. Omitting the
 * spender falls back to the legacy factory, which will silently report
 * the wrong allowance for V2 pools and cause deposits to revert with
 * empty data when the token's `transferFrom` fails.
 */
export function useStakingAllowance(
    tokenAddress?: string,
    spenderAddress?: string,
    decimals: number = 9,
) {
    const { address: walletAddress } = useWalletStore();
    const [allowance, setAllowance] = useState<bigint>(BigInt(0));
    const [isPolling, setIsPolling] = useState(false);
    const pollTimerRef = useRef<any>(null);

    const fetchAllowance = useCallback(async () => {
        if (!tokenAddress || !walletAddress) return;

        try {
            const latestAllowance = await stakingService.getAllowance(
                tokenAddress,
                walletAddress,
                spenderAddress,
            );
            setAllowance(latestAllowance);
        } catch (error) {
            console.error('[useStakingAllowance] Polling error:', error);
        }
    }, [tokenAddress, walletAddress, spenderAddress]);

    // Fast-Flow polling effect (2000ms)
    useEffect(() => {
        if (!tokenAddress || !walletAddress || !isPolling) {
            if (pollTimerRef.current) {
                clearInterval(pollTimerRef.current);
                pollTimerRef.current = null;
            }
            return;
        }

        // Initial fetch
        fetchAllowance();

        // Start high-frequency interval (2s is a good balance for "Fast-Flow" without 429 errors)
        pollTimerRef.current = setInterval(fetchAllowance, 2000);

        return () => {
            if (pollTimerRef.current) {
                clearInterval(pollTimerRef.current);
            }
        };
    }, [tokenAddress, walletAddress, isPolling, fetchAllowance]);

    return {
        allowance,
        startPolling: () => setIsPolling(true),
        stopPolling: () => setIsPolling(false),
        refetch: fetchAllowance
    };
}
