import { ERC20_ABI, STAKING_FACTORY_ABI, STAKING_POOL_V2_ABI } from '@/constants/abis';
import { MOCK_STAKING_POOLS, MOCK_USER_STAKES } from '@/constants/mockData';
import { formatCompactNumber } from '@/utils/formatting';
import { createPublicClient, formatUnits, http } from 'viem';
import { bsc } from 'viem/chains';
import { api, StakingPool as SDKStakingPool } from '@/lib/mobile/api-client';
import type { APIStakingPool, APIUserStake } from '@/services/apiClient';
import { RPC_CONFIG, RPC_TRANSPORT_OPTIONS, createBscFallbackTransport } from '@/constants/rpc';

// Toggle this to enable/disable mocks globally for staking
const USE_MOCK_FALLBACK = false;

// TWC Token Address on BSC
const TWC_ADDRESS_BSC = '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596';
// BSC Factory Address - Updated to match official production address for TWC
const BSC_FACTORY_ADDRESS = '0x8505c412Ba61e5B260686a260C5213905DAAa130';

const SECONDS_PER_YEAR = 31536000;

export interface StakingStats {
    overallTvl: string;
    maxTvl: string;
    totalTwcStaked: string;
    activePoolsCount: number;
    inactivePoolsCount: number;
    activeStakersCount: string;
    allTimeStakersCount: string;
}

export interface StakingPool extends APIStakingPool {
    displayApy: string;
    displayLimits?: string;
    minStakingPeriod?: string;
    tvl?: string;
    activeStakers?: string;
    tokenName: string;
    chainName?: string;
    createdAt?: string;
    updatedAt?: string;
    /**
     * Contract `endTime` in epoch seconds (0 if unknown or non-V2). Once
     * `Date.now()/1000 >= endTime`, the pool stops emitting rewards on-chain.
     */
    endTime?: number;
}

export interface UserStake {
    id: string;
    userWallet: string;
    stakedAmount: string;
    rewardsEarned: string;
    /** Rewards the user explicitly claimed via the Claim button (cumulative). */
    totalClaimed?: string;
    displayApy: string;
    displayStakedAmount: string;
    displayRewardsEarned: string;
    pendingRewardsFormatted?: string;
    minStakingPeriod?: string;
    earningRate?: number;
    pool: StakingPool;
    status: 'active' | 'completed' | 'withdrawn' | 'archived';
    transactionHash?: string;
    lockPeriodDays?: number;
    lockEndDate?: string;
    createdAt?: string;
    updatedAt?: string;
}

class StakingService {
    private bscClient = createPublicClient({
        chain: bsc,
        transport: createBscFallbackTransport(),
    });

    /** Cache of last successful global stats — used to avoid rendering a
     *  partial-failure result if even one pool's on-chain read fails. */
    private lastGoodStats: StakingStats | null = null;

    /**
     * Utility to calculate APR for a pool based on on-chain config
     */
    private calculateAPRFromPoolConfig(
        poolReward: number,
        totalStakedTokens: number,
        rewardDurationSeconds: number
    ): string {
        if (totalStakedTokens <= 0 || rewardDurationSeconds <= 0) return '0.00%';

        // Formula: reward / (staked * time) * year
        const rewardRatePerTokenPerSecond = poolReward / (totalStakedTokens * rewardDurationSeconds);
        const apr = rewardRatePerTokenPerSecond * SECONDS_PER_YEAR * 100;

        return `~${apr.toFixed(2)}%`;
    }

