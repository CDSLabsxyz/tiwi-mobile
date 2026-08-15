import { ERC20_ABI, STAKING_FACTORY_ABI, STAKING_POOL_V2_ABI } from '@/constants/abis';
import { MOCK_STAKING_POOLS, MOCK_USER_STAKES } from '@/constants/mockData';
import { formatCompactNumber } from '@/utils/formatting';
import { createPublicClient, formatUnits } from 'viem';
import { bsc } from 'viem/chains';
import { api, type MobilePool, type TokenPriceRequestToken } from '@/lib/mobile/api-client';
import { resolveRewardToken } from '@/lib/mobile/pool-onchain';
import type { APIStakingPool } from '@/services/apiClient';
import { createBscFallbackTransport } from '@/constants/rpc';
import { getTokenLogo } from '@/services/tokenLogoService';
import { ensureAdminTokenLogoOverrides, normalizeTokenLogoUrl } from '@/utils/admin-token-logos';

// Toggle this to enable/disable mocks globally for staking
const USE_MOCK_FALLBACK = false;

// TWC Token Address on BSC
const TWC_ADDRESS_BSC = '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596';
// BSC Factory Address - Updated to match official production address for TWC
const BSC_FACTORY_ADDRESS = '0x8505c412Ba61e5B260686a260C5213905DAAa130';

const SECONDS_PER_YEAR = 31536000;

/**
 * Byte-for-byte copy of the web Earn page's local `formatCompact`
 * (tiwi-user-app/app/earn/page.tsx). Deliberately NOT `formatCompactNumber`
 * from @/utils/formatting - that one trims trailing zeros ("40T", not
 * "40.00T"), so it would drift from the web on round numbers. Any change to
 * the suffix ladder or the decimal count has to land on both sides together.
 */
