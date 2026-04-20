/**
 * StakeDetailsCard — expandable in-list card for Active Positions / My Stakes.
 *
 * Port of the super-app's stake-details-card.tsx. Structure:
 *   Header (always visible): token icon, symbol+name, status badge, chevron
 *   Expanded body:
 *     - Staking Countdown (only when active): Time Staked, Time Until Unlock, Progress bar
 *     - Stats grid: Staked Amount, Pending Rewards, Reward Duration, Started
 *     - Rewards Summary: Claimed + (Pending while active, Withdrawn once ended)
 *     - Earning Rate row
 *     - Claim + Unstake action buttons (open PercentageActionModal)
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { colors } from '@/constants/colors';
import { useStakingPool } from '@/hooks/useStakingPool';
import type { UserStake } from '@/services/stakingService';
import { useStakingStore } from '@/store/stakingStore';
import { useToastStore } from '@/store/useToastStore';
import { useWalletStore } from '@/store/walletStore';
import { formatCompactNumber } from '@/utils/formatting';
import { PercentageActionModal } from './PercentageActionModal';
import { RewardsSummaryPanel } from './RewardsSummaryPanel';

const TWCIcon = require('../../../assets/home/tiwicat.svg');

interface Props {
    stake: UserStake;
    isExpanded: boolean;
    onToggle: () => void;
    /** 'active' tab shows the live countdown + action buttons; 'history' hides them. */
    variant: 'active' | 'history';
}

type EffectiveStatus = 'active' | 'completed' | 'withdrawn' | 'stopped';

const STATUS_STYLES: Record<EffectiveStatus, { bg: string; fg: string; label: string }> = {
    active: { bg: 'rgba(177,241,40,0.1)', fg: '#b1f128', label: 'Active' },
    completed: { bg: 'rgba(96,165,250,0.12)', fg: '#60A5FA', label: 'Completed' },
    withdrawn: { bg: 'rgba(156,163,175,0.12)', fg: '#9CA3AF', label: 'Withdrawn' },
    // 'stopped' = pool has ended on-chain, but the user still holds principal
    // and/or unclaimed rewards. Stays this color until they fully exit
    // (both staked and pending hit zero); only then does it flip to 'withdrawn'.
    stopped: { bg: 'rgba(234,179,8,0.12)', fg: '#EAB308', label: 'Stopped' },
};

function formatFull(num: number, maxDecimals = 4): string {
    if (!num) return '0';
    if (num < 0.000001) return num.toExponential(4);
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: maxDecimals });
}

