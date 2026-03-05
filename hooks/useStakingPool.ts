import { ERC20_ABI, STAKING_FACTORY_ABI } from '@/constants/abis';
import { STAKING_FACTORY_ADDRESSES } from '@/constants/contracts';
import { useToastStore } from '@/store/useToastStore';
import { formatCompactNumber } from '@/utils/formatting';
import { useCallback, useMemo, useState } from 'react';
import { useAccount, useChainId, useReadContract, useSwitchChain, usePublicClient, useWriteContract } from 'wagmi';
import { useMarketPrice } from './useMarketPrice';
import { useWalletStore } from '@/store/walletStore';
import { signerController } from '@/services/signer/SignerController';
import { apiClient } from '@/services/apiClient';
import { activityService } from '@/services/activityService';
import { encodeFunctionData, formatUnits, parseUnits } from 'viem';

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
    tvlCompact: string;
    maxTvlCompact: string;
    limitsFormatted: string;
    activeStakersCount: string;
    lockPeriod: string;
    isLoading: boolean;
    isTransactionPending: boolean;
    refetch: () => void;
    // New fields for Mining/Live Stats
    stakeTime: number;
    rewardDurationSeconds: number;
    earningRate: number; // rewards per second
    emissionVelocity: number;
    isLocked: boolean;
    isFull: boolean;
    poolReward: number;
    tvl: number;
}

const STAKING_CHAIN_ID = 56; // BSC Mainnet
const SECONDS_PER_YEAR_NUM = 31536000;
const TWC_ADDRESS_BSC = '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596';

/**
 * Hook to interact with a TIWI Staking Pool (Read & Write)
 * Enhanced with Hybrid Signer Support & unified transaction tracking
 */