    /**
     * Helper to map pool to UI format with on-chain enrichment
     */
    private async mapPool(pool: APIStakingPool): Promise<StakingPool> {
        let apyValue = typeof pool.apy === 'number' ? `~${pool.apy.toFixed(2)}%` : 'N/A';
        let tvl = pool.tvl || 'N/A';
        let activeStakers = pool.activeStakers || '0';
        let endTime = 0;

        // ON-CHAIN ENRICHMENT: Fetch real-time TVL and APY. Two architectures:
        //   - V2 pool-per-contract: read `poolContractAddress` directly.
        //   - Legacy factory: read factory.getPoolInfo(poolId).
        // V2 takes precedence when the DB row carries a poolContractAddress.
        const hasV2 = !!pool.poolContractAddress;
        const hasLegacy = pool.chainId === 56 && pool.poolId !== undefined;
        if (hasV2 || hasLegacy) {
            try {
                let totalStaked = 0;
                let poolReward = 0;
                let maxTvl = 0;
                let rewardDuration = 0;
                let stakingTokenAddr: string | undefined;

                if (hasV2) {
                    // V2: getPoolInfo returns a 13-tuple, no args.
                    const info = await this.bscClient.readContract({
                        address: pool.poolContractAddress as `0x${string}`,
                        abi: STAKING_POOL_V2_ABI,
                        functionName: 'getPoolInfo',
                    }) as any;
                    stakingTokenAddr = info?.[0];
                    const decimals = pool.decimals || (stakingTokenAddr?.toLowerCase() === TWC_ADDRESS_BSC.toLowerCase() ? 9 : 18);
                    poolReward = Number(formatUnits(info[3] ?? 0n, decimals));
                    rewardDuration = Number(info[4] ?? 0n);
                    maxTvl = Number(formatUnits(info[5] ?? 0n, decimals));
                    endTime = Number(info[8] ?? 0n);
                    totalStaked = Number(formatUnits(info[10] ?? 0n, decimals));
                } else {
                    const poolInfo = await this.bscClient.readContract({
                        address: BSC_FACTORY_ADDRESS as `0x${string}`,
                        abi: STAKING_FACTORY_ABI,
                        functionName: 'getPoolInfo',
                        args: [BigInt(pool.poolId!)],
                    }) as any;

                    if (!poolInfo) throw new Error('Empty factory response');
                    const config = poolInfo[0];
                    const state = poolInfo[1];
                    stakingTokenAddr = config.stakingToken;
                    const decimals = pool.decimals || (stakingTokenAddr?.toLowerCase() === TWC_ADDRESS_BSC.toLowerCase() ? 9 : 18);
                    totalStaked = Number(formatUnits(state.totalStaked, decimals));
                    poolReward = Number(formatUnits(config.poolReward, decimals));
                    maxTvl = Number(formatUnits(config.maxTvl, decimals));
                    rewardDuration = Number(config.rewardDurationSeconds);
                    endTime = Number(config.endTime ?? state.endTime ?? 0);
                }

                tvl = formatCompactNumber(totalStaked, { decimals: 2 });
                const tvlForCalculation = maxTvl > 0 ? maxTvl : (totalStaked > 0 ? totalStaked : 1);
                apyValue = this.calculateAPRFromPoolConfig(poolReward, tvlForCalculation, rewardDuration);

                try {
                    const response = await api.staking.userStakes({
                        walletAddress: '',
                        poolId: pool.id
                    });
                    const uniqueWallets = new Set((response.stakes || []).map((s: any) => s.userWallet?.toLowerCase())).size;
                    activeStakers = uniqueWallets.toLocaleString();
                } catch (e: any) {
                    console.warn(`[StakingService] Failed to fetch stakers for pool ${pool.id}`, e.message);
                }
            } catch (e: any) {
                console.warn(`[StakingService] Enrichment failed for pool ${pool.id}:`, e.message);
            }
        }

        // Compact Limits Formatting
        let displayLimits = 'N/A';
        if (pool.minStakeAmount && pool.maxStakeAmount) {
            const minStr = formatCompactNumber(pool.minStakeAmount, { decimals: 0 });
            const maxStr = formatCompactNumber(pool.maxStakeAmount, { decimals: 0 });
            displayLimits = `${minStr}-${maxStr} ${pool.tokenSymbol}`;
        }

        return {
            ...pool,
            displayApy: apyValue,
            displayLimits,
            minStakingPeriod: pool.minStakingPeriod || '30 days',
            tvl: tvl,
            activeStakers: activeStakers,
            endTime,
        };
    }

