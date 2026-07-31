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
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Address } from 'viem';

const SECONDS_PER_YEAR = 31_536_000;

const EXPLORERS: Record<number, string> = {
    1: 'https://etherscan.io',
    56: 'https://bscscan.com',
    137: 'https://polygonscan.com',
    42161: 'https://arbiscan.io',
    8453: 'https://basescan.org',
    10: 'https://optimistic.etherscan.io',
    43114: 'https://snowtrace.io',
};

const isEvmAddr = (v?: string) => !!v && /^0x[a-fA-F0-9]{40}$/.test(v);

function aprText(p: UserStakingPool['pool']): string | null {
    if (!p?.poolReward || !p.maxTvl || !p.rewardDurationSeconds) return null;
    const apr = (p.poolReward / (p.maxTvl * p.rewardDurationSeconds)) * SECONDS_PER_YEAR * 100;
    return Number.isFinite(apr) ? `${apr.toFixed(2)}%` : null;
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
            // backend yet — treat it as "no pools" rather than a hard error so
            // the screen shows the normal empty state instead of a dev overlay.
            const notDeployed = String(e?.message || '').includes('404');
            if (notDeployed) console.warn('[MyPoolsView] user-staking-pools route unavailable (404) — showing empty state');
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

function StatusBadge({ pool }: { pool: UserStakingPool }) {
    if (pool.approvalStatus === 'approved') {
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
    const [error, setError] = useState<string | null>(null);
    const { payCreationFee, emergencyWithdrawRewards } = useStakingDeployer();
    const { requireBackup, BackupRequiredModal } = useRequireBackup();

    const canWithdraw = pool.approvalStatus === 'rejected' && !pool.fundsWithdrawn;
    const feeUnpaid =
        !!feeSettings?.creationFeeEnabled &&
        feeSettings.creationFeeAmount > 0 &&
        isEvmAddr(feeSettings.creationFeeTokenAddress) &&
        isEvmAddr(feeSettings.creationFeeTreasuryAddress) &&
        !pool.creationFeeTxHash;
    const canPayFee = pool.approvalStatus === 'pending' && feeUnpaid;
    const explorer = EXPLORERS[pool.chainId];
    const apr = aprText(pool.pool);
    const title = pool.poolName || pool.pool?.name || pool.pool?.tokenSymbol || 'Untitled pool';
    const sym = pool.pool?.tokenSymbol ?? '';

    const handleWithdraw = async () => {
        setError(null);
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

    const handlePayFee = async () => {
        if (!feeSettings) return;
        setError(null);
        if (!requireBackup()) return;
        setIsPayingFee(true);
        try {
            const hash = await payCreationFee({
                chainId: feeSettings.creationFeeChainId,
                tokenAddress: feeSettings.creationFeeTokenAddress as Address,
                treasury: feeSettings.creationFeeTreasuryAddress as Address,
                amount: String(feeSettings.creationFeeAmount),
                decimals: feeSettings.creationFeeTokenDecimals,
                walletAddress: walletAddress as Address,
            });
            await api.staking.patchUserPool({
                id: pool.id,
                creationFeeTxHash: hash,
                creationFeeAmount: feeSettings.creationFeeAmount,
                creationFeeToken: feeSettings.creationFeeTokenSymbol || feeSettings.creationFeeTokenAddress,
            });
            onChanged();
        } catch (e: any) {
            setError(e?.message || 'Fee payment failed. Please try again.');
        } finally {
            setIsPayingFee(false);
        }
    };

    return (
        <View style={styles.row}>
            <TouchableOpacity style={styles.rowHead} activeOpacity={0.85} onPress={() => setExpanded((v) => !v)}>
                <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                        {sym ? `${sym} · ` : ''}{pool.pool?.chainName || `chain ${pool.chainId}`}
                    </Text>
                </View>
                <StatusBadge pool={pool} />
                <Ionicons name="chevron-down" size={16} color="#8F9891" style={{ marginLeft: 6, transform: [{ rotate: expanded ? '180deg' : '0deg' }] }} />
            </TouchableOpacity>

            {expanded ? (
                <View style={styles.rowBody}>
                    <View style={styles.infoGrid}>
                        <Info label="APR" value={apr || '—'} />
                        <Info label="Reward pool" value={pool.pool?.poolReward != null ? `${pool.pool.poolReward} ${sym}` : '—'} />
                        <Info label="Max TVL" value={pool.pool?.maxTvl != null ? `${pool.pool.maxTvl} ${sym}` : '—'} />
                        <Info label="Duration" value={pool.pool?.rewardDurationSeconds ? `${Math.round(pool.pool.rewardDurationSeconds / 86400)} days` : '—'} />
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
                            onPress={() => router.push(`/earn/stake/${encodeURIComponent(pool.stakingPoolId)}` as any)}
                        >
                            <Ionicons name="settings-outline" size={15} color={colors.primaryCTA} />
                            <Text style={styles.manageBtnText}>Manage pool</Text>
                        </TouchableOpacity>
                    ) : null}

                    {pool.approvalStatus === 'pending' && !canPayFee ? (
                        <View style={styles.pendingNote}>
                            <Text style={styles.pendingNoteText}>Waiting for an admin to review this pool. It isn&apos;t visible to stakers yet.</Text>
                        </View>
                    ) : null}

                    {canPayFee && feeSettings ? (
                        <View style={styles.pendingNote}>
                            <Text style={styles.pendingNoteText}>
                                Creation fee not paid. Pay the <Text style={{ color: '#fff', fontFamily: 'Manrope-SemiBold' }}>{feeSettings.creationFeeAmount} {feeSettings.creationFeeTokenSymbol || 'token'}</Text> fee so an admin can review and approve this pool.
                            </Text>
                            {error ? <Text style={styles.errText}>{error}</Text> : null}
                            <TouchableOpacity style={[styles.payBtn, isPayingFee && { opacity: 0.6 }]} onPress={handlePayFee} disabled={isPayingFee}>
                                <Text style={styles.payBtnText}>{isPayingFee ? 'Paying…' : 'Pay fee'}</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}

                    {canWithdraw ? (
                        <View style={styles.rejectNote}>
                            <Text style={styles.rejectNoteText}>
                                This pool was rejected. You can withdraw the reward funds you deposited — the pool will be nullified but stays listed here.
                            </Text>
                            {error ? <Text style={styles.errText}>{error}</Text> : null}
                            <TouchableOpacity style={[styles.withdrawBtn, isWithdrawing && { opacity: 0.6 }]} onPress={handleWithdraw} disabled={isWithdrawing}>
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
    rejectNote: { marginTop: 14, borderRadius: 14, borderWidth: 1, borderColor: '#3a1414', backgroundColor: 'rgba(22,8,8,0.7)', paddingHorizontal: 14, paddingVertical: 12 },
    rejectNoteText: { color: '#f4a4a4', fontFamily: 'Manrope-Medium', fontSize: 13, lineHeight: 18 },
    nullNote: { marginTop: 14, borderRadius: 14, borderWidth: 1, borderColor: '#242424', backgroundColor: 'rgba(12,12,12,0.7)', paddingHorizontal: 14, paddingVertical: 12 },
    nullNoteText: { color: '#8F9891', fontFamily: 'Manrope-Medium', fontSize: 13, lineHeight: 18 },
    errText: { color: '#f87171', fontFamily: 'Manrope-Medium', fontSize: 12, marginTop: 8 },

    payBtn: { marginTop: 12, alignSelf: 'flex-start', borderRadius: 999, backgroundColor: colors.primaryCTA, paddingHorizontal: 16, paddingVertical: 9 },
    payBtnText: { color: '#010501', fontFamily: 'Manrope-SemiBold', fontSize: 13 },
    withdrawBtn: { marginTop: 12, alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#f87171', paddingHorizontal: 16, paddingVertical: 9 },
    withdrawBtnText: { color: '#160808', fontFamily: 'Manrope-SemiBold', fontSize: 13 },
});
