/**
 * Pool Management (mobile)
 *
 * Native port of the web `components/earn/pool-management-view.tsx`
 * (rendered at /earn/pool/manage?id=…). Same data sources, same derived
 * figures, same sections in the same order:
 *
 *   header (title · symbol · chain · live status) + Pause/Resume
 *   4 stat cards   — Total staked / Current APR / Active stakers / Time remaining
 *   2 meters       — Rewards distributed / Pool duration
 *   Stakers list   — the web's table, as cards (a 6-column table doesn't fit a phone)
 *
 * This is the CREATOR-facing view reached from My pools → "Manage pool". The
 * staker-facing screen is /earn/stake/[symbol]; "Manage pool" used to link
 * there, which showed the wrong thing entirely.
 */

import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { SettingsHeader } from '@/components/ui/settings-header';
import { colors } from '@/constants/colors';
import { useRequireBackup } from '@/hooks/useRequireBackup';
import { useStakingDeployer } from '@/hooks/useStakingDeployer';
import { api, type MobilePool, type MobilePoolOnChain } from '@/lib/mobile/api-client';
import {
    readPoolInfoClient,
    readPoolRewardWithdrawalClient,
    readStakerOnChain,
} from '@/lib/mobile/pool-onchain';
import { useWalletStore } from '@/store/walletStore';
import {
    readRecordedRewardWithdrawal,
    recordRewardWithdrawal,
    type RecordedRewardWithdrawal,
} from '@/utils/staking-reward-withdrawal';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Address } from 'viem';

const SECONDS_PER_YEAR = 31_536_000;

/** Cap the per-staker on-chain reads so a large pool doesn't hammer the RPC. */
const MAX_STAKER_READS = 60;

type StakerMap = Record<string, { stakedAmount: number; pendingReward: number }>;

const NO_STAKER_CHAIN: StakerMap = {};

interface Staker {
    userWallet: string;
    stakedAmount: number;
    rewardsEarned: number;
    totalClaimed: number;
    status: 'active' | 'completed' | 'withdrawn';
    createdAt: string;
}

