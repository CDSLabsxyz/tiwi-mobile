import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { stakingService, type UserStake, type StakingPool } from '@/services/stakingService';

type GlobalStats = {
    overallTvl: string;
    maxTvl: string;
    totalTwcStaked: string;
    activePoolsCount: number;
    inactivePoolsCount: number;
    activeStakersCount: string;
    allTimeStakersCount: string;
};

interface StakingState {
    activePositions: UserStake[];
    historicalStakes: UserStake[];
    activePools: StakingPool[];
    globalStats: GlobalStats;
    liveRewards: Record<string, number>; // Maps position ID to current ticking reward
    isLoading: boolean;
    isGlobalStatsLoading: boolean;
    isMining: boolean;
    /** Wallet currently associated with cached per-wallet state. */
    cachedWallet: string | null;
    /**
     * Wallet that the latest in-flight per-wallet fetch was started for.
     * Reset by swapWallet(). Pending fetches whose tag no longer matches
     * this value at the time their promise resolves must not apply their
     * results — that's how we discard stale wallet-A responses after the
     * user has already switched to wallet B.
     */
    pendingFetchWallet: string | null;

    // Actions
    fetchInitialData: (walletAddress: string) => Promise<void>;
    fetchGlobalStats: () => Promise<void>;
    fetchHistoricalStakes: (walletAddress: string) => Promise<void>;
    discoverPositions: (walletAddress: string) => Promise<void>;
    startMining: () => void;
    stopMining: () => void;
    syncRewardsWithChain: (walletAddress: string) => Promise<void>;
    /**
     * Atomic wallet transition — synchronously swaps the per-wallet view to
     * the new wallet's cached positions/history (from in-memory mirror of
     * the disk cache). Single set() call, no empty intermediate frame, no
     * badge flicker. Pass null on disconnect.
     */
    swapWallet: (walletAddress: string | null) => void;
}

let miningInterval: any = null;

// AsyncStorage cache keys. Per-wallet state is suffixed with the lowercased
// wallet address so a wallet switch never reads the previous user's stakes.
const CACHE_POOLS = '@tiwi/staking-pools';
const CACHE_STATS = '@tiwi/staking-stats';
const CACHE_POSITIONS_PREFIX = '@tiwi/staking-positions-';
const CACHE_HISTORY_PREFIX = '@tiwi/staking-history-';

/**
 * In-memory mirror of the disk cache. Populated once at module load from
 * AsyncStorage, kept in sync on every persistPools / persistStats /
 * persistPositions / persistHistory call. The store reads from this mirror
 * synchronously during a wallet switch — that's how the swap can be a
 * single atomic set() with no empty intermediate frame.
 */
const memCache = {
    pools: null as StakingPool[] | null,
    stats: null as GlobalStats | null,
    positions: {} as Record<string, UserStake[]>,
    history: {} as Record<string, UserStake[]>,
    loaded: false,
};

const loadMemCache = (async () => {
    try {
        const allKeys = await AsyncStorage.getAllKeys();
        const positionKeys = allKeys.filter(k => k.startsWith(CACHE_POSITIONS_PREFIX));
        const historyKeys = allKeys.filter(k => k.startsWith(CACHE_HISTORY_PREFIX));
        const [poolsStr, statsStr, posEntries, histEntries] = await Promise.all([
            AsyncStorage.getItem(CACHE_POOLS),
            AsyncStorage.getItem(CACHE_STATS),
            positionKeys.length ? AsyncStorage.multiGet(positionKeys) : Promise.resolve([] as readonly [string, string | null][]),
            historyKeys.length ? AsyncStorage.multiGet(historyKeys) : Promise.resolve([] as readonly [string, string | null][]),
        ]);
        if (poolsStr) {
            try { memCache.pools = JSON.parse(poolsStr).data ?? null; } catch {}
        }
        if (statsStr) {
            try { memCache.stats = JSON.parse(statsStr).data ?? null; } catch {}
        }
        for (const [key, value] of posEntries) {
            if (!value) continue;
            try {
                const wallet = key.replace(CACHE_POSITIONS_PREFIX, '');
                memCache.positions[wallet] = JSON.parse(value).data ?? [];
            } catch {}
        }
        for (const [key, value] of histEntries) {
            if (!value) continue;
            try {
                const wallet = key.replace(CACHE_HISTORY_PREFIX, '');
                memCache.history[wallet] = JSON.parse(value).data ?? [];
            } catch {}
        }
    } catch {
        // Cache load failures are non-fatal — fetches will populate from network.
    } finally {
        memCache.loaded = true;
    }
})();

