/**
 * Manage Stake Screen (Active Position)
 * Allows user to Boost (add more) or Unstake (withdraw)
 * Matches Figma design: 3279:111289 (Boost) & 3279:111365 (Unstake)
 */

import { AccountSelectionModal } from '@/components/sections/Earn/AccountSelectionModal';
import { DepositSelectionModal } from '@/components/sections/Earn/DepositSelectionModal';
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
    StyleSheet,
    Text,
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

    const { connectedWallets, address: activeAddress } = useWalletStore();
    const { data: balanceData } = useWalletBalances();
    const [userStake, setUserStake] = useState<UserStake | null>(null);
    const { showToast } = useToastStore();
    const [isLoading, setIsLoading] = useState(true);
    const inputRef = useRef<TextInput>(null);

    // Get user balance for this specific token
    const userTokenBalance = useMemo(() => {
        if (!balanceData?.tokens || !symbol) return '0';
        const token = balanceData.tokens.find(t => t.symbol.toLowerCase() === symbol.toLowerCase());
        return token?.balanceFormatted || '0';
    }, [balanceData, symbol]);

    // Construct the dynamic list of accounts (Connected Wallets only)
    const availableAccounts = useMemo(() => {
        const list: any[] = [];

        // Add each connected wallet
        connectedWallets.forEach(wallet => {
            const isMain = wallet.address.toLowerCase() === activeAddress?.toLowerCase();
            list.push({
                id: wallet.address,
                name: wallet.name || (isMain ? 'Main Wallet' : 'Imported Wallet'),
                type: 'Wallet',
                balance: `${isMain ? userTokenBalance : '0.00'} ${symbol}`,
                address: wallet.address
            });
        });

        return list;
    }, [connectedWallets, activeAddress, userTokenBalance, symbol]);

    const [selectedAccountId, setSelectedAccountId] = useState<string>(activeAddress || '');
    const selectedAccount = useMemo(() =>
        availableAccounts.find(a => a.id === selectedAccountId) || availableAccounts[0]
        , [availableAccounts, selectedAccountId]);

    useEffect(() => {
        const loadStake = async () => {
            if (activeAddress && symbol) {
                const stake = await stakingService.getUserStakeBySymbol(activeAddress, symbol);
                if (stake) {
                    setUserStake(stake);
                }
                setIsLoading(false);
            }
        };
        loadStake();
    }, [activeAddress, symbol]);

    // On-Chain Read & Write
    const stakingData = useStakingPool(userStake?.pool.poolId);
    const {
        allowance: initialAllowance,
        isLoading: isStakingLoading,
        isTransactionPending,
        approve,
        stake,
        unstake,
        claimRewards,
        refetch: refetchStaking
    } = stakingData;

    // High-frequency polling for the "Fast-Flow" button (Boost tab only)
    const {
        allowance: polledAllowance,
        startPolling,
        stopPolling
    } = useStakingAllowance(userStake?.pool.tokenAddress);

    // Combine for best UX
    const currentAllowance = polledAllowance > 0n ? polledAllowance : initialAllowance;

    const totalBalanceNumeric = useMemo(() => {
        const walletBal = parseFloat(userTokenBalance) || 0;
        const vaultBal = parseFloat(stakingData.userStakedFormatted || '0') || 0;
        return (walletBal + vaultBal).toString();
    }, [userTokenBalance, stakingData.userStakedFormatted]);

    const totalBalance = useMemo(() => {
        const val = parseFloat(totalBalanceNumeric);
        return `${formatCompactNumber(val, { decimals: 2 })} ${symbol}`;
    }, [totalBalanceNumeric, symbol]);

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

            if (isNeeded) {
                startPolling();
            } else {
                stopPolling();
            }

            return isNeeded;
        } catch (e) {
            return false;
        }
    }, [amount, currentAllowance, activeTab, startPolling, stopPolling]);

    // Position Stats
    const positionStats = useMemo(() => {
        return {
            stakedAmount: stakingData.userStaked ? `${stakingData.userStakedFormatted} ${symbol}` : (userStake?.displayStakedAmount || '0 TWC'),
            lockPeriod: userStake?.lockPeriodDays ? `${userStake.lockPeriodDays} Days` : 'Flexible',
            rewardsEarned: stakingData.pendingRewards ? `${stakingData.pendingRewardsFormatted} ${symbol}` : (userStake?.displayRewardsEarned || '0 TWC'),
            apy: stakingData.apr || (userStake?.displayApy || 'N/A'),
            totalStaked: stakingData.totalStakedCompact || '...',
            hasRewards: (stakingData.pendingRewards || 0n) > 0n
        };
    }, [stakingData, userStake, symbol]);

    const handleSelectionChange = (
        event: NativeSyntheticEvent<TextInputSelectionChangeEventData>
    ) => {
        setSelection(event.nativeEvent.selection);
    };

    /**
     * Inserts text at the current cursor position.
     */
    const handleKeyPress = (value: string) => {
        if (value === '.') {
            if (amount.includes('.')) return;
        }

        const newAmount =
            amount.slice(0, selection.start) +
            value +
            amount.slice(selection.end);

        setAmount(newAmount);

        // Move cursor forward
        const newCursorPos = selection.start + 1;
        setSelection({ start: newCursorPos, end: newCursorPos });
    };

    const handleDelete = () => {
        if (selection.start === 0 && selection.end === 0) return;

        // If there is a range selected, delete the range
        if (selection.start !== selection.end) {
            const newAmount = amount.slice(0, selection.start) + amount.slice(selection.end);
            setAmount(newAmount);
            setSelection({ start: selection.start, end: selection.start });
            return;
        }

        // Delete character before cursor
        const newAmount = amount.slice(0, selection.start - 1) + amount.slice(selection.end);
        setAmount(newAmount);

        // Move cursor back
        const newCursorPos = Math.max(0, selection.start - 1);
        setSelection({ start: newCursorPos, end: newCursorPos });
    };

    const handleMax = () => {
        const maxVal = activeTab === 'Boost' ? totalBalanceNumeric : (stakingData.userStakedFormatted || '0');
        setAmount(maxVal);
        setSelection({ start: maxVal.length, end: maxVal.length });
    };

    const handleConfirm = async () => {
        if (!isConnected) {
            showToast('Connect Wallet: Please connect your wallet to continue.', 'error');
            return;
        }

        if (!amount || parseFloat(amount) <= 0) {
            showToast('Invalid Amount: Please enter a valid amount.', 'error');
            return;
        }

        try {
            if (activeTab === 'Boost') {
                if (needsApproval) {
                    // Phase 1: Approve
                    await approve();
                    showToast('Token Approved! Proceeding to Boost...', 'pending');
                    
                    // Phase 2: Action (Stake/Boost)
                    setTimeout(async () => {
                        try {
                            await stake(amount);
                            showToast('Successfully boosted stake!', 'success');
                            setAmount('');
                            refetchStaking();
                        } catch (err: any) {
                            console.error('[ManageStake] Chained boost error:', err);
                        }
                    }, 1000);
                } else {
                    await stake(amount);
                    showToast('Successfully boosted stake!', 'success');
                    setAmount('');
                    refetchStaking();
                }
            } else {
                await unstake(amount);
                showToast('Successfully unstaked tokens!', 'success');
                setAmount('');
                refetchStaking();
            }
        } catch (error: any) {
            console.error('[ManageStake] Transaction error:', error);
            const errorMsg = error?.message || 'Transaction failed. Please try again.';
            if (!errorMsg.includes('User rejected')) {
                showToast(`Transaction Failed: ${errorMsg}`, 'error');
            }
        }
    };

    const handleClaim = async () => {
        try {
            await claimRewards();
            Alert.alert('Success', 'Rewards claimed successfully!');
            refetchStaking();
        } catch (error: any) {
            console.error('[ManageStake] Claim error:', error);
            const errorMsg = error?.message || 'Claim failed.';
            if (!errorMsg.includes('User rejected')) {
                Alert.alert('Claim Failed', errorMsg);
            }
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: '#000000' }]}>
            <CustomStatusBar />

            {/* Header */}
            <View style={[styles.header, { paddingTop: top }]}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backButton}
                    activeOpacity={0.8}
                >
                    <Image source={BackIcon} style={styles.icon} contentFit="contain" />
                </TouchableOpacity>

                <View style={styles.tokenHeader}>
                    <Image source={userStake?.pool.tokenLogo ? { uri: userStake.pool.tokenLogo } : TWCIcon} style={styles.tokenIcon} contentFit="cover" />
                    <Text style={styles.headerSymbol}>{symbol || 'TWC'}</Text>
                </View>
                <View style={{ width: 24 }} />
            </View>

            <View style={{ flex: 1 }}>
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={{ paddingBottom: 150 }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Position Summary Card */}
                    <View style={styles.positionCardWrapper}>
                        <View style={styles.statsCard}>
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>Staked</Text>
                                <Text style={styles.statValue}>{positionStats.stakedAmount}</Text>
                            </View>
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>Lock Period</Text>
                                <Text style={styles.statValue}>{positionStats.lockPeriod}</Text>
                            </View>
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>Rewards</Text>
                                <Text style={styles.statValue}>{positionStats.rewardsEarned}</Text>
                                {positionStats.hasRewards && (
                                    <TouchableOpacity onPress={handleClaim} style={styles.claimButtonSmall}>
                                        <Text style={styles.claimButtonTextSmall}>Claim</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>APY</Text>
                                <Text style={styles.statValue}>{positionStats.apy}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Tabs (Boost / Unstake) */}
                    <View style={styles.tabsContainer}>
                        <TouchableOpacity
                            onPress={() => setActiveTab('Boost')}
                            style={styles.tab}
                        >
                            <Text style={[styles.tabText, activeTab === 'Boost' ? styles.tabTextActive : styles.tabTextInactive]}>Boost</Text>
                            {activeTab === 'Boost' && <View style={styles.activeUnderline} />}
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setActiveTab('Unstake')}
                            style={styles.tab}
                        >
                            <Text style={[styles.tabText, activeTab === 'Unstake' ? styles.tabTextActive : styles.tabTextInactive]}>Unstake</Text>
                            {activeTab === 'Unstake' && <View style={styles.activeUnderline} />}
                        </TouchableOpacity>
                    </View>

                    {/* Tab-specific content */}
                    {activeTab === 'Boost' && (
                        <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
                            {/* Info Banner */}
                            <View style={styles.infoBanner}>
                                <FontAwesome6 name="bolt" size={24} color="#498F00" style={{ marginRight: 8 }} />
                                <Text style={styles.infoBannerText}>
                                    Boost your earnings by extending your lock period or adding more tokens.
                                </Text>
                                <TouchableOpacity>
                                    <AntDesign name="close" size={16} color={colors.mutedText} />
                                </TouchableOpacity>
                            </View>

                            {/* Time Boost Dropdown */}
                            <TouchableOpacity style={styles.dropdownSelector} activeOpacity={0.8}>
                                <Text style={styles.dropdownLabel}>Time Boost</Text>
                                <Image source={DropdownIcon} style={{ width: 24, height: 24 }} contentFit="contain" />
                            </TouchableOpacity>

                            <Text style={[styles.dropdownLabel, { marginTop: 16, color: colors.mutedText }]}>
                                Add more tokens
                            </Text>
                        </View>
                    )}

                    {activeTab === 'Unstake' && (
                        <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
                            {/* Warning Banner for Unstake */}
                            <View style={styles.warningBanner}>
                                <Ionicons name="remove-circle-outline" size={16} color="#FF4D4D" style={{ marginRight: 8 }} />
                                <Text style={styles.warningBannerText}>
                                    Unstaking initiates a 30-day cooldown, though you can cancel at any point.
                                </Text>
                                <TouchableOpacity>
                                    <AntDesign name="close" size={16} color={colors.mutedText} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Amount Input Section */}
                    <View style={styles.amountSection}>
                        <View style={styles.amountInputContainer}>
                            <TextInput
                                ref={inputRef}
                                style={styles.inputField}
                                value={amount}
                                showSoftInputOnFocus={false}
                                onSelectionChange={handleSelectionChange}
                                selection={selection}
                                placeholder="0.000"
                                placeholderTextColor={colors.mutedText}
                                keyboardType="numeric"
                            />

                            {/* <Text style={styles.inputSuffix}>{symbol}</Text> */}

                            <TouchableOpacity onPress={handleMax} style={styles.maxButton}>
                                <Text style={styles.maxButtonText}>Max</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Account Selector Row below input */}
                        <View style={styles.accountRow}>
                            <TouchableOpacity
                                style={styles.accountTrigger}
                                onPress={() => setIsAccountModalVisible(true)}
                            >
                                <Text style={styles.accountLabel}>{selectedAccount?.name || 'Account'}</Text>
                                <Image source={DropdownIcon} style={{ width: 16, height: 16 }} contentFit="contain" />
                            </TouchableOpacity>

                            <View style={styles.balanceContainer}>
                                <Text style={styles.balanceText}>{selectedAccount?.balance || userTokenBalance}</Text>
                                <TouchableOpacity onPress={() => setIsDepositModalVisible(true)}>
                                    <AntDesign name="plus" size={16} color={colors.titleText} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    <View style={{ height: 30 }} />

                    {/* Numeric Keypad right after account selection */}
                    <NumericKeypad onPress={handleKeyPress} onDelete={handleDelete} />

                </ScrollView>
            </View>

            {/* Bottom Action Bar */}
            <View style={[styles.bottomBar, { paddingBottom: bottom + 12 }]}>
                <TouchableOpacity
                    onPress={handleConfirm}
                    disabled={isTransactionPending || !amount || parseFloat(amount) <= 0}
                    style={[
                        styles.confirmButton,
                        (isTransactionPending || !amount || parseFloat(amount) <= 0) && styles.confirmButtonDisabled
                    ]}
                    activeOpacity={0.9}
                >
                    {isTransactionPending ? (
                        <TIWILoader size={40} />
                    ) : (
                        <Text style={styles.confirmButtonText}>
                            {activeTab === 'Boost' ? (needsApproval ? 'Approve Token' : 'Boost Stake') : 'Unstake Now'}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>

            <AccountSelectionModal
                visible={isAccountModalVisible}
                onClose={() => setIsAccountModalVisible(false)}
                onSelect={(account) => setSelectedAccountId(account.id)}
                accounts={availableAccounts}
                selectedAccountId={selectedAccountId}
                totalBalance={totalBalance}
            />

            <DepositSelectionModal
                visible={isDepositModalVisible}
                onClose={() => setIsDepositModalVisible(false)}
                onSelect={(action) => {
                    setIsDepositModalVisible(false);
                    if (action === 'send') router.push('/send');
                    else if (action === 'swap') router.push('/swap');
                    else if (action === 'receive') router.push('/receive');
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    backButton: {
        width: 24,
        height: 24,
    },
    icon: {
        width: '100%',
        height: '100%',
    },
    tokenHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    tokenIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    headerSymbol: {
        fontFamily: 'Manrope-Bold',
        fontSize: 18,
        color: colors.titleText,
    },
    scrollView: {
        flex: 1,
    },
    positionCardWrapper: {
        paddingHorizontal: 20,
        marginTop: 20,
    },
    statsCard: {
        flexDirection: 'row',
        backgroundColor: '#0B0F0A',
        borderWidth: 1,
        borderColor: '#1E1E1E',
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 8,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    statLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 11,
        color: '#7C7C7C',
    },
    statValue: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 13,
        color: '#FFFFFF',
        textAlign: 'center',
    },
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginTop: 24,
        gap: 24,
    },
    tab: {
        paddingVertical: 8,
        alignItems: 'center',
    },
    tabText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
    },
    tabTextActive: {
        color: '#FFFFFF',
    },
    tabTextInactive: {
        color: '#7C7C7C',
    },
    activeUnderline: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        height: 2,
        backgroundColor: colors.primaryCTA,
    },
    infoBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: 'rgba(177, 241, 40, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(177, 241, 40, 0.2)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
    },
    infoBannerText: {
        flex: 1,
        fontFamily: 'Manrope-Regular',
        fontSize: 12,
        color: '#498F00',
        marginRight: 8,
        lineHeight: 18,
    },
    warningBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: 'rgba(255, 77, 77, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 77, 77, 0.2)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
    },
    warningBannerText: {
        flex: 1,
        fontFamily: 'Manrope-Regular',
        fontSize: 12,
        color: '#FF4D4D',
        marginRight: 8,
        lineHeight: 18,
    },
    dropdownSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#0B0F0A',
        borderRadius: 16,
        padding: 16,
        marginBottom: 8,
    },
    dropdownLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
    },
    amountSection: {
        marginTop: 12,
        paddingHorizontal: 20,
    },
    amountInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0B0F0A',
        borderWidth: 1,
        borderColor: '#1E1E1E',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 4,
        height: 64,
    },
    inputField: {
        flex: 1,
        fontFamily: 'Manrope-Regular',
        fontSize: 16,
        color: colors.titleText,
        height: '100%',
        padding: 0,
    },
    inputSuffix: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: colors.titleText,
        marginRight: 16,
        marginLeft: 8,
    },
    maxButton: {
        backgroundColor: colors.primaryCTA,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 100,
    },
    maxButtonText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: '#000000',
    },
    accountRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
    },
    accountTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    accountLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
    },
    balanceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    balanceText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
    },
    keypadContainer: {
        marginTop: 10,
        paddingBottom: 80,
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#000000',
        paddingHorizontal: 20,
        paddingTop: 16,
        borderTopWidth: 0,
    },
    confirmButton: {
        backgroundColor: colors.primaryCTA,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmButtonText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: '#000000',
    },
    confirmButtonDisabled: {
        opacity: 0.6,
        backgroundColor: colors.bgStroke,
    },
    claimButtonSmall: {
        backgroundColor: colors.primaryCTA,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        marginTop: 4,
    },
    claimButtonTextSmall: {
        fontFamily: 'Manrope-Bold',
        fontSize: 10,
        color: '#000000',
    },
});
