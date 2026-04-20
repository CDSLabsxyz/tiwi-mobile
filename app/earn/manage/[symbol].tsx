/**
 * Manage Stake Screen (Active Position)
 * Allows user to Boost (add more) or Unstake (withdraw)
 * Matches Figma design: 3279:111289 (Boost) & 3279:111365 (Unstake)
 */

import { AccountSelectionModal } from '@/components/sections/Earn/AccountSelectionModal';
import { DepositSelectionModal } from '@/components/sections/Earn/DepositSelectionModal';
import { PercentageActionModal } from '@/components/sections/Earn/PercentageActionModal';
import { RewardsSummaryPanel } from '@/components/sections/Earn/RewardsSummaryPanel';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { NumericKeypad } from '@/components/ui/NumericKeypad';
import { colors } from '@/constants/colors';
import { useStakingAllowance } from '@/hooks/useStakingAllowance';
import { useStakingPool } from '@/hooks/useStakingPool';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { stakingService, type UserStake } from '@/services/stakingService';
import { useWalletStore } from '@/store/walletStore';
import AntDesign from '@expo/vector-icons/AntDesign';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useToastStore } from '@/store/useToastStore';
import { formatCompactNumber } from '@/utils/formatting';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    NativeSyntheticEvent,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TextInputSelectionChangeEventData,
    TouchableOpacity,
    View
} from 'react-native';
import { TIWILoader } from '@/components/ui/TIWILoader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { parseUnits } from 'viem';
import { useAccount } from 'wagmi';

// Icons
const BackIcon = require('../../../assets/swap/arrow-left-02.svg');
const DropdownIcon = require('../../../assets/home/arrow-down-01.svg');
const TWCIcon = require('../../../assets/home/tiwicat.svg');

type ManageTab = 'Boost' | 'Unstake';

