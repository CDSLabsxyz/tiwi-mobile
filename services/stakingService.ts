import { ERC20_ABI, STAKING_FACTORY_ABI } from '@/constants/abis';
import { MOCK_STAKING_POOLS, MOCK_USER_STAKES } from '@/constants/mockData';
import { formatCompactNumber } from '@/utils/formatting';
import { createPublicClient, formatUnits, http } from 'viem';
import { bsc } from 'viem/chains';
import { apiClient, APIStakingPool, APIUserStake } from './apiClient';
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

export interface StakingPool extends APIStakingPool {
    displayApy: string;
    displayLimits?: string;
    minStakingPeriod?: string;
    tvl?: string;
    activeStakers?: string;
}

export interface UserStake extends APIUserStake {
    displayApy: string;
    displayStakedAmount: string;
    displayRewardsEarned: string;
    minStakingPeriod?: string;
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
                        const poolStakes = await apiClient.getUserStakes(undefined, 'active', pool.id);
                        const uniqueWallets = new Set((poolStakes || []).map((s: any) => s.userWallet?.toLowerCase())).size;
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
            // Get all active pool IDs from factory
            const allPoolIds = await this.bscClient.readContract({
                address: BSC_FACTORY_ADDRESS as `0x${string}`,
                abi: STAKING_FACTORY_ABI,
                functionName: 'getActivePoolIds',
            }) as bigint[];

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
                const stakes = await apiClient.getUserStakes(undefined, 'active');
                const uniqueWallets = new Set((stakes || []).map((s: any) => s.userWallet?.toLowerCase())).size;
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
            let pools = await apiClient.getStakingPools('active');

            if (USE_MOCK_FALLBACK && (!pools || pools.length === 0)) {
                pools = MOCK_STAKING_POOLS;
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
     * Fetch user stakes and map to UI format
     */
    async getUserStakes(walletAddress: string, status?: string): Promise<UserStake[]> {
        if (!walletAddress && !USE_MOCK_FALLBACK) return [];
        try {
            let stakes = await apiClient.getUserStakes(walletAddress || '0x', status);

            if (USE_MOCK_FALLBACK && (!stakes || stakes.length === 0)) {
                stakes = MOCK_USER_STAKES.filter((s: APIUserStake) => !status || s.status === status);
            }

            return (stakes || []).map(stake => {
                const apyValue = stake.pool && typeof stake.pool.apy === 'number' ? `~${stake.pool.apy.toFixed(2)}%` : 'N/A';
                return {
                    ...stake,
                    displayApy: apyValue,
                    displayStakedAmount: `${stake.stakedAmount} ${stake.pool?.tokenSymbol || ''}`,
                    displayRewardsEarned: `${stake.rewardsEarned} ${stake.pool?.tokenSymbol || ''}`,
                    minStakingPeriod: stake.pool?.minStakingPeriod || '30 days'
                };
            });
        } catch (error) {
            console.error('[StakingService] Error fetching user stakes:', error);
            return [];
        }
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
}

export const stakingService = new StakingService();
