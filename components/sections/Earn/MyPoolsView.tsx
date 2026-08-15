/**
 * MyPoolsView (mobile)
 *
 * Native port of the web `components/earn/my-pools-view.tsx`. Lists the pools the
 * connected wallet created with their admin-review status, and surfaces the
 * conditional actions (Pay fee for pending-unpaid, Withdraw funds for rejected).
 */

import { colors } from '@/constants/colors';
import { useStakingDeployer } from '@/hooks/useStakingDeployer';
import { useRequireBackup } from '@/hooks/useRequireBackup';
import { api, type PoolFeeSettings, type UserStakingPool } from '@/lib/mobile/api-client';
import {
    readPoolRewardWithdrawalClient,
    readPoolStatusClient,
    type PoolStatusOnChain,
} from '@/lib/mobile/pool-onchain';
import { Ionicons } from '@expo/vector-icons';
import {
    readRecordedRewardWithdrawal,
    recordRewardWithdrawal,
    type RecordedRewardWithdrawal,
} from '@/utils/staking-reward-withdrawal';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Address, Hash } from 'viem';

const TELEGRAM_SUPPORT_URL = 'https://t.me/tiwiecosystemsupport';

type PoolLifecycle = 'live' | 'paused' | 'ended' | 'unknown';

/**
 * Fallback lifecycle from DB fields, for the moment before the on-chain read
 * lands (or when it fails). The contract's `startTime` is set at funding, a beat
 * after `created_at` - close enough to decide "ended", not close enough to
 * render a countdown from.
 */
function lifecycleFromDb(pool: UserStakingPool): PoolLifecycle {
    const duration = pool.pool?.rewardDurationSeconds ?? pool.settings?.rewardDurationSeconds;
    const createdAt = pool.pool?.createdAt || pool.createdAt;
    if (!duration || !createdAt) return 'unknown';
    const start = new Date(createdAt).getTime();
    if (Number.isNaN(start)) return 'unknown';
    return Date.now() >= start + duration * 1000 ? 'ended' : 'live';
}

const EXPLORERS: Record<number, string> = {
    1: 'https://etherscan.io',
    56: 'https://bscscan.com',
    137: 'https://polygonscan.com',
    42161: 'https://arbiscan.io',
    8453: 'https://basescan.org',
    10: 'https://optimistic.etherscan.io',
    43114: 'https://snowtrace.io',
    1116: 'https://scan.coredao.org',
    1329: 'https://seitrace.com',
};

const isEvmAddr = (v?: string) => !!v && /^0x[a-fA-F0-9]{40}$/.test(v);

function aprText(p: UserStakingPool['pool']): string | null {
    const apr = Number(p?.apy);
    return Number.isFinite(apr) ? `${apr.toFixed(2)}%` : null;
}

/**
 * Human duration for a reward window. Pools are routinely created with windows
 * measured in hours or minutes, and flooring those to days rendered them all
 * as a flat "0 days".
 */
