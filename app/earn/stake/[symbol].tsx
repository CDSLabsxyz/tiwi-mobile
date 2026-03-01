/**
 * Stake Pool Screen
 * Allows user to stake tokens in flexible or fixed pools
 * Matches Figma nodes: 3279:111935, 3279:112286, 3279:112020, 3279:112146
 */

import { AccountSelectionModal } from '@/components/sections/Earn/AccountSelectionModal';
import { DepositSelectionModal } from '@/components/sections/Earn/DepositSelectionModal';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { NumericKeypad } from '@/components/ui/NumericKeypad';
import { colors } from '@/constants/colors';
import { useStakingAllowance } from '@/hooks/useStakingAllowance';
import { useStakingPool } from '@/hooks/useStakingPool';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { stakingService, type StakingPool } from '@/services/stakingService';
import { useWalletStore } from '@/store/walletStore';
import AntDesign from '@expo/vector-icons/AntDesign';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
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
const AlertIcon = require('../../../assets/earn/alert-diamond.svg');

// Mock Token Icon
const TWCIcon = require('../../../assets/home/tiwicat.svg');

type StakeType = 'Flexible' | 'Fixed';
type AccountType = 'Account';

export default function StakeScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const { symbol } = useLocalSearchParams<{ symbol: string }>();
    const [stakeType, setStakeType] = useState<StakeType>('Flexible');
    const [amount, setAmount] = useState('');
    const [selectedDuration, setSelectedDuration] = useState('30 Days');
    const [autoSubscribe, setAutoSubscribe] = useState(true);
    const [isAccountModalVisible, setIsAccountModalVisible] = useState(false);
    const [isDepositModalVisible, setIsDepositModalVisible] = useState(false);
    const [selection, setSelection] = useState({ start: 0, end: 0 });

    const { walletGroups = [], activeAddress } = useWalletStore();
    const { data: balanceData } = useWalletBalances();
    const [pool, setPool] = useState<StakingPool | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Get user balance for this specific token
    const userTokenBalance = React.useMemo(() => {
        if (!balanceData?.tokens || !symbol) return '0';
        const token = balanceData.tokens.find(t => t.symbol.toLowerCase() === symbol.toLowerCase());
        return token?.balanceFormatted || '0';
    }, [balanceData, symbol]);

    // Construct the dynamic list of accounts (Connected Wallets only)
    const availableAccounts = React.useMemo(() => {
        const list: any[] = [];

        // Add each connected wallet
        if (walletGroups && Array.isArray(walletGroups)) {
            walletGroups.forEach(wallet => {
                // Determine EVM address for this group
                const walletAddress = wallet.addresses?.EVM || wallet.addresses?.SOLANA || '';
                if (!walletAddress) return;

                const isMain = walletAddress.toLowerCase() === activeAddress?.toLowerCase();
                list.push({
                    id: walletAddress,
                    name: wallet.name || (isMain ? 'Main Wallet' : 'Imported Wallet'),
                    type: 'Wallet',
                    balance: `${isMain ? userTokenBalance : '0.00'} ${symbol}`,
                    address: walletAddress
                });
            });
        }

        return list;
    }, [walletGroups, activeAddress, userTokenBalance, symbol]);

    const [selectedAccountId, setSelectedAccountId] = useState<string>(activeAddress || '');
    const selectedAccount = React.useMemo(() =>
        availableAccounts.find(a => a.id === selectedAccountId) || availableAccounts[0]
        , [availableAccounts, selectedAccountId]);

    useEffect(() => {
        const loadPool = async () => {
            if (symbol) {
                const foundPool = await stakingService.getPoolBySymbol(symbol);
                if (foundPool) {
                    setPool(foundPool);
                }
                setIsLoading(false);
            }
        };
        loadPool();
    }, [symbol]);

    // On-Chain Read & Write
    const stakingData = useStakingPool(pool?.poolId);
    const {
        allowance: initialAllowance,
        isLoading: isStakingLoading,
        isTransactionPending,
        approve,
        stake,
        refetch: refetchStaking
    } = stakingData;

    // High-frequency polling for the "Fast-Flow" button
    const {
        allowance: polledAllowance,
        startPolling,
        stopPolling
    } = useStakingAllowance(pool?.tokenAddress);

    // Combine for best UX (initial from wagmi, then polled)
    const currentAllowance = polledAllowance > 0n ? polledAllowance : initialAllowance;

    const totalBalanceNumeric = React.useMemo(() => {
        const walletBal = parseFloat(userTokenBalance) || 0;
        const vaultBal = parseFloat(stakingData.userStakedFormatted || '0') || 0;
        return (walletBal + vaultBal).toString();
    }, [userTokenBalance, stakingData.userStakedFormatted]);

    const totalBalance = React.useMemo(() => {
        return `${parseFloat(totalBalanceNumeric).toFixed(4)} ${symbol}`;
    }, [totalBalanceNumeric, symbol]);

    const { isConnected: isWagmiConnected } = useAccount();
    const isConnected = !!activeAddress || isWagmiConnected;

    const needsApproval = React.useMemo(() => {
        if (!amount || isNaN(parseFloat(amount))) return false;
        try {
            const amountWei = parseUnits(amount, 9); // Use 9 decimals for TWC
            const isNeeded = (currentAllowance || 0n) < amountWei;

            // Start polling if we might need approval
            if (isNeeded) {
                startPolling();
            } else {
                stopPolling();
            }

            return isNeeded;
        } catch (e) {
            return false;
        }
    }, [amount, currentAllowance, startPolling, stopPolling]);

    const isOutOfRange = React.useMemo(() => {
        if (!amount || !pool) return false;
        const val = parseFloat(amount);
        const min = pool.minStakeAmount || 0;
        const max = pool.maxStakeAmount || Infinity;
        return val < min || val > max;
    }, [amount, pool]);

    // Stats based on real pool data
    const stats = {
        tvl: stakingData.tvlUsd || '$0.00',
        apr: stakingData.apr || pool?.displayApy || 'N/A',
        totalStaked: stakingData.totalStakedCompact || '0 TWC',
        lockPeriod: pool?.minStakingPeriod || stakingData.lockPeriod || 'N/A',
        limits: pool?.displayLimits || 'N/A',
    };

    const handleConfirm = async () => {
        if (!isConnected) {
            Alert.alert('Connect Wallet', 'Please connect your wallet to continue.');
            return;
        }

        if (!amount || parseFloat(amount) <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid amount to stake.');
            return;
        }

        try {
            if (needsApproval) {
                await approve();
                Alert.alert('Success', 'Token approved successfully!');
                refetchStaking();
            } else {
                await stake(amount);
                Alert.alert('Success', 'Staked successfully!', [
                    { text: 'OK', onPress: () => router.back() }
                ]);
                refetchStaking();
            }
        } catch (error: any) {
            console.error('[StakeScreen] Transaction error:', error);
            const errorMsg = error?.message || 'Transaction failed. Please try again.';
            if (!errorMsg.includes('User rejected')) {
                Alert.alert('Transaction Failed', errorMsg);
            }
        }
    };

    const handleMax = () => {
        setAmount(totalBalanceNumeric);
        setSelection({ start: totalBalanceNumeric.length, end: totalBalanceNumeric.length });
    };

    const handleKeyPress = (value: string) => {
        if (value === '.') {
            if (amount.includes('.')) return;
        }

        const newAmount =
            amount.slice(0, selection.start) +
            value +
            amount.slice(selection.end);

        setAmount(newAmount);
        const newPos = selection.start + value.length;
        setSelection({ start: newPos, end: newPos });
    };

    const handleDelete = () => {
        if (selection.start === 0 && selection.end === 0) return;

        let newAmount = '';
        let newPos = 0;

        if (selection.start !== selection.end) {
            newAmount = amount.slice(0, selection.start) + amount.slice(selection.end);
            newPos = selection.start;
        } else {
            newAmount = amount.slice(0, selection.start - 1) + amount.slice(selection.end);
            newPos = Math.max(0, selection.start - 1);
        }

        setAmount(newAmount);
        setSelection({ start: newPos, end: newPos });
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
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
                    <Image source={pool?.tokenLogo ? { uri: pool.tokenLogo } : TWCIcon} style={styles.tokenIcon} contentFit="cover" />
                    <Text style={styles.headerSymbol}>{symbol || 'TWC'}</Text>
                </View>
                <View style={{ width: 24 }} />
            </View>

            <View style={{ flex: 1 }}>
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={{ paddingBottom: 40 }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Stats Card */}
                    <View style={styles.statsCardWrapper}>
                        <View style={styles.statsCard}>
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>TVL</Text>
                                <Text style={styles.statValue}>{stats.tvl}</Text>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>APR</Text>
                                <Text style={styles.statValue}>{stats.apr}</Text>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>Lock Period</Text>
                                <Text style={styles.statValue}>{stats.lockPeriod}</Text>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>Limits</Text>
                                <Text style={styles.statValue}>{stats.limits}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Type Selection Cards */}
                    <View style={styles.cardsContainer}>
                        <TouchableOpacity
                            onPress={() => setStakeType('Flexible')}
                            activeOpacity={0.8}
                            style={[
                                styles.typeCard,
                                stakeType === 'Flexible' && styles.typeCardActive
                            ]}
                        >
                            <View>
                                <Text style={[
                                    styles.typeCardLabel,
                                    stakeType === 'Flexible' ? styles.textActive : styles.textInactive
                                ]}>Flexible</Text>
                                <Text style={styles.lockInfoText}>No Lock</Text>
                            </View>
                            <Text style={[
                                styles.typeCardValue,
                                stakeType === 'Flexible' ? styles.textWhite : styles.textInactive
                            ]}>{pool?.displayApy || '5.30%'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setStakeType('Fixed')}
                            activeOpacity={0.8}
                            style={[
                                styles.typeCard,
                                stakeType === 'Fixed' && styles.typeCardActive
                            ]}
                        >
                            <View>
                                <Text style={[
                                    styles.typeCardLabel,
                                    stakeType === 'Fixed' ? styles.textActive : styles.textInactive
                                ]}>Fixed</Text>
                                <Text style={styles.lockInfoText}>{stats.lockPeriod}</Text>
                            </View>
                            <Text style={[
                                styles.typeCardValue,
                                stakeType === 'Fixed' ? styles.textWhite : styles.textInactive
                            ]}>{pool?.displayApy || '5.30%'}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Amount Input Display */}
                    <View style={styles.amountSection}>
                        <View style={[
                            styles.amountInputContainer,
                            isOutOfRange && amount.length > 0 && styles.amountInputError
                        ]}>
                            <TextInput
                                style={styles.largeInput}
                                value={amount}
                                placeholder="0.000"
                                placeholderTextColor={colors.mutedText}
                                showSoftInputOnFocus={false}
                                onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                                selection={selection}
                            />
                            <TouchableOpacity onPress={handleMax} style={styles.maxButton}>
                                <Text style={styles.maxButtonText}>Max</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={[
                            styles.rangeText,
                            isOutOfRange && amount.length > 0 && { color: '#FF4D4D' }
                        ]}>
                            Range: {stats.limits}
                        </Text>
                    </View>

                    <View style={{ height: 24 }} />

                    {/* Account Selection */}
                    <View style={styles.accountSection}>
                        <TouchableOpacity
                            style={styles.accountSelector}
                            onPress={() => setIsAccountModalVisible(true)}
                        >
                            <Text style={styles.accountSelectorLabel}>{selectedAccount?.name || 'Account'}</Text>
                            <Image source={DropdownIcon} style={styles.dropdownIcon} contentFit="contain" />
                        </TouchableOpacity>

                        <View style={styles.balanceAction}>
                            <Text style={styles.balanceValue}>{selectedAccount?.balance || userTokenBalance}</Text>
                            <TouchableOpacity onPress={() => setIsDepositModalVisible(true)}>
                                <AntDesign name="plus" size={16} color={colors.titleText} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={{ height: 30 }} />

                    {/* Numeric Keypad right after account selection */}
                    <NumericKeypad onPress={handleKeyPress} onDelete={handleDelete} />
                    <View style={{ height: 150 }} />

                </ScrollView>
            </View>

            {/* Bottom Action Bar */}
            <View style={[styles.bottomBar, { paddingBottom: bottom + 12 }]}>
                <TouchableOpacity
                    onPress={handleConfirm}
                    disabled={isTransactionPending || !amount || parseFloat(amount) <= 0 || isOutOfRange}
                    style={[
                        styles.confirmButton,
                        (isTransactionPending || !amount || parseFloat(amount) <= 0 || isOutOfRange) && styles.confirmButtonDisabled
                    ]}
                    activeOpacity={0.9}
                >
                    {isTransactionPending ? (
                        <TIWILoader size={40} />
                    ) : (
                        <Text style={styles.confirmButtonText}>
                            {needsApproval ? 'Approve Token' : 'Stake Now'}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Account Selection Modal */}
            <AccountSelectionModal
                visible={isAccountModalVisible}
                onClose={() => setIsAccountModalVisible(false)}
                onSelect={(account) => setSelectedAccountId(account.id)}
                accounts={availableAccounts}
                selectedAccountId={selectedAccountId}
                totalBalance={totalBalance}
            />

            {/* Deposit Selection Modal */}
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
    statsCardWrapper: {
        paddingHorizontal: 20,
        marginTop: 20,
    },
    statsCard: {
        flexDirection: 'row',
        backgroundColor: colors.bgSemi,
        borderWidth: 1,
        borderColor: '#273024',
        borderRadius: 12,
        paddingVertical: 12,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    statLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 10,
        color: colors.mutedText,
    },
    statValue: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 12,
        color: colors.titleText,
    },
    divider: {
        width: 1,
        height: '100%',
        backgroundColor: '#273024',
    },
    cardsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginTop: 24,
        gap: 16,
    },
    typeCard: {
        flex: 1,
        backgroundColor: colors.bgSemi,
        borderRadius: 16,
        padding: 16,
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    typeCardActive: {
        borderColor: colors.primaryCTA,
    },
    typeCardLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
    },
    typeCardValue: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 12,
    },
    lockInfoText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 10,
        color: colors.mutedText,
        marginTop: 2,
    },
    textActive: {
        color: colors.mutedText,
    },
    textInactive: {
        color: colors.mutedText,
    },
    textWhite: {
        color: colors.titleText,
    },
    amountSection: {
        marginTop: 24,
        paddingHorizontal: 20,
    },
    amountInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgSemi,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        paddingHorizontal: 14,
        borderRadius: 16,
        height: 64,
    },
    amountInputError: {
        borderColor: '#FF4D4D',
    },
    largeInput: {
        flex: 1,
        fontFamily: 'Manrope-Regular',
        fontSize: 16,
        color: colors.titleText,
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
        color: colors.bg,
    },
    rangeText: {
        fontFamily: 'Manrope-Regular',
        fontSize: 12,
        color: colors.mutedText,
        marginTop: 8,
        paddingHorizontal: 4,
    },
    accountSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginTop: 24,
        marginBottom: 10,
    },
    accountSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    accountSelectorLabel: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.titleText,
    },
    dropdownIcon: {
        width: 16,
        height: 16,
    },
    balanceAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    balanceValue: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.bg,
        paddingHorizontal: 20,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: colors.bgStroke,
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
        color: colors.bg,
    },
    confirmButtonDisabled: {
        opacity: 0.6,
        backgroundColor: colors.bgStroke,
    },
});