export const StakeDetailsCard: React.FC<Props> = ({ stake, isExpanded, onToggle, variant }) => {
    const router = useRouter();
    const symbol = stake.pool?.tokenSymbol || 'TWC';
    const name = stake.pool?.tokenName || symbol;
    const detailsIdentifier = stake.pool?.poolContractAddress ? stake.pool?.id : stake.pool?.poolId;
    const pooled = useStakingPool(detailsIdentifier, stake.pool?.decimals ?? 9, {
        poolContractAddress: stake.pool?.poolContractAddress,
    });
    const { showToast } = useToastStore();

    const [liveRewards, setLiveRewards] = useState<number>(0);
    const [now, setNow] = useState<number>(Date.now());
    const [isClaimModalVisible, setIsClaimModalVisible] = useState(false);
    const [isUnstakeModalVisible, setIsUnstakeModalVisible] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Baseline from on-chain. We ONLY snap back to the contract's view when
    // it goes backwards (a claim dropped pending to ~0) or on first read —
    // otherwise the 10s wagmi refetch would visibly yank the smoothly-ticking
    // counter forward in chunks. Between resyncs the 100ms tick below
    // accumulates at `earningRate`, so the number counts up like mining.
    useEffect(() => {
        const onChainPending = Number(pooled.pendingRewardsFormatted || '0');
        if (pooled.pendingRewards === null) return;
        setLiveRewards((prev) => {
            if (prev === 0) return onChainPending;
            if (onChainPending < prev) return onChainPending;
            return prev;
        });
    }, [pooled.pendingRewardsFormatted, pooled.pendingRewards]);

    // 100ms tick: advance the pending-reward counter + recompute "now" for the timer.
    useEffect(() => {
        if (!isExpanded) return;
        const rate = pooled.earningRate || 0;
        const interval = setInterval(() => {
            setNow(Date.now());
            if (rate > 0) setLiveRewards((prev) => prev + rate / 10);
        }, 100);
        return () => clearInterval(interval);
    }, [isExpanded, pooled.earningRate]);

    // Resolve effective status.
    //
    //   - If the pool's on-chain endTime has passed and the user still holds
    //     any funds in the pool (staked principal OR unclaimed rewards), the
    //     badge is 'stopped' (yellow) so they know rewards have frozen but
    //     their funds are still recoverable via Claim + Unstake.
    //   - Only flip to 'withdrawn' when both staked and pending hit zero on
    //     chain — i.e., the user has fully exited.
    //   - If the pool is not yet expired and the user still has principal
    //     (or reads haven't resolved), keep the DB status ('active').
    const effectiveStatus: EffectiveStatus = useMemo(() => {
        const dbStatus = (stake.status === 'archived' ? 'withdrawn' : stake.status) as EffectiveStatus;
        const onChainStaked = Number(pooled.userStakedFormatted || '0');
        const onChainPending = Number(pooled.pendingRewardsFormatted || '0');
        const readsResolved = pooled.userStaked !== null;
        const hasFunds = onChainStaked > 0 || onChainPending > 0;

        const endTimeSec = Number(stake.pool?.endTime || 0);
        const isPoolExpired = endTimeSec > 0 && Date.now() / 1000 >= endTimeSec;

        if (dbStatus === 'active') {
            if (isPoolExpired && hasFunds) return 'stopped';
            if (readsResolved && !hasFunds) return 'withdrawn';
            return 'active';
        }
        return dbStatus || 'active';
    }, [stake.status, stake.pool?.endTime, pooled.userStakedFormatted, pooled.pendingRewardsFormatted, pooled.userStaked]);

    const statusStyle = STATUS_STYLES[effectiveStatus];

    // Countdown math — Time Staked and Time Until Unlock.
    const countdown = useMemo(() => {
        const stakeTimeMs = pooled.stakeTime > 0
            ? pooled.stakeTime * 1000
            : (stake.createdAt ? new Date(stake.createdAt).getTime() : Date.now());
        const durationSec = pooled.rewardDurationSeconds || (stake.pool?.minStakingPeriod
            ? parseIntSafe(stake.pool.minStakingPeriod) * 86400
            : 30 * 86400);
        const endMs = stakeTimeMs + durationSec * 1000;

        const elapsedSec = Math.max(0, Math.floor((now - stakeTimeMs) / 1000));
        const remainingSec = Math.max(0, Math.floor((endMs - now) / 1000));
        const progress = durationSec > 0 ? Math.min(100, (elapsedSec / durationSec) * 100) : 0;

        return {
            staked: splitDuration(elapsedSec),
            remaining: splitDuration(remainingSec),
            progress,
            totalDays: Math.ceil(durationSec / 86400),
        };
    }, [pooled.stakeTime, pooled.rewardDurationSeconds, stake.createdAt, stake.pool?.minStakingPeriod, now]);

    // Display values — live on-chain for active, DB historical for finalized.
    const displayStaked = useMemo(() => {
        const onChain = Number(pooled.userStakedFormatted || '0');
        return effectiveStatus === 'withdrawn' ? parseFloat(stake.stakedAmount || '0') : onChain;
    }, [pooled.userStakedFormatted, effectiveStatus, stake.stakedAmount]);

    const displayPending = effectiveStatus === 'withdrawn' ? 0 : liveRewards;
    // Prefer whichever source is higher — the DB value can lag (or fail to
    // record) behind an on-chain claim. Reading cumulative Claim events from
    // the pool contract is authoritative, but the lookback window is bounded,
    // so for very old stakes DB may still be higher.
    const dbClaimed = parseFloat(stake.totalClaimed || '0');
    const onChainClaimed = parseFloat((pooled as any).onChainClaimedFormatted || '0');
    const totalClaimed = Math.max(dbClaimed, onChainClaimed);
    // `rewardsEarned` is the auto-harvest leg of Max-unstake (stored in the
    // rewards_earned column), distinct from explicit Claim-button totals.
    // The summary surfaces both together once the position has ended.
    const exitHarvested = parseFloat(stake.rewardsEarned || '0');
    // Mirrors the web's `hasEnded`: finalized stakes plus anything on a pool
    // whose on-chain reward period is over. We surface "Withdrawn" (principal
    // returned) in place of "Pending" in this case.
    const poolEndTimeSec = Number(stake.pool?.endTime || 0);
    const isPoolExpired = poolEndTimeSec > 0 && Date.now() / 1000 >= poolEndTimeSec;
    const hasEnded = effectiveStatus === 'withdrawn'
        || effectiveStatus === 'completed'
        || effectiveStatus === 'stopped'
        || isPoolExpired;
    // Principal returned at exit. For fully-withdrawn rows the DB preserves
    // stake.stakedAmount (the withdraw PATCH intentionally leaves it) so we
    // can surface a historical value; while still in the pool, use the live
    // on-chain staked amount so it stays accurate.
    const withdrawnPrincipal = effectiveStatus === 'withdrawn'
        ? parseFloat(stake.stakedAmount || '0')
        : displayStaked;

    const startedLabel = useMemo(() => {
        const ts = pooled.stakeTime > 0 ? pooled.stakeTime * 1000 : (stake.createdAt ? new Date(stake.createdAt).getTime() : 0);
        return ts ? new Date(ts).toLocaleDateString() : '—';
    }, [pooled.stakeTime, stake.createdAt]);

    const showCountdown = variant === 'active' && effectiveStatus === 'active';
    // Show Claim/Unstake whenever the user still has funds in the pool —
    // including 'stopped' rows on the My Stakes tab, since that's the only
    // path back to their principal + unclaimed rewards once the pool ends.
    const showActions = effectiveStatus !== 'withdrawn';

    // Action handlers — all PATCH bookkeeping lives in the hook's handleTxConfirmed.
    // After each write resolves we also refetch the DB-backed stake list from
    // the store so the card re-renders with the updated Claimed / staked
    // totals instead of waiting for the 30s poll.
    const refetchStore = useCallback(() => {
        const wallet = useWalletStore.getState().activeAddress;
        if (!wallet) return;
        const { fetchInitialData, fetchHistoricalStakes } = useStakingStore.getState();
        fetchInitialData(wallet);
        fetchHistoricalStakes(wallet);
    }, []);

    const onClaimConfirm = useCallback(async (pct: number) => {
        setIsClaimModalVisible(false);
        setIsProcessing(true);
        try {
            await pooled.claimRewards(pct);
            pooled.refetch();
            refetchStore();
        } catch (err: any) {
            if (!err?.message?.includes('User rejected')) {
                showToast(`Claim failed: ${err?.message || 'Unknown error'}`, 'error');
            }
        } finally {
            setIsProcessing(false);
        }
    }, [pooled, showToast, refetchStore]);

    const onUnstakeConfirm = useCallback(async (pct: number) => {
        setIsUnstakeModalVisible(false);
        if (displayStaked <= 0) return;
        const amount = (displayStaked * (pct / 100)).toString();
        setIsProcessing(true);
        try {
            await pooled.unstake(amount);
            pooled.refetch();
        } catch (err: any) {
            if (!err?.message?.includes('User rejected')) {
                showToast(`Unstake failed: ${err?.message || 'Unknown error'}`, 'error');
            }
        } finally {
            setIsProcessing(false);
        }
    }, [pooled, displayStaked, showToast]);

    const onMaxUnstakeWithHarvest = useCallback(async () => {
        setIsUnstakeModalVisible(false);
        setIsProcessing(true);
        try {
            await pooled.maxUnstakeWithHarvest();
            pooled.refetch();
        } catch (err: any) {
            if (!err?.message?.includes('User rejected')) {
                showToast(`Max unstake failed: ${err?.message || 'Unknown error'}`, 'error');
            }
        } finally {
            setIsProcessing(false);
        }
    }, [pooled, showToast]);

    return (
        <View style={styles.card}>
            <TouchableOpacity activeOpacity={0.85} onPress={onToggle} style={styles.header}>
                <View style={styles.headerLeft}>
                    <Image
                        source={stake.pool?.tokenLogo ? { uri: stake.pool.tokenLogo } : TWCIcon}
                        style={styles.icon}
                    />
                    <View>
                        <Text style={styles.symbol}>{symbol}</Text>
                        <Text style={styles.name} numberOfLines={1}>{name}</Text>
                    </View>
                </View>
                <View style={styles.headerRight}>
                    <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                        <Text style={[styles.statusText, { color: statusStyle.fg }]}>{statusStyle.label}</Text>
                    </View>
                    <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color={colors.mutedText}
                    />
                </View>
            </TouchableOpacity>

            {isExpanded && (
                <View style={styles.body}>
                    {showCountdown && (
                        <View style={styles.countdownCard}>
                            <View style={styles.countdownTitleRow}>
                                <Ionicons name="time-outline" size={18} color="#b1f128" />
                                <Text style={styles.countdownTitle}>Staking Countdown</Text>
                                <TouchableOpacity
                                    activeOpacity={0.85}
                                    onPress={() => router.push(`/earn/stake/${symbol}` as any)}
                                    style={styles.boostButton}
                                >
                                    <Ionicons name="flash" size={12} color="#010501" />
                                    <Text style={styles.boostButtonText}>Boost</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.boxGroupLabel}>Time Staked</Text>
                            <View style={styles.boxRow}>
                                <TimerBox value={countdown.staked.d} unit="DAYS" />
                                <TimerBox value={countdown.staked.h} unit="HRS" pad />
                                <TimerBox value={countdown.staked.m} unit="MIN" pad />
                                <TimerBox value={countdown.staked.s} unit="SEC" pad highlight />
                            </View>

                            {countdown.remaining.totalSec > 0 && (
                                <>
                                    <Text style={[styles.boxGroupLabel, { marginTop: 12 }]}>Time Until Unlock</Text>
                                    <View style={styles.boxRow}>
                                        <TimerBox value={countdown.remaining.d} unit="DAYS" variant="yellow" />
                                        <TimerBox value={countdown.remaining.h} unit="HRS" pad variant="yellow" />
                                        <TimerBox value={countdown.remaining.m} unit="MIN" pad variant="yellow" />
                                        <TimerBox value={countdown.remaining.s} unit="SEC" pad variant="yellow" />
                                    </View>
                                </>
                            )}

                            <View style={styles.progressRow}>
                                <Text style={styles.progressLabel}>Progress</Text>
                                <Text style={styles.progressValue}>
                                    {countdown.progress.toFixed(1)}% of {countdown.totalDays} days
                                </Text>
                            </View>
                            <View style={styles.progressBg}>
                                <View style={[styles.progressFill, { width: `${countdown.progress}%` }]} />
                            </View>

                            {countdown.remaining.totalSec === 0 && (
                                <View style={styles.unlockDoneBox}>
                                    <Text style={styles.unlockDoneText}>Lock period completed!</Text>
                                </View>
                            )}
                        </View>
                    )}

                    <View style={styles.statsGrid}>
                        <StatTile icon="link-outline" label="Staked Amount" value={`${formatFull(displayStaked)}`} suffix={symbol} />
                        <StatTile icon="trending-up-outline" label="Pending Rewards" value={formatFull(displayPending, 6)} suffix={symbol} valueColor="#b1f128" />
                        <StatTile icon="lock-closed-outline" label={effectiveStatus === 'active' ? 'Reward Duration' : 'Duration'} value={`${countdown.totalDays}`} suffix="days" />
                        <StatTile icon="calendar-outline" label="Started" value={startedLabel} />
                    </View>

                    <RewardsSummaryPanel
                        pending={displayPending}
                        totalClaimed={totalClaimed}
                        rewardsEarned={exitHarvested}
                        stakedAmount={withdrawnPrincipal}
                        hasEnded={hasEnded}
                        tokenSymbol={symbol}
                    />

                    {pooled.earningRate > 0 && effectiveStatus === 'active' && (
                        <View style={styles.earningRateRow}>
                            <Text style={styles.earningRateLabel}>Earning Rate</Text>
                            <Text style={styles.earningRateValue}>+{pooled.earningRate.toFixed(8)} {symbol}/sec</Text>
                        </View>
                    )}

                    {showActions && (
                        <View style={styles.actionRow}>
                            <TouchableOpacity
                                disabled={isProcessing || displayPending <= 0}
                                onPress={() => setIsClaimModalVisible(true)}
                                activeOpacity={0.85}
                                style={[styles.claimButton, (isProcessing || displayPending <= 0) && styles.buttonDisabled]}
                            >
                                <Text style={styles.claimButtonText}>
                                    {isProcessing ? 'Processing…' : displayPending > 0 ? 'Claim' : 'No Rewards'}
                                </Text>
                                {displayPending > 0 && (
                                    <Text style={styles.claimButtonSub}>
                                        ≈ {formatCompactNumber(displayPending, { decimals: 4 } as any)} {symbol}
                                    </Text>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                disabled={isProcessing || displayStaked <= 0}
                                onPress={() => setIsUnstakeModalVisible(true)}
                                activeOpacity={0.85}
                                style={[styles.unstakeButton, (isProcessing || displayStaked <= 0) && styles.buttonDisabled]}
                            >
                                <Text style={styles.unstakeButtonText}>
                                    {effectiveStatus === 'completed' ? 'Withdraw' : 'Unstake'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            )}

            <PercentageActionModal
                visible={isClaimModalVisible}
                onClose={() => setIsClaimModalVisible(false)}
                kind="claim"
                maxAmount={displayPending}
                tokenSymbol={symbol}
                isProcessing={isProcessing}
                onConfirm={onClaimConfirm}
            />
            <PercentageActionModal
                visible={isUnstakeModalVisible}
                onClose={() => setIsUnstakeModalVisible(false)}
                kind="unstake"
                maxAmount={displayStaked}
                tokenSymbol={symbol}
                isProcessing={isProcessing}
                onConfirm={onUnstakeConfirm}
                onConfirmMaxWithHarvest={displayPending > 0 ? onMaxUnstakeWithHarvest : undefined}
            />
        </View>
    );
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function splitDuration(totalSec: number) {
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return { d, h, m, s, totalSec };
}

function parseIntSafe(raw: string | number | undefined): number {
    if (raw === undefined) return 30;
    const n = typeof raw === 'number' ? raw : parseInt(String(raw).replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : 30;
}

const TimerBox: React.FC<{ value: number; unit: string; pad?: boolean; highlight?: boolean; variant?: 'default' | 'yellow' }> = ({ value, unit, pad, highlight, variant = 'default' }) => {
    const text = pad ? String(value).padStart(2, '0') : String(value);
    const numberColor = variant === 'yellow' ? '#EAB308' : highlight ? '#b1f128' : '#FFF';
    const bg = variant === 'yellow' ? '#273024' : '#1f261e';
    return (
        <View style={[styles.timerBox, { backgroundColor: bg }]}>
            <Text style={[styles.timerValue, { color: numberColor }]}>{text}</Text>
            <Text style={styles.timerUnit}>{unit}</Text>
        </View>
    );
};

const StatTile: React.FC<{ icon: any; label: string; value: string; suffix?: string; valueColor?: string }> = ({ icon, label, value, suffix, valueColor }) => (
    <View style={styles.statTile}>
        <View style={styles.statTileHeader}>
            <Ionicons name={icon} size={14} color="#b1f128" />
            <Text style={styles.statTileLabel}>{label}</Text>
        </View>
        <Text style={[styles.statTileValue, valueColor ? { color: valueColor } : null]} numberOfLines={1}>
            {value}{suffix ? <Text style={styles.statTileSuffix}> {suffix}</Text> : null}
        </Text>
    </View>
);

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    card: {
        width: '100%',
        backgroundColor: '#0b0f0a',
        borderWidth: 1,
        borderColor: '#273024',
        borderRadius: 16,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    icon: { width: 36, height: 36, borderRadius: 18 },
    symbol: { color: '#FFF', fontSize: 14, fontFamily: 'Manrope-SemiBold' },
    name: { color: '#7c7c7c', fontSize: 11 },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    statusText: { fontSize: 11, fontFamily: 'Manrope-SemiBold' },
    body: {
        borderTopWidth: 1,
        borderTopColor: '#273024',
        padding: 14,
        gap: 14,
    },
    countdownCard: {
        backgroundColor: '#0f140e',
        borderRadius: 12,
        padding: 12,
    },
    countdownTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    countdownTitle: { color: '#FFF', fontSize: 14, fontFamily: 'Manrope-SemiBold', flex: 1 },
    boostButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#b1f128',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
    },
    boostButtonText: { color: '#010501', fontSize: 12, fontFamily: 'Manrope-Bold' },
    boxGroupLabel: { color: '#7c7c7c', fontSize: 11, marginBottom: 6 },
    boxRow: { flexDirection: 'row', gap: 6 },
    timerBox: {
        flex: 1,
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 4,
        alignItems: 'center',
    },
    timerValue: { fontSize: 16, fontFamily: 'Manrope-Bold' },
    timerUnit: { color: '#7c7c7c', fontSize: 8, marginTop: 2 },
    progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, marginBottom: 4 },
    progressLabel: { color: '#7c7c7c', fontSize: 11 },
    progressValue: { color: '#7c7c7c', fontSize: 11 },
    progressBg: { height: 5, backgroundColor: '#1f261e', borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#b1f128' },
    unlockDoneBox: {
        marginTop: 10,
        backgroundColor: 'rgba(177,241,40,0.1)',
        borderRadius: 10,
        paddingVertical: 6,
        alignItems: 'center',
    },
    unlockDoneText: { color: '#b1f128', fontSize: 12, fontFamily: 'Manrope-SemiBold' },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    statTile: {
        flexBasis: '48.5%',
        backgroundColor: '#0f140e',
        borderRadius: 10,
        padding: 10,
        gap: 4,
    },
    statTileHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statTileLabel: { color: '#7c7c7c', fontSize: 10 },
    statTileValue: { color: '#FFF', fontSize: 13, fontFamily: 'Manrope-SemiBold' },
    statTileSuffix: { color: '#7c7c7c', fontSize: 11, fontFamily: 'Manrope-Regular' },
    earningRateRow: {
        backgroundColor: '#0f140e',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    earningRateLabel: { color: '#7c7c7c', fontSize: 12 },
    earningRateValue: { color: '#b1f128', fontSize: 12, fontFamily: 'Manrope-SemiBold' },
    actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
    claimButton: {
        flex: 1,
        backgroundColor: '#b1f128',
        borderRadius: 999,
        paddingVertical: 12,
        alignItems: 'center',
    },
    claimButtonText: { color: '#010501', fontSize: 14, fontFamily: 'Manrope-Bold' },
    claimButtonSub: { color: '#010501', fontSize: 10, opacity: 0.8, marginTop: 2 },
    unstakeButton: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#b1f128',
        borderRadius: 999,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    unstakeButtonText: { color: '#b1f128', fontSize: 14, fontFamily: 'Manrope-Bold' },
    buttonDisabled: { opacity: 0.5 },
});