const formatWebCompact = (n: number): string => {
    if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

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
    /** Contract `active` flag when available. False means creator paused it. */
    onChainActive?: boolean;
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
    // `batch.multicall` collapses every concurrent readContract issued in the
    // same tick into a single Multicall3 call. The Earn screen reads
    // getPoolInfo once per pool (~19 pools), which was 19 separate RPC round
    // trips; batched it is one.
    private bscClient = createPublicClient({
        chain: bsc,
        transport: createBscFallbackTransport(),
        batch: { multicall: { wait: 16 } },
    });

    /** Cache of last successful global stats - used to avoid rendering a
     *  partial-failure result if even one pool's on-chain read fails. */
    private lastGoodStats: StakingStats | null = null;

    /**
     * Short-lived request coalescer. A single Earn load fans out into several
     * calls that each want the same upstream data (the full stake list, the
     * global stats crawl). Without this they run concurrently and duplicate
     * every network request. Keyed calls share one in-flight promise, and the
     * resolved value is reused for `ttlMs` so the 30s auto-refresh and a
     * pull-to-refresh landing together don't double up either.
     */
    private inflight = new Map<string, { promise: Promise<any>; at: number }>();
    private tokenPriceCache = new Map<string, { price: number; at: number }>();

    private coalesce<T>(key: string, ttlMs: number, run: () => Promise<T>): Promise<T> {
        const hit = this.inflight.get(key);
        if (hit && Date.now() - hit.at < ttlMs) return hit.promise as Promise<T>;

        const promise = run().catch((e) => {
            // Never cache a failure - the next caller should retry.
            this.inflight.delete(key);
            throw e;
        });
        this.inflight.set(key, { promise, at: Date.now() });
        return promise;
    }

    private priceKey(chainId: number, address: string): string {
        return `${chainId}:${(address || '').toLowerCase()}`;
    }

    private async getTokenPrices(tokens: TokenPriceRequestToken[]): Promise<Map<string, number>> {
        const now = Date.now();
        const out = new Map<string, number>();
        const missing: TokenPriceRequestToken[] = [];
        const seen = new Set<string>();

        for (const token of tokens) {
            if (!token.address || !token.chainId) continue;
            const key = this.priceKey(token.chainId, token.address);
            if (seen.has(key)) continue;
            seen.add(key);

            const cached = this.tokenPriceCache.get(key);
            if (cached && now - cached.at < 60_000) {
                out.set(key, cached.price);
            } else {
                missing.push(token);
            }
        }

        if (missing.length > 0) {
            try {
                const resp = await api.tokens.prices(missing);
                const prices = resp.prices || {};
                for (const token of missing) {
                    const key = this.priceKey(token.chainId, token.address);
                    const price = Number(prices[key]) || 0;
                    if (price > 0) {
                        out.set(key, price);
                        this.tokenPriceCache.set(key, { price, at: now });
                    }
                }
            } catch (e) {
                console.warn('[StakingService] token price lookup failed', e);
            }
        }

        return out;
    }

    /** Full stake list (all pools, all wallets), fetched at most once per 15s. */
    private getAllStakes(): Promise<any[]> {
        return this.coalesce('all-stakes', 15_000, async () => {
            try {
                const resp = await api.staking.userStakes({ walletAddress: '' });
                return (resp as any).stakes || [];
            } catch {
                return [];
            }
        });
    }

    /**
     * poolId -> server-enriched on-chain snapshot.
     *
     * `/api/v1/mobile/staking/pools` already performs the getPoolInfo read for
     * every pool server-side and returns the result inline. One ~0.8s request
     * replaces the per-pool contract reads this service used to issue from the
     * device. Falls back to an empty map on failure, which puts each caller
     * back on its original direct-RPC path.
     */
    private getEnrichedPoolSnapshot(): Promise<Map<string, MobilePool>> {
        return this.coalesce('enriched-pools', 15_000, async () => {
            try {
                const resp = await api.staking.poolsMobile();
                const pools = resp.pools || [];
                return new Map(pools.map((p) => [p.id, p]));
            } catch (e) {
                console.warn('[StakingService] Enriched pool snapshot unavailable:', e);
                return new Map<string, MobilePool>();
            }
        });
    }

    /**
     * Raw stake rows for one wallet. The Earn screen asks twice per load -
     * once for Active Positions, once for My Stakes - with identical request
     * params, so they share a single HTTP call.
     */
    private getWalletStakesRaw(walletAddress: string): Promise<any[]> {
        return this.coalesce(`stakes:${walletAddress.toLowerCase()}`, 15_000, async () => {
            const resp = await api.staking.userStakes({ walletAddress });
            return (resp as any).stakes || [];
        });
    }

    /**
     * poolId -> unique ACTIVE staker count, derived from the shared stake
     * snapshot.
     *
     * Active-only is the web's definition: its pool card reads
     * `/api/v1/user-stakes?status=active&poolId=…` and counts distinct
     * wallets in the response. Counting every status instead (what this did)
     * inflated the number by wallets that had already fully withdrawn - 62
     * on mobile against the web's 60 for Diamond Hands Club Staking Pool 1.
     */
    private async getStakerCountsByPool(): Promise<Map<string, number>> {
        const stakes = await this.getAllStakes();
        const wallets = new Map<string, Set<string>>();
        for (const stake of stakes) {
            if (stake.status !== 'active') continue;
            const poolId = stake.poolId || stake.pool?.id;
            const wallet = stake.userWallet?.toLowerCase();
            if (!poolId || !wallet) continue;
            if (!wallets.has(poolId)) wallets.set(poolId, new Set());
            wallets.get(poolId)!.add(wallet);
        }
        return new Map([...wallets].map(([poolId, set]) => [poolId, set.size]));
    }

    private formatDbApy(apy: unknown): string {
        const parsed = typeof apy === 'number' || typeof apy === 'string' ? Number(apy) : NaN;
        return Number.isFinite(parsed) ? `~${parsed.toFixed(2)}%` : 'N/A';
    }

    private resolvePoolLogo(symbol?: string, chainId?: number, address?: string, suppliedLogo?: string): string | undefined {
        return normalizeTokenLogoUrl(suppliedLogo) || getTokenLogo(symbol, chainId, address);
    }

    private calculateLegacyAPRFromPoolConfig(
        poolReward: number,
        totalStakedTokens: number,
        rewardDurationSeconds: number,
    ): string {
        if (poolReward <= 0 || totalStakedTokens <= 0 || rewardDurationSeconds <= 0) return '~0.00%';
        const rewardPerYearTokens = (poolReward / rewardDurationSeconds) * SECONDS_PER_YEAR;
        const apr = (rewardPerYearTokens / totalStakedTokens) * 100;

        if (!Number.isFinite(apr) || apr < 0) return '~0.00%';
        if (apr > 0 && apr < 0.01) return '<0.01%';
        return `~${apr.toFixed(2)}%`;
    }

    private calculateUsdAPRFromPoolConfig(
        poolReward: number,
        totalStakedTokens: number,
        rewardDurationSeconds: number,
        rewardTokenPrice: number,
        stakingTokenPrice: number,
    ): string {
        if (poolReward <= 0 || totalStakedTokens <= 0 || rewardDurationSeconds <= 0) return '~0.00%';
        if (rewardTokenPrice <= 0 || stakingTokenPrice <= 0) {
            return this.calculateLegacyAPRFromPoolConfig(poolReward, totalStakedTokens, rewardDurationSeconds);
        }

        const rewardPerYearTokens = (poolReward / rewardDurationSeconds) * SECONDS_PER_YEAR;
        const rewardPerYearUsd = rewardPerYearTokens * rewardTokenPrice;
        const stakedCapacityUsd = totalStakedTokens * stakingTokenPrice;
        const apr = (rewardPerYearUsd / stakedCapacityUsd) * 100;

        if (!Number.isFinite(apr) || apr < 0) return '~0.00%';
        if (apr > 0 && apr < 0.01) return '<0.01%';
        return `~${apr.toFixed(2)}%`;
    }

    /**
     * Helper to map pool to UI format with on-chain enrichment
     */
    private async mapPool(pool: APIStakingPool): Promise<StakingPool> {
        await ensureAdminTokenLogoOverrides().catch(() => {});

        let apyValue = this.formatDbApy(pool.apy);
        let tvl = pool.tvl || 'N/A';
        let activeStakers = pool.activeStakers || '0';
        let endTime = 0;
        let onChainActive: boolean | undefined;
        let resolvedRewardTokenSymbol = pool.rewardTokenSymbol;
        let resolvedTokenLogo = this.resolvePoolLogo(pool.tokenSymbol, pool.chainId, pool.tokenAddress, pool.tokenLogo);
        let resolvedRewardTokenLogo = normalizeTokenLogoUrl(pool.rewardTokenLogo);

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
                let rewardTokenAddr: string | undefined;
                let rewardTokenSymbol: string | undefined;

                // Preferred path: the server already read this pool's
                // getPoolInfo for us. Skips a device-side RPC round trip.
                const enriched = (await this.getEnrichedPoolSnapshot()).get(pool.id);
                const chain = enriched?.onChain;

                if (chain) {
                    poolReward = Number(chain.poolReward) || 0;
                    rewardDuration = Number(chain.rewardDurationSeconds) || 0;
                    maxTvl = Number(chain.maxTvl) || 0;
                    endTime = Number(chain.endTime) || 0;
                    totalStaked = Number(chain.totalStaked) || 0;
                    onChainActive = chain.active;
                    stakingTokenAddr = chain.stakingToken || pool.tokenAddress;
                    rewardTokenAddr = chain.rewardToken || pool.tokenAddress;
                    rewardTokenSymbol = chain.rewardTokenSymbol || pool.tokenSymbol;
                    resolvedRewardTokenSymbol = resolvedRewardTokenSymbol || rewardTokenSymbol;
                } else if (hasV2) {
                    // V2: getPoolInfo returns a 13-tuple, no args.
                    const info = await this.bscClient.readContract({
                        address: pool.poolContractAddress as `0x${string}`,
                        abi: STAKING_POOL_V2_ABI,
                        functionName: 'getPoolInfo',
                    }) as any;
                    stakingTokenAddr = info?.[0];
                    const decimals = pool.decimals || (stakingTokenAddr?.toLowerCase() === TWC_ADDRESS_BSC.toLowerCase() ? 9 : 18);
                    const rewardInfo = await resolveRewardToken({
                        chainId: pool.chainId || 56,
                        rewardTokenAddress: info?.[1],
                        stakingTokenAddress: stakingTokenAddr,
                        stakingSymbol: pool.tokenSymbol,
                        stakingDecimals: decimals,
                    });
                    rewardTokenAddr = rewardInfo.address || info?.[1];
                    rewardTokenSymbol = rewardInfo.symbol || pool.tokenSymbol;
                    resolvedRewardTokenSymbol = resolvedRewardTokenSymbol || rewardTokenSymbol;
                    poolReward = Number(formatUnits(info[3] ?? 0n, rewardInfo.decimals));
                    rewardDuration = Number(info[4] ?? 0n);
                    maxTvl = Number(formatUnits(info[5] ?? 0n, decimals));
                    endTime = Number(info[8] ?? 0n);
                    onChainActive = Boolean(info[9]);
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
                    const rewardInfo = await resolveRewardToken({
                        chainId: pool.chainId || 56,
                        rewardTokenAddress: config.rewardToken,
                        stakingTokenAddress: stakingTokenAddr,
                        stakingSymbol: pool.tokenSymbol,
                        stakingDecimals: decimals,
                    });
                    rewardTokenAddr = rewardInfo.address || config.rewardToken;
                    rewardTokenSymbol = rewardInfo.symbol || pool.tokenSymbol;
                    resolvedRewardTokenSymbol = resolvedRewardTokenSymbol || rewardTokenSymbol;
                    totalStaked = Number(formatUnits(state.totalStaked, decimals));
                    poolReward = Number(formatUnits(config.poolReward, rewardInfo.decimals));
                    maxTvl = Number(formatUnits(config.maxTvl, decimals));
                    rewardDuration = Number(config.rewardDurationSeconds);
                    endTime = Number(config.endTime ?? state.endTime ?? 0);
                    onChainActive = Boolean(config.active ?? config[10]);
                }

                tvl = formatCompactNumber(totalStaked, { decimals: 2 });
                const tvlForCalculation = maxTvl > 0 ? maxTvl : (totalStaked > 0 ? totalStaked : 1);
                const actualChainId = pool.chainId || 56;
                const stakingAddress = stakingTokenAddr || pool.tokenAddress;
                const rewardAddress = rewardTokenAddr || pool.tokenAddress;
                resolvedTokenLogo = resolvedTokenLogo || this.resolvePoolLogo(pool.tokenSymbol, actualChainId, stakingAddress);
                resolvedRewardTokenLogo = resolvedRewardTokenLogo || this.resolvePoolLogo(rewardTokenSymbol, actualChainId, rewardAddress);
                const tokenPrices = await this.getTokenPrices([
                    { address: stakingAddress, chainId: actualChainId, symbol: pool.tokenSymbol },
                    { address: rewardAddress, chainId: actualChainId, symbol: rewardTokenSymbol || pool.tokenSymbol },
                ]);
                const stakingTokenPrice = Number(tokenPrices.get(this.priceKey(actualChainId, stakingAddress))) || 0;
                const rewardTokenPrice = Number(tokenPrices.get(this.priceKey(actualChainId, rewardAddress))) || 0;
                const priceApr = this.calculateUsdAPRFromPoolConfig(
                    poolReward,
                    tvlForCalculation,
                    rewardDuration,
                    rewardTokenPrice,
                    stakingTokenPrice,
                );
                apyValue = priceApr;

                // Staker count comes from the shared all-stakes snapshot rather
                // than one HTTP call per pool. Enriching 19 pools used to fire
                // 19 identical-shaped requests; now they share one.
                try {
                    const byPool = await this.getStakerCountsByPool();
                    activeStakers = (byPool.get(pool.id) ?? 0).toLocaleString();
                } catch (e: any) {
                    console.warn(`[StakingService] Failed to resolve stakers for pool ${pool.id}`, e.message);
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
            tokenLogo: resolvedTokenLogo,
            rewardTokenLogo: resolvedRewardTokenLogo,
            displayApy: apyValue,
            displayLimits,
            minStakingPeriod: pool.minStakingPeriod || undefined,
            rewardTokenSymbol: resolvedRewardTokenSymbol,
            tvl: tvl,
            activeStakers: activeStakers,
            endTime,
            onChainActive,
        };
    }

    /**
     * The six numbers on the Earn screen's stats card, computed exactly the
     * way the web Earn page computes them. See computeGlobalStakingStats.
     */
    async getGlobalStakingStats(): Promise<StakingStats> {
        // The Earn screen asks for this twice per load (fetchInitialData and
        // fetchGlobalStats both want it). Coalesced, the second caller reuses
        // the first's promise instead of re-issuing both requests.
        return this.coalesce('global-stats', 15_000, () => this.computeGlobalStakingStats());
    }

    private async computeGlobalStakingStats(): Promise<StakingStats> {
        // ─────────────────────────────────────────────────────────────────
        // PARITY CONTRACT: this is a line-for-line port of the web app's
        // tiwi-user-app/app/earn/page.tsx → fetchGlobalStakingStats().
        // The web Earn page is the source of truth for these six numbers,
        // so the inputs (the same two endpoints), the math, and the compact
        // formatter must all stay identical to it. Do not "improve" this
        // with on-chain reads or row de-duplication - both were tried here
        // and both made the mobile card disagree with the web:
        //   • on-chain `totalStaked` reports what is staked RIGHT NOW, but
        //     TOTAL TWC STAKED is the lifetime peak summed off `user_stakes`
        //     (rows aren't decremented on unstake). That gap read as
        //     10.63T on mobile vs 36.22T on the web.
        //   • de-duplicating pool rows that share one contract address
        //     dropped the pool counts from 41 to 33 inactive.
        // If a number here looks wrong, fix it on the web page first and
        // port the change back - never diverge locally.
        // ─────────────────────────────────────────────────────────────────
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
            // Both feeds degrade independently, exactly like the web's
            // Promise.allSettled - one endpoint failing must not blank the
            // stats the other one can still produce.
            const [allPools, allStakes] = await Promise.all([
                (async () => {
                    try {
                        // No status filter: inactivePoolsCount needs every row.
                        return ((await api.staking.list()) as any).pools || [];
                    } catch (e) {
                        console.warn('[StakingService] staking-pools fetch failed for global stats:', e);
                        return [] as any[];
                    }
                })(),
                // No wallet/status filter: all-time stakers and the TWC total
                // are computed across every row. Shared with mapPool's staker
                // counts - one request, not N+1.
                this.getAllStakes(),
            ]);
            const enrichedById = await this.getEnrichedPoolSnapshot();

            // A pool is inactive when the operator flipped its DB status OR
            // its reward window (createdAt + rewardDurationSeconds) elapsed.
            // Mirrors the web's isExpiredStakingPool/isActiveStakingPool.
            const isExpired = (p: any): boolean => {
                const enriched = enrichedById.get(p.id);
                if (enriched?.isExpired === true) return true;
                if (!p.rewardDurationSeconds || !p.createdAt) return false;
                const createdAtMs = new Date(p.createdAt).getTime();
                if (Number.isNaN(createdAtMs)) return false;
                return Date.now() > createdAtMs + p.rewardDurationSeconds * 1000;
            };
            const isActive = (p: any): boolean => {
                const enriched = enrichedById.get(p.id);
                return (p.status || 'active') === 'active'
                    && enriched?.onChain?.active !== false
                    && !isExpired(p);
            };
            const activePools = allPools.filter(isActive);

            // Overall TVL = sum of every pool's configured maxTvl cap.
            const overallTvlSum = allPools.reduce(
                (sum: number, pool: any) => sum + (Number(pool.maxTvl) || 0),
                0,
            );

            // Total TWC Staked = cumulative PEAK of TWC ever committed. Rows
            // hold staked_amount as a lifetime peak (partial and full unstakes
            // don't decrement it), so this sums across every status.
            let twcStaked = 0;
            const activeWallets = new Set<string>();
            // All-time stakers = any wallet on any user_stakes row, including
            // wallets that have fully exited.
            const allTimeWallets = new Set<string>();

            for (const stake of allStakes) {
                const amount = Number(stake.stakedAmount || 0);
                if (stake.pool?.tokenSymbol?.toUpperCase() === 'TWC') {
                    twcStaked += amount;
                }
                if (stake.userWallet) {
                    allTimeWallets.add(stake.userWallet.toLowerCase());
                }
                if (stake.status === 'active' && stake.userWallet) {
                    activeWallets.add(stake.userWallet.toLowerCase());
                }
            }

            const stats: StakingStats = {
                overallTvl: formatWebCompact(overallTvlSum),
                maxTvl: formatWebCompact(overallTvlSum),
                totalTwcStaked: formatWebCompact(twcStaked),
                activePoolsCount: activePools.length,
                inactivePoolsCount: allPools.length - activePools.length,
                activeStakersCount: activeWallets.size.toLocaleString(),
                allTimeStakersCount: allTimeWallets.size.toLocaleString(),
            };

            // Both feeds down (airplane mode, backend outage) - the numbers
            // would all be 0, which reads as "everything reset". Keep the last
            // good snapshot instead. The web has no equivalent because a
            // desktop reload is cheap; a phone losing signal mid-poll is not.
            if (allPools.length === 0 && allStakes.length === 0 && this.lastGoodStats) {
                return this.lastGoodStats;
            }

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
            const nowSec = Date.now() / 1000;
            return enrichedPools.filter(pool =>
                pool.onChainActive !== false &&
                !(pool.endTime && pool.endTime > 0 && nowSec >= pool.endTime)
            );
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
            let stakes = await this.getWalletStakesRaw(walletAddress);

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
                // endTime has passed - the contract's `_secondsElapsed` caps
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
                    minStakingPeriod: (enrichedPool as StakingPool)?.minStakingPeriod
                        || stake.pool?.minStakingPeriod,
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
     * collapses them onto the first match - that was why tapping Genesis 1
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
     * contract address - otherwise `needsApproval` will read the wrong
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
                            minStakingPeriod: apiPool.minStakingPeriod || undefined,
                            earningRate: 0 // Will be calculated by store
                        } as UserStake;
                    }
                } catch {
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
