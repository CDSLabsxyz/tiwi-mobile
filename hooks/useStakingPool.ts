import { ERC20_ABI, STAKING_FACTORY_ABI } from '@/constants/abis';
import { STAKING_FACTORY_ADDRESSES } from '@/constants/contracts';
import { currencyService } from '@/services/currencyService';
import { useToastStore } from '@/store/useToastStore';
import { formatCompactNumber } from '@/utils/formatting';
import { useCallback, useEffect, useMemo } from 'react';
import { formatUnits, parseUnits } from 'viem';
import { useAccount, useChainId, useReadContract, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { useMarketPrice } from './useMarketPrice';

export interface OnChainPoolStats {
    totalStaked: bigint | null;
    totalStakedFormatted: string;
    totalStakedCompact: string;
    userStaked: bigint | null;
    userStakedFormatted: string;
    pendingRewards: bigint | null;
    pendingRewardsFormatted: string;
    allowance: bigint | null;
    stakingToken: `0x${string}` | null;
    apr: string;
    tvlUsd: string;
    limitsFormatted: string;
    lockPeriod: string;
    isLoading: boolean;
    isTransactionPending: boolean;
    refetch: () => void;
}

const STAKING_CHAIN_ID = 56; // BSC Mainnet
const SECONDS_PER_YEAR = 31536000n;

/**
 * Hook to interact with a TIWI Staking Pool (Read & Write)
 * Enhanced with Phase 4: Protocol Polishing & Safety
 */
export function useStakingPool(poolId?: number | string, decimals: number = 9) {
    const chainId = useChainId();
    const { address } = useAccount();
    const { switchChainAsync } = useSwitchChain();
    const { showToast, hideToast } = useToastStore();
    const { data: priceData } = useMarketPrice('TWC-USDT', STAKING_CHAIN_ID);

    // Check if this is a mock pool
    const isMock = typeof poolId === 'string' && poolId.startsWith('mock');

    // Always use BSC addresses for staking logic
    const factoryAddress = STAKING_FACTORY_ADDRESSES[STAKING_CHAIN_ID];

    // --- READS ---

    const {
        data: poolInfo,
        isLoading: isPoolLoading,
        refetch: refetchPool
    } = useReadContract({
        address: factoryAddress,
        abi: STAKING_FACTORY_ABI,
        functionName: 'getPoolInfo',
        args: poolId !== undefined && !isMock ? [BigInt(poolId)] : undefined,
        query: {
            enabled: !!factoryAddress && poolId !== undefined && !isMock,
        }
    });

    const poolConfig = (poolInfo as any)?.[0];
    const poolState = (poolInfo as any)?.[1];
    const stakingToken = poolConfig?.stakingToken as `0x${string}` | undefined;

    const {
        data: userInfo,
        isLoading: isUserLoading,
        refetch: refetchUser
    } = useReadContract({
        address: factoryAddress,
        abi: STAKING_FACTORY_ABI,
        functionName: 'getUserInfo',
        args: poolId !== undefined && address && !isMock ? [BigInt(poolId), address] : undefined,
        query: {
            enabled: !!factoryAddress && poolId !== undefined && !!address && !isMock,
            refetchInterval: 10000,
        }
    });

    const {
        data: allowance,
        isLoading: isAllowanceLoading,
        refetch: refetchAllowance
    } = useReadContract({
        address: stakingToken,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: address && factoryAddress ? [address, factoryAddress] : undefined,
        query: {
            enabled: !!stakingToken && !!address && !!factoryAddress,
        }
    });

    // --- WRITES ---

    const { writeContractAsync, data: txHash, isPending: isWritePending, error: writeError, reset } = useWriteContract();

    const { isLoading: isTxWaiting, isSuccess: isTxSuccess, error: waitError } = useWaitForTransactionReceipt({
        hash: txHash,
    });

    const isTransactionPending = isWritePending || isTxWaiting;

    const refetchAll = useCallback(() => {
        refetchPool();
        refetchUser();
        refetchAllowance();
    }, [refetchPool, refetchUser, refetchAllowance]);

    // Phase 4: Auto-refresh data on transaction success
    useEffect(() => {
        if (isTxSuccess) {
            const handleLogging = async () => {
                console.log('[useStakingPool] Transaction confirmed, refreshing data and logging activity...');
                showToast('Transaction Successful!', 'success', txHash);
                refetchAll();

                // Log to backend for referral rewards
                if (txHash && address && poolId !== undefined) {
                    try {
                        const { apiClient } = require('@/services/apiClient');

                        // Determine transaction type and details
                        // We use a simplified mapping for now as we don't track the exact calling function here
                        // but we can infer 'Stake' or 'Unstake' or 'Claim' based on context if we added a state.
                        // For now, let's log it as a generic DeFi/Stake activity if we can't distinguish.
                        // IMPROVEMENT: Distinguish between stake/unstake/claim.

                        await apiClient.logTransaction({
                            walletAddress: address,
                            transactionHash: txHash,
                            chainId: STAKING_CHAIN_ID,
                            type: 'DeFi',
                            amount: '0', // Amount is handled by backend from tx receipt usually, or we could pass it
                            amountFormatted: 'Staking activity',
                            routerName: 'Tiwi Staking',
                        });
                    } catch (e) {
                        console.error('[useStakingPool] Failed to log activity:', e);
                    }
                }

                // Hide toast after 4 seconds
                setTimeout(hideToast, 4000);
            };

            handleLogging();
        }
    }, [isTxSuccess, refetchAll, showToast, hideToast, txHash, address, poolId]);

    // Handle Errors in Toast
    useEffect(() => {
        if (writeError || waitError) {
            const error = writeError || waitError;
            console.error('[useStakingPool] Transaction error:', error);

            let message = 'Transaction Failed';
            if (error?.message?.includes('User rejected')) {
                message = 'Transaction Rejected';
            } else if (error?.message?.includes('insufficient funds')) {
                message = 'Insufficient Gas';
            }

            showToast(message, 'error');
            setTimeout(hideToast, 4000);
            reset(); // Clear write state
        }
    }, [writeError, waitError, showToast, hideToast, reset]);

    // Phase 4: Network Intelligence (Ensure Correct Chain)
    const ensureCorrectChain = useCallback(async () => {
        if (chainId !== STAKING_CHAIN_ID) {
            console.log(`[useStakingPool] Switching chain from ${chainId} to ${STAKING_CHAIN_ID}`);
            showToast('Switching to BSC...', 'pending');
            try {
                await switchChainAsync({ chainId: STAKING_CHAIN_ID });
                hideToast();
            } catch (err) {
                showToast('Failed to switch network', 'error');
                setTimeout(hideToast, 3000);
                throw new Error('Please switch to BNB Smart Chain to continue.');
            }
        }
    }, [chainId, switchChainAsync, showToast, hideToast]);

    const stake = useCallback(async (amount: string) => {
        await ensureCorrectChain();
        const amountWei = parseUnits(amount, decimals);

        showToast('Confirm Staking in Wallet...', 'pending');
        const hash = await writeContractAsync({
            address: factoryAddress,
            abi: STAKING_FACTORY_ABI,
            functionName: 'deposit',
            args: [BigInt(poolId!), amountWei],
        });
        showToast('Stake/Unstake Processing...', 'confirmed', hash);
        return hash;
    }, [factoryAddress, poolId, decimals, writeContractAsync, ensureCorrectChain, showToast]);

    const unstake = useCallback(async (amount: string) => {
        await ensureCorrectChain();
        const amountWei = parseUnits(amount, decimals);

        showToast('Confirm Unstaking in Wallet...', 'pending');
        const hash = await writeContractAsync({
            address: factoryAddress,
            abi: STAKING_FACTORY_ABI,
            functionName: 'withdraw',
            args: [BigInt(poolId!), amountWei],
        });
        showToast('Stake/Unstake Processing...', 'confirmed', hash);
        return hash;
    }, [factoryAddress, poolId, decimals, writeContractAsync, ensureCorrectChain, showToast]);

    const claimRewards = useCallback(async () => {
        await ensureCorrectChain();

        showToast('Confirm Claim in Wallet...', 'pending');
        const hash = await writeContractAsync({
            address: factoryAddress,
            abi: STAKING_FACTORY_ABI,
            functionName: 'claim',
            args: [BigInt(poolId!)],
        });
        showToast('Rewards Distribution Processing...', 'confirmed', hash);
        return hash;
    }, [factoryAddress, poolId, writeContractAsync, ensureCorrectChain, showToast]);

    const approve = useCallback(async (amount?: string) => {
        await ensureCorrectChain();
        if (!stakingToken) throw new Error('Staking token not found');

        const amountWei = amount
            ? parseUnits(amount, decimals)
            : BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

        showToast('Confirm Approval in Wallet...', 'pending');
        const hash = await writeContractAsync({
            address: stakingToken,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [factoryAddress, amountWei],
        });
        showToast('Token Approval Processing...', 'confirmed', hash);
        return hash;
    }, [stakingToken, factoryAddress, decimals, writeContractAsync, ensureCorrectChain, showToast]);

    const stats: OnChainPoolStats = useMemo(() => {
        // --- MATH ENGINE ---

        const price = priceData?.priceUSD || 0;
        const totalStaked = poolState?.totalStaked || 0n;
        const userStaked = userInfo?.[0] || 0n;
        const pendingRewards = userInfo?.[3] || 0n;
        const maxTvl = poolConfig?.maxTvl || 0n;

        // Contract may provide rewardPerSecond or we calculate from poolReward/duration
        const poolReward = poolConfig?.poolReward || 0n;
        const duration = poolConfig?.rewardDurationSeconds || 0n;
        const rewardPerSec = poolConfig?.rewardPerSecond || (duration > 0n ? poolReward / duration : 0n);

        // APR Calculation Logic:
        // 1. Fixed/Conservative: Use maxTvl as denominator (Minimum Guaranteed APR)
        // 2. Flexible/Dynamic: Use totalStaked as denominator (Current Real-time APR)
        // We will default to the user's requested formula (maxTvl) but fallback to totalStaked if maxTvl is 0.

        let aprValue = '0.00%';
        if (rewardPerSec > 0n) {
            const yearlyReward = rewardPerSec * SECONDS_PER_YEAR;
            const denominator = maxTvl > 0n ? maxTvl : (totalStaked > 0n ? totalStaked : 0n);

            if (denominator > 0n) {
                const aprNum = (Number(formatUnits(yearlyReward, decimals)) / Number(formatUnits(denominator, decimals))) * 100;
                // Cap displayed APR at 99,999% to avoid UI distortion if capacity is tiny
                aprValue = aprNum > 99999 ? '> 99,999%' : `${aprNum.toFixed(2)}%`;
            }
        }

        // TVL USD: totalStaked * price
        const totalStakedNum = Number(formatUnits(totalStaked, decimals));
        const tvlUsd = currencyService.format(totalStakedNum * price, 'USD');

        const totalStakedCompact = formatCompactNumber(totalStakedNum);

        // If it's a mock pool, we provide realistic simulated data
        if (isMock) {
            return {
                totalStaked: parseUnits('213111612', decimals),
                totalStakedFormatted: '213,111,612',
                totalStakedCompact: '213M',
                userStaked: parseUnits('5000', decimals),
                userStakedFormatted: '5,000.00',
                pendingRewards: parseUnits('124.5', decimals),
                pendingRewardsFormatted: '124.50',
                allowance: BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
                stakingToken: null,
                apr: '12.45%',
                tvlUsd: '$1.4M',
                limitsFormatted: '1M - 10M TWC',
                isLoading: false,
                isTransactionPending: false,
                refetch: () => console.log('Mock refetch')
            };
        }

        return {
            totalStaked,
            totalStakedFormatted: formatUnits(totalStaked, decimals),
            totalStakedCompact: `${totalStakedCompact} TWC`,
            userStaked,
            userStakedFormatted: formatUnits(userStaked, decimals),
            pendingRewards,
            pendingRewardsFormatted: formatUnits(pendingRewards, decimals),
            allowance: (allowance as bigint) || 0n,
            stakingToken: stakingToken || null,
            apr: aprValue,
            tvlUsd,
            limitsFormatted: 'N/A',
            lockPeriod: '30 Days', // Default based on pool configuration
            isLoading: isPoolLoading || isUserLoading || isAllowanceLoading,
            isTransactionPending,
            refetch: refetchAll
        };
    }, [isMock, poolConfig, poolState, userInfo, allowance, stakingToken, isPoolLoading, isUserLoading, isAllowanceLoading, isTransactionPending, decimals, refetchAll, priceData]);

    return {
        ...stats,
        stake,
        unstake,
        claimRewards,
        approve
    };
}
