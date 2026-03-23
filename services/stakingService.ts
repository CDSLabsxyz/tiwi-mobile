import { ERC20_ABI, STAKING_FACTORY_ABI } from '@/constants/abis';
import { MOCK_STAKING_POOLS, MOCK_USER_STAKES } from '@/constants/mockData';
import { formatCompactNumber } from '@/utils/formatting';
import { createPublicClient, formatUnits, http } from 'viem';
import { bsc } from 'viem/chains';
import { api, StakingPool as SDKStakingPool, UserStake as SDKUserStake } from '@/lib/mobile/api-client';
import { RPC_CONFIG, RPC_TRANSPORT_OPTIONS } from '@/constants/rpc';

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
    activeStakersCount: string;
}

export interface StakingPool extends SDKStakingPool {
    displayApy: string;
    displayLimits?: string;
    minStakingPeriod?: string;
    tvl?: string;
    activeStakers?: string;
    tokenSymbol: string; // Ensure compatibility
    tokenName: string;
}

export interface UserStake extends Partial<SDKUserStake> {
    id: string;
    userWallet: string;
    stakedAmount: string;
    rewardsEarned: string;
    displayApy: string;
    displayStakedAmount: string;
    displayRewardsEarned: string;
    pendingRewardsFormatted?: string;
    minStakingPeriod?: string;
    earningRate?: number;
    pool: StakingPool;
    status: 'active' | 'completed' | 'withdrawn' | 'archived';
}

class StakingService {
    private bscClient = createPublicClient({
        chain: bsc,
        transport: http(RPC_CONFIG[56], RPC_TRANSPORT_OPTIONS)
    });

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

        // ON-CHAIN ENRICHMENT: Fetch real-time TVL and APY if we have a factory and poolId
        if (pool.chainId === 56 && pool.poolId !== undefined) {
            try {
                const poolInfo = await this.bscClient.readContract({
                    address: BSC_FACTORY_ADDRESS as `0x${string}`,
                    abi: STAKING_FACTORY_ABI,
                    functionName: 'getPoolInfo',
                    args: [BigInt(pool.poolId)],
                }) as any;

                if (poolInfo) {
                    const config = poolInfo[0];
                    const state = poolInfo[1];
                    const decimals = pool.decimals || (config.stakingToken.toLowerCase() === TWC_ADDRESS_BSC.toLowerCase() ? 9 : 18);

                    const totalStaked = Number(formatUnits(state.totalStaked, decimals));
                    const poolReward = Number(formatUnits(config.poolReward, decimals));
                    const maxTvl = Number(formatUnits(config.maxTvl, decimals));
                    const rewardDuration = Number(config.rewardDurationSeconds);

                    // Update TVL
                    tvl = formatCompactNumber(totalStaked, { decimals: 2 });

                    // Recalculate APY (On-chain is more accurate than DB)
                    // Matches web logic: use maxTvl if available, otherwise current totalStaked
                    const tvlForCalculation = maxTvl > 0 ? maxTvl : (totalStaked > 0 ? totalStaked : 1);
                    apyValue = this.calculateAPRFromPoolConfig(poolReward, tvlForCalculation, rewardDuration);

                    // Fetch active stakers for THIS specific pool from API
                    try {
                        const response = await api.staking.userStakes({
                            walletAddress: '', // Fetch all for count
                            poolId: pool.id
                        });
                        const uniqueWallets = new Set((response.stakes || []).map((s: any) => s.userWallet?.toLowerCase())).size;
                        activeStakers = uniqueWallets.toLocaleString();
                    } catch (e: any) {
                        console.warn(`[StakingService] Failed to fetch stakers for pool ${pool.id}`, e.message);
                    }
                }
            } catch (e: any) {
                console.warn(`[StakingService] Enrichment failed for pool ${pool.poolId}:`, e.message);
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
            activeStakers: activeStakers
        };
    }