    /**
     * Fetches global staking statistics from BSC
     */
    async getGlobalStakingStats(): Promise<StakingStats> {
        const empty: StakingStats = {
            overallTvl: '0',
            maxTvl: '0',
            totalTwcStaked: '0',
            activePoolsCount: 0,
            inactivePoolsCount: 0,
            activeStakersCount: '0',
            allTimeStakersCount: '0',
        };
        try {
            // Pull DB pools (all statuses) + all user stakes (any status).
            // Mirrors the super-app's page.tsx:357-370 — lets us compute
            // both active-only and all-time metrics from a single pass.
            const [poolsResponseAll, stakesAllResp] = await Promise.all([
                (async () => {
                    try { return await api.staking.list(); } catch { return { pools: [] as any[] }; }
                })(),
                (async () => {
                    try { return await api.staking.userStakes({ walletAddress: '' }); } catch { return { stakes: [] as any[] }; }
                })(),
            ]);

            const allPools = (poolsResponseAll as any).pools || [];
            const allStakes = (stakesAllResp as any).stakes || [];

            // Pool status, TVL cap, and live staked are read DIRECTLY from
            // the pool contract (V2 pool-per-contract, or legacy factory).
            // The DB's `status` and `maxTvl` columns drift — admins can pause
            // a pool on-chain without touching the DB, and endTime is set at
            // deployment and may not be persisted. On-chain is ground truth.
            //
            // The bscClient now uses a multi-provider fallback transport
            // (Alchemy + Binance dataseed + publicnode + drpc + ankr), and
            // we treat a partial RPC failure as all-or-nothing — if any pool
            // doesn't resolve we return the last good snapshot rather than
            // emit a half-complete total (the prior behaviour was the cause
            // of the 12M ↔ 122.1M ↔ 5T flicker on the dashboard).
            //
            // Stakers counts still come from the DB because there's no
            // efficient on-chain way to enumerate historical users.
            const nowSec = Math.floor(Date.now() / 1000);
            const onChainStats = await Promise.all(allPools.map(async (p: any) => {
                const hasV2 = !!p.poolContractAddress;
                const hasLegacy = (p.chainId ?? 56) === 56 && p.poolId !== undefined && p.poolId !== null;
                if (!hasV2 && !hasLegacy) {
                    return {
                        ok: true as const,
                        isActive: p.status === 'active',
                        maxTvlTok: 0,
                        totalStakedTok: 0,
                        tokenSymbol: (p.tokenSymbol || '').toUpperCase(),
                    };
                }
                try {
                    let active = false;
                    let endTimeSec = 0;
                    let maxTvlTok = 0;
                    let totalStakedTok = 0;
                    let tokenSymbol = (p.tokenSymbol || '').toUpperCase();
                    if (hasV2) {
                        const info = await this.bscClient.readContract({
                            address: p.poolContractAddress as `0x${string}`,
                            abi: STAKING_POOL_V2_ABI,
                            functionName: 'getPoolInfo',
                        }) as any;
                        const stakingTokenAddr: string | undefined = info?.[0];
                        const decimals = p.decimals || (stakingTokenAddr?.toLowerCase() === TWC_ADDRESS_BSC.toLowerCase() ? 9 : 18);
                        maxTvlTok = Number(formatUnits(info[5] ?? 0n, decimals));
                        endTimeSec = Number(info[8] ?? 0n);
                        active = Boolean(info[9]);
                        totalStakedTok = Number(formatUnits(info[10] ?? 0n, decimals));
                    } else {
                        const poolInfo = await this.bscClient.readContract({
                            address: BSC_FACTORY_ADDRESS as `0x${string}`,
                            abi: STAKING_FACTORY_ABI,
                            functionName: 'getPoolInfo',
                            args: [BigInt(p.poolId!)],
                        }) as any;
                        const config = poolInfo?.[0];
                        const state = poolInfo?.[1];
                        const stakingTokenAddr: string | undefined = config?.stakingToken;
                        const decimals = p.decimals || (stakingTokenAddr?.toLowerCase() === TWC_ADDRESS_BSC.toLowerCase() ? 9 : 18);
                        maxTvlTok = Number(formatUnits(config?.maxTvl ?? 0n, decimals));
                        endTimeSec = Number(config?.endTime ?? state?.endTime ?? 0);
                        active = Boolean(config?.active ?? state?.active ?? false);
                        totalStakedTok = Number(formatUnits(state?.totalStaked ?? 0n, decimals));
                    }
                    const notExpired = endTimeSec === 0 || nowSec < endTimeSec;
                    return {
                        ok: true as const,
                        isActive: active && notExpired,
                        maxTvlTok,
                        totalStakedTok,
                        tokenSymbol,
                    };
                } catch (e) {
                    console.warn(`[StakingService] Pool ${p.id} on-chain status read failed across all RPC fallbacks:`, e);
                    return { ok: false as const };
                }
            }));

            // All-or-nothing: if any pool didn't resolve, keep the previous
            // snapshot rather than publish a partial total. This is what kills
            // the dashboard flicker.
            if (onChainStats.some((s) => !s.ok) && this.lastGoodStats) {
                console.warn('[StakingService] Partial RPC failure — returning last good stats');
                return this.lastGoodStats;
            }

            const resolvedStats = onChainStats.filter(
                (s): s is Extract<typeof s, { ok: true }> => s.ok,
            );
            const activeCount = resolvedStats.filter((s) => s.isActive).length;
            const inactiveCount = Math.max(0, resolvedStats.length - activeCount);
            const overallTvlSum = resolvedStats.reduce((sum, s) => sum + s.maxTvlTok, 0);
            const twcStaked = resolvedStats.reduce((sum, s) => (
                s.tokenSymbol === 'TWC' ? sum + s.totalStakedTok : sum
            ), 0);

            const activeWallets = new Set<string>();
            const allTimeWallets = new Set<string>();
            for (const stake of allStakes) {
                const wallet = stake.userWallet?.toLowerCase();
                if (!wallet) continue;
                allTimeWallets.add(wallet);
                if (stake.status === 'active') activeWallets.add(wallet);
            }

            const stats: StakingStats = {
                overallTvl: formatCompactNumber(overallTvlSum, { decimals: 2 }),
                maxTvl: formatCompactNumber(overallTvlSum, { decimals: 2 }),
                totalTwcStaked: formatCompactNumber(twcStaked, { decimals: 2 }),
                activePoolsCount: activeCount,
                inactivePoolsCount: inactiveCount,
                activeStakersCount: activeWallets.size.toLocaleString(),
                allTimeStakersCount: allTimeWallets.size.toLocaleString(),
            };
            this.lastGoodStats = stats;
            return stats;
        } catch (error) {
            console.error('[StakingService] Error fetching global staking stats:', error);
            return this.lastGoodStats ?? empty;
        }
    }