/** Same thresholds as the web's local `formatCompact`. */
function formatCompact(value: number): string {
    if (!Number.isFinite(value)) return '0';
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(2)}T`;
    if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    // Sub-unit reward figures (a 0.024 USDT payout) must not round away to
    // "0.02" or "0" — on a cross-token pool these are the whole story.
    if (abs > 0 && abs < 0.0001) return value.toExponential(2);
    if (abs > 0 && abs < 1) return value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
    return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/**
 * Human duration for a reward window. Pools are routinely created with windows
 * measured in hours or minutes, and flooring those to days rendered them all as
 * a flat "0d".
 */
function formatDuration(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return '—';
    if (seconds >= 86400) {
        const days = seconds / 86400;
        return `${Number.isInteger(days) ? days : days.toFixed(1)}d`;
    }
    if (seconds >= 3600) {
        const hours = seconds / 3600;
        return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
    }
    return `${Math.max(1, Math.round(seconds / 60))}m`;
}

/**
 * APRs here are unbounded — a small `maxTvl` against a large reward pool over a
 * short window legitimately produces nine-digit percentages, and printing those
 * in full ("1752000000.0%") overflows the stat card and reads as a glitch.
 */
function formatPercent(value: number): string {
    if (!Number.isFinite(value)) return '0%';
    if (Math.abs(value) >= 1000) return `${formatCompact(value)}%`;
    return `${value.toFixed(2)}%`;
}

function getRewardSettlement(params: {
    rewardBalance: number;
    unclaimedRewards: number | null;
    totalStaked: number;
    poolExpired: boolean;
    liabilitiesResolved: boolean;
    supportsProtectedWithdrawal: boolean;
    contractRemainingRewards: number | null;
}) {
    const safeRewardBalance = Number.isFinite(params.rewardBalance) ? Math.max(0, params.rewardBalance) : 0;
    const safeTotalStaked = Number.isFinite(params.totalStaked) ? Math.max(0, params.totalStaked) : 0;
    const safeUnclaimed = params.unclaimedRewards === null || !Number.isFinite(params.unclaimedRewards)
        ? null
        : Math.max(0, params.unclaimedRewards);
    const safeContractRemaining = params.contractRemainingRewards === null || !Number.isFinite(params.contractRemainingRewards)
        ? null
        : Math.max(0, params.contractRemainingRewards);
    const remainingRewards = params.supportsProtectedWithdrawal
        ? safeContractRemaining
        : safeUnclaimed === null
            ? null
            : Math.max(0, safeRewardBalance - safeUnclaimed);

    return {
        remainingRewards,
        canWithdrawAllRemaining:
            params.poolExpired &&
            remainingRewards !== null &&
            remainingRewards > 0 &&
            (params.supportsProtectedWithdrawal || (
                params.liabilitiesResolved &&
                safeTotalStaked === 0 &&
                safeUnclaimed === 0
            )),
    };
}

export default function PoolManageScreen() {
    // `name` is handed over by My pools: the mobile staking route doesn't
    // project the pool's name, so without it the header would fall back to
    // the bare token symbol.
    const {
        id,
        name: nameParam,
        deploymentTxHash,
    } = useLocalSearchParams<{ id: string; name?: string; deploymentTxHash?: string }>();
    const poolId = String(id || '');
    const router = useRouter();
    const { bottom } = useSafeAreaInsets();

    const { address: walletAddress, walletGroups, activeGroupId } = useWalletStore();
    // Pool ownership actions are EVM-only, same as pool creation.
    const evmAddress = useMemo(() => {
        const group = walletGroups.find(g => g.id === activeGroupId);
        return group?.addresses?.EVM || walletAddress || null;
    }, [walletGroups, activeGroupId, walletAddress]);

    const [pool, setPool] = useState<MobilePool | null>(null);
    const [stakers, setStakers] = useState<Staker[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [notFound, setNotFound] = useState(false);
    const [isToggling, setIsToggling] = useState(false);
    const [isWithdrawingRewards, setIsWithdrawingRewards] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [withdrawalError, setWithdrawalError] = useState<string | null>(null);
    const [withdrawalStatus, setWithdrawalStatus] = useState<string | null>(null);
    const [recordedWithdrawal, setRecordedWithdrawal] = useState<RecordedRewardWithdrawal | null>(null);
    // Both keyed by the pool address they were read for, so a result arriving
    // after the screen switched pools is discarded rather than displayed.
    const [clientOnChain, setClientOnChain] = useState<{ address: string; info: MobilePoolOnChain | null } | null>(null);
    const [stakerChain, setStakerChain] = useState<{ address: string; byWallet: StakerMap } | null>(null);

    const { setPoolActive, withdrawRemainingRewards, emergencyWithdrawRewards } = useStakingDeployer();
    const { requireBackup, BackupRequiredModal } = useRequireBackup();

    useEffect(() => {
        let cancelled = false;
        const poolAddress = pool?.poolContractAddress;
        const chainId = pool?.chainId;
        if (!poolAddress || chainId == null) {
            setRecordedWithdrawal(null);
            return;
        }
        Promise.all([
            readRecordedRewardWithdrawal(chainId, poolAddress),
            readPoolRewardWithdrawalClient({
                chainId,
                poolAddress,
                deploymentTxHash,
            }),
        ]).then(async ([cached, onChain]) => {
            const record = onChain || cached;
            if (onChain && !cached) {
                await recordRewardWithdrawal(chainId, poolAddress, onChain.txHash).catch(() => undefined);
            }
            if (!cancelled) setRecordedWithdrawal(record);
        });
        return () => { cancelled = true; };
    }, [deploymentTxHash, pool?.chainId, pool?.poolContractAddress]);

    const loadPool = useCallback(async () => {
        try {
            const data = await api.staking.poolMobile(poolId);
            setPool(data?.pool ?? null);
            if (!data?.pool) setNotFound(true);
        } catch (e) {
            console.warn('[PoolManage] load pool failed', e);
            setNotFound(true);
        }
    }, [poolId]);

    const loadStakers = useCallback(async () => {
        try {
            // Every staker in this pool, any status — the web queries
            // /api/v1/user-stakes?poolId=… with no wallet filter.
            const data = await api.staking.userStakes({ walletAddress: '', poolId });
            setStakers((data?.stakes || []).map((s: any) => ({
                userWallet: s.userWallet,
                stakedAmount: Number(s.stakedAmount) || 0,
                rewardsEarned: Number(s.rewardsEarned) || 0,
                totalClaimed: Number(s.totalClaimed) || 0,
                status: s.status,
                createdAt: s.createdAt,
            })));
        } catch (e) {
            console.warn('[PoolManage] load stakers failed', e);
            setStakers([]);
        }
    }, [poolId]);

    useEffect(() => {
        if (!poolId) { setNotFound(true); setLoading(false); return; }
        setLoading(true);
        Promise.all([loadPool(), loadStakers()]).finally(() => setLoading(false));
    }, [poolId, loadPool, loadStakers]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([loadPool(), loadStakers()]);
        setRefreshing(false);
    }, [loadPool, loadStakers]);

    // Re-read from the device when the API payload is missing either reward
    // token metadata or creator-settlement fields. Current protected contracts
    // expose those values directly; legacy contracts fail only those optional
    // reads and still return the rest of the pool information.
    //
    //  1. `onChain: null` — the API's enrichment is best-effort, and when the
    //     backend's RPC calls fail every figure below collapses to a zero that
    //     looks like real data rather than absence.
    //  2. `onChain` present but with no `rewardTokenDecimals` — that payload
    //     came from a backend deployed before the reward-token fix, so its
    //     `poolReward`/`rewardBalance` are formatted with the STAKING token's
    //     decimals and are wrong by 10^(d_reward - d_stake) on a cross-token
    //     pool. The device knows better; don't wait on a backend deploy.
    useEffect(() => {
        let cancelled = false;
        const address = pool?.poolContractAddress;
        const payloadIsComplete =
            pool?.onChain?.rewardTokenDecimals != null &&
            pool?.onChain?.supportsProtectedRewardWithdrawal != null &&
            pool?.onChain?.accRewardPerShare != null;
        if (!pool || payloadIsComplete || !address) return;

        readPoolInfoClient({
            chainId: pool.chainId,
            poolAddress: address,
            stakingDecimals: pool.decimals ?? 18,
            stakingSymbol: pool.tokenSymbol,
        }).then((info) => {
            if (!cancelled) setClientOnChain({ address, info });
        });
        return () => { cancelled = true; };
    }, [pool]);

    const clientRead = clientOnChain?.address === pool?.poolContractAddress ? clientOnChain : null;
    // The device read wins when it succeeded — it's the one that knows the
    // reward token. Fall back to the server payload otherwise.
    const onChain: MobilePoolOnChain | null = clientRead?.info ?? pool?.onChain ?? null;
    // Read attempted, and it failed, with nothing from the server either.
    const onChainUnavailable = !!clientRead && !clientRead.info && !pool?.onChain;
    const hasChainData = !!onChain;

    // Reward figures are denominated in the EARN token. On a "stake TWC, earn
    // USDT" pool, labelling them with the staking symbol reported a 1 USDT
    // reward pool as "1000.00M TWC".
    const rewardSymbol = onChain?.rewardTokenSymbol || pool?.tokenSymbol || '';
    const isCrossToken = !!onChain?.isCrossToken;
    const stakerWallets = useMemo(() => Array.from(new Set(
        stakers
            .map((staker) => staker.userWallet.toLowerCase())
            .filter((wallet) => /^0x[a-fA-F0-9]{40}$/.test(wallet)),
    )), [stakers]);

    // The stakers list is a DB mirror and drifts from the contract (it reported
    // a wallet holding 5.0K against an on-chain total of 4.9K — a 102% pool
    // share — and "+0" rewards for a pool that had already paid some out). Read
    // each wallet's real position; the DB row stays as the fallback.
    useEffect(() => {
        let cancelled = false;
        const address = pool?.poolContractAddress;
        if (!address || !pool || stakers.length === 0) return;

        const wallets = stakerWallets.slice(0, MAX_STAKER_READS);

        Promise.all(wallets.map(async (wallet) => {
            const info = await readStakerOnChain({
                chainId: pool.chainId,
                poolAddress: address,
                wallet,
                stakingDecimals: pool.decimals ?? 18,
                rewardDecimals: onChain?.rewardTokenDecimals ?? pool.decimals ?? 18,
            });
            return [wallet, info] as const;
        })).then((entries) => {
            if (cancelled) return;
            const byWallet: StakerMap = {};
            for (const [wallet, info] of entries) if (info) byWallet[wallet] = info;
            setStakerChain({ address, byWallet });
        });

        return () => { cancelled = true; };
        // `onChain` only feeds the reward decimals; re-running on its arrival is intended.
    }, [pool, stakers, stakerWallets, onChain?.rewardTokenDecimals]);

    const stakerByWallet = stakerChain && stakerChain.address === pool?.poolContractAddress
        ? stakerChain.byWallet
        : NO_STAKER_CHAIN;
    const stakerReadsComplete = stakers.length === 0 || (
        stakerWallets.length > 0 &&
        stakerWallets.length <= MAX_STAKER_READS &&
        stakerWallets.length === new Set(stakers.map((staker) => staker.userWallet.toLowerCase())).size &&
        stakerChain?.address === pool?.poolContractAddress &&
        stakerWallets.every((wallet) => Object.prototype.hasOwnProperty.call(stakerByWallet, wallet))
    );

    // Derived figures — identical arithmetic to the web's `data` memo.
    const data = useMemo(() => {
        const oc = onChain;
        const totalStaked = oc ? parseFloat(oc.totalStaked || '0') : 0;
        const poolReward = oc ? parseFloat(oc.poolReward || '0') : 0;
        const rewardBalance = oc ? parseFloat(oc.rewardBalance || '0') : 0;
        const supportsProtectedWithdrawal = oc?.supportsProtectedRewardWithdrawal === true;
        const protectedUnclaimed = supportsProtectedWithdrawal
            ? parseFloat(oc?.unclaimedRewards || '0')
            : null;
        const protectedRemaining = supportsProtectedWithdrawal
            ? parseFloat(oc?.remainingRewards || '0')
            : null;
        const maxTvl = oc ? parseFloat(oc.maxTvl || '0') : 0;
        const durationSec = oc?.rewardDurationSeconds || 0;
        const distributed = Math.max(0, poolReward - rewardBalance);
        const apr = maxTvl > 0 && durationSec > 0 && poolReward > 0
            ? (poolReward / (maxTvl * durationSec)) * SECONDS_PER_YEAR * 100
            : 0;

        const nowSec = Date.now() / 1000;
        const start = oc?.startTime || 0;
        const end = oc?.endTime || 0;
        const totalDur = end > start ? end - start : durationSec;
        const elapsed = start ? Math.min(totalDur, Math.max(0, nowSec - start)) : 0;
        const secondsLeft = end ? Math.max(0, end - nowSec) : 0;

        // Still-unclaimed rewards. `rewardBalance` only drops on claim, so
        // `distributed` is what stakers have actually taken out.
        const pendingOnChain = supportsProtectedWithdrawal
            ? protectedUnclaimed
            : stakerReadsComplete
                ? Object.values(stakerByWallet).reduce((sum, s) => sum + s.pendingReward, 0)
                : null;

        const activeCount = stakers.filter((s) => {
            const chain = stakerByWallet[s.userWallet.toLowerCase()];
            if (chain) return chain.stakedAmount > 0;
            return s.status === 'active';
        }).length;

        return {
            totalStaked,
            poolReward,
            rewardBalance,
            distributed,
            pendingOnChain,
            protectedRemaining,
            supportsProtectedWithdrawal,
            maxTvl,
            apr,
            timePct: totalDur > 0 ? Math.min(100, Math.round((elapsed / totalDur) * 100)) : 0,
            rewardPct: poolReward > 0 ? Math.min(100, Math.round((distributed / poolReward) * 100)) : 0,
            secondsLeft,
            totalDur,
            // Null when the contract's endTime is unknown — the caller then
            // falls back to the server's createdAt-based guess.
            ended: end > 0 ? nowSec >= end : null,
            activeCount,
        };
    }, [onChain, stakers, stakerByWallet, stakerReadsComplete]);

    const isOwnerActionable = !!pool?.poolContractAddress && !!evmAddress;
    const active = onChain?.active ?? (pool?.status === 'active');
    // The server's `isExpired` falls back to createdAt + duration when its own
    // chain read failed; the contract's `endTime` is authoritative when we have it.
    const isExpired = data.ended ?? !!pool?.isExpired;
    const noLegacyRewardLiabilityEverAccrued =
        onChain?.accRewardPerShare === '0' && data.totalStaked === 0;
    const settlement = getRewardSettlement({
        rewardBalance: data.rewardBalance,
        unclaimedRewards: data.pendingOnChain,
        totalStaked: data.totalStaked,
        poolExpired: isExpired,
        liabilitiesResolved: noLegacyRewardLiabilityEverAccrued,
        supportsProtectedWithdrawal: data.supportsProtectedWithdrawal,
        contractRemainingRewards: data.protectedRemaining,
    });
    const rewardsWereWithdrawn = recordedWithdrawal !== null || withdrawalStatus !== null;
    const title = pool?.name || nameParam || pool?.tokenSymbol || 'Pool';
    const symbol = pool?.tokenSymbol || '';

    const toggleActive = async () => {
        if (!pool?.poolContractAddress) return;
        setActionError(null);
        if (!requireBackup()) return;
        setIsToggling(true);
        try {
            await setPoolActive({
                chainId: pool.chainId,
                poolAddress: pool.poolContractAddress as Address,
                active: !active,
                walletAddress: evmAddress as Address,
            });
            // Give the chain a moment, then refresh.
            await new Promise(r => setTimeout(r, 1500));
            await loadPool();
        } catch (e: any) {
            setActionError(e?.message || "Action failed. Make sure you're the pool owner.");
        } finally {
            setIsToggling(false);
        }
    };

    const handleWithdrawRemainingRewards = async () => {
        if (!pool?.poolContractAddress || !settlement.canWithdrawAllRemaining || !evmAddress) return;
        setWithdrawalError(null);
        setWithdrawalStatus(null);
        if (!requireBackup()) return;
        setIsWithdrawingRewards(true);
        try {
            const params = {
                chainId: pool.chainId,
                poolAddress: pool.poolContractAddress as Address,
                walletAddress: evmAddress as Address,
            };
            const hash = data.supportsProtectedWithdrawal
                ? await withdrawRemainingRewards(params)
                : await emergencyWithdrawRewards(params);
            const record = await recordRewardWithdrawal(pool.chainId, pool.poolContractAddress, hash);
            setRecordedWithdrawal(record);
            const refreshed = await readPoolInfoClient({
                chainId: pool.chainId,
                poolAddress: pool.poolContractAddress,
                stakingDecimals: pool.decimals ?? 18,
                stakingSymbol: pool.tokenSymbol,
            });
            setClientOnChain({ address: pool.poolContractAddress, info: refreshed });
            setWithdrawalStatus(`Rewards withdrawn successfully. Transaction ${hash.slice(0, 10)}...${hash.slice(-6)}`);
        } catch (e: any) {
            setWithdrawalError(e?.message || "Reward withdrawal failed. Make sure you're the pool owner.");
        } finally {
            setIsWithdrawingRewards(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.screen}>
                <CustomStatusBar />
                <SettingsHeader title="Manage pool" />
                <Text style={styles.loadingText}>Loading pool…</Text>
            </View>
        );
    }

    if (notFound || !pool) {
        return (
            <View style={styles.screen}>
                <CustomStatusBar />
                <SettingsHeader title="Manage pool" />
                <View style={styles.notFound}>
                    <Text style={styles.notFoundTitle}>Pool not found</Text>
                    <Text style={styles.notFoundSub}>This pool link is missing or no longer available.</Text>
                    <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/earn?tab=my-pools' as any)}>
                        <Text style={styles.backBtnText}>Back to Earn</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            <CustomStatusBar />
            <SettingsHeader title="Manage pool" />
            <ScrollView
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottom + 32, gap: 12 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryCTA} />
                }
            >
                {/* Header — title, symbol · chain, live status */}
                <View style={styles.headerBlock}>
                    <Text style={styles.title} numberOfLines={2}>{title}</Text>
                    <View style={styles.subRow}>
                        <Text style={styles.subText}>{symbol}{symbol ? ' · ' : ''}{pool.chainName}</Text>
                        <Text style={styles.subDot}>•</Text>
                        <View style={styles.statusRow}>
                            <View style={[styles.statusDot, { backgroundColor: active ? colors.primaryCTA : '#facc15' }]} />
                            <Text style={[styles.statusText, { color: active ? colors.primaryCTA : '#facc15' }]}>
                                {isExpired ? 'Expired' : active ? 'Active' : 'Paused'}
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        onPress={toggleActive}
                        disabled={isToggling || !isOwnerActionable}
                        style={[
                            styles.toggleBtn,
                            active ? styles.toggleBtnPause : styles.toggleBtnResume,
                            (isToggling || !isOwnerActionable) && { opacity: 0.5 },
                        ]}
                    >
                        <Ionicons
                            name={active ? 'pause' : 'play'}
                            size={15}
                            color={active ? '#f87171' : '#010501'}
                        />
                        <Text style={[styles.toggleBtnText, { color: active ? '#f87171' : '#010501' }]}>
                            {isToggling ? 'Working…' : active ? 'Pause pool' : 'Resume pool'}
                        </Text>
                    </TouchableOpacity>
                    {actionError ? <Text style={styles.errText}>{actionError}</Text> : null}
                </View>

                {/* The figures below are all on-chain reads. When neither the
                    server nor the device could reach the pool contract they are
                    unknown, not zero — say so instead of rendering a screen
                    full of convincing 0s. */}
                {!hasChainData && onChainUnavailable ? (
                    <View style={styles.pendingNote}>
                        <Text style={styles.pendingNoteText}>
                            Couldn&apos;t reach the pool contract right now, so the live figures below are unavailable.
                            Pull to refresh in a moment.
                        </Text>
                    </View>
                ) : null}

                {/* Headline analytics */}
                <View style={styles.statGrid}>
                    <StatCard
                        icon="cash-outline"
                        label="Total staked"
                        value={hasChainData ? `${formatCompact(data.totalStaked)} ${symbol}` : '—'}
                        sub={hasChainData && data.maxTvl > 0 ? `of ${formatCompact(data.maxTvl)} max` : undefined}
                    />
                    <StatCard
                        icon="trending-up-outline"
                        // For a "stake A, earn B" pool the ratio is reward
                        // tokens per staked token — a real APR would need both
                        // token prices, which this screen doesn't have. Label
                        // what the number actually is.
                        label={isCrossToken ? 'Reward rate' : 'Current APR'}
                        value={hasChainData ? formatPercent(data.apr) : '—'}
                        sub={isCrossToken && rewardSymbol ? `${rewardSymbol} per ${symbol} / yr` : undefined}
                    />
                    <StatCard
                        icon="people-outline"
                        label="Active stakers"
                        value={`${data.activeCount}`}
                        sub={`${stakers.length} all-time`}
                    />
                    <StatCard
                        icon="time-outline"
                        label="Time remaining"
                        value={!hasChainData ? '—' : isExpired || data.secondsLeft <= 0 ? 'Ended' : formatDuration(data.secondsLeft)}
                        sub={hasChainData && data.totalDur > 0 ? `${formatDuration(data.totalDur)} total` : undefined}
                    />
                </View>

                {/* Progress meters */}
                <View style={styles.meterCard}>
                    <Meter
                        label="Rewards claimed"
                        value={hasChainData
                            ? `${formatCompact(data.distributed)} / ${formatCompact(data.poolReward)} ${rewardSymbol}`
                            : '—'}
                        pct={data.rewardPct}
                    />
                    {/* On a cross-token pool the payout asset is not the deposit
                        asset, and reading "1000M TWC" for a pool that pays USDT
                        is worse than no label at all. */}
                    {hasChainData && isCrossToken ? (
                        <Text style={styles.meterNote}>Paid in {rewardSymbol} — stakers deposit {symbol}</Text>
                    ) : null}
                    {hasChainData && data.pendingOnChain !== null && data.pendingOnChain > 0 ? (
                        <Text style={styles.meterNote}>
                            {formatCompact(data.pendingOnChain)} {rewardSymbol} earned but not yet claimed
                        </Text>
                    ) : null}
                </View>
                <View style={styles.meterCard}>
                    <Meter label="Pool duration" value={hasChainData ? `${data.timePct}% elapsed` : '—'} pct={data.timePct} />
                </View>

                <View style={styles.statGrid}>
                    <StatCard
                        icon="cash-outline"
                        label="Remaining rewards"
                        value={!hasChainData || settlement.remainingRewards === null
                            ? '—'
                            : `${formatCompact(settlement.remainingRewards)} ${rewardSymbol}`}
                        sub="Unused by stakers"
                    />
                    <StatCard
                        icon="people-outline"
                        label="Unclaimed rewards"
                        value={!hasChainData || data.pendingOnChain === null
                            ? '—'
                            : `${formatCompact(data.pendingOnChain)} ${rewardSymbol}`}
                        sub="Reserved for users"
                    />
                    <StatCard
                        icon="wallet-outline"
                        label="Reward balance"
                        value={hasChainData ? `${formatCompact(data.rewardBalance)} ${rewardSymbol}` : '—'}
                        sub="Remaining + unclaimed"
                    />
                </View>

                <View style={styles.settlementCard}>
                    <Text style={styles.settlementTitle}>Creator reward withdrawal</Text>
                    <Text style={styles.settlementText}>
                        {!hasChainData
                            ? 'Live reward balances are unavailable.'
                            : rewardsWereWithdrawn
                                ? 'Remaining rewards were withdrawn successfully. Any unclaimed user rewards remain reserved for claims.'
                            : !isExpired
                                ? 'Withdrawal becomes available after the pool expires.'
                                : data.supportsProtectedWithdrawal && settlement.remainingRewards !== null
                                    ? settlement.remainingRewards <= 0
                                        ? 'No unused reward funds remain. User claims stay protected.'
                                        : `${formatCompact(settlement.remainingRewards)} ${rewardSymbol} is available to withdraw. ${formatCompact(data.pendingOnChain || 0)} ${rewardSymbol} remains reserved for user claims.`
                                    : data.totalStaked > 0
                                        ? `${formatCompact(data.totalStaked)} ${symbol} is still staked and must remain protected.`
                                        : data.pendingOnChain === null
                                            ? "Checking every staker's unclaimed rewards before enabling withdrawal."
                                            : data.pendingOnChain > 0
                                                ? `${formatCompact(data.pendingOnChain)} ${rewardSymbol} is reserved for users and cannot be withdrawn.`
                                                : !noLegacyRewardLiabilityEverAccrued
                                                    ? 'Frontend protection is active for this legacy pool. Its contract cannot separate unused funds from user claims, so creator withdrawal stays locked.'
                                                    : data.rewardBalance <= 0
                                                        ? 'No reward funds remain in this pool.'
                                                        : `${formatCompact(data.rewardBalance)} ${rewardSymbol} is available to return to the creator. This legacy withdrawal transfers the full remaining balance.`}
                    </Text>
                    {withdrawalStatus ? <Text style={styles.successText}>{withdrawalStatus}</Text> : null}
                    {withdrawalError ? <Text style={styles.errText}>{withdrawalError}</Text> : null}
                    <TouchableOpacity
                        style={[
                            styles.withdrawRewardsBtn,
                            (!settlement.canWithdrawAllRemaining || isWithdrawingRewards || !isOwnerActionable || rewardsWereWithdrawn) && { opacity: 0.4 },
                        ]}
                        onPress={handleWithdrawRemainingRewards}
                        disabled={!settlement.canWithdrawAllRemaining || isWithdrawingRewards || !isOwnerActionable || rewardsWereWithdrawn}
                    >
                        <Ionicons name={rewardsWereWithdrawn ? 'checkmark-circle' : 'wallet-outline'} size={16} color="#010501" />
                        <Text style={styles.withdrawRewardsBtnText}>
                            {isWithdrawingRewards
                                ? 'Withdrawing…'
                                : rewardsWereWithdrawn
                                    ? 'Withdrawn'
                                    : isExpired && settlement.remainingRewards === 0
                                        ? 'No rewards remaining'
                                        : 'Withdraw remaining rewards'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Stakers — the web's table, as cards. A 6-column table can't
                    fit a phone without horizontal scrolling, so each staker
                    becomes a row carrying the same six values. */}
                <View style={styles.stakersCard}>
                    <View style={styles.stakersHead}>
                        <Text style={styles.stakersTitle}>Stakers</Text>
                        <Text style={styles.stakersCount}>{stakers.length} wallets</Text>
                    </View>

                    {stakers.length === 0 ? (
                        <Text style={styles.stakersEmpty}>No stakers yet.</Text>
                    ) : (
                        stakers.map((staker, index) => {
                            // Prefer the contract over the DB mirror for both
                            // figures: the mirror drifts, and rewards earned =
                            // already claimed + still pending, in the REWARD token.
                            const chain = stakerByWallet[staker.userWallet.toLowerCase()];
                            const staked = chain ? chain.stakedAmount : staker.stakedAmount;
                            const earned = chain ? (staker.totalClaimed || 0) + chain.pendingReward : staker.rewardsEarned;
                            const isActive = chain ? chain.stakedAmount > 0 : staker.status === 'active';
                            const share = isActive && data.totalStaked
                                ? Math.min(100, (staked / data.totalStaked) * 100)
                                : null;
                            return (
                                <View key={`${staker.userWallet}-${index}`} style={styles.stakerRow}>
                                    <View style={styles.stakerTop}>
                                        <Text style={styles.stakerIndex}>{index + 1}</Text>
                                        <Text style={styles.stakerWallet} numberOfLines={1}>
                                            {staker.userWallet.slice(0, 6)}...{staker.userWallet.slice(-4)}
                                        </Text>
                                        <View style={styles.statusRow}>
                                            <View style={[styles.statusDot, { backgroundColor: isActive ? '#21F69A' : '#8F9891' }]} />
                                            <Text style={[styles.stakerStatus, { color: isActive ? '#21F69A' : '#8F9891' }]}>
                                                {isActive ? 'Active' : staker.status === 'withdrawn' ? 'Withdrawn' : 'Completed'}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.stakerBottom}>
                                        <StakerStat label="Staked" value={`${formatCompact(staked)} ${symbol}`} />
                                        <StakerStat
                                            label="Rewards earned"
                                            value={`+${formatCompact(earned)} ${rewardSymbol}`}
                                            color={colors.primaryCTA}
                                        />
                                        <StakerStat
                                            label="Pool share"
                                            value={share === null ? '—' : `${share.toFixed(1)}%`}
                                            align="flex-end"
                                        />
                                    </View>
                                </View>
                            );
                        })
                    )}
                </View>
            </ScrollView>

            {BackupRequiredModal}
        </View>
    );
}

function StatCard({ icon, label, value, sub }: {
    icon: keyof typeof Ionicons.glyphMap; label: string; value: string; sub?: string;
}) {
    return (
        <View style={styles.statCard}>
            <View style={styles.statCardHead}>
                <Ionicons name={icon} size={14} color="#8F9891" />
                <Text style={styles.statCardLabel}>{label}</Text>
            </View>
            <Text style={styles.statCardValue} numberOfLines={1}>{value}</Text>
            {sub ? <Text style={styles.statCardSub} numberOfLines={1}>{sub}</Text> : null}
        </View>
    );
}

function Meter({ label, value, pct }: { label: string; value: string; pct: number }) {
    return (
        <View>
            <View style={styles.meterHead}>
                <Text style={styles.meterLabel}>{label}</Text>
                <Text style={styles.meterValue} numberOfLines={1}>{value}</Text>
            </View>
            <View style={styles.meterTrack}>
                <View style={[styles.meterFill, { width: `${pct}%` }]} />
            </View>
        </View>
    );
}

function StakerStat({ label, value, color, align }: {
    label: string; value: string; color?: string; align?: 'flex-start' | 'flex-end';
}) {
    return (
        <View style={{ flex: 1, alignItems: align || 'flex-start' }}>
            <Text style={styles.stakerStatLabel}>{label}</Text>
            <Text style={[styles.stakerStatValue, color ? { color } : null]} numberOfLines={1}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#010501' },
    loadingText: { color: '#8F9891', fontFamily: 'Manrope-Medium', fontSize: 14, padding: 20 },

    notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
    notFoundTitle: { color: '#fff', fontFamily: 'Manrope-SemiBold', fontSize: 18 },
    notFoundSub: { color: '#8F9891', fontFamily: 'Manrope-Medium', fontSize: 13, textAlign: 'center' },
    backBtn: { marginTop: 12, borderRadius: 999, backgroundColor: colors.primaryCTA, paddingHorizontal: 20, paddingVertical: 10 },
    backBtnText: { color: '#010501', fontFamily: 'Manrope-SemiBold', fontSize: 13 },

    headerBlock: { paddingTop: 6, paddingBottom: 4, gap: 10 },
    title: { color: '#fff', fontFamily: 'Manrope-SemiBold', fontSize: 22, lineHeight: 28 },
    subRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    subText: { color: '#8F9891', fontFamily: 'Manrope-Medium', fontSize: 13 },
    subDot: { color: '#2c3a2a', fontSize: 13 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontFamily: 'Manrope-SemiBold', fontSize: 13 },

    toggleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
    toggleBtnPause: { borderWidth: 1, borderColor: '#3a201f', backgroundColor: 'transparent' },
    toggleBtnResume: { backgroundColor: colors.primaryCTA },
    toggleBtnText: { fontFamily: 'Manrope-SemiBold', fontSize: 13 },
    errText: { color: '#f87171', fontFamily: 'Manrope-Medium', fontSize: 12 },

    statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    statCard: { width: '47.5%', flexGrow: 1, borderRadius: 16, borderWidth: 1, borderColor: '#1f321d', backgroundColor: 'rgba(7,16,7,0.8)', padding: 14 },
    statCardHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    statCardLabel: { color: '#8F9891', fontFamily: 'Manrope-Medium', fontSize: 11 },
    statCardValue: { color: '#fff', fontFamily: 'Manrope-SemiBold', fontSize: 19, marginTop: 7 },
    statCardSub: { color: '#8F9891', fontFamily: 'Manrope-Medium', fontSize: 11, marginTop: 2 },

    meterCard: { borderRadius: 18, borderWidth: 1, borderColor: '#1f321d', backgroundColor: 'rgba(7,16,7,0.8)', padding: 18 },
    meterHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    meterLabel: { color: '#B5B5B5', fontFamily: 'Manrope-Medium', fontSize: 12 },
    meterValue: { color: '#fff', fontFamily: 'Manrope-SemiBold', fontSize: 12, flexShrink: 1, textAlign: 'right' },
    meterTrack: { height: 6, borderRadius: 3, backgroundColor: '#121712', marginTop: 9, overflow: 'hidden' },
    meterFill: { height: '100%', borderRadius: 3, backgroundColor: colors.primaryCTA },
    meterNote: { color: '#8F9891', fontFamily: 'Manrope-Medium', fontSize: 11, marginTop: 8 },

    pendingNote: { borderRadius: 14, borderWidth: 1, borderColor: '#2a2410', backgroundColor: 'rgba(20,16,5,0.7)', paddingHorizontal: 14, paddingVertical: 12 },
    pendingNoteText: { color: '#facc15', fontFamily: 'Manrope-Medium', fontSize: 12, lineHeight: 17 },

    settlementCard: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#1f321d', paddingVertical: 18, gap: 10 },
    settlementTitle: { color: '#fff', fontFamily: 'Manrope-SemiBold', fontSize: 16 },
    settlementText: { color: '#8F9891', fontFamily: 'Manrope-Medium', fontSize: 13, lineHeight: 19 },
    successText: { color: colors.primaryCTA, fontFamily: 'Manrope-Medium', fontSize: 12, lineHeight: 17 },
    withdrawRewardsBtn: { minHeight: 46, borderRadius: 999, backgroundColor: colors.primaryCTA, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 18, alignSelf: 'stretch' },
    withdrawRewardsBtnText: { color: '#010501', fontFamily: 'Manrope-SemiBold', fontSize: 13 },

    stakersCard: { borderRadius: 24, borderWidth: 1, borderColor: '#1f321d', backgroundColor: 'rgba(1,5,1,0.96)', paddingHorizontal: 16, paddingBottom: 8, paddingTop: 18 },
    stakersHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    stakersTitle: { color: '#fff', fontFamily: 'Manrope-SemiBold', fontSize: 17 },
    stakersCount: { color: '#A7ABA8', fontFamily: 'Manrope-Medium', fontSize: 13 },
    stakersEmpty: { color: '#8F9891', fontFamily: 'Manrope-Medium', fontSize: 13, paddingBottom: 16 },

    stakerRow: { borderTopWidth: 1, borderTopColor: '#10200f', paddingVertical: 12, gap: 10 },
    stakerTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    stakerIndex: { color: '#A7ABA8', fontFamily: 'Manrope-Medium', fontSize: 12, minWidth: 18 },
    stakerWallet: { color: '#fff', fontFamily: 'Manrope-Medium', fontSize: 13, flex: 1 },
    stakerStatus: { fontFamily: 'Manrope-Medium', fontSize: 12 },
    stakerBottom: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingLeft: 28 },
    stakerStatLabel: { color: '#7C837E', fontFamily: 'Manrope-Regular', fontSize: 11 },
    stakerStatValue: { color: '#fff', fontFamily: 'Manrope-SemiBold', fontSize: 13, marginTop: 2 },
});