    /**
     * Fetches global staking statistics from BSC
     */
    async getGlobalStakingStats(): Promise<StakingStats> {
        try {
            // 1. Get all active pool IDs from factory
            let allPoolIds: bigint[] = [];
            try {
                allPoolIds = await this.bscClient.readContract({
                    address: BSC_FACTORY_ADDRESS as `0x${string}`,
                    abi: STAKING_FACTORY_ABI,
                    functionName: 'getActivePoolIds',
                }) as bigint[];
            } catch (contractErr) {
                console.warn('[StakingService] Factory "getActivePoolIds" call failed, using empty list or fallback:', contractErr);
                // Return defaults if we can't even get pool IDs
                return {
                    overallTvl: '0',
                    maxTvl: '0',
                    totalTwcStaked: '0',
                    activePoolsCount: 0,
                    activeStakersCount: '0'
                };
            }

            if (!allPoolIds || allPoolIds.length === 0) {
                return {
                    overallTvl: '0',
                    maxTvl: '0',
                    totalTwcStaked: '0',
                    activePoolsCount: 0,
                    activeStakersCount: '0'
                };
            }

            let totalStakedValueNum = 0;
            let totalMaxTvlValueNum = 0;
            let twcStakedValueNum = 0;

            // Query pool info for all active pools
            await Promise.all(allPoolIds.map(async (poolId) => {
                try {
                    const poolInfo = await this.bscClient.readContract({
                        address: BSC_FACTORY_ADDRESS as `0x${string}`,
                        abi: STAKING_FACTORY_ABI,
                        functionName: 'getPoolInfo',
                        args: [poolId],
                    }) as any;

                    const config = poolInfo[0];
                    const state = poolInfo[1];

                    const poolDecimals = (config.stakingToken.toLowerCase() === TWC_ADDRESS_BSC.toLowerCase()) ? 9 : 18;
                    const staked = Number(formatUnits(state.totalStaked, poolDecimals));
                    const maxTvl = Number(formatUnits(config.maxTvl, poolDecimals));

                    totalStakedValueNum += staked;
                    totalMaxTvlValueNum += maxTvl;

                    if (config.stakingToken.toLowerCase() === TWC_ADDRESS_BSC.toLowerCase()) {
                        twcStakedValueNum += staked;
                    }
                } catch (e) {
                    console.warn(`[StakingService] Failed to fetch info for pool ${poolId}`, e);
                }
            }));

            // Fetch active stakers count from API (global)
            let stakersCount = '0';
            try {
                const response = await api.staking.userStakes({ walletAddress: '' });
                const uniqueWallets = new Set((response.stakes || []).map((s: any) => s.userWallet?.toLowerCase())).size;
                stakersCount = uniqueWallets.toLocaleString();
            } catch (e: any) {
                console.warn('[StakingService] Failed to fetch global stakers count:', e.message);
            }

            return {
                overallTvl: formatCompactNumber(totalStakedValueNum, { decimals: 2 }),
                maxTvl: formatCompactNumber(totalMaxTvlValueNum, { decimals: 2 }),
                totalTwcStaked: formatCompactNumber(twcStakedValueNum, { decimals: 2 }),
                activePoolsCount: allPoolIds.length,
                activeStakersCount: stakersCount
            };
        } catch (error) {
            console.error('[StakingService] Error fetching global staking stats:', error);
            return {
                overallTvl: '0',
                maxTvl: '0',
                totalTwcStaked: '0',
                activePoolsCount: 0,
                activeStakersCount: '0'
            };
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
            const enrichedPools = await Promise.all((pools || []).map(pool => this.mapPool(pool)));
            return enrichedPools;
        } catch (error) {
            console.error('[StakingService] Error fetching active pools:', error);
            if (USE_MOCK_FALLBACK) {
                return Promise.all(MOCK_STAKING_POOLS.map(pool => this.mapPool(pool)));
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

                const earningRate = (stakedNum / Math.max(1, Number(totalStaked))) * (Number(poolReward) / Math.max(1, Number(duration)));

                return {
                    ...stake,
                    pool: (enrichedPool as StakingPool) || stake.pool!,
                    displayApy: (enrichedPool as StakingPool)?.displayApy || 'N/A',
                    displayStakedAmount: `${stake.stakedAmount} ${stake.pool?.tokenSymbol || ''}`,
                    displayRewardsEarned: `${stake.rewardsEarned} ${stake.pool?.tokenSymbol || ''}`,
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
     * Get a specific stake for a user by symbol
     */
    async getUserStakeBySymbol(walletAddress: string, symbol: string): Promise<UserStake | undefined> {
        const stakes = await this.getUserStakes(walletAddress, 'active');
        return stakes.find(s => s.pool?.tokenSymbol.toLowerCase() === symbol.toLowerCase());
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
     * READINESS: Check ERC20 allowance
     */
    async getAllowance(tokenAddress: string, ownerAddress: string): Promise<bigint> {
        try {
            const allowance = await this.bscClient.readContract({
                address: tokenAddress as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'allowance',
                args: [ownerAddress as `0x${string}`, BSC_FACTORY_ADDRESS as `0x${string}`],
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
