import { create } from 'zustand';
import { stakingService, type UserStake, type StakingPool } from '@/services/stakingService';

interface StakingState {
    activePositions: UserStake[];
    activePools: StakingPool[];
    globalStats: {
        overallTvl: string;
        maxTvl: string;
        totalTwcStaked: string;
        activePoolsCount: number;
        activeStakersCount: string;
    };
    liveRewards: Record<string, number>; // Maps position ID to current ticking reward
    isLoading: boolean;
    isGlobalStatsLoading: boolean;
    isMining: boolean;

    // Actions
    fetchInitialData: (walletAddress: string) => Promise<void>;
    fetchGlobalStats: () => Promise<void>;
    discoverPositions: (walletAddress: string) => Promise<void>;
    startMining: () => void;
    stopMining: () => void;
    syncRewardsWithChain: (walletAddress: string) => Promise<void>;
}

let miningInterval: any = null;

export const useStakingStore = create<StakingState>((set, get) => ({
    activePositions: [],
    activePools: [],
    globalStats: {
        overallTvl: '...',
        maxTvl: '...',
        totalTwcStaked: '...',
        activePoolsCount: 0,
        activeStakersCount: '...'
    },
    liveRewards: {},
    isLoading: false,
    isGlobalStatsLoading: false,
    isMining: false,

    fetchGlobalStats: async () => {
        set({ isGlobalStatsLoading: true });
        try {
            const stats = await stakingService.getGlobalStakingStats();
            set({ globalStats: stats, isGlobalStatsLoading: false });
        } catch (error) {
            console.warn('[StakingStore] Global stats fetch failed:', error);
            set({ isGlobalStatsLoading: false });
        }
    },

    fetchInitialData: async (walletAddress: string) => {
        set({ isLoading: true });
        try {
            // Parallel fetch of global stats, standard data, and initial pool list
            const [pools, dbStakes, stats] = await Promise.all([
                stakingService.getActivePools(),
                stakingService.getUserStakes(walletAddress, 'active'),
                stakingService.getGlobalStakingStats()
            ]);

            set({
                activePools: pools,
                activePositions: dbStakes,
                globalStats: stats,
                isLoading: false
            });

            // Initialize live rewards from current state
            const initialRewards: Record<string, number> = {};
            dbStakes.forEach(s => {
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