    /**
     * Fetch active staking pools and map to UI format
     */
    async getActivePools(): Promise<StakingPool[]> {
        try {
            const response = await api.staking.list({ status: 'active' });
            let pools = response.pools || [];

            if (USE_MOCK_FALLBACK && pools.length === 0) {
                pools = MOCK_STAKING_POOLS as any;
            }

            // Map and enrich sequentially to avoid RPC spam, though Promise.all is faster
            const enrichedPools = await Promise.all((pools || []).map((pool: any) => this.mapPool(pool as APIStakingPool)));
            return enrichedPools;
        } catch (error) {
            console.error('[StakingService] Error fetching active pools:', error);
            if (USE_MOCK_FALLBACK) {
                return Promise.all(MOCK_STAKING_POOLS.map((pool: any) => this.mapPool(pool as APIStakingPool)));
            }
            return [];
        }
    }

    /**
     * Fetch user stakes and map to UI format with on-chain enrichment
     */
    async getUserStakes(walletAddress: string, status?: string): Promise<UserStake[]> {
        if (!walletAddress && !USE_MOCK_FALLBACK) return [];
        try {
            const response = await api.staking.userStakes({ walletAddress });
            let stakes = response.stakes || [];

            if (USE_MOCK_FALLBACK && stakes.length === 0) {
                stakes = MOCK_USER_STAKES.filter((s: any) => !status || s.status === status);
            }

            // Enrich all stakes with on-chain pool info in parallel
            return await Promise.all(stakes.map(async (stake: any) => {
                let enrichedPool = stake.pool;
                if (stake.pool) {
                    enrichedPool = await this.mapPool(stake.pool);
                }

                const stakedNum = parseFloat(stake.stakedAmount) || 0;
                const poolReward = (enrichedPool as any)?.poolRewardNum || (enrichedPool as any)?.poolReward || 0;
                const totalStaked = (enrichedPool as any)?.totalStakedNum || (enrichedPool as any)?.totalStaked || 1;
                const duration = (enrichedPool as any)?.rewardDurationSeconds || 1;

                // Zero out the displayed emission rate once the pool's on-chain
                // endTime has passed — the contract's `_secondsElapsed` caps
                // at endTime so no further rewards accrue.
                const poolEndTime = (enrichedPool as any)?.endTime || 0;
                const isExpired = poolEndTime > 0 && Date.now() / 1000 >= poolEndTime;
                const earningRate = isExpired
                    ? 0
                    : (stakedNum / Math.max(1, Number(totalStaked))) * (Number(poolReward) / Math.max(1, Number(duration)));

                return {
                    ...stake,
                    pool: (enrichedPool as StakingPool) || stake.pool!,
                    displayApy: (enrichedPool as StakingPool)?.displayApy || 'N/A',
                    displayStakedAmount: `${stake.stakedAmount} ${stake.pool?.tokenSymbol || ''}`,
                    displayRewardsEarned: `${stake.rewardsEarned} ${stake.pool?.tokenSymbol || ''}`,
                    totalClaimed: (stake as any).totalClaimed ?? '0',
                    minStakingPeriod: (enrichedPool as StakingPool)?.minStakingPeriod || stake.pool?.minStakingPeriod || '30 days',
                    earningRate
                };
            }));
        } catch (error) {
            console.error('[StakingService] Error fetching user stakes:', error);
            return [];
        }
    }

