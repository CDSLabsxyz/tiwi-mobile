import { ERC20_ABI, STAKING_FACTORY_ABI, STAKING_POOL_V2_ABI } from '@/constants/abis';
import { STAKING_FACTORY_ADDRESSES } from '@/constants/contracts';
import { RPC_CONFIG, RPC_TRANSPORT_OPTIONS } from '@/constants/rpc';
import { useToastStore } from '@/store/useToastStore';
import { formatCompactNumber } from '@/utils/formatting';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, useChainId, useSwitchChain, useWriteContract } from 'wagmi';
import { useMarketPrice } from './useMarketPrice';
import { useWalletStore } from '@/store/walletStore';
import { signerController } from '@/services/signer/SignerController';
import { apiClient } from '@/services/apiClient';
import { activityService } from '@/services/activityService';
import { createPublicClient, encodeFunctionData, formatUnits, http, parseUnits } from 'viem';
import { bsc } from 'viem/chains';

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

// AppKit's WagmiAdapter hard-codes transports to rpc.walletconnect.org, which
// drops ~20% of eth_call requests on BSC. Reads go through a dedicated viem
// client on Alchemy — wagmi only handles writes (via the connected signer).
const bscReadClient = createPublicClient({
    chain: bsc,
    transport: http(RPC_CONFIG[STAKING_CHAIN_ID], RPC_TRANSPORT_OPTIONS),
});

/**
 * Hook to interact with a TIWI Staking Pool (Read & Write)
 * Enhanced with Hybrid Signer Support & unified transaction tracking
 *
 * Supports two architectures:
 *   - V2 pool-per-contract: pass `poolContractAddress` — reads/writes go
 *     directly to that pool contract using STAKING_POOL_V2_ABI.
 *   - Legacy factory: pass `poolId` — reads/writes go through the factory
 *     at STAKING_FACTORY_ADDRESSES[56] with STAKING_FACTORY_ABI.
 *
 * `poolContractAddress` takes precedence when both are provided.
 */