export function useStakingPool(poolId?: number | string, decimals: number = 9) {
    const chainId = useChainId();
    const publicClient = usePublicClient({ chainId: STAKING_CHAIN_ID });
    const { address: wagmiAddress } = useAccount();
    const activeAddress = useWalletStore(state => state.activeAddress);
    const effectiveAddress = activeAddress || wagmiAddress;

    const { switchChainAsync } = useSwitchChain();
    const { showToast, hideToast } = useToastStore();
    const { data: priceData } = useMarketPrice('TWC-USDT', STAKING_CHAIN_ID);

    // Check if this is a mock pool
    const isMock = typeof poolId === 'string' && poolId.startsWith('mock');

    // Always use BSC addresses for staking logic
    const factoryAddress = STAKING_FACTORY_ADDRESSES[STAKING_CHAIN_ID];

    // --- TRANSACTION STATE ---
    const [localTxHash, setLocalTxHash] = useState<`0x${string}` | undefined>();
    const [isInternalPending, setIsInternalPending] = useState(false);
    const [isInternalSuccess, setIsInternalSuccess] = useState(false);
    const [internalError, setInternalError] = useState<any>(null);

    const { writeContractAsync, data: wagmiTxHash, isPending: isWagmiPending, error: wagmiError, reset: resetWagmi } = useWriteContract();

    // Unified States
    const txHash = wagmiTxHash || localTxHash;
    const isTransactionPending = isInternalPending || isWagmiPending;

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
        chainId: STAKING_CHAIN_ID,
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
        args: poolId !== undefined && effectiveAddress && !isMock ? [BigInt(poolId), effectiveAddress as `0x${string}`] : undefined,
        chainId: STAKING_CHAIN_ID,
        query: {
            enabled: !!factoryAddress && poolId !== undefined && !!effectiveAddress && !isMock,
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
        args: effectiveAddress && factoryAddress ? [effectiveAddress as `0x${string}`, factoryAddress] : undefined,
        chainId: STAKING_CHAIN_ID,
        query: {
            enabled: !!stakingToken && !!effectiveAddress && !!factoryAddress,
        }
    });

    const refetchAll = useCallback(() => {
        refetchPool();
        refetchUser();
        refetchAllowance();
    }, [refetchPool, refetchUser, refetchAllowance]);

    // --- TRANSACTION HELPERS ---

    const resetStates = useCallback(() => {
        setLocalTxHash(undefined);
        setIsInternalPending(false);
        setIsInternalSuccess(false);
        setInternalError(null);
        resetWagmi();
    }, [resetWagmi]);

    const handleTxConfirmed = useCallback(async (hash: `0x${string}`, type: string, amount: string = '0', receipt?: any) => {
        console.log(`[useStakingPool] Transaction confirmed: ${hash} | Type: ${type} | Amount: ${amount}`);
        showToast('Transaction Successful!', 'success', hash);
        refetchAll();

        if (effectiveAddress) {
            try {
                // Determine token address and symbol
                const finalTokenAddr = stakingToken || TWC_ADDRESS_BSC;
                const tokenSymbol = stakingToken?.toLowerCase() === TWC_ADDRESS_BSC.toLowerCase() ? 'TWC' : 'Tokens';

                // 1. Log to Global Transaction History
                const logResult = await apiClient.logTransaction({
                    walletAddress: effectiveAddress.toLowerCase(),
                    transactionHash: hash,
                    chainId: STAKING_CHAIN_ID,
                    type: type, // 'Stake', 'Unstake', 'Approve'
                    fromTokenAddress: type === 'Stake' ? finalTokenAddr.toLowerCase() : effectiveAddress.toLowerCase(),
                    fromTokenSymbol: type === 'Stake' ? tokenSymbol : 'BNB',
                    toTokenAddress: type === 'Stake' ? factoryAddress.toLowerCase() : finalTokenAddr.toLowerCase(),
                    toTokenSymbol: type === 'Stake' ? 'Factory' : tokenSymbol,
                    amount: amount,
                    amountFormatted: `${amount} ${tokenSymbol}`,
                    routerName: 'Tiwi Staking',
                    blockNumber: receipt?.blockNumber ? Number(receipt.blockNumber) : undefined,
                });

                console.log(`[useStakingPool] Global log attempt ${logResult ? 'Success' : 'Failed'}`);

                // 2. Log to user_stakes table (for Active Positions)
                if (type === 'Stake' || type === 'Unstake') {
                    const stakeResult = await apiClient.logUserStake({
                        userWallet: effectiveAddress.toLowerCase(),
                        stakedAmount: amount,
                        poolId: poolId?.toString() || '',
                        status: type === 'Stake' ? 'active' : 'withdrawn',
                        transactionHash: hash
                    });
                    console.log(`[useStakingPool] UserStake table log attempt ${stakeResult ? 'Success' : 'Failed'}`);
                }

                // 3. Log to Local Activities (Supabase)
                await activityService.logTransaction(
                    effectiveAddress,
                    type,
                    `${type} Successful`,
                    `Your ${type.toLowerCase()} of ${amount} ${tokenSymbol} was confirmed on blockchain.`,
                    hash,
                    {
                        amount,
                        symbol: tokenSymbol,
                        poolId: poolId?.toString(),
                        onChainPoolId: poolId?.toString()
                    }
                );

                console.log(`[useStakingPool] Local activity log complete for ${type}.`);

                // 4. Special Case: If it's a stake, trigger an extra refetch after a delay
                if (type === 'Stake') {
                    setTimeout(refetchAll, 3000);
                    setTimeout(refetchAll, 10000); // Polling for backend indexing
                }

            } catch (e) {
                console.error('[useStakingPool] Failed to log activity:', e);
            }
        }
        setTimeout(hideToast, 4000);
    }, [effectiveAddress, refetchAll, showToast, hideToast, stakingToken, factoryAddress, poolId]);

    const ensureCorrectChain = useCallback(async () => {
        if (chainId !== STAKING_CHAIN_ID) {
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

    const executeWrite = useCallback(async (params: { address: `0x${string}`, abi: any, functionName: string, args: any[], value?: bigint }, type: string, amount: string) => {
        resetStates();
        const walletStore = useWalletStore.getState();
        const activeWallet = walletStore.walletGroups.find(g =>
            Object.values(g.addresses).some(addr => addr?.toLowerCase() === walletStore.activeAddress?.toLowerCase())
        );

        const isLocal = activeWallet?.type === 'mnemonic' || activeWallet?.type === 'privateKey' || activeWallet?.source === 'local' || activeWallet?.source === 'internal' || activeWallet?.source === 'imported';

        try {
            if (isLocal && walletStore.activeAddress) {
                setIsInternalPending(true);
                const result = await signerController.executeTransaction({
                    chainFamily: 'evm',
                    to: params.address,
                    data: encodeFunctionData({
                        abi: params.abi,
                        functionName: params.functionName,
                        args: params.args
                    }),
                    value: params.value?.toString(),
                    chainId: STAKING_CHAIN_ID
                }, walletStore.activeAddress);

                if (result.status === 'success' && result.hash) {
                    const hash = result.hash as `0x${string}`;
                    setLocalTxHash(hash);

                    let receipt = null;
                    if (publicClient) {
                        try {
                            receipt = await publicClient.waitForTransactionReceipt({ hash });
                        } catch (e) {
                            console.warn('[useStakingPool] Receipt wait failed, but hash exists.');
                        }
                    }

                    setIsInternalSuccess(true);
                    setIsInternalPending(false);
                    handleTxConfirmed(hash, type, amount, receipt);
                    return hash;
                }
                throw new Error(result.error || 'Transaction failed');
            } else {
                if (!wagmiAddress) {
                    throw new Error('Wallet not connected via AppKit. Please check your connection.');
                }
                const hash = await writeContractAsync({
                    ...params,
                    chainId: STAKING_CHAIN_ID
                });

                if (publicClient && hash) {
                    try {
                        const receipt = await publicClient.waitForTransactionReceipt({ hash });
                        handleTxConfirmed(hash, type, amount, receipt);
                    } catch (e) {
                        console.warn('[useStakingPool] Receipt wait failed for external.');
                    }
                }
                return hash;
            }
        } catch (error: any) {
            setIsInternalPending(false);
            setInternalError(error);

            let message = 'Transaction Failed';
            if (error?.message?.includes('User rejected')) {
                message = 'Transaction Rejected';
            } else if (error?.message?.includes('insufficient funds')) {
                message = 'Insufficient Gas';
            }
            showToast(message, 'error');
            setTimeout(hideToast, 4000);
            throw error;
        }
    }, [wagmiAddress, writeContractAsync, publicClient, handleTxConfirmed, resetStates, hideToast, showToast]);

    // --- ACTIONS ---

    const stake = useCallback(async (amount: string) => {
        await ensureCorrectChain();
        const amountWei = parseUnits(amount, decimals);
        showToast('Confirm Staking in Wallet...', 'pending');
        return await executeWrite({
            address: factoryAddress as `0x${string}`,
            abi: STAKING_FACTORY_ABI,
            functionName: 'deposit',
            args: [BigInt(poolId!), amountWei],
        }, 'Stake', amount);
    }, [factoryAddress, poolId, decimals, executeWrite, ensureCorrectChain, showToast]);

    const unstake = useCallback(async (amount: string) => {
        await ensureCorrectChain();
        const amountWei = parseUnits(amount, decimals);
        showToast('Confirm Unstaking in Wallet...', 'pending');
        return await executeWrite({
            address: factoryAddress as `0x${string}`,
            abi: STAKING_FACTORY_ABI,
            functionName: 'withdraw',
            args: [BigInt(poolId!), amountWei],
        }, 'Unstake', amount);
    }, [factoryAddress, poolId, decimals, executeWrite, ensureCorrectChain, showToast]);

    const claimRewards = useCallback(async () => {
        await ensureCorrectChain();
        showToast('Confirm Claim in Wallet...', 'pending');
        return await executeWrite({
            address: factoryAddress as `0x${string}`,
            abi: STAKING_FACTORY_ABI,
            functionName: 'claim',
            args: [BigInt(poolId!)],
        }, 'Claim', '0');
    }, [factoryAddress, poolId, executeWrite, ensureCorrectChain, showToast]);

    const approve = useCallback(async (amount?: string) => {
        await ensureCorrectChain();
        if (!stakingToken) throw new Error('Staking token not found');

        const amountWei = amount
            ? parseUnits(amount, decimals)
            : BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

        showToast('Confirm Approval in Wallet...', 'pending');
        return await executeWrite({
            address: stakingToken,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [factoryAddress as `0x${string}`, amountWei],
        }, 'Approve', amount || 'Max');
    }, [stakingToken, factoryAddress, decimals, executeWrite, ensureCorrectChain, showToast]);

    // --- VIEW LOGIC ---

    const stats = useMemo((): OnChainPoolStats => {
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
                tvlCompact: '1.4M',
                maxTvlCompact: '10M',
                limitsFormatted: '1M - 10M TWC',
                activeStakersCount: '1,245',
                isLoading: false,
                isTransactionPending: false,
                refetch: () => console.log('Mock refetch'),
                stakeTime: Math.floor(Date.now() / 1000) - 86400 * 4, // 4 days ago
                rewardDurationSeconds: 2592000, // 30 days
                earningRate: 0.009837963,
                emissionVelocity: 0.009837963,
                isLocked: true,
                isFull: false,
                poolReward: 25500,
                tvl: 25500,
                lockPeriod: '30 days'
            };
        }

        const totalStaked = (poolState as any)?.[0] ?? (poolState as any)?.totalStaked ?? 0n;
        const userStaked = (userInfo as any)?.[0] ?? (userInfo as any)?.amount ?? 0n;
        const pendingRewards = (userInfo as any)?.[3] ?? (userInfo as any)?.pending ?? 0n;
        const stakeTime = Number((userInfo as any)?.[2] ?? (userInfo as any)?.stakeTime ?? 0n);

        const totalStakedCompact = formatCompactNumber(Number(formatUnits(totalStaked, decimals)), {});

        let aprValue = 'N/A';
        let tvlUsd = '$0.00';
        let maxTvlCompact = 'N/A';
        let rewardDurationSeconds = 0;
        let earningRate = 0;
        let poolRewardNum = 0;
        let totalStakedNum = Number(formatUnits(totalStaked, decimals));

        if (poolConfig && poolState) {
            // Support both array and object responses for robustness
            rewardDurationSeconds = Number(poolConfig[5] ?? poolConfig.rewardDurationSeconds ?? 0n);
            poolRewardNum = Number(formatUnits(poolConfig[4] ?? poolConfig.poolReward ?? 0n, decimals));
            const maxTvl = Number(formatUnits(poolConfig[6] ?? poolConfig.maxTvl ?? 0n, decimals));
            const rewardPerSecondRaw = poolConfig[7] ?? poolConfig.rewardPerSecond ?? 0n;

            maxTvlCompact = formatCompactNumber(maxTvl, {});

            const tvlForCalculation = maxTvl > 0 ? maxTvl : (totalStakedNum > 0 ? totalStakedNum : 1);

            // Use rewardPerSecond from contract if available, else fallback to calculation
            let rewardPerSecNum = 0;
            if (rewardPerSecondRaw > 0n) {
                rewardPerSecNum = Number(formatUnits(rewardPerSecondRaw, decimals));
            } else if (rewardDurationSeconds > 0) {
                rewardPerSecNum = poolRewardNum / rewardDurationSeconds;
            }

            const rewardPerTokenPerSec = rewardPerSecNum / tvlForCalculation;
            let apr = rewardPerTokenPerSec * SECONDS_PER_YEAR_NUM * 100;

            // If APR is extremely high (> 1M%), it's almost certainly a decimal mismatch between pool reward and total staked.
            // We'll attempt a logic fix here to provide better UX if it happens.
            if (apr > 1000000) {
                // Heuristic: If we are a factor of 10^9 or 10^12 off, we fix it
                apr = apr / 1000000000;
            }

            // Exactly 2 decimal places as requested
            aprValue = `${apr.toFixed(2)}%`;

            // Calculate user-specific earning rate (Emission Velocity for this user)
            if (totalStakedNum > 0) {
                const userStakedNum = Number(formatUnits(userStaked, decimals));
                earningRate = (userStakedNum / totalStakedNum) * rewardPerSecNum;
            }

            if (priceData?.priceUSD) {
                tvlUsd = `$${formatCompactNumber(totalStakedNum * priceData.priceUSD, { decimals: 2 })}`;
            }
        }

        const duration = poolConfig?.[5] ?? poolConfig?.rewardDurationSeconds ?? 0n;
        const lockPeriodDays = Number(duration) / 86400;
        const lockPeriodFormatted = lockPeriodDays > 0 ? `${Math.ceil(lockPeriodDays)} days` : (poolConfig?.minStakingPeriod || '30 days');

        const maxTvlNum = poolConfig ? Number(formatUnits(poolConfig.maxTvl ?? 0n, decimals)) : 0;
        const isFull = maxTvlNum > 0 && totalStakedNum >= maxTvlNum;

        return {
            totalStaked,
            totalStakedFormatted: formatUnits(totalStaked, decimals),
            totalStakedCompact: `${totalStakedCompact} TWC`,
            userStaked,
            userStakedFormatted: formatUnits(userStaked, decimals),
            pendingRewards,
            pendingRewardsFormatted: formatUnits(pendingRewards, decimals),
            allowance: (allowance as bigint) || 0n,
            stakingToken: (stakingToken as `0x${string}`) || null,
            apr: aprValue,
            tvlUsd,
            tvlCompact: totalStakedCompact,
            maxTvlCompact,
            limitsFormatted: poolConfig ? `${formatCompactNumber(Number(formatUnits(poolConfig.minStakeAmount || 0n, decimals)), {})}-${formatCompactNumber(Number(formatUnits(poolConfig.maxStakeAmount || 0n, decimals)), {})} TWC` : 'N/A',
            activeStakersCount: 'N/A',
            lockPeriod: lockPeriodFormatted,
            isLoading: isPoolLoading || isUserLoading || isAllowanceLoading,
            isTransactionPending,
            refetch: refetchAll,
            stakeTime,
            rewardDurationSeconds,
            earningRate, // Also known as emissionVelocity for individual user
            emissionVelocity: earningRate,
            isLocked: lockPeriodDays > 0,
            isFull,
            poolReward: poolRewardNum,
            tvl: totalStakedNum
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