function durationText(seconds?: number): string {
    if (!seconds || seconds <= 0) return '-';
    if (seconds >= 86400) {
        const days = seconds / 86400;
        return `${Number.isInteger(days) ? days : days.toFixed(1)} ${days === 1 ? 'day' : 'days'}`;
    }
    if (seconds >= 3600) {
        const hours = seconds / 3600;
        return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} ${hours === 1 ? 'hour' : 'hours'}`;
    }
    const minutes = Math.max(1, Math.round(seconds / 60));
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}

function rewardAmountText(value?: string): string {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '-';
    return amount.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

interface Props {
    activeWalletAddress?: string | null;
    onConnectEvmWallet?: () => void;
    onCreatePool?: () => void;
}

export function MyPoolsView({ activeWalletAddress, onConnectEvmWallet, onCreatePool }: Props) {
    const [pools, setPools] = useState<UserStakingPool[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [feeSettings, setFeeSettings] = useState<PoolFeeSettings | null>(null);

    useEffect(() => {
        let cancelled = false;
        api.staking.poolSettings()
            .then((s) => { if (!cancelled) setFeeSettings(s); })
            .catch((e) => console.warn('[MyPoolsView] fee settings load failed', e));
        return () => { cancelled = true; };
    }, []);

    const load = useCallback(async () => {
        if (!activeWalletAddress) { setPools([]); return; }
        setIsLoading(true);
        try {
            const data = await api.staking.listUserPools(activeWalletAddress);
            setPools(data?.pools || []);
        } catch (e: any) {
            // A 404 means the user-staking-pools route isn't deployed on this
            // backend yet - treat it as "no pools" rather than a hard error so
            // the screen shows the normal empty state instead of a dev overlay.
            const notDeployed = String(e?.message || '').includes('404');
            if (notDeployed) console.warn('[MyPoolsView] user-staking-pools route unavailable (404) - showing empty state');
            else console.warn('[MyPoolsView] load failed', e);
            setPools([]);
        } finally {
            setIsLoading(false);
        }
    }, [activeWalletAddress]);

    useEffect(() => { load(); }, [load]);

    if (!activeWalletAddress) {
        return (
            <View style={styles.centerCard}>
                <Text style={styles.centerTitle}>Connect your wallet</Text>
                <Text style={styles.centerSub}>Connect an EVM wallet to see the pools you&apos;ve created.</Text>
                <TouchableOpacity style={styles.connectBtn} onPress={onConnectEvmWallet}>
                    <Text style={styles.connectBtnText}>Connect wallet</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={{ width: '100%', gap: 14 }}>
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>My pools</Text>
                    <Text style={styles.headerSub}>Pools you created and their review status.</Text>
                </View>
                <TouchableOpacity style={styles.createBtn} onPress={onCreatePool}>
                    <Ionicons name="add" size={16} color={colors.primaryCTA} />
                    <Text style={styles.createBtnText}>Create</Text>
                </TouchableOpacity>
            </View>

            {isLoading ? (
                <View style={styles.centerCard}><Text style={styles.centerSub}>Loading your pools…</Text></View>
            ) : pools.length === 0 ? (
                <View style={styles.centerCard}>
                    <Text style={styles.centerTitle}>No pools yet</Text>
                    <Text style={styles.centerSub}>Create a staking pool and it&apos;ll show up here.</Text>
                </View>
            ) : (
                <View style={{ gap: 12 }}>
                    {pools.map((p) => (
                        <MyPoolRow key={p.id} pool={p} walletAddress={activeWalletAddress} feeSettings={feeSettings} onChanged={load} />
                    ))}
                </View>
            )}
        </View>
    );
}

/**
 * An approved pool is only "Live" while its reward window is open and it hasn't
 * been paused. Once `endTime` passes nobody can stake and no rewards accrue -
 * badging that as Live told creators their expired pool was still running.
 */
function StatusBadge({ pool, lifecycle }: { pool: UserStakingPool; lifecycle: PoolLifecycle }) {
    if (pool.approvalStatus === 'approved') {
        if (lifecycle === 'ended') {
            return (
                <View style={[styles.badge, { backgroundColor: '#1a1a1a' }]}>
                    <Ionicons name="shield-checkmark" size={13} color="#8F9891" />
                    <Text style={[styles.badgeText, { color: '#8F9891' }]}>Verified · Ended</Text>
                </View>
            );
        }
        if (lifecycle === 'paused') {
            return (
                <View style={[styles.badge, { backgroundColor: '#201a08' }]}>
                    <Ionicons name="shield-checkmark" size={13} color="#facc15" />
                    <Text style={[styles.badgeText, { color: '#facc15' }]}>Verified · Paused</Text>
                </View>
            );
        }
        return (
            <View style={[styles.badge, { backgroundColor: '#063D05' }]}>
                <Ionicons name="shield-checkmark" size={13} color={colors.primaryCTA} />
                <Text style={[styles.badgeText, { color: colors.primaryCTA }]}>Verified · Live</Text>
            </View>
        );
    }
    if (pool.approvalStatus === 'pending') {
        return (
            <View style={[styles.badge, { backgroundColor: '#201a08' }]}>
                <Ionicons name="time" size={13} color="#facc15" />
                <Text style={[styles.badgeText, { color: '#facc15' }]}>Pending review</Text>
            </View>
        );
    }
    if (pool.fundsWithdrawn) {
        return (
            <View style={[styles.badge, { backgroundColor: '#1a1a1a' }]}>
                <Ionicons name="ban" size={13} color="#8F9891" />
                <Text style={[styles.badgeText, { color: '#8F9891' }]}>Nullified</Text>
            </View>
        );
    }
    return (
        <View style={[styles.badge, { backgroundColor: '#2a1010' }]}>
            <Ionicons name="close-circle" size={13} color="#f87171" />
            <Text style={[styles.badgeText, { color: '#f87171' }]}>Rejected</Text>
        </View>
    );
}

function MyPoolRow({ pool, walletAddress, feeSettings, onChanged }: {
    pool: UserStakingPool; walletAddress: string; feeSettings: PoolFeeSettings | null; onChanged: () => void;
}) {
    const router = useRouter();
    const [expanded, setExpanded] = useState(false);
    const [isWithdrawing, setIsWithdrawing] = useState(false);
    const [isPayingFee, setIsPayingFee] = useState(false);
    const [pendingFeeTxHash, setPendingFeeTxHash] = useState<Hash | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [rewardWithdrawalError, setRewardWithdrawalError] = useState<string | null>(null);
    const [withdrawalSuccess, setWithdrawalSuccess] = useState<string | null>(null);
    const [recordedWithdrawal, setRecordedWithdrawal] = useState<RecordedRewardWithdrawal | null>(null);
    const [chainStatus, setChainStatus] = useState<PoolStatusOnChain | null>(null);
    const { payCreationFee, emergencyWithdrawRewards, withdrawRemainingRewards } = useStakingDeployer();
    const { requireBackup, BackupRequiredModal } = useRequireBackup();
    const handleTelegramSupportPress = useCallback(() => {
        Linking.openURL(TELEGRAM_SUPPORT_URL).catch((e) => {
            console.warn('[MyPoolsView] failed to open Telegram support:', e);
        });
    }, []);

    useEffect(() => {
        let cancelled = false;
        Promise.all([
            readRecordedRewardWithdrawal(pool.chainId, pool.poolContractAddress),
            readPoolRewardWithdrawalClient({
                chainId: pool.chainId,
                poolAddress: pool.poolContractAddress,
                deploymentTxHash: pool.txHash,
            }),
        ]).then(async ([cached, onChain]) => {
            const record = onChain || cached;
            if (onChain && !cached) {
                await recordRewardWithdrawal(pool.chainId, pool.poolContractAddress, onChain.txHash).catch(() => undefined);
            }
            if (!cancelled) setRecordedWithdrawal(record);
        });
        return () => { cancelled = true; };
    }, [pool.chainId, pool.poolContractAddress, pool.txHash]);

    // `endTime` lives on the contract, not in `staking_pools`, so the badge has
    // to read it. Only approved pools are worth the call - the rest can't be live.
    useEffect(() => {
        let cancelled = false;
        if (pool.approvalStatus !== 'approved' || !isEvmAddr(pool.poolContractAddress)) return;
        readPoolStatusClient({
            chainId: pool.chainId,
            poolAddress: pool.poolContractAddress,
            stakingDecimals: pool.pool?.decimals ?? 18,
            stakingSymbol: pool.settings?.tokenSymbol || pool.pool?.tokenSymbol,
        })
            .then((status) => { if (!cancelled) setChainStatus(status); });
        return () => { cancelled = true; };
    }, [
        pool.approvalStatus,
        pool.poolContractAddress,
        pool.chainId,
        pool.pool?.decimals,
        pool.pool?.tokenSymbol,
        pool.settings?.tokenSymbol,
    ]);

    const lifecycle: PoolLifecycle = chainStatus
        ? chainStatus.ended ? 'ended' : chainStatus.active ? 'live' : 'paused'
        : lifecycleFromDb(pool);

    const canWithdrawRejectedPool = pool.approvalStatus === 'rejected' && !pool.fundsWithdrawn;
    const remainingRewards = Number(chainStatus?.remainingRewards);
    const canWithdrawRemaining =
        pool.approvalStatus === 'approved' &&
        chainStatus?.supportsProtectedRewardWithdrawal === true &&
        chainStatus.ended &&
        Number.isFinite(remainingRewards) &&
        remainingRewards > 0;
    const rewardsWereWithdrawn = recordedWithdrawal !== null || withdrawalSuccess !== null;
    const feeUnpaid =
        !!feeSettings?.creationFeeEnabled &&
        feeSettings.creationFeeAmount > 0 &&
        isEvmAddr(feeSettings.creationFeeTokenAddress) &&
        isEvmAddr(feeSettings.creationFeeTreasuryAddress) &&
        !pool.creationFeeTxHash;
    // An outstanding fee stays payable for as long as the pool is live -
    // gating this to 'pending' left an already-approved pool with no way to
    // settle it. A rejected pool is the one case where we stop asking: it's
    // being nullified.
    const canPayFee = feeUnpaid && pool.approvalStatus !== 'rejected';
    const explorer = EXPLORERS[pool.chainId];
    const apr = aprText(pool.pool);
    const title = pool.poolName || pool.pool?.name || pool.pool?.tokenSymbol || 'Untitled pool';
    // Reward figures are denominated in the EARN token, TVL in the STAKE
    // token. Labelling both with the staking symbol reported a
    // "stake TWC, earn USDT" pool as paying out TWC.
    const stakeSymbol = pool.settings?.tokenSymbol || pool.pool?.tokenSymbol || '';
    const rewardSymbol = pool.settings?.rewardTokenSymbol || stakeSymbol;

    const handleRejectedPoolWithdraw = async () => {
        setError(null);
        setWithdrawalSuccess(null);
        if (!requireBackup()) return;
        setIsWithdrawing(true);
        try {
            const hash = await emergencyWithdrawRewards({
                chainId: pool.chainId,
                poolAddress: pool.poolContractAddress as Address,
                walletAddress: walletAddress as Address,
            });
            await api.staking.patchUserPool({ id: pool.id, fundsWithdrawn: true, txHash: hash });
            onChanged();
        } catch (e: any) {
            setError(e?.message || 'Withdrawal failed. Please try again.');
        } finally {
            setIsWithdrawing(false);
        }
    };

    const handleRemainingRewardsWithdraw = async () => {
        if (!canWithdrawRemaining) return;
        setRewardWithdrawalError(null);
        setWithdrawalSuccess(null);
        if (!requireBackup()) return;
        setIsWithdrawing(true);
        try {
            const hash = await withdrawRemainingRewards({
                chainId: pool.chainId,
                poolAddress: pool.poolContractAddress as Address,
                walletAddress: walletAddress as Address,
            });
            const record = await recordRewardWithdrawal(pool.chainId, pool.poolContractAddress, hash);
            setRecordedWithdrawal(record);
            const refreshed = await readPoolStatusClient({
                chainId: pool.chainId,
                poolAddress: pool.poolContractAddress,
                stakingDecimals: pool.pool?.decimals ?? 18,
                stakingSymbol: stakeSymbol,
            });
            setChainStatus(refreshed);
            setWithdrawalSuccess(`Remaining rewards withdrawn. Transaction ${hash.slice(0, 10)}…${hash.slice(-6)}`);
        } catch (e: any) {
            setRewardWithdrawalError(e?.message || 'Reward withdrawal failed. Please try again.');
        } finally {
            setIsWithdrawing(false);
        }
    };

    const handlePayFee = async () => {
        if (!feeSettings) return;
        setError(null);
        if (!pendingFeeTxHash && !requireBackup()) return;
        setIsPayingFee(true);
        try {
            let hash = pendingFeeTxHash;
            if (!hash) {
                hash = await payCreationFee({
                    chainId: feeSettings.creationFeeChainId,
                    tokenAddress: feeSettings.creationFeeTokenAddress as Address,
                    treasury: feeSettings.creationFeeTreasuryAddress as Address,
                    amount: String(feeSettings.creationFeeAmount),
                    decimals: feeSettings.creationFeeTokenDecimals,
                    tokenSymbol: feeSettings.creationFeeTokenSymbol,
                    walletAddress: walletAddress as Address,
                });
            }
            setPendingFeeTxHash(hash);
            try {
                await api.staking.patchUserPool({
                    id: pool.id,
                    creationFeeTxHash: hash,
                    creationFeeAmount: feeSettings.creationFeeAmount,
                    creationFeeToken: feeSettings.creationFeeTokenSymbol || feeSettings.creationFeeTokenAddress,
                });
                setPendingFeeTxHash(null);
            } catch (patchErr: any) {
                // The server re-verifies the hash on-chain before storing it,
                // so a rejection means the pool is genuinely still unpaid. Say
                // so - and surface the hash - rather than refreshing into a
                // misleading "paid" state.
                throw new Error(
                    `The fee was sent (tx ${hash}) but recording it failed. ` +
                    `${patchErr?.message || 'Try confirming again, or contact support with this hash.'}`,
                );
            }
            onChanged();
        } catch (e: any) {
            setError(e?.message || 'Fee payment failed. Please try again.');
        } finally {
            setIsPayingFee(false);
        }
    };
    const feeButtonText = isPayingFee
        ? pendingFeeTxHash ? 'Confirming…' : 'Paying…'
        : pendingFeeTxHash ? 'Confirm fee' : 'Pay fee';

    return (
        <View style={styles.row}>
            <TouchableOpacity style={styles.rowHead} activeOpacity={0.85} onPress={() => setExpanded((v) => !v)}>
                <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                        {stakeSymbol
                            ? `${rewardSymbol && rewardSymbol !== stakeSymbol ? `${stakeSymbol} → ${rewardSymbol}` : stakeSymbol} · `
                            : ''}
                        {pool.pool?.chainName || `chain ${pool.chainId}`}
                    </Text>
                </View>
                {/* An unpaid fee is the one thing the creator has to act on, so
                    it reads from the collapsed row - no expanding to find it. */}
                {canPayFee ? (
                    <View style={[styles.badge, { backgroundColor: '#201a08', marginRight: 6 }]}>
                        <Ionicons name="wallet" size={13} color="#facc15" />
                        <Text style={[styles.badgeText, { color: '#facc15' }]}>Fee unpaid</Text>
                    </View>
                ) : null}
                <StatusBadge pool={pool} lifecycle={lifecycle} />
                <Ionicons name="chevron-down" size={16} color="#8F9891" style={{ marginLeft: 6, transform: [{ rotate: expanded ? '180deg' : '0deg' }] }} />
            </TouchableOpacity>

            {expanded ? (
                <View style={styles.rowBody}>
                    <View style={styles.infoGrid}>
                        <Info label="APR" value={apr || '-'} />
                        <Info label="Reward pool" value={pool.pool?.poolReward != null ? `${pool.pool.poolReward} ${rewardSymbol}`.trim() : '-'} />
                        <Info label="Max TVL" value={pool.pool?.maxTvl != null ? `${pool.pool.maxTvl} ${stakeSymbol}`.trim() : '-'} />
                        <Info label="Duration" value={durationText(pool.pool?.rewardDurationSeconds)} />
                    </View>

                    <View style={styles.addrRow}>
                        <Text style={styles.addrText} numberOfLines={1}>
                            Pool {pool.poolContractAddress.slice(0, 8)}…{pool.poolContractAddress.slice(-6)}
                        </Text>
                        {explorer ? (
                            <TouchableOpacity onPress={() => Linking.openURL(`${explorer}/address/${pool.poolContractAddress}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                <Text style={styles.viewLink}>View</Text>
                                <Ionicons name="open-outline" size={12} color={colors.primaryCTA} />
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    {pool.approvalStatus === 'approved' ? (
                        <TouchableOpacity
                            style={styles.manageBtn}
                            // The creator-facing management screen, not the
                            // staker-facing stake screen. Matches the web's
                            // /earn/pool/manage?id=<stakingPoolId>.
                            //
                            // `name` is passed along because the mobile
                            // staking route doesn't project the pool's name -
                            // without it the header falls back to the bare
                            // token symbol, and this row already knows it.
                            onPress={() => router.push({
                                pathname: '/earn/pool/[id]',
                                params: {
                                    id: pool.stakingPoolId,
                                    name: title,
                                    deploymentTxHash: pool.txHash || '',
                                },
                            } as any)}
                        >
                            <Ionicons name="settings-outline" size={15} color={colors.primaryCTA} />
                            <Text style={styles.manageBtnText}>Manage pool</Text>
                        </TouchableOpacity>
                    ) : null}

                    {pool.approvalStatus === 'approved' ? (
                        <View style={styles.rewardNote}>
                            <Text style={styles.rewardNoteTitle}>Remaining rewards</Text>
                            <Text style={styles.rewardNoteText}>
                                {rewardsWereWithdrawn
                                    ? 'Remaining rewards were withdrawn successfully. User claims remain protected.'
                                    : !chainStatus
                                    ? 'Checking the pool contract for withdrawable rewards.'
                                    : !chainStatus.supportsProtectedRewardWithdrawal
                                      ? 'This is a legacy pool. Open Manage pool to verify whether a full reward withdrawal is safe.'
                                    : chainStatus.ended
                                    ? Number.isFinite(remainingRewards) && remainingRewards > 0
                                        ? `${rewardAmountText(chainStatus.remainingRewards)} ${rewardSymbol} is available to withdraw.`
                                        : 'No unused reward funds remain in this pool.'
                                    : 'Withdrawal becomes available after the pool expires.'}
                                {!rewardsWereWithdrawn && chainStatus?.supportsProtectedRewardWithdrawal
                                    ? ` ${rewardAmountText(chainStatus.unclaimedRewards)} ${rewardSymbol} remains reserved for user claims.`
                                    : ''}
                            </Text>
                            {withdrawalSuccess ? <Text style={styles.successText}>{withdrawalSuccess}</Text> : null}
                            {rewardWithdrawalError ? <Text style={styles.errText}>{rewardWithdrawalError}</Text> : null}
                            <TouchableOpacity
                                style={[styles.remainingBtn, (!canWithdrawRemaining || isWithdrawing || rewardsWereWithdrawn) && { opacity: 0.45 }]}
                                onPress={handleRemainingRewardsWithdraw}
                                disabled={!canWithdrawRemaining || isWithdrawing || rewardsWereWithdrawn}
                            >
                                <Ionicons name={rewardsWereWithdrawn ? 'checkmark-circle' : 'wallet-outline'} size={15} color="#010501" />
                                <Text style={styles.remainingBtnText}>
                                    {isWithdrawing
                                        ? 'Withdrawing…'
                                        : rewardsWereWithdrawn
                                            ? 'Withdrawn'
                                            : chainStatus?.ended && remainingRewards === 0
                                                ? 'No rewards remaining'
                                                : 'Withdraw remaining rewards'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}

                    {pool.approvalStatus === 'pending' && !canPayFee ? (
                        <View style={styles.pendingNote}>
                            <Text style={styles.pendingNoteText}>
                                Waiting for an admin to review this pool. It isn&apos;t visible to stakers yet.
                                {' '}If approval takes more than 24 hours,{' '}
                                <Text style={styles.pendingNoteLink} onPress={handleTelegramSupportPress}>
                                    contact Telegram support
                                </Text>
                                .
                            </Text>
                        </View>
                    ) : null}

                    {canPayFee && feeSettings ? (
                        <View style={styles.pendingNote}>
                            <Text style={styles.pendingNoteText}>
                                Creation fee not paid. Pay the{' '}
                                <Text style={{ color: '#fff', fontFamily: 'Manrope-SemiBold' }}>
                                    {feeSettings.creationFeeAmount} {feeSettings.creationFeeTokenSymbol || 'token'}
                                </Text>
                                {' '}fee to settle this pool
                                {pool.approvalStatus === 'pending' ? ' so an admin can review and approve it' : ''}.
                            </Text>
                            {error ? <Text style={styles.errText}>{error}</Text> : null}
                            <TouchableOpacity style={[styles.payBtn, isPayingFee && { opacity: 0.6 }]} onPress={handlePayFee} disabled={isPayingFee}>
                                <Text style={styles.payBtnText}>{feeButtonText}</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}

                    {canWithdrawRejectedPool ? (
                        <View style={styles.rejectNote}>
                            <Text style={styles.rejectNoteText}>
                                This pool was rejected. You can withdraw the reward funds you deposited - the pool will be nullified but stays listed here.
                            </Text>
                            {error ? <Text style={styles.errText}>{error}</Text> : null}
                            <TouchableOpacity style={[styles.withdrawBtn, isWithdrawing && { opacity: 0.6 }]} onPress={handleRejectedPoolWithdraw} disabled={isWithdrawing}>
                                <Text style={styles.withdrawBtnText}>{isWithdrawing ? 'Withdrawing…' : 'Withdraw funds'}</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}

                    {pool.approvalStatus === 'rejected' && pool.fundsWithdrawn ? (
                        <View style={styles.nullNote}>
                            <Text style={styles.nullNoteText}>This pool was rejected and its funds have been withdrawn. It&apos;s nullified and no longer active.</Text>
                        </View>
                    ) : null}

                    {BackupRequiredModal}
                </View>
            ) : null}
        </View>
    );
}

function Info({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    centerCard: { borderRadius: 24, borderWidth: 1, borderColor: '#1f321d', backgroundColor: 'rgba(1,5,1,0.95)', padding: 28, alignItems: 'center' },
    centerTitle: { color: '#fff', fontFamily: 'Manrope-SemiBold', fontSize: 15 },
    centerSub: { color: '#8F9891', fontFamily: 'Manrope-Medium', fontSize: 13, marginTop: 6, textAlign: 'center' },
    connectBtn: { marginTop: 16, borderRadius: 999, backgroundColor: colors.primaryCTA, paddingHorizontal: 20, paddingVertical: 10 },
    connectBtnText: { color: '#010501', fontFamily: 'Manrope-SemiBold', fontSize: 13 },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerTitle: { color: '#fff', fontFamily: 'Manrope-SemiBold', fontSize: 16 },
    headerSub: { color: '#8F9891', fontFamily: 'Manrope-Medium', fontSize: 13, marginTop: 2 },
    createBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, backgroundColor: '#063D05', paddingHorizontal: 14, paddingVertical: 8 },
    createBtnText: { color: colors.primaryCTA, fontFamily: 'Manrope-SemiBold', fontSize: 13 },

    badge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
    badgeText: { fontFamily: 'Manrope-SemiBold', fontSize: 12 },

    row: { borderRadius: 20, borderWidth: 1, borderColor: '#1f321d', backgroundColor: 'rgba(1,5,1,0.95)', overflow: 'hidden' },
    rowHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
    rowTitle: { color: '#fff', fontFamily: 'Manrope-SemiBold', fontSize: 14 },
    rowSub: { color: '#8F9891', fontFamily: 'Manrope-Medium', fontSize: 11, marginTop: 2 },
    rowBody: { borderTopWidth: 1, borderTopColor: '#1f321d', paddingHorizontal: 16, paddingVertical: 14 },

    infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    infoCell: { width: '47.5%', flexGrow: 1, borderRadius: 14, borderWidth: 1, borderColor: '#1f321d', backgroundColor: 'rgba(7,16,7,0.7)', paddingHorizontal: 12, paddingVertical: 10 },
    infoLabel: { color: '#8F9891', fontFamily: 'Manrope-Regular', fontSize: 11 },
    infoValue: { color: '#fff', fontFamily: 'Manrope-SemiBold', fontSize: 13, marginTop: 2 },

    addrRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
    addrText: { color: '#8F9891', fontFamily: 'Manrope-Medium', fontSize: 12, flex: 1, marginRight: 8 },
    viewLink: { color: colors.primaryCTA, fontFamily: 'Manrope-SemiBold', fontSize: 12 },

    manageBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 14, borderRadius: 999, backgroundColor: '#063D05', paddingHorizontal: 14, paddingVertical: 9 },
    manageBtnText: { color: colors.primaryCTA, fontFamily: 'Manrope-SemiBold', fontSize: 13 },

    pendingNote: { marginTop: 14, borderRadius: 14, borderWidth: 1, borderColor: '#2a2410', backgroundColor: 'rgba(20,16,5,0.7)', paddingHorizontal: 14, paddingVertical: 12 },
    pendingNoteText: { color: '#facc15', fontFamily: 'Manrope-Medium', fontSize: 13, lineHeight: 18 },
    pendingNoteLink: { color: '#fff', fontFamily: 'Manrope-SemiBold', textDecorationLine: 'underline' },
    rejectNote: { marginTop: 14, borderRadius: 14, borderWidth: 1, borderColor: '#3a1414', backgroundColor: 'rgba(22,8,8,0.7)', paddingHorizontal: 14, paddingVertical: 12 },
    rejectNoteText: { color: '#f4a4a4', fontFamily: 'Manrope-Medium', fontSize: 13, lineHeight: 18 },
    nullNote: { marginTop: 14, borderRadius: 14, borderWidth: 1, borderColor: '#242424', backgroundColor: 'rgba(12,12,12,0.7)', paddingHorizontal: 14, paddingVertical: 12 },
    nullNoteText: { color: '#8F9891', fontFamily: 'Manrope-Medium', fontSize: 13, lineHeight: 18 },
    errText: { color: '#f87171', fontFamily: 'Manrope-Medium', fontSize: 12, marginTop: 8 },
    successText: { color: colors.primaryCTA, fontFamily: 'Manrope-Medium', fontSize: 12, marginTop: 8 },

    rewardNote: { marginTop: 14, borderRadius: 14, borderWidth: 1, borderColor: '#29421f', backgroundColor: 'rgba(7,20,5,0.75)', paddingHorizontal: 14, paddingVertical: 12 },
    rewardNoteTitle: { color: '#fff', fontFamily: 'Manrope-SemiBold', fontSize: 13 },
    rewardNoteText: { color: '#a8b3aa', fontFamily: 'Manrope-Medium', fontSize: 12, lineHeight: 18, marginTop: 4 },

    payBtn: { marginTop: 12, alignSelf: 'flex-start', borderRadius: 999, backgroundColor: colors.primaryCTA, paddingHorizontal: 16, paddingVertical: 9 },
    payBtnText: { color: '#010501', fontFamily: 'Manrope-SemiBold', fontSize: 13 },
    withdrawBtn: { marginTop: 12, alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#f87171', paddingHorizontal: 16, paddingVertical: 9 },
    withdrawBtnText: { color: '#160808', fontFamily: 'Manrope-SemiBold', fontSize: 13 },
    remainingBtn: { marginTop: 12, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: colors.primaryCTA, paddingHorizontal: 16, paddingVertical: 9 },
    remainingBtnText: { color: '#010501', fontFamily: 'Manrope-SemiBold', fontSize: 13 },
});