export default function ManageStakeScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const { symbol } = useLocalSearchParams<{ symbol: string }>();

    const [activeTab, setActiveTab] = useState<ManageTab>('Boost');
    const [amount, setAmount] = useState('');
    const [selection, setSelection] = useState({ start: 0, end: 0 });
    const [isAccountModalVisible, setIsAccountModalVisible] = useState(false);
    const [isDepositModalVisible, setIsDepositModalVisible] = useState(false);
    const [isClaimModalVisible, setIsClaimModalVisible] = useState(false);
    const [isUnstakeModalVisible, setIsUnstakeModalVisible] = useState(false);

    const { walletGroups, address: activeAddress } = useWalletStore();
    const { data: balanceData } = useWalletBalances();
    const [userStake, setUserStake] = useState<UserStake | null>(null);
    const { showToast } = useToastStore();
    const [isLoading, setIsLoading] = useState(true);
    const inputRef = useRef<TextInput>(null);

    // Live rewards state
    const [liveRewards, setLiveRewards] = useState(0);
    const [timeStakedSeconds, setTimeStakedSeconds] = useState(0);
    const lastUpdateTs = useRef<number>(Date.now());

    // Get user balance for this specific token
    const userTokenBalance = useMemo(() => {
        if (!balanceData?.tokens || !symbol) return '0';
        const token = balanceData.tokens.find(t => t.symbol.toLowerCase() === symbol.toLowerCase());
        return token?.balanceFormatted || '0';
    }, [balanceData, symbol]);

    // Available accounts
    const availableAccounts = useMemo(() => {
        const list: any[] = [];
        walletGroups.forEach(group => {
            const groupAddress = group.addresses[group.primaryChain];
            if (!groupAddress) return;
            const isMain = groupAddress.toLowerCase() === activeAddress?.toLowerCase();
            list.push({
                id: groupAddress,
                name: group.name || (isMain ? 'Main Wallet' : 'Imported Wallet'),
                type: 'Wallet',
                balance: `${isMain ? userTokenBalance : '0.00'} ${symbol}`,
                address: groupAddress
            });
        });
        return list;
    }, [walletGroups, activeAddress, userTokenBalance, symbol]);

    const [selectedAccountId, setSelectedAccountId] = useState<string>(activeAddress || '');
    const selectedAccount = useMemo(() =>
        availableAccounts.find(a => a.id === selectedAccountId) || availableAccounts[0]
        , [availableAccounts, selectedAccountId]);

    useEffect(() => {
        const loadStake = async () => {
            if (activeAddress && symbol) {
                const stake = await stakingService.getUserStakeBySymbol(activeAddress, symbol);
                if (stake) setUserStake(stake);
                setIsLoading(false);
            }
        };
        loadStake();
    }, [activeAddress, symbol]);

    const manageIdentifier = userStake?.pool?.poolContractAddress ? userStake?.pool?.id : userStake?.pool?.poolId;
    const stakingData = useStakingPool(manageIdentifier, userStake?.pool?.decimals ?? 9, {
        poolContractAddress: userStake?.pool?.poolContractAddress,
    });
    const {
        allowance: initialAllowance,
        isTransactionPending,
        approve,
        stake,
        unstake,
        claimRewards,
        maxUnstakeWithHarvest,
        refetch: refetchStaking,
        earningRate,
        stakeTime,
        rewardDurationSeconds
    } = stakingData;

    // Real-time Mining & Countdown Logic
    useEffect(() => {
        if (stakingData.pendingRewards === null) return;

        // Internal tick for smooth 'mining' feel
        const miningInterval = setInterval(() => {
            const now = Date.now();
            const deltaSec = (now - lastUpdateTs.current) / 1000;
            lastUpdateTs.current = now;

            if (earningRate > 0) {
                setLiveRewards(prev => prev + (earningRate * deltaSec));
            }

            // Also update time staked seconds
            const nowSec = Math.floor(now / 1000);

            // Fallback for stakeTime: use on-chain first, then DB createdAt
            let finalStakeTime = stakeTime;
            if (finalStakeTime <= 0 && userStake?.createdAt) {
                finalStakeTime = Math.floor(new Date(userStake.createdAt).getTime() / 1000);
            }

            if (finalStakeTime > 0) {
                setTimeStakedSeconds(nowSec - finalStakeTime);
            }
        }, 100);

        return () => clearInterval(miningInterval);
    }, [earningRate, stakeTime, userStake, stakingData.refetch]);

    // Sync with on-chain data when it refetches
    useEffect(() => {
        if (stakingData.pendingRewards !== null) {
            setLiveRewards(Number(stakingData.pendingRewardsFormatted));
            lastUpdateTs.current = Date.now();
        }
    }, [stakingData.pendingRewardsFormatted]);

    // Live display values
    const displayedRewards = useMemo(() => {
        return liveRewards.toFixed(8);
    }, [liveRewards]);

    // Consolidate current stats with fallbacks
    const effectiveStats = useMemo(() => {
        const onChainStaked = parseFloat(stakingData.userStakedFormatted);
        const dbStaked = parseFloat(userStake?.stakedAmount || '0');
        const stakedAmount = onChainStaked > 0 ? stakingData.userStakedFormatted : (dbStaked > 0 ? dbStaked.toString() : '0');

        const currentEarningRate = earningRate > 0 ? earningRate : (userStake?.earningRate || 0);

        // Handle period calculation (Prioritize on-chain, fallback to DB, ultimate fallback 30 days)
        let period = rewardDurationSeconds;
        if (period <= 0) {
            const dbValue = userStake?.minStakingPeriod || userStake?.pool?.minStakingPeriod || '30 days';
            const dbPeriodRaw = String(dbValue);

            if (dbPeriodRaw.toLowerCase().includes('day')) {
                period = parseInt(dbPeriodRaw) * 86400;
            } else {
                const parsed = parseInt(dbPeriodRaw);
                // If the number is small (e.g. 30), assume it's days. If large (e.g. 2592000), it's seconds.
                period = parsed > 1000 ? parsed : (parsed > 0 ? parsed * 86400 : 2592000);
            }
        }

        return {
            stakedAmount,
            earningRate: currentEarningRate,
            period: period || 2592000,
            totalPeriodDays: Math.ceil((period || 2592000) / 86400)
        };
    }, [stakingData.userStakedFormatted, userStake, earningRate, rewardDurationSeconds]);

    const countdownStats = useMemo(() => {
        const period = effectiveStats.period;

        const d = Math.floor(timeStakedSeconds / 86400);
        const h = Math.floor((timeStakedSeconds % 86400) / 3600);
        const m = Math.floor((timeStakedSeconds % 3600) / 60);
        const s = timeStakedSeconds % 60;

        const timeUntilUnlock = Math.max(0, period - timeStakedSeconds);
        const ud = Math.floor(timeUntilUnlock / 86400);
        const uh = Math.floor((timeUntilUnlock % 86400) / 3600);
        const um = Math.floor((timeUntilUnlock % 3600) / 60);
        const us = timeUntilUnlock % 60;

        const progressPercent = Math.min(100, (timeStakedSeconds / Math.max(1, period)) * 100);

        return {
            timeStaked: { d, h, m, s },
            timeUntilUnlock: { d: ud, h: uh, m: um, s: us },
            progress: progressPercent,
            totalPeriodDays: effectiveStats.totalPeriodDays
        };
    }, [timeStakedSeconds, effectiveStats]);

    const {
        allowance: polledAllowance,
        startPolling,
        stopPolling
    } = useStakingAllowance(userStake?.pool.tokenAddress, userStake?.pool.poolContractAddress || undefined);

    const currentAllowance = polledAllowance > 0n ? polledAllowance : initialAllowance;
    const { isConnected: isWagmiConnected } = useAccount();
    const isConnected = !!activeAddress || isWagmiConnected;

    const needsApproval = useMemo(() => {
        if (activeTab !== 'Boost') {
            stopPolling();
            return false;
        }
        if (!amount || isNaN(parseFloat(amount))) return false;
        try {
            const amountWei = parseUnits(amount, 9);
            const isNeeded = (currentAllowance || 0n) < amountWei;
            if (isNeeded) startPolling(); else stopPolling();
            return isNeeded;
        } catch (e) { return false; }
    }, [amount, currentAllowance, activeTab, startPolling, stopPolling]);

    const handleKeyPress = (value: string) => {
        if (value === '.' && amount.includes('.')) return;
        const newAmount = amount.slice(0, selection.start) + value + amount.slice(selection.end);
        setAmount(newAmount);
        const newCursorPos = selection.start + 1;
        setSelection({ start: newCursorPos, end: newCursorPos });
    };

    const handleDelete = () => {
        if (selection.start === 0 && selection.end === 0) return;
        if (selection.start !== selection.end) {
            const newAmount = amount.slice(0, selection.start) + amount.slice(selection.end);
            setAmount(newAmount);
            setSelection({ start: selection.start, end: selection.start });
            return;
        }
        const newAmount = amount.slice(0, selection.start - 1) + amount.slice(selection.end);
        setAmount(newAmount);
        const newCursorPos = Math.max(0, selection.start - 1);
        setSelection({ start: newCursorPos, end: newCursorPos });
    };

    const handleMax = () => {
        const maxVal = activeTab === 'Boost' ? userTokenBalance : (stakingData.userStakedFormatted || '0');
        setAmount(maxVal);
        setSelection({ start: maxVal.length, end: maxVal.length });
    };

    const handleConfirm = async () => {
        if (!isConnected) { showToast('Connect Wallet: Please connect your wallet to continue.', 'error'); return; }
        if (!amount || parseFloat(amount) <= 0) { showToast('Invalid Amount: Please enter a valid amount.', 'error'); return; }
        try {
            if (activeTab === 'Boost') {
                if (needsApproval) {
                    await approve();
                    showToast('Token Approved! Proceeding to Boost...', 'pending');
                    setTimeout(async () => {
                        try { await stake(amount); setAmount(''); refetchStaking(); } catch (err) { }
                    }, 1000);
                } else {
                    await stake(amount); setAmount(''); refetchStaking();
                }
            } else {
                await unstake(amount); setAmount(''); refetchStaking();
            }
        } catch (error: any) {
            const errorMsg = error?.message || 'Transaction failed.';
            if (!errorMsg.includes('User rejected')) showToast(`Transaction Failed: ${errorMsg}`, 'error');
        }
    };

    const handleClaim = async (percentage: number = 100) => {
        try {
            await claimRewards(percentage);
            refetchStaking();
        } catch (error: any) {
            if (!error?.message?.includes('User rejected')) {
                showToast(`Claim failed: ${error?.message || 'Unknown error'}`, 'error');
            }
        }
    };

    const onClaimModalConfirm = async (percentage: number) => {
        setIsClaimModalVisible(false);
        await handleClaim(percentage);
    };

    const onUnstakeModalConfirm = async (percentage: number) => {
        setIsUnstakeModalVisible(false);
        const staked = parseFloat(stakingData.userStakedFormatted || '0');
        if (staked <= 0) return;
        const amt = (staked * (percentage / 100)).toString();
        try {
            await unstake(amt);
            setAmount('');
            refetchStaking();
        } catch (error: any) {
            if (!error?.message?.includes('User rejected')) {
                showToast(`Unstake failed: ${error?.message || 'Unknown error'}`, 'error');
            }
        }
    };

    const onUnstakeMaxWithHarvest = async () => {
        setIsUnstakeModalVisible(false);
        try {
            await maxUnstakeWithHarvest();
            setAmount('');
            refetchStaking();
        } catch (error: any) {
            if (!error?.message?.includes('User rejected')) {
                showToast(`Max unstake failed: ${error?.message || 'Unknown error'}`, 'error');
            }
        }
    };

    const renderCountdownBox = (value: number, label: string) => (
        <View style={styles.countdownBox}>
            <Text style={styles.countdownValue}>{value.toString().padStart(2, '0')}</Text>
            <Text style={styles.countdownLabel}>{label}</Text>
        </View>
    );

    if (isLoading && !userStake) {
        return <View style={[styles.container, { backgroundColor: '#000' }]}><TIWILoader /></View>;
    }

    return (
        <View style={[styles.container, { backgroundColor: '#000000' }]}>
            <CustomStatusBar />

            <View style={[styles.header, { paddingTop: top }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Image source={BackIcon} style={styles.icon} contentFit="contain" />
                </TouchableOpacity>

                <View style={styles.tokenHeader}>
                    <Image source={userStake?.pool.tokenLogo ? { uri: userStake.pool.tokenLogo } : TWCIcon} style={styles.tokenIcon} contentFit="cover" />
                    <View>
                        <Text style={styles.headerSymbol}>{symbol || 'TWC'}</Text>
                        <Text style={{ color: colors.mutedText, fontSize: 12 }}>{userStake?.pool.tokenName || 'TIWICAT'}</Text>
                    </View>
                </View>

                <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>Active</Text>
                </View>
                <TouchableOpacity><Ionicons name="chevron-up" size={24} color={colors.mutedText} /></TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
                {/* Main Action Section - Match Screenshot 3 */}
                <View style={styles.mainCard}>
                    <View style={styles.countdownHeader}>
                        <Ionicons name="time-outline" size={24} color="#C4F440" />
                        <Text style={styles.countdownTitle}>Staking Countdown</Text>
                    </View>

                    <Text style={styles.sectionLabel}>Time Staked</Text>
                    <View style={styles.countdownRow}>
                        {renderCountdownBox(countdownStats.timeStaked.d, 'DAYS')}
                        {renderCountdownBox(countdownStats.timeStaked.h, 'HRS')}
                        {renderCountdownBox(countdownStats.timeStaked.m, 'MIN')}
                        {renderCountdownBox(countdownStats.timeStaked.s, 'SEC')}
                    </View>

                    <Text style={styles.sectionLabel}>Time Until Unlock</Text>
                    <View style={styles.countdownRow}>
                        {renderCountdownBox(countdownStats.timeUntilUnlock.d, 'DAYS')}
                        {renderCountdownBox(countdownStats.timeUntilUnlock.h, 'HRS')}
                        {renderCountdownBox(countdownStats.timeUntilUnlock.m, 'MIN')}
                        {renderCountdownBox(countdownStats.timeUntilUnlock.s, 'SEC')}
                    </View>

                    <View style={styles.progressContainer}>
                        <View style={styles.progressTextRow}>
                            <Text style={styles.progressLabel}>Progress</Text>
                            <Text style={styles.progressValue}>
                                {countdownStats.progress.toFixed(1)}% of {countdownStats.totalPeriodDays} days
                            </Text>
                        </View>
                        <View style={styles.progressBarBg}>
                            <View style={[styles.progressBarFill, { width: `${countdownStats.progress}%` }]} />
                        </View>
                    </View>

                    {/* Stats Grid */}
                    <View style={styles.statsGrid}>
                        <View style={styles.gridItem}>
                            <View style={styles.gridLabelRow}>
                                <Ionicons name="link-outline" size={16} color="#C4F440" />
                                <Text style={styles.gridLabel}>Staked Amount</Text>
                            </View>
                            <Text style={styles.gridValue}>{formatCompactNumber(Number(effectiveStats.stakedAmount), { decimals: 2 })} <Text style={styles.gridSymbol}>{symbol}</Text></Text>
                        </View>
                        <View style={styles.gridItem}>
                            <View style={styles.gridLabelRow}>
                                <Ionicons name="trending-up-outline" size={16} color="#C4F440" />
                                <Text style={styles.gridLabel}>Pending Rewards</Text>
                            </View>
                            <Text style={styles.gridValue}>{displayedRewards} <Text style={styles.gridSymbol}>{symbol}</Text></Text>
                        </View>
                        <View style={styles.gridItem}>
                            <View style={styles.gridLabelRow}>
                                <Ionicons name="lock-closed-outline" size={16} color="#C4F440" />
                                <Text style={styles.gridLabel}>Reward Duration</Text>
                            </View>
                            <Text style={styles.gridValue}>{effectiveStats.totalPeriodDays} <Text style={styles.gridSymbol}>days</Text></Text>
                        </View>
                        <View style={styles.gridItem}>
                            <View style={styles.gridLabelRow}>
                                <Ionicons name="calendar-outline" size={16} color="#C4F440" />
                                <Text style={styles.gridLabel}>Started</Text>
                            </View>
                            <Text style={styles.gridValue}>
                                {stakeTime > 0
                                    ? new Date(stakeTime * 1000).toLocaleDateString()
                                    : (userStake?.createdAt ? new Date(userStake.createdAt).toLocaleDateString() : '...')
                                }
                            </Text>
                        </View>
                    </View>

                    {/* Rewards Summary (Accumulated / Claimed / Pending) */}
                    <RewardsSummaryPanel
                        pending={liveRewards}
                        totalClaimed={parseFloat(userStake?.totalClaimed || '0')}
                    />

                    {/* Earning Rate Banner */}
                    <View style={styles.earningRateBanner}>
                        <Text style={styles.earningRateLabel}>Earning Rate</Text>
                        <Text style={styles.earningRateValue}>+{effectiveStats.earningRate.toFixed(8)} {symbol}/sec</Text>
                    </View>

                    <View style={styles.actionButtonsRow}>
                        <TouchableOpacity
                            onPress={() => setIsClaimModalVisible(true)}
                            disabled={isTransactionPending || liveRewards <= 0}
                            style={[styles.claimButtonLarge, (isTransactionPending || liveRewards <= 0) && { opacity: 0.5 }]}
                        >
                            <Text style={styles.claimButtonTextLarge}>Claim</Text>
                            <Text style={styles.claimSubtext}>≈ {formatCompactNumber(liveRewards)} {symbol}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setIsUnstakeModalVisible(true)}
                            disabled={isTransactionPending || parseFloat(stakingData.userStakedFormatted || '0') <= 0}
                            style={[styles.unstakeButtonOutline, { borderColor: '#C4F440' }, (isTransactionPending || parseFloat(stakingData.userStakedFormatted || '0') <= 0) && { opacity: 0.5 }]}
                        >
                            <Text style={styles.unstakeButtonTextHeadline}>Unstake</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Tabs */}
                <View style={styles.tabsContainer}>
                    <TouchableOpacity onPress={() => setActiveTab('Boost')} style={styles.tab}>
                        <Text style={[styles.tabText, activeTab === 'Boost' ? styles.tabTextActive : styles.tabTextInactive]}>Add Stake</Text>
                        {activeTab === 'Boost' && <View style={styles.activeUnderline} />}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setActiveTab('Unstake')} style={styles.tab}>
                        <Text style={[styles.tabText, activeTab === 'Unstake' ? styles.tabTextActive : styles.tabTextInactive]}>Unstake</Text>
                        {activeTab === 'Unstake' && <View style={styles.activeUnderline} />}
                    </TouchableOpacity>
                </View>

                {/* Amount Section */}
                <View style={styles.amountSection}>
                    <View style={styles.amountInputContainer}>
                        <TextInput
                            ref={inputRef}
                            style={styles.inputField}
                            value={amount}
                            showSoftInputOnFocus={false}
                            onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                            selection={selection}
                            placeholder="0.000"
                            placeholderTextColor={colors.mutedText}
                        />
                        <TouchableOpacity onPress={handleMax} style={styles.maxButton}><Text style={styles.maxButtonText}>Max</Text></TouchableOpacity>
                    </View>

                    <View style={styles.accountRow}>
                        <TouchableOpacity style={styles.accountTrigger} onPress={() => setIsAccountModalVisible(true)}>
                            <Text style={styles.accountLabel}>{selectedAccount?.name || 'Account'}</Text>
                            <Image source={DropdownIcon} style={{ width: 16, height: 16 }} contentFit="contain" />
                        </TouchableOpacity>
                        <View style={styles.balanceContainer}>
                            <Text style={styles.balanceText}>{selectedAccount?.balance || userTokenBalance}</Text>
                            <TouchableOpacity onPress={() => setIsDepositModalVisible(true)}><AntDesign name="plus" size={16} color="#C4F440" /></TouchableOpacity>
                        </View>
                    </View>
                </View>

                <NumericKeypad onPress={handleKeyPress} onDelete={handleDelete} />
            </ScrollView>

            <View style={[styles.bottomBar, { paddingBottom: bottom + 12 }]}>
                <TouchableOpacity
                    onPress={handleConfirm}
                    disabled={isTransactionPending || !amount || parseFloat(amount) <= 0}
                    style={[styles.confirmButton, (isTransactionPending || !amount || parseFloat(amount) <= 0) && styles.confirmButtonDisabled]}
                >
                    {isTransactionPending ? <TIWILoader size={40} /> : <Text style={styles.confirmButtonText}>
                        {activeTab === 'Boost' ? (needsApproval ? 'Approve Token' : 'Add to Stake') : 'Unstake Now'}
                    </Text>}
                </TouchableOpacity>
            </View>

            <AccountSelectionModal
                visible={isAccountModalVisible}
                onClose={() => setIsAccountModalVisible(false)}
                onSelect={(account) => setSelectedAccountId(account.id)}
                accounts={availableAccounts}
                selectedAccountId={selectedAccountId}
                totalBalance={`${userTokenBalance} ${symbol}`}
            />

            <PercentageActionModal
                visible={isClaimModalVisible}
                onClose={() => setIsClaimModalVisible(false)}
                kind="claim"
                maxAmount={liveRewards}
                tokenSymbol={symbol || 'TWC'}
                isProcessing={isTransactionPending}
                onConfirm={onClaimModalConfirm}
            />

            <PercentageActionModal
                visible={isUnstakeModalVisible}
                onClose={() => setIsUnstakeModalVisible(false)}
                kind="unstake"
                maxAmount={parseFloat(stakingData.userStakedFormatted || '0')}
                tokenSymbol={symbol || 'TWC'}
                isProcessing={isTransactionPending}
                onConfirm={onUnstakeModalConfirm}
                onConfirmMaxWithHarvest={liveRewards > 0 ? onUnstakeMaxWithHarvest : undefined}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, gap: 12 },
    backButton: { width: 32, height: 32, justifyContent: 'center' },
    icon: { width: 20, height: 20 },
    tokenHeader: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    tokenIcon: { width: 40, height: 40, borderRadius: 20 },
    headerSymbol: { fontFamily: 'Manrope-Bold', fontSize: 18, color: '#FFF' },
    activeBadge: { backgroundColor: 'rgba(196, 244, 64, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
    activeBadgeText: { color: '#C4F440', fontSize: 12, fontFamily: 'Manrope-Bold' },
    scrollView: { flex: 1 },
    mainCard: { backgroundColor: '#0D0D0D', margin: 20, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#1A1A1A' },
    countdownHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
    countdownTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Manrope-Bold' },
    sectionLabel: { color: colors.mutedText, fontSize: 12, marginBottom: 12, marginTop: 8 },
    countdownRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    countdownBox: { flex: 1, backgroundColor: '#1A1A1A', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center' },
    countdownValue: { color: '#FFF', fontSize: 16, fontFamily: 'Manrope-Bold' },
    countdownLabel: { color: colors.mutedText, fontSize: 8, marginTop: 4 },
    progressContainer: { marginTop: 10, marginBottom: 20 },
    progressTextRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    progressLabel: { color: colors.mutedText, fontSize: 12 },
    progressValue: { color: colors.mutedText, fontSize: 12 },
    progressBarBg: { height: 6, backgroundColor: '#1A1A1A', borderRadius: 3, overflow: 'hidden' },
    progressBarFill: { height: '100%', backgroundColor: '#C4F440' },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
    gridItem: { width: '48.5%', backgroundColor: '#141414', borderRadius: 16, padding: 12, gap: 6 },
    gridLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    gridLabel: { color: colors.mutedText, fontSize: 10 },
    gridValue: { color: '#FFF', fontSize: 15, fontFamily: 'Manrope-Bold' },
    gridSymbol: { color: colors.mutedText, fontSize: 11 },
    earningRateBanner: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#141414', padding: 16, borderRadius: 12, marginTop: 16 },
    earningRateLabel: { color: colors.mutedText, fontSize: 14 },
    earningRateValue: { color: '#C4F440', fontSize: 14, fontFamily: 'Manrope-Bold' },
    actionButtonsRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
    claimButtonLarge: { flex: 1, backgroundColor: '#C4F440', height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
    claimButtonTextLarge: { color: '#000', fontSize: 18, fontFamily: 'Manrope-Bold' },
    claimSubtext: { color: '#000', fontSize: 10, opacity: 0.7 },
    unstakeButtonOutline: { flex: 1, height: 64, borderRadius: 32, borderWidth: 1, borderColor: '#333', alignItems: 'center', justifyContent: 'center' },
    unstakeButtonTextHeadline: { color: '#FFF', fontSize: 18, fontFamily: 'Manrope-Bold' },
    tabsContainer: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 10, gap: 24 },
    tab: { paddingVertical: 12 },
    tabText: { fontSize: 16, fontFamily: 'Manrope-Medium' },
    tabTextActive: { color: '#FFF' },
    tabTextInactive: { color: colors.mutedText },
    activeUnderline: { position: 'absolute', bottom: 0, width: '100%', height: 2, backgroundColor: '#C4F440' },
    amountSection: { paddingHorizontal: 20, marginTop: 20 },
    amountInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0D0D0D', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: '#1A1A1A' },
    inputField: { flex: 1, color: '#FFF', fontSize: 20, fontFamily: 'Manrope-Bold' },
    maxButton: { backgroundColor: '#C4F440', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    maxButtonText: { color: '#000', fontSize: 12, fontFamily: 'Manrope-Bold' },
    accountRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
    accountTrigger: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    accountLabel: { color: '#FFF', fontSize: 14 },
    balanceContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    balanceText: { color: '#FFF', fontSize: 14 },
    bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: '#000' },
    confirmButton: { height: 56, backgroundColor: '#C4F440', borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
    confirmButtonText: { color: '#000', fontSize: 16, fontFamily: 'Manrope-Bold' },
    confirmButtonDisabled: { opacity: 0.3 }
});