const writeCache = (key: string, data: any) => {
    AsyncStorage.setItem(key, JSON.stringify({ data, updatedAt: Date.now() })).catch(() => {});
};

const persistPools = (pools: StakingPool[]) => {
    memCache.pools = pools;
    writeCache(CACHE_POOLS, pools);
};
const persistStats = (stats: GlobalStats) => {
    memCache.stats = stats;
    writeCache(CACHE_STATS, stats);
};
const persistPositions = (wallet: string, positions: UserStake[]) => {
    memCache.positions[wallet] = positions;
    writeCache(`${CACHE_POSITIONS_PREFIX}${wallet}`, positions);
};
const persistHistory = (wallet: string, history: UserStake[]) => {
    memCache.history[wallet] = history;
    writeCache(`${CACHE_HISTORY_PREFIX}${wallet}`, history);
};

/**
 * `getGlobalStakingStats` fans out per-pool on-chain reads inside a Promise.all.
 * Each read has its own try/catch returning null on failure, so a transient RPC
 * blip (very common during wallet-switch when many parallel calls fire at once)
 * collapses the stats response to all-zeros for pools/TVL while the DB-backed
 * stakers counts survive. That payload is "technically valid" but visually
 * looks like the dashboard reset to 0. Treat it as degraded and reject when
 * we already have real data on screen.
 */
