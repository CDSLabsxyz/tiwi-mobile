import { ERC20_ABI, STAKING_FACTORY_ABI } from '@/constants/abis';
import { MOCK_STAKING_POOLS, MOCK_USER_STAKES } from '@/constants/mockData';
import { formatCompactNumber } from '@/utils/formatting';
import { createPublicClient, formatUnits, http } from 'viem';
import { bsc } from 'viem/chains';
import { apiClient, APIStakingPool, APIUserStake } from './apiClient';

// Toggle this to enable/disable mocks globally for staking
const USE_MOCK_FALLBACK = false;

// TWC Token Address on BSC
const TWC_ADDRESS_BSC = '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596';
// BSC Factory Address
const BSC_FACTORY_ADDRESS = '0x9178044f7cC0DD0dB121E7fCD4b068a0d1B76b07';

export interface StakingPool extends APIStakingPool {
    displayApy: string;
    displayLimits?: string;
    minStakingPeriod?: string;
}

export interface UserStake extends APIUserStake {
    displayApy: string;
    displayStakedAmount: string;
    displayRewardsEarned: string;
    minStakingPeriod?: string;
}

import { RPC_CONFIG, RPC_TRANSPORT_OPTIONS } from '@/constants/rpc';

class StakingService {
    private bscClient = createPublicClient({
        chain: bsc,
        transport: http(RPC_CONFIG[56], RPC_TRANSPORT_OPTIONS)
    });

    /**
     * Helper to map pool to UI format
     */
    private mapPool(pool: APIStakingPool): StakingPool {
        const apyValue = typeof pool.apy === 'number' ? `~${pool.apy.toFixed(2)}%` : 'N/A';

        // Compact Limits Formatting: 1,000,000 -> 1M
        let displayLimits = 'N/A';
        if (pool.minStakeAmount && pool.maxStakeAmount) {
            const minStr = formatCompactNumber(pool.minStakeAmount, { decimals: 0 });
            const maxStr = formatCompactNumber(pool.maxStakeAmount, { decimals: 0 });
            displayLimits = `${minStr}-${maxStr} ${pool.tokenSymbol}`;
        } else if (pool.minStakeAmount) {
            displayLimits = `Min: ${formatCompactNumber(pool.minStakeAmount, { decimals: 0 })} ${pool.tokenSymbol}`;
        }

        return {
            ...pool,
            displayApy: apyValue,
            displayLimits,
            minStakingPeriod: pool.minStakingPeriod || '30 days' // Fallback to 30 days based on backend data
        };
    }

    /**
     * Fetches the total TWC staked across all factory pools on BSC
     */
    async getTotalTwcStaked(): Promise<string> {
        try {
            // Get all pool IDs from factory
            const allPoolIds = await this.bscClient.readContract({
                address: BSC_FACTORY_ADDRESS as `0x${string}`,
                abi: STAKING_FACTORY_ABI,
                functionName: 'getActivePoolIds',
            }) as bigint[];

            if (!allPoolIds || allPoolIds.length === 0) {
                return '0 TWC';
            }

            let totalStaked = BigInt(0);

            // Query pool info for all active pools
            // In a production app, this would be optimized via multicall or indexing service
            const poolsToQuery = allPoolIds.slice(-20); // Query last 20 for performance

            await Promise.all(poolsToQuery.map(async (poolId) => {
                try {
                    const poolInfo = await this.bscClient.readContract({
                        address: BSC_FACTORY_ADDRESS as `0x${string}`,
                        abi: STAKING_FACTORY_ABI,
                        functionName: 'getPoolInfo',
                        args: [poolId],
                    }) as any;

                    // poolInfo returns [config, state]
                    const config = poolInfo[0];
                    const state = poolInfo[1];

                    if (config.stakingToken.toLowerCase() === TWC_ADDRESS_BSC.toLowerCase()) {
                        totalStaked += state.totalStaked;
                    }
                } catch (e) {
                    console.warn(`[StakingService] Failed to fetch info for pool ${poolId}`, e);
                }
            }));

            const formatted = formatUnits(totalStaked, 9);
            const num = Number(formatted);
            const compact = formatCompactNumber(num, { decimals: 0 });
            return `${compact} TWC`;
        } catch (error) {
            console.error('[StakingService] Error fetching total TWC staked:', error);
            return '0 TWC';
        }
    }