export function useStakingPool(
    poolId?: number | string,
    decimals: number = 9,
    options?: { poolContractAddress?: string }
) {
    const poolContractAddress = options?.poolContractAddress;
    const chainId = useChainId();
    const publicClient = bscReadClient;
    const { address: wagmiAddress } = useAccount();
    const activeAddress = useWalletStore(state => state.activeAddress);
    const effectiveAddress = activeAddress || wagmiAddress;

    const { switchChainAsync } = useSwitchChain();
    const { showToast, hideToast } = useToastStore();
    const { data: priceData } = useMarketPrice('TWC-USDT', STAKING_CHAIN_ID);

    // Check if this is a mock pool
    const isMock = typeof poolId === 'string' && poolId.startsWith('mock');

    // The legacy factory works in terms of a numeric pool id. Callers may pass
    // either a number, a numeric string, or — by accident — a DB UUID. Anything
    // that isn't a well-formed integer coerces to undefined so we never hit
    // `BigInt('abc-123')` which would blow up the render.
    const numericPoolId = useMemo(() => {
        if (poolId === undefined || poolId === null) return undefined;
        const raw = String(poolId).trim();
        if (!/^\d+$/.test(raw)) return undefined;
        try { return BigInt(raw); } catch { return undefined; }
    }, [poolId]);
    const hasPoolId = numericPoolId !== undefined;

    // V2: per-pool contract address. When present, we skip the factory entirely.
    const v2Address = useMemo(() => {
        const a = poolContractAddress?.trim();
        return a && /^0x[a-fA-F0-9]{40}$/.test(a) ? (a as `0x${string}`) : undefined;
    }, [poolContractAddress]);
    const isV2 = !!v2Address;

    // Legacy factory address (BSC only).
    const factoryAddress = STAKING_FACTORY_ADDRESSES[STAKING_CHAIN_ID];
    // The staking contract the ERC20 approves + deposits go to.
    const stakingTargetAddress = (v2Address ?? factoryAddress) as `0x${string}`;

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
    // All three reads below use `bscReadClient` (viem + Alchemy) via useQuery
    // rather than wagmi's useReadContract, because AppKit's WagmiAdapter pins
    // the transport to WalletConnect's relay which fails intermittently.

    // getPoolInfo — V2 (no args, 13-tuple) or legacy factory (poolId arg, [config, state] tuple).
    const {
        data: poolInfo,
        isLoading: isPoolLoading,
        refetch: refetchPool,
    } = useQuery({
        queryKey: ['staking', 'poolInfo', isV2 ? v2Address : factoryAddress, numericPoolId?.toString() ?? null, isV2],
        queryFn: async () => {
            if (isV2 && v2Address) {
                return await bscReadClient.readContract({
                    address: v2Address,
                    abi: STAKING_POOL_V2_ABI,
                    functionName: 'getPoolInfo',
                });
            }
            return await bscReadClient.readContract({
                address: factoryAddress as `0x${string}`,
                abi: STAKING_FACTORY_ABI,
                functionName: 'getPoolInfo',
                args: [numericPoolId!],
            });
        },
        enabled: !isMock && (isV2 || (!!factoryAddress && hasPoolId)),
    });

    // Normalize: factory returns [config, state]; V2 returns a flat 13-tuple.
    // Downstream `poolConfig` / `poolState` expose the same indexed fields
    // used across the rest of the hook — see `stats` memo below.
    const { poolConfig, poolState, stakingToken } = useMemo(() => {
        if (!poolInfo) return { poolConfig: undefined, poolState: undefined, stakingToken: undefined as `0x${string}` | undefined };
        if (isV2) {
            // V2 tuple: [stakingToken, rewardToken, poolOwner, poolReward,
            //            rewardDurationSeconds, maxTvl, rewardPerSecond,
            //            startTime, endTime, active, totalStaked,
            //            rewardBalance, funded]
            const info = poolInfo as any;
            const cfg: any = {
                0: undefined, // no poolId in V2
                1: info[0], stakingToken: info[0],
                2: info[1], rewardToken: info[1],
                3: info[2], poolOwner: info[2],
                4: info[3], poolReward: info[3],
                5: info[4], rewardDurationSeconds: info[4],
                6: info[5], maxTvl: info[5],
                7: info[6], rewardPerSecond: info[6],
                8: info[7], startTime: info[7],
                9: info[8], endTime: info[8],
                10: info[9], active: info[9],
            };
            const st: any = {
                0: info[10], totalStaked: info[10],
                3: info[11], rewardBalance: info[11],
                funded: info[12],
            };
            return { poolConfig: cfg, poolState: st, stakingToken: info[0] as `0x${string}` };
        }
        const cfg = (poolInfo as any)[0];
        const st = (poolInfo as any)[1];
        return { poolConfig: cfg, poolState: st, stakingToken: cfg?.stakingToken as `0x${string}` | undefined };
    }, [poolInfo, isV2]);

    const {
        data: userInfo,
        isLoading: isUserLoading,
        refetch: refetchUser,
    } = useQuery({
        queryKey: ['staking', 'userInfo', isV2 ? v2Address : factoryAddress, numericPoolId?.toString() ?? null, effectiveAddress, isV2],
        queryFn: async () => {
            if (isV2 && v2Address && effectiveAddress) {
                return await bscReadClient.readContract({
                    address: v2Address,
                    abi: STAKING_POOL_V2_ABI,
                    functionName: 'getUserInfo',
                    args: [effectiveAddress as `0x${string}`],
                });
            }
            return await bscReadClient.readContract({
                address: factoryAddress as `0x${string}`,
                abi: STAKING_FACTORY_ABI,
                functionName: 'getUserInfo',
                args: [numericPoolId!, effectiveAddress as `0x${string}`],
            });
        },
        enabled: !isMock && !!effectiveAddress && (isV2 || (!!factoryAddress && hasPoolId)),
        refetchInterval: 10000,
    });

    const {
        data: allowance,
        isLoading: isAllowanceLoading,
        refetch: refetchAllowance,
    } = useQuery({
        queryKey: ['staking', 'allowance', stakingToken, effectiveAddress, stakingTargetAddress],
        queryFn: async () => {
            return await bscReadClient.readContract({
                address: stakingToken as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'allowance',
                args: [effectiveAddress as `0x${string}`, stakingTargetAddress],
            });
        },
        enabled: !!stakingToken && !!effectiveAddress,
    });

    // --- ON-CHAIN CLAIMED + DEPOSITED TOTALS ---
    // The staking contracts don't store cumulative per-user claimed or
    // deposited figures — only current `u.amount` and `u.rewards`. We sum
    // `Claim(user, amount)` and `Deposit(user, amount)` events for this user
    // on this pool so the UI can:
    //   - fall back to on-chain truth for CLAIMED when the DB PATCH is stale
    //   - enforce the "lifetime deposited" per-wallet cap (unstaking does NOT
    //     free up headroom — the limit is maxStake - Σ deposits, not
    //     maxStake - currentStaked)
    // Range is bounded by the user's on-chain `stakeTime` (deposits + claims
    // can't predate it) and chunked in 4,999-block windows to stay inside
    // public BSC RPC getLogs limits.
    const [onChainClaimedTotal, setOnChainClaimedTotal] = useState<bigint>(0n);
    const [onChainTotalDeposited, setOnChainTotalDeposited] = useState<bigint>(0n);

    const refetchOnChainClaimed = useCallback(async () => {
        if (!publicClient || !effectiveAddress || isMock) return;
        const contractAddr = (isV2 ? v2Address : factoryAddress) as `0x${string}` | undefined;
        if (!contractAddr) return;
        const stakeTimeSec = Number((userInfo as any)?.[2] ?? (userInfo as any)?.stakeTime ?? 0);
        try {
            const latest = await publicClient.getBlockNumber();
            const nowSec = Math.floor(Date.now() / 1000);
            // BSC targets 3s blocks. Derive fromBlock from stakeTime; cap the
            // lookback at ~250k blocks (~8.5 days) to keep the chunk count sane.
            const ageSec = stakeTimeSec > 0 ? Math.max(0, nowSec - stakeTimeSec) : 0;
            const estBlocksBack = BigInt(Math.min(250_000, Math.ceil(ageSec / 3) + 5_000));
            const fromBlock = latest > estBlocksBack ? latest - estBlocksBack : 0n;
            const CHUNK = 4_999n;

            const claimEvent = isV2
                ? { type: 'event' as const, name: 'Claim' as const, inputs: [
                    { indexed: true, name: 'user', type: 'address' as const },
                    { indexed: false, name: 'amount', type: 'uint256' as const },
                ] }
                : { type: 'event' as const, name: 'Claim' as const, inputs: [
                    { indexed: true, name: 'poolId', type: 'uint256' as const },
                    { indexed: true, name: 'user', type: 'address' as const },
                    { indexed: false, name: 'amount', type: 'uint256' as const },
                ] };

            // The factory's Deposit event indexes the depositor as `funder`,
            // while the V2 pool uses `user`. Same concept — just a naming
            // difference, but viem filters `args` by input name so we need
            // the matching key.
            const depositEvent = isV2
                ? { type: 'event' as const, name: 'Deposit' as const, inputs: [
                    { indexed: true, name: 'user', type: 'address' as const },
                    { indexed: false, name: 'amount', type: 'uint256' as const },
                ] }
                : { type: 'event' as const, name: 'Deposit' as const, inputs: [
                    { indexed: true, name: 'poolId', type: 'uint256' as const },
                    { indexed: true, name: 'funder', type: 'address' as const },
                    { indexed: false, name: 'amount', type: 'uint256' as const },
                ] };

            const claimArgs: any = isV2
                ? { user: effectiveAddress as `0x${string}` }
                : { poolId: numericPoolId != null ? BigInt(numericPoolId) : undefined, user: effectiveAddress as `0x${string}` };

            const depositArgs: any = isV2
                ? { user: effectiveAddress as `0x${string}` }
                : { poolId: numericPoolId != null ? BigInt(numericPoolId) : undefined, funder: effectiveAddress as `0x${string}` };

            const ranges: Array<[bigint, bigint]> = [];
            for (let start = fromBlock; start <= latest; start += CHUNK + 1n) {
                const end = start + CHUNK > latest ? latest : start + CHUNK;
                ranges.push([start, end]);
            }

            const fetchChunks = (event: any, args: any) => Promise.all(ranges.map(([from, to]) =>
                publicClient.getLogs({
                    address: contractAddr,
                    event,
                    args,
                    fromBlock: from,
                    toBlock: to,
                }).catch((e) => {
                    console.warn('[useStakingPool] getLogs chunk failed', event?.name, from, to, e);
                    return [];
                })
            ));

            const [claimChunks, depositChunks] = await Promise.all([
                fetchChunks(claimEvent, claimArgs),
                fetchChunks(depositEvent, depositArgs),
            ]);

            const sumAmounts = (chunks: any[][]) => chunks.flat().reduce((acc: bigint, log: any) => {
                const amt: bigint = log.args?.amount ?? 0n;
                return acc + amt;
            }, 0n);

            setOnChainClaimedTotal(sumAmounts(claimChunks));
            setOnChainTotalDeposited(sumAmounts(depositChunks));
        } catch (e) {
            console.warn('[useStakingPool] refetchOnChainClaimed failed:', e);
        }
    }, [publicClient, effectiveAddress, isMock, isV2, v2Address, factoryAddress, numericPoolId, userInfo]);

    useEffect(() => {
        refetchOnChainClaimed();
    }, [refetchOnChainClaimed]);

    const refetchAll = useCallback(() => {
        refetchPool();
        refetchUser();
        refetchAllowance();
        refetchOnChainClaimed();
    }, [refetchPool, refetchUser, refetchAllowance, refetchOnChainClaimed]);

    // --- TRANSACTION HELPERS ---

    const resetStates = useCallback(() => {
        setLocalTxHash(undefined);
        setIsInternalPending(false);
        setIsInternalSuccess(false);
        setInternalError(null);
        resetWagmi();
    }, [resetWagmi]);

    const handleTxConfirmed = useCallback(async (hash: `0x${string}`, type: string, amount: string = '0', receipt?: any, meta?: { claimedAmount?: string; remainingStaked?: string; harvestedOnExit?: string }) => {
        console.log(`[useStakingPool] Transaction confirmed: ${hash} | Type: ${type} | Amount: ${amount} | Meta:`, meta);
        showToast('Transaction Successful!', 'success', hash);
        refetchAll();

        if (effectiveAddress) {
            try {
                // Determine token address and symbol
                const finalTokenAddr = stakingToken || TWC_ADDRESS_BSC;
                const tokenSymbol = stakingToken?.toLowerCase() === TWC_ADDRESS_BSC.toLowerCase() ? 'TWC' : 'Tokens';

                // The backend's logTransaction endpoint only accepts a fixed
                // enum: Swap | Sent | Received | Stake | Unstake | Approve |
                // Transfer | DeFi | NFTTransfer | ContractCall. We use richer
                // internal labels ('Claim', 'Harvest') for the branching logic
                // below, so map them to the nearest valid enum before POSTing.
                // Claim/Harvest = user receiving reward tokens → 'Received'.
                const apiType = (type === 'Claim' || type === 'Harvest') ? 'Received' : type;

                // 1. Log to Global Transaction History
                const logResult = await apiClient.logTransaction({
                    walletAddress: effectiveAddress.toLowerCase(),
                    transactionHash: hash,
                    chainId: STAKING_CHAIN_ID,
                    type: apiType,
                    fromTokenAddress: type === 'Stake' ? finalTokenAddr.toLowerCase() : effectiveAddress.toLowerCase(),
                    fromTokenSymbol: type === 'Stake' ? tokenSymbol : 'BNB',
                    toTokenAddress: type === 'Stake' ? stakingTargetAddress.toLowerCase() : finalTokenAddr.toLowerCase(),
                    toTokenSymbol: type === 'Stake' ? (isV2 ? 'Pool' : 'Factory') : tokenSymbol,
                    amount: amount,
                    amountFormatted: `${amount} ${tokenSymbol}`,
                    routerName: 'Tiwi Staking',
                    blockNumber: receipt?.blockNumber ? Number(receipt.blockNumber) : undefined,
                });

                console.log(`[useStakingPool] Global log attempt ${logResult ? 'Success' : 'Failed'}`);

                // 2. Persist stake state to user_stakes.
                //    - Stake: POST (upsert) with the DB pool UUID.
                //    - Unstake: PATCH the existing active row with new stakedAmount/status.
                //    - Claim: PATCH with addToClaimed (+ optional harvest on Max exit).
                if (type === 'Stake') {
                    const poolUuid = poolId !== undefined ? await apiClient.resolvePoolUuid(poolId) : null;
                    if (poolUuid) {
                        const stakeResult = await apiClient.logUserStake({
                            userWallet: effectiveAddress.toLowerCase(),
                            stakedAmount: amount,
                            poolId: poolUuid,
                            status: 'active',
                            transactionHash: hash
                        });
                        console.log(`[useStakingPool] Stake logged ${stakeResult ? 'OK' : 'FAIL'}`);
                    } else {
                        console.warn('[useStakingPool] Could not resolve DB pool UUID for on-chain poolId', poolId);
                    }
                } else if (type === 'Unstake' && poolId !== undefined) {
                    const stakeId = await apiClient.findActiveStakeId(effectiveAddress, poolId);
                    if (stakeId) {
                        const remaining = meta?.remainingStaked !== undefined ? Number(meta.remainingStaked) : undefined;
                        const harvest = meta?.harvestedOnExit ? Number(meta.harvestedOnExit) : undefined;
                        const patchOk = await apiClient.patchUserStake({
                            id: stakeId,
                            stakedAmount: remaining,
                            status: remaining !== undefined && remaining <= 0 ? 'withdrawn' : 'active',
                            transactionHash: hash,
                            addToRewardsEarned: harvest,
                        });
                        console.log(`[useStakingPool] Unstake patched ${patchOk ? 'OK' : 'FAIL'}`);
                    } else {
                        console.warn('[useStakingPool] No active stake row to PATCH on Unstake');
                    }
                } else if (type === 'Claim' && poolId !== undefined) {
                    const stakeId = await apiClient.findActiveStakeId(effectiveAddress, poolId);
                    const claimed = meta?.claimedAmount ? Number(meta.claimedAmount) : 0;
                    if (stakeId && claimed > 0) {
                        const patchOk = await apiClient.patchUserStake({
                            id: stakeId,
                            addToClaimed: claimed,
                            transactionHash: hash,
                        });
                        console.log(`[useStakingPool] Claim patched ${patchOk ? 'OK' : 'FAIL'}`);
                    } else {
                        console.warn('[useStakingPool] Claim PATCH skipped — stakeId:', stakeId, 'claimed:', claimed);
                    }
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
    }, [effectiveAddress, refetchAll, showToast, hideToast, stakingToken, stakingTargetAddress, isV2, poolId]);

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

    const executeWrite = useCallback(async (params: { address: `0x${string}`, abi: any, functionName: string, args: any[], value?: bigint }, type: string, amount: string, meta?: { claimedAmount?: string; remainingStaked?: string; harvestedOnExit?: string }) => {
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
                }, walletStore.activeAddress, { skipAuthorize: true });

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
                    // Await so the DB PATCH (addToClaimed / stakedAmount / etc.)
                    // completes before we resolve — callers refetch the stake
                    // list right after this returns and would otherwise race.
                    await handleTxConfirmed(hash, type, amount, receipt, meta);
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
                        await handleTxConfirmed(hash, type, amount, receipt, meta);
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
        return await executeWrite(
            isV2
                ? {
                    address: v2Address!,
                    abi: STAKING_POOL_V2_ABI,
                    functionName: 'deposit',
                    args: [amountWei],
                }
                : {
                    address: factoryAddress as `0x${string}`,
                    abi: STAKING_FACTORY_ABI,
                    functionName: 'deposit',
                    args: [numericPoolId!, amountWei],
                },
            'Stake', amount);
    }, [isV2, v2Address, factoryAddress, numericPoolId, decimals, executeWrite, ensureCorrectChain, showToast]);

    const unstake = useCallback(async (amount: string) => {
        await ensureCorrectChain();
        const amountWei = parseUnits(amount, decimals);
        // Snapshot the user's staked balance BEFORE the tx so the DB PATCH
        // can record the correct post-tx remaining amount.
        const preUserStaked = (userInfo as any)?.[0] ?? (userInfo as any)?.amount ?? 0n;
        const remainingWei = preUserStaked > amountWei ? preUserStaked - amountWei : 0n;
        const remainingStaked = formatUnits(remainingWei as bigint, decimals);
        showToast('Confirm Unstaking in Wallet...', 'pending');
        return await executeWrite(
            isV2
                ? {
                    address: v2Address!,
                    abi: STAKING_POOL_V2_ABI,
                    functionName: 'withdraw',
                    args: [amountWei],
                }
                : {
                    address: factoryAddress as `0x${string}`,
                    abi: STAKING_FACTORY_ABI,
                    functionName: 'withdraw',
                    args: [numericPoolId!, amountWei],
                },
            'Unstake', amount, { remainingStaked });
    }, [isV2, v2Address, factoryAddress, numericPoolId, decimals, executeWrite, ensureCorrectChain, showToast, userInfo]);

    const claimRewards = useCallback(async (percentage: number = 100) => {
        await ensureCorrectChain();
        const pct = Math.max(1, Math.min(100, Math.round(percentage)));
        // Snapshot pending rewards BEFORE the tx so the DB PATCH records the
        // correct claimed amount — the on-chain value will be ~0 (full) or
        // reduced by `pct` (partial) after the tx lands.
        const prePending = (userInfo as any)?.[3] ?? (userInfo as any)?.pending ?? 0n;
        const claimedWei = (prePending as bigint) * BigInt(pct) / 100n;
        const claimedAmount = formatUnits(claimedWei, decimals);
        showToast('Confirm Claim in Wallet...', 'pending');
        const isFull = pct === 100;
        return await executeWrite(
            isV2
                ? {
                    address: v2Address!,
                    abi: STAKING_POOL_V2_ABI,
                    functionName: isFull ? 'claim' : 'claimPercentage',
                    args: isFull ? [] : [BigInt(pct)],
                }
                : {
                    address: factoryAddress as `0x${string}`,
                    abi: STAKING_FACTORY_ABI,
                    functionName: isFull ? 'claim' : 'claimPercentage',
                    args: isFull ? [numericPoolId!] : [numericPoolId!, BigInt(pct)],
                },
            'Claim', claimedAmount, { claimedAmount });
    }, [isV2, v2Address, factoryAddress, numericPoolId, decimals, executeWrite, ensureCorrectChain, showToast, userInfo]);

    /**
     * Max unstake with auto-harvest. Fires claim() first (harvests pending
     * into the wallet, recorded as rewards_earned), then withdraw() for the
     * full principal (recorded as status='withdrawn'). Falls back to a plain
     * withdraw if pending is 0.
     */
    const maxUnstakeWithHarvest = useCallback(async () => {
        await ensureCorrectChain();
        const preUserStaked = (userInfo as any)?.[0] ?? (userInfo as any)?.amount ?? 0n;
        const prePending = (userInfo as any)?.[3] ?? (userInfo as any)?.pending ?? 0n;

        if (preUserStaked === 0n) throw new Error('Nothing staked to unstake');

        // Leg 1 — harvest pending rewards (skipped if zero). Recorded to
        // rewards_earned so it doesn't inflate the "Claimed" counter.
        if (prePending > 0n) {
            showToast('Harvesting rewards...', 'pending');
            const harvestedOnExit = formatUnits(prePending as bigint, decimals);
            try {
                await executeWrite(
                    isV2
                        ? {
                            address: v2Address!,
                            abi: STAKING_POOL_V2_ABI,
                            functionName: 'claim',
                            args: [],
                        }
                        : {
                            address: factoryAddress as `0x${string}`,
                            abi: STAKING_FACTORY_ABI,
                            functionName: 'claim',
                            args: [numericPoolId!],
                        },
                    'Harvest', harvestedOnExit, { harvestedOnExit });
            } catch (e) {
                // If harvest fails (user rejects, etc.), abort — don't strand them
                // mid-exit. They can retry or do a plain unstake.
                throw e;
            }
        }

        // Leg 2 — withdraw full principal. Pass harvestedOnExit so the single
        // Unstake PATCH records both stakedAmount=0/status=withdrawn AND
        // the harvested amount as rewards_earned.
        const amountStr = formatUnits(preUserStaked as bigint, decimals);
        const harvestedOnExit = prePending > 0n ? formatUnits(prePending as bigint, decimals) : undefined;
        showToast('Confirm Unstake in Wallet...', 'pending');
        return await executeWrite(
            isV2
                ? {
                    address: v2Address!,
                    abi: STAKING_POOL_V2_ABI,
                    functionName: 'withdraw',
                    args: [preUserStaked],
                }
                : {
                    address: factoryAddress as `0x${string}`,
                    abi: STAKING_FACTORY_ABI,
                    functionName: 'withdraw',
                    args: [numericPoolId!, preUserStaked],
                },
            'Unstake', amountStr, { remainingStaked: '0', harvestedOnExit });
    }, [isV2, v2Address, factoryAddress, numericPoolId, decimals, executeWrite, ensureCorrectChain, showToast, userInfo]);

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
            args: [stakingTargetAddress, amountWei],
        }, 'Approve', amount || 'Max');
    }, [stakingToken, stakingTargetAddress, decimals, executeWrite, ensureCorrectChain, showToast]);

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

            maxTvlCompact = formatCompactNumber(maxTvl, {});

            // IMPORTANT: do NOT read `rewardPerSecond` from the contract directly.
            // The contract stores it scaled by 1e12 for internal precision
            // (constructor: `rewardPerSecond = (_poolReward * 1e12) / _rewardDurationSeconds`),
            // and `_updatePool` divides by `maxTvl * 1e12` to emit the actual
            // per-second reward. Reading the raw value with token decimals
            // leaves it 10^12 too large — that's what produced the
            // 35,770,000% APR and the trillions/sec earning rate.
            //
            // Use the ground-truth formula from the contract directly, which
            // matches the web app's stake-details-card calculation:
            //   poolEmissionPerSec = poolReward / rewardDurationSeconds
            //   rewardPerTokenPerSec = poolEmissionPerSec / maxTvl
            //   userRewardPerSec = poolReward * userStaked / (maxTvl * duration)
            const tvlForApr = maxTvl > 0 ? maxTvl : (totalStakedNum > 0 ? totalStakedNum : 1);
            const poolEmissionPerSec = rewardDurationSeconds > 0
                ? poolRewardNum / rewardDurationSeconds
                : 0;
            const rewardPerTokenPerSec = poolEmissionPerSec / tvlForApr;
            const apr = rewardPerTokenPerSec * SECONDS_PER_YEAR_NUM * 100;

            aprValue = `${apr.toFixed(2)}%`;

            // User earning rate (TWC/sec) — derived from the same formula the
            // on-chain `_updatePool` uses: user's share of the fill-adjusted
            // emission. Equivalent closed form: user * poolReward / (maxTvl * duration).
            // The contract caps `_secondsElapsed` at `endTime`, so once the
            // pool has expired no further rewards accrue — zero the displayed
            // rate to match.
            const endTimeSec = Number(poolConfig[8] ?? poolConfig.endTime ?? 0);
            const isPoolExpired = endTimeSec > 0 && Date.now() / 1000 >= endTimeSec;
            if (maxTvl > 0 && rewardDurationSeconds > 0 && !isPoolExpired) {
                const userStakedNum = Number(formatUnits(userStaked, decimals));
                earningRate = (poolRewardNum * userStakedNum) / (maxTvl * rewardDurationSeconds);
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
            onChainClaimedTotal,
            onChainClaimedFormatted: formatUnits(onChainClaimedTotal, decimals),
            onChainTotalDeposited,
            onChainTotalDepositedFormatted: formatUnits(onChainTotalDeposited, decimals),
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
    }, [isMock, poolConfig, poolState, userInfo, allowance, stakingToken, isPoolLoading, isUserLoading, isAllowanceLoading, isTransactionPending, decimals, refetchAll, priceData, onChainClaimedTotal, onChainTotalDeposited]);

    return {
        ...stats,
        stake,
        unstake,
        claimRewards,
        maxUnstakeWithHarvest,
        approve
    };
}