const isDegradedStats = (s: GlobalStats): boolean => {
    const isZeroNumeric = (v: string) => v === '0' || v === '0.00' || v === '0.00%';
    return s.activePoolsCount === 0
        && s.inactivePoolsCount === 0
        && isZeroNumeric(s.overallTvl)
        && isZeroNumeric(s.totalTwcStaked);
};


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
    cachedWallet: null,
    pendingFetchWallet: null,

    swapWallet: (walletAddress: string | null) => {
        const wallet = walletAddress?.toLowerCase() || null;
        const s = get();

        // Atomic transition. Single set() so React renders one frame: the
        // new wallet's cached view (or empty if no cache yet). No empty
        // intermediate frame, no badge flicker between wallet A's data and
        // wallet B's data.
        const patch: Partial<StakingState> = {
            cachedWallet: wallet,
            // Tag the next fetch with the new wallet. Any in-flight fetch
            // tagged for the previous wallet sees the mismatch on resolve
            // and discards its result.
            pendingFetchWallet: wallet,
        };

        // Global state — apply the cache only when in-memory state hasn't
        // been populated yet (first mount on this app session). Subsequent
        // wallet switches keep whatever fresh values are already on screen.
        if (s.activePools.length === 0 && memCache.pools && memCache.pools.length > 0) {
            patch.activePools = memCache.pools;
        }
        if (s.globalStats.overallTvl === '...' && memCache.stats) {
            patch.globalStats = memCache.stats;
        }

        // Per-wallet state — always swap, even if memCache has no entry for
        // this wallet (in which case the lists become []), so we never show
        // the previous wallet's positions while waiting on the network.
        if (wallet) {
            const positions = (memCache.positions[wallet] || []).filter(
                p => p.userWallet?.toLowerCase() === wallet
            );
            const history = (memCache.history[wallet] || []).filter(
                h => h.userWallet?.toLowerCase() === wallet
            );
            patch.activePositions = positions;
            patch.historicalStakes = history;
            // Seed live rewards from the cached baseline so the 100ms mining
            // tick continues from the right number instead of restarting at 0.
            const seeded: Record<string, number> = {};
            positions.forEach(p => { seeded[p.id] = parseFloat(p.rewardsEarned) || 0; });
            patch.liveRewards = seeded;
        } else {
            patch.activePositions = [];
            patch.historicalStakes = [];
            patch.liveRewards = {};
        }

        set(patch);

        // If the disk-to-memCache loader hasn't completed yet (rare — only
        // possible on a cold-start that lands directly on Earn before module
        // boot finishes the AsyncStorage read), apply once it does. Guard
        // against a wallet switch that happened in the meantime.
        if (!memCache.loaded) {
            loadMemCache.then(() => {
                if (get().cachedWallet !== wallet) return;
                const after: Partial<StakingState> = {};
                const cur = get();
                if (cur.activePools.length === 0 && memCache.pools && memCache.pools.length > 0) {
                    after.activePools = memCache.pools;
                }
                if (cur.globalStats.overallTvl === '...' && memCache.stats) {
                    after.globalStats = memCache.stats;
                }
                if (wallet) {
                    if (cur.activePositions.length === 0 && memCache.positions[wallet]) {
                        after.activePositions = memCache.positions[wallet].filter(
                            p => p.userWallet?.toLowerCase() === wallet
                        );
                        const seeded: Record<string, number> = {};
                        (after.activePositions || []).forEach(p => {
                            seeded[p.id] = parseFloat(p.rewardsEarned) || 0;
                        });
                        after.liveRewards = { ...cur.liveRewards, ...seeded };
                    }
                    if (cur.historicalStakes.length === 0 && memCache.history[wallet]) {
                        after.historicalStakes = memCache.history[wallet].filter(
                            h => h.userWallet?.toLowerCase() === wallet
                        );
                    }
                }
                if (Object.keys(after).length > 0) set(after);
            }).catch(() => {});
        }
    },

    fetchGlobalStats: async () => {
        // Only show the skeleton on the very first load — once we have real
        // numbers, background refreshes swap values in silently so the card
        // never flashes blank on the 30s poll tick.
        const hasLoaded = get().globalStats.overallTvl !== '...';
        if (!hasLoaded) set({ isGlobalStatsLoading: true });
        try {
            const stats = await stakingService.getGlobalStakingStats();
            const prev = get().globalStats;
            const hadRealData = prev.overallTvl !== '...';
            if (hadRealData && isDegradedStats(stats)) {
                // Transient on-chain read failure — keep prior values, don't
                // persist zeros to disk, just clear the loading flag.
                set({ isGlobalStatsLoading: false });
            } else {
                set({ globalStats: stats, isGlobalStatsLoading: false });
                persistStats(stats);
            }
        } catch (error) {
            console.warn('[StakingStore] Global stats fetch failed:', error);
            set({ isGlobalStatsLoading: false });
        }
    },

    fetchInitialData: async (walletAddress: string) => {
        const activeWallet = walletAddress.toLowerCase();

        // Tag this fetch with the wallet it was started for. If the user
        // switches wallets (or disconnects) while we're awaiting the network,
        // swapWallet() will overwrite pendingFetchWallet and we'll discard
        // our results below instead of stomping the new wallet's view with
        // stale data from the previous one.
        set({ pendingFetchWallet: activeWallet });

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

            // Stale-fetch guard: bail if the wallet has changed (or the user
            // disconnected) while this request was in flight. Pools and stats
            // are global so we still persist those — only the per-wallet
            // positions get dropped.
            const stillCurrent = get().pendingFetchWallet === activeWallet;

            // Defense-in-depth: only show stakes owned by the currently
            // selected wallet. The backend already filters by walletAddress,
            // but we enforce it again here so a stale cache or a buggy
            // response can't leak another wallet's positions into the UI.
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

            // Apply + persist pools and stats — they're global. Guard against
            // a degraded stats payload (all-zero pools/TVL from a transient
            // BSC RPC failure during the wallet-switch refetch storm) so we
            // don't overwrite prior good values with zeros.
            const prevStats = get().globalStats;
            const hadRealStats = prevStats.overallTvl !== '...';
            const statsAreDegraded = hadRealStats && isDegradedStats(stats);
            // Pools list is degraded if it's empty AND we previously had pools
            // — same RPC-blip story (api.staking.list fail returns []).
            const prevPools = get().activePools;
            const poolsAreDegraded = prevPools.length > 0 && pools.length === 0;

            const patch: Partial<StakingState> = { isLoading: false };
            if (!statsAreDegraded) {
                patch.globalStats = stats;
                persistStats(stats);
            }
            if (!poolsAreDegraded) {
                patch.activePools = pools;
                persistPools(pools);
            }
            set(patch);

            if (!stillCurrent) {
                // Wallet has changed — write this wallet's positions to its
                // own cache slot (so a future switch back is instant) but do
                // NOT touch the visible activePositions / liveRewards state.
                persistPositions(activeWallet, stillActive);
                return;
            }

            set({
                activePositions: stillActive,
                cachedWallet: activeWallet,
            });
            persistPositions(activeWallet, stillActive);

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
        const activeWallet = walletAddress.toLowerCase();
        try {
            const all = await stakingService.getUserStakes(walletAddress);
            // Defense-in-depth: strip any row not owned by the active wallet
            // before anything else touches the list, so another wallet's
            // withdrawn/completed stakes can never appear under My Stakes.
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
            const historicalStakes = Array.from(grouped.values());

            // Always persist this wallet's history to its own cache slot,
            // even if the user has switched away — that way switching back
            // hits cache instantly. But only apply to the visible state if
            // we're still looking at this wallet.
            persistHistory(activeWallet, historicalStakes);
            if (get().pendingFetchWallet !== activeWallet) return;
            set({ historicalStakes });
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