    /**
     * Helper to map stake to UI format
     */
    private mapStake(stake: APIUserStake): UserStake {
        const apyValue = stake.pool && typeof stake.pool.apy === 'number' ? `~${stake.pool.apy.toFixed(2)}%` : 'N/A';
        return {
            ...stake,
            displayApy: apyValue,
            displayStakedAmount: `${stake.stakedAmount} ${stake.pool?.tokenSymbol || ''}`,
            displayRewardsEarned: `${stake.rewardsEarned} ${stake.pool?.tokenSymbol || ''}`,
            minStakingPeriod: stake.pool?.minStakingPeriod || '30 days'
        };
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

            return (pools || []).map(pool => this.mapPool(pool));
        } catch (error) {
            console.error('[StakingService] Error fetching active pools:', error);
            if (USE_MOCK_FALLBACK) {
                return MOCK_STAKING_POOLS.map(pool => this.mapPool(pool));
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

            return (stakes || []).map(stake => this.mapStake(stake));
        } catch (error) {
            console.error('[StakingService] Error fetching user stakes:', error);
            if (USE_MOCK_FALLBACK) {
                return MOCK_USER_STAKES
                    .filter((s: APIUserStake) => !status || s.status === status)
                    .map(stake => this.mapStake(stake));
            }
            return [];
        }
    }

    /**
     * Get a specific pool by symbol or ID
     * DISCOVERY: If pool not in API cache, attempt to find its ID on BSC on-chain
     */
    async getPoolBySymbol(symbol: string): Promise<StakingPool | undefined> {
        try {
            const pools = await this.getActivePools();
            const pool = pools.find(p => p.tokenSymbol.toLowerCase() === symbol.toLowerCase());

            if (pool) return pool;

            // ON-CHAIN DISCOVERY FALLBACK
            // In a pro app, we'd resolve the symbol to an address first.
            // For Tiwi, we typically stake 'TWC' or major assets with 'TWC' as rewards.
            if (symbol.toUpperCase() === 'TWC') {
                const discoveredIds = await this.discoverPoolsOnChain(TWC_ADDRESS_BSC, TWC_ADDRESS_BSC);
                if (discoveredIds.length > 0) {
                    // Fetch full info for the found ID
                    const poolInfo = await this.bscClient.readContract({
                        address: BSC_FACTORY_ADDRESS as `0x${string}`,
                        abi: STAKING_FACTORY_ABI,
                        functionName: 'getPoolInfo',
                        args: [discoveredIds[0]],
                    }) as any;

                    return this.mapPool({
                        id: `discovered-${discoveredIds[0]}`,
                        tokenSymbol: 'TWC',
                        tokenName: 'Tiwi Token',
                        apy: 0, // State-based APR calculation would go here
                        contractAddress: BSC_FACTORY_ADDRESS,
                        chainId: bsc.id,
                        tokenAddress: TWC_ADDRESS_BSC,
                        poolId: Number(discoveredIds[0]),
                        status: 'active'
                    });
                }
            }

            return undefined;
        } catch (error) {
            console.error('[StakingService] Error fetching pool by symbol:', error);
            return undefined;
        }
    }

    /**
     * Get user's stake for a specific pool by symbol
     */
    async getUserStakeBySymbol(walletAddress: string, symbol: string): Promise<UserStake | undefined> {
        try {
            const stakes = await this.getUserStakes(walletAddress, 'active');
            return stakes.find(s => s.pool.tokenSymbol.toLowerCase() === symbol.toLowerCase());
        } catch (error) {
            console.error('[StakingService] Error fetching user stake by symbol:', error);
            return undefined;
        }
    }

    /**
     * DISCOVERY: Find pool IDs for a specific token pair on-chain
     */
    async discoverPoolsOnChain(stakingToken: string, rewardToken: string): Promise<bigint[]> {
        try {
            const poolIds = await this.bscClient.readContract({
                address: BSC_FACTORY_ADDRESS as `0x${string}`,
                abi: STAKING_FACTORY_ABI,
                functionName: 'getPoolsByTokenPair',
                args: [stakingToken, rewardToken],
            }) as bigint[];
            return poolIds || [];
        } catch (error) {
            console.error('[StakingService] On-chain discovery failed:', error);
            return [];
        }
    }

    /**
     * READINESS: Check ERC20 allowance for a token against the factory
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
