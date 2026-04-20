import { create } from 'zustand';
import { stakingService, type UserStake, type StakingPool } from '@/services/stakingService';

interface StakingState {
    activePositions: UserStake[];
    historicalStakes: UserStake[];
    activePools: StakingPool[];
    globalStats: {
        overallTvl: string;
        maxTvl: string;
        totalTwcStaked: string;
        activePoolsCount: number;
        inactivePoolsCount: number;
        activeStakersCount: string;
        allTimeStakersCount: string;
    };
    liveRewards: Record<string, number>; // Maps position ID to current ticking reward
    isLoading: boolean;
    isGlobalStatsLoading: boolean;
    isMining: boolean;

    // Actions
    fetchInitialData: (walletAddress: string) => Promise<void>;
    fetchGlobalStats: () => Promise<void>;
    fetchHistoricalStakes: (walletAddress: string) => Promise<void>;
    discoverPositions: (walletAddress: string) => Promise<void>;
    startMining: () => void;
    stopMining: () => void;
    syncRewardsWithChain: (walletAddress: string) => Promise<void>;
    /** Wipe per-wallet stake state — call on wallet switch / disconnect. */
    resetUserStakes: () => void;
}

let miningInterval: any = null;

export const useStakingStore = create<StakingState>((set, get) => ({
    activePositions: [],
    historicalStakes: [],
    activePools: [],
    globalStats: {
        overallTvl: '...',
        maxTvl: '...',
        totalTwcStaked: '...',
        activePoolsCount: 0,
        inactivePoolsCount: 0,
        activeStakersCount: '...',
        allTimeStakersCount: '...',
    },
    liveRewards: {},
    isLoading: false,
    isGlobalStatsLoading: false,
    isMining: false,

    fetchGlobalStats: async () => {
        // Only show the skeleton on the very first load — once we have real
        // numbers, background refreshes swap values in silently so the card
        // never flashes blank on the 30s poll tick.
        const hasLoaded = get().globalStats.overallTvl !== '...';
        if (!hasLoaded) set({ isGlobalStatsLoading: true });
        try {
            const stats = await stakingService.getGlobalStakingStats();
            set({ globalStats: stats, isGlobalStatsLoading: false });
        } catch (error) {
            console.warn('[StakingStore] Global stats fetch failed:', error);
            set({ isGlobalStatsLoading: false });
        }
    },

    fetchInitialData: async (walletAddress: string) => {
        // Only flip isLoading on the first fetch for this session/wallet.
        // Subsequent polls swap data in silently so pool/position cards don't
        // flash a skeleton state on the 30s tick.
        const s = get();
        const hasLoaded = s.activePools.length > 0
            || s.activePositions.length > 0
            || s.globalStats.overallTvl !== '...';
        if (!hasLoaded) set({ isLoading: true });
        try {
            // Parallel fetch of global stats, standard data, and initial pool list
            const [pools, dbStakes, stats] = await Promise.all([
                stakingService.getActivePools(),
                stakingService.getUserStakes(walletAddress, 'active'),
                stakingService.getGlobalStakingStats()
            ]);

            // Defense-in-depth: only show stakes owned by the currently
            // selected wallet. The backend already filters by walletAddress,
            // but we enforce it again here so a stale cache or a buggy
            // response can't leak another wallet's positions into the UI.
            const activeWallet = walletAddress.toLowerCase();
            const ownedByActive = dbStakes.filter(
                (s) => s.userWallet?.toLowerCase() === activeWallet
            );

            // Drop stakes whose pool's on-chain endTime has passed — the
            // contract has stopped emitting, so they belong in My Stakes
            // (the user still needs to claim/unstake), not in Active Positions.
            const nowSec = Date.now() / 1000;
            const stillActive = ownedByActive.filter((s) => {
                const endTime = (s.pool as any)?.endTime || 0;
                return !(endTime > 0 && nowSec >= endTime);
            });

            set({
                activePools: pools,
                activePositions: stillActive,
                globalStats: stats,
                isLoading: false
            });

            // Initialize live rewards from current state
            const initialRewards: Record<string, number> = {};
            stillActive.forEach(s => {
                initialRewards[s.id] = parseFloat(s.rewardsEarned) || 0;
            });
            set({ liveRewards: initialRewards });

            // Start mining immediately
            get().startMining();
        } catch (error) {
            console.error('[StakingStore] Initial fetch failed:', error);
            set({ isLoading: false });
        }
    },

    /**
     * Fetch past stakes (status !== 'active') and group by pool.
     * Multiple history rows per pool get merged — stakedAmount peak is summed,
     * rewardsEarned/totalClaimed are summed, and the latest updatedAt wins for status.
     */
    fetchHistoricalStakes: async (walletAddress: string) => {
        try {
            const all = await stakingService.getUserStakes(walletAddress);
            // Defense-in-depth: strip any row not owned by the active wallet
            // before anything else touches the list, so another wallet's
            // withdrawn/completed stakes can never appear under My Stakes.
            const activeWallet = walletAddress.toLowerCase();
            const owned = all.filter(
                (s) => s.userWallet?.toLowerCase() === activeWallet
            );
            // Mirror super-app's My Stakes filter: include both rows the user
            // has explicitly exited AND active rows whose pool's on-chain
            // endTime has passed (still funded but no longer earning — user
            // needs to claim + unstake from here).
            const nowSec = Date.now() / 1000;
            const inactive = owned.filter((s) => {
                if (s.status !== 'active') return true;
                const endTime = (s.pool as any)?.endTime || 0;
                return endTime > 0 && nowSec >= endTime;
            });

            const grouped = new Map<string, UserStake>();
            inactive.forEach((s) => {
                const key = s.pool?.id || s.pool?.poolId?.toString() || s.id;
                const existing = grouped.get(key);
                if (!existing) {
                    grouped.set(key, {
                        ...s,
                        stakedAmount: String(parseFloat(s.stakedAmount || '0')),
                        rewardsEarned: String(parseFloat(s.rewardsEarned || '0')),
                        totalClaimed: String(parseFloat(s.totalClaimed || '0')),
                    });
                } else {
                    const nextStaked = parseFloat(existing.stakedAmount || '0') + parseFloat(s.stakedAmount || '0');
                    const nextRewards = parseFloat(existing.rewardsEarned || '0') + parseFloat(s.rewardsEarned || '0');
                    const nextClaimed = parseFloat(existing.totalClaimed || '0') + parseFloat(s.totalClaimed || '0');
                    const latest = new Date(s.updatedAt || 0).getTime() > new Date(existing.updatedAt || 0).getTime() ? s : existing;
                    grouped.set(key, {
                        ...existing,
                        stakedAmount: String(nextStaked),
                        rewardsEarned: String(nextRewards),
                        totalClaimed: String(nextClaimed),
                        status: latest.status,
                        updatedAt: latest.updatedAt,
                    });
                }
            });
            set({ historicalStakes: Array.from(grouped.values()) });
        } catch (error) {
            console.error('[StakingStore] History fetch failed:', error);
        }
    },

    discoverPositions: async (walletAddress: string) => {
        if (!walletAddress) return;
        console.log('[StakingStore] Starting background discovery crawl...');

        try {
            const discovered = await stakingService.discoverOnChainPositions(walletAddress);
            if (discovered.length > 0) {
                const current = get().activePositions;

                // Merge discovered positions, avoiding duplicates by poolId
                const merged = [...current];
                discovered.forEach(d => {
                    const exists = merged.find(m => m.pool.poolId === d.pool.poolId);
                    if (!exists) {
                        merged.push(d);
                        // Initialize reward for new discovery
                        set(state => ({
                            liveRewards: { ...state.liveRewards, [d.id]: parseFloat(d.rewardsEarned) || 0 }
                        }));
                    }
                });

                set({ activePositions: merged });
            }
        } catch (error) {
            console.error('[StakingStore] Discovery failed:', error);
        }
    },

    startMining: () => {
        if (get().isMining) return;

        console.log('[StakingStore] Global Mining Engine Started (100ms interval)');
        set({ isMining: true });

        miningInterval = setInterval(() => {
            const state = get();
            const newLiveRewards = { ...state.liveRewards };
            let hasChanges = false;

            state.activePositions.forEach(pos => {
                const rate = pos.earningRate || 0;
                if (rate > 0) {
                    const current = newLiveRewards[pos.id] || 0;
                    // Tick increment: Rate per second / 10 (since we're running at 100ms)
                    newLiveRewards[pos.id] = current + (rate / 10);
                    hasChanges = true;
                }
            });

            if (hasChanges) {
                set({ liveRewards: newLiveRewards });
            }
        }, 100);
    },

    stopMining: () => {
        if (miningInterval) {
            clearInterval(miningInterval);
            miningInterval = null;
        }
        set({ isMining: false });
        console.log('[StakingStore] Global Mining Engine Stopped');
    },

    resetUserStakes: () => {
        set({
            activePositions: [],
            historicalStakes: [],
            liveRewards: {},
        });
    },

    syncRewardsWithChain: async (walletAddress: string) => {
        // Deep refresh from contract to correct any drift in local mining
        try {
            const stakes = await stakingService.getUserStakes(walletAddress, 'active');
            const updatedRewards = { ...get().liveRewards };

            stakes.forEach(s => {
                updatedRewards[s.id] = parseFloat(s.rewardsEarned) || 0;
            });

            set({ liveRewards: updatedRewards });
        } catch (error) {
            console.warn('[StakingStore] Drift correction failed');
        }
    }
}));