    /**
     * Get a specific stake for a user by symbol or pool DB UUID. Resolving
     * by UUID first prevents Genesis 1 and Genesis 2 (both 'TWC') from
     * collapsing onto whichever stake is returned first.
     */
    async getUserStakeBySymbol(walletAddress: string, symbolOrPoolId: string): Promise<UserStake | undefined> {
        const stakes = await this.getUserStakes(walletAddress, 'active');
        const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(symbolOrPoolId);
        if (looksLikeUuid) {
            const byPool = stakes.find(s => s.pool?.id === symbolOrPoolId);
            if (byPool) return byPool;
        }
        return stakes.find(s => s.pool?.tokenSymbol?.toLowerCase() === symbolOrPoolId.toLowerCase());
    }

    /**
     * Get a specific pool by symbol or ID
     */
    async getPoolBySymbol(symbol: string): Promise<StakingPool | undefined> {
        try {
            const pools = await this.getActivePools();
            return pools.find(p => p.tokenSymbol.toLowerCase() === symbol.toLowerCase());
        } catch (error) {
            console.error('[StakingService] Error fetching pool by symbol:', error);
            return undefined;
        }
    }

    /**
     * Resolve a route param that may be either a pool DB id (UUID) OR a token
     * symbol (legacy deep links). Multiple pools share the same token symbol
     * (e.g., Genesis 1 and Genesis 2 are both TWC), so symbol-based lookup
     * collapses them onto the first match — that was why tapping Genesis 1
     * always opened Genesis 2. Prefer id when it looks like a UUID.
     */
    async getPoolByIdOrSymbol(idOrSymbol: string): Promise<StakingPool | undefined> {
        try {
            const pools = await this.getActivePools();
            const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSymbol);
            if (looksLikeUuid) {
                const byId = pools.find(p => p.id === idOrSymbol);
                if (byId) return byId;
            }
            return pools.find(p => p.tokenSymbol.toLowerCase() === idOrSymbol.toLowerCase());
        } catch (error) {
            console.error('[StakingService] Error fetching pool by id-or-symbol:', error);
            return undefined;
        }
    }

    /**
     * READINESS: Check ERC20 allowance against the STAKING TARGET.
     *
     * For V2 per-pool contracts the spender must be the pool's own address
     * (the pool calls `transferFrom`), NOT the legacy factory. Callers that
     * omit `spenderAddress` fall back to the legacy factory for back-compat
     * with old factory-style pools, but any V2 caller should pass its pool
     * contract address — otherwise `needsApproval` will read the wrong
     * allowance and the subsequent deposit reverts with "0x" when the
     * token's `transferFrom` fails.
     */
    async getAllowance(
        tokenAddress: string,
        ownerAddress: string,
        spenderAddress: string = BSC_FACTORY_ADDRESS,
    ): Promise<bigint> {
        try {
            const allowance = await this.bscClient.readContract({
                address: tokenAddress as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'allowance',
                args: [ownerAddress as `0x${string}`, spenderAddress as `0x${string}`],
            }) as bigint;
            return allowance;
        } catch (error) {
            console.error('[StakingService] Failed to fetch allowance:', error);
            return BigInt(0);
        }
    }

    /**
     * CRAWLER: Discovers user positions directly from blockchain factory
     * This ensures the app sees positions even if they aren't indexed in the DB yet
     */
    async discoverOnChainPositions(walletAddress: string): Promise<UserStake[]> {
        if (!walletAddress) return [];
        try {
            // 1. Get all active pool IDs from factory
            const allPoolIds = await this.bscClient.readContract({
                address: BSC_FACTORY_ADDRESS as `0x${string}`,
                abi: STAKING_FACTORY_ABI,
                functionName: 'getActivePoolIds',
            }) as bigint[];

            if (!allPoolIds || allPoolIds.length === 0) return [];

            // 2. Scan all pools in parallel for user balances
            const discovered = await Promise.all(allPoolIds.map(async (poolId) => {
                try {
                    const userInfo = await this.bscClient.readContract({
                        address: BSC_FACTORY_ADDRESS as `0x${string}`,
                        abi: STAKING_FACTORY_ABI,
                        functionName: 'getUserInfo',
                        args: [poolId, walletAddress as `0x${string}`],
                    }) as [bigint, bigint, bigint, bigint];

                    const amount = userInfo[0];
                    if (amount > 0n) {
                        // Position found! Hydrate it with pool data
                        const poolInfo = await this.bscClient.readContract({
                            address: BSC_FACTORY_ADDRESS as `0x${string}`,
                            abi: STAKING_FACTORY_ABI,
                            functionName: 'getPoolInfo',
                            args: [poolId],
                        }) as any;

                        const config = poolInfo[0];
                        const decimals = (config.stakingToken.toLowerCase() === TWC_ADDRESS_BSC.toLowerCase()) ? 9 : 18;

                        // Create a skeleton pool for mapping
                        const poolRecord: any = {
                            id: poolId.toString(),
                            poolId: Number(poolId),
                            tokenSymbol: config.stakingToken.toLowerCase() === TWC_ADDRESS_BSC.toLowerCase() ? 'TWC' : 'Tokens',
                            decimals,
                            chainId: 56
                        };

                        const apiPool = await this.mapPool(poolRecord);
                        const stakedAmountStr = formatUnits(amount, decimals);

                        return {
                            id: `live-${poolId}-${walletAddress.slice(2, 6)}`,
                            userWallet: walletAddress,
                            stakedAmount: stakedAmountStr,
                            rewardsEarned: formatUnits(userInfo[3], decimals),
                            status: 'active' as const,
                            createdAt: new Date(Number(userInfo[2]) * 1000).toISOString(),
                            pool: apiPool,
                            displayApy: apiPool.displayApy,
                            displayStakedAmount: `${stakedAmountStr} ${apiPool.tokenSymbol}`,
                            displayRewardsEarned: `${formatUnits(userInfo[3], decimals)} ${apiPool.tokenSymbol}`,
                            minStakingPeriod: apiPool.minStakingPeriod || '30 days',
                            earningRate: 0 // Will be calculated by store
                        } as UserStake;
                    }
                } catch (e) {
                    // Fail silently for individual pools
                }
                return null;
            }));

            return discovered.filter((s): s is UserStake => s !== null);
        } catch (error) {
            console.error('[StakingService] Discovery crawler failed:', error);
            return [];
        }
    }
}

export const stakingService = new StakingService();
