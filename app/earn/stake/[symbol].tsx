/**
 * Stake Pool Screen
 * Allows user to stake tokens in flexible or fixed pools
 * Matches Figma nodes: 3279:111935, 3279:112286, 3279:112020, 3279:112146
 */

import { AccountSelectionModal } from '@/components/sections/Earn/AccountSelectionModal';
import { DepositSelectionModal } from '@/components/sections/Earn/DepositSelectionModal';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { NumericKeypad } from '@/components/ui/NumericKeypad';
import { TIWILoader } from '@/components/ui/TIWILoader';
import { colors } from '@/constants/colors';
import { useStakingAllowance } from '@/hooks/useStakingAllowance';
import { useStakingPool } from '@/hooks/useStakingPool';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { stakingService, type StakingPool } from '@/services/stakingService';
import { useToastStore } from '@/store/useToastStore';
import { useWalletStore } from '@/store/walletStore';
import { formatCompactNumber } from '@/utils/formatting';
import AntDesign from '@expo/vector-icons/AntDesign';
import { Image } from 'expo-image';
import { useRequireBackup } from '@/hooks/useRequireBackup';
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
type TransactionStatus = 'idle' | 'approving' | 'staking' | 'success' | 'error';

export default function StakeScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const { symbol } = useLocalSearchParams<{ symbol: string }>();

    // Backup gate — checked at action-time (stake button press), not on page mount.
    const { requireBackup, BackupRequiredModal } = useRequireBackup();
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
    const { showToast } = useToastStore();
    const [isLoading, setIsLoading] = useState(true);
    const [txStatus, setTxStatus] = useState<TransactionStatus>('idle');
    const [errorMsg, setErrorMsg] = useState('');

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
                    balance: `${formatCompactNumber(parseFloat(isMain ? userTokenBalance : '0'), { decimals: 2 })} ${symbol}`,
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
    const poolDecimals = pool?.decimals || 9;
    const stakingData = useStakingPool(pool?.poolId, poolDecimals);
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
        return `${formatCompactNumber(parseFloat(totalBalanceNumeric), { decimals: 2 })} ${symbol}`;
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
        tvl: `${stakingData.tvlCompact} / ${stakingData.maxTvlCompact}`,
        apr: stakingData.apr || pool?.displayApy || 'N/A',
        totalStaked: stakingData.totalStakedCompact || '0 TWC',
        // Fallback to pool object (database) if on-chain is N/A or empty
        lockPeriod: stakingData.lockPeriod && stakingData.lockPeriod !== 'N/A' && stakingData.lockPeriod !== 'No Lock'
            ? stakingData.lockPeriod
            : (pool?.minStakingPeriod || 'No Lock'),
        limits: stakingData.limitsFormatted && stakingData.limitsFormatted !== 'N/A' && stakingData.limitsFormatted !== '0-0 TWC'
            ? stakingData.limitsFormatted
            : (pool?.displayLimits || 'N/A'),
    };

    const handleConfirm = async () => {
        if (!requireBackup()) return;

        if (!isConnected) {
            showToast('Connect Wallet: Please connect your wallet to continue.', 'error');
            return;
        }

        if (!amount || parseFloat(amount) <= 0) {
            showToast('Invalid Amount: Please enter a valid amount to stake.', 'error');
            return;
        }

        try {
            if (needsApproval) {
                setTxStatus('approving');
                // Phase 1: Approve
                await approve();

                // Phase 2: Action (Stake) 
                setTxStatus('staking');
                // We add a tiny delay for state to settle
                setTimeout(async () => {
                    try {
                        await stake(amount);
                        setTxStatus('success');
                        refetchStaking();
                    } catch (err: any) {
                        console.error('[StakeScreen] Chained stake error:', err);
                        setErrorMsg(err?.message || 'Stake failed');
                        setTxStatus('error');
                    }
                }, 1500);
            } else {
                setTxStatus('staking');
                await stake(amount);
                setTxStatus('success');
                refetchStaking();
            }
        } catch (error: any) {
            console.error('[StakeScreen] Transaction error:', error);
            const msg = error?.message || 'Transaction failed. Please try again.';
            if (!msg.includes('User rejected')) {
                setErrorMsg(msg);
                setTxStatus('error');
            } else {
                setTxStatus('idle');
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

    const handlePercentage = (percent: number) => {
        // Base calculation on the pool's max limit as requested
        const maxLimit = pool?.maxStakeAmount || 0;
        const balance = parseFloat(userTokenBalance) || 0;

        let targetAmount = 0;
        if (maxLimit > 0) {
            // "100% is 50k, 50% is 25k" implies calculation from max limit
            targetAmount = (maxLimit * percent) / 100;

            // Safety: Don't suggest more than the user actually has
            if (targetAmount > balance) {
                targetAmount = balance;
            }
        } else {
            // Fallback to balance if no limit defined
            targetAmount = (balance * percent) / 100;
        }

        // Format to avoid long decimals if calculation results in them
        const finalAmountString = targetAmount % 1 === 0 ? targetAmount.toString() : targetAmount.toFixed(2);
        setAmount(finalAmountString);
        setSelection({ start: finalAmountString.length, end: finalAmountString.length });
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
                    {/* Stats Card (MATCHING WEB 2x2 GRID) */}
                    <View style={styles.statsCardWrapper}>
                        <View style={styles.statsCard}>
                            <View style={styles.statsGrid}>
                                {/* Row 1 */}
                                <View style={styles.statsRow}>
                                    <View style={styles.statItem}>
                                        <Text style={styles.statLabel}>TVL</Text>
                                        <Text style={styles.statValue}>{stats.tvl}</Text>
                                        <Text style={styles.statInfoLabel}>{symbol}</Text>
                                    </View>
                                    <View style={styles.gridDividerV} />
                                    <View style={styles.statItem}>
                                        <Text style={styles.statLabel}>APR</Text>
                                        <View style={styles.rowValue}>
                                            <Text style={[styles.statValue, { color: colors.primaryCTA }]}>
                                                {stats.apr.replace('%', '')}
                                            </Text>
                                            <Text style={[styles.statInfoLabel, { marginLeft: 2 }]}>%</Text>
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.gridDividerH} />

                                {/* Row 2 */}
                                <View style={styles.statsRow}>
                                    <View style={styles.statItem}>
                                        <Text style={styles.statLabel}>Total Staked</Text>
                                        <Text style={styles.statValue}>{stats.totalStaked}</Text>
                                        <Text style={styles.statInfoLabel}>{symbol}</Text>
                                    </View>
                                    <View style={styles.gridDividerV} />
                                    <View style={styles.statItem}>
                                        <Text style={styles.statLabel}>Limits</Text>
                                        <Text style={styles.statValue}>{stats.limits}</Text>
                                        <Text style={styles.statInfoLabel}>{symbol}</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
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
                            <Text style={styles.balanceValue}>{formatCompactNumber(parseFloat(selectedAccount?.balance || userTokenBalance), { decimals: 2 })} {symbol}</Text>
                            <TouchableOpacity onPress={() => setIsDepositModalVisible(true)}>
                                <AntDesign name="plus" size={16} color={colors.titleText} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={{ height: 20 }} />

                    {/* Percentage Buttons Row */}
                    <View style={styles.percentageRow}>
                        {[25, 50, 75, 100].map((p) => (
                            <TouchableOpacity
                                key={p}
                                style={styles.percentageButton}
                                onPress={() => handlePercentage(p)}
                            >
                                <Text style={styles.percentageText}>{p}%</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={{ height: 10 }} />

                    {/* Numeric Keypad right after account selection */}
                    <NumericKeypad onPress={handleKeyPress} onDelete={handleDelete} />
                    <View style={{ height: 150 }} />

                </ScrollView>
            </View>

            {/* Bottom Action Bar */}
            <View style={[styles.bottomBar, { paddingBottom: bottom + 12 }]}>
                <TouchableOpacity
                    onPress={handleConfirm}
                    disabled={isTransactionPending || !amount || parseFloat(amount) <= 0 || isOutOfRange || stakingData.isFull}
                    style={[
                        styles.confirmButton,
                        (isTransactionPending || !amount || parseFloat(amount) <= 0 || isOutOfRange || stakingData.isFull) && styles.confirmButtonDisabled
                    ]}
                    activeOpacity={0.9}
                >
                    {isTransactionPending ? (
                        <TIWILoader size={40} />
                    ) : (
                        <Text style={styles.confirmButtonText}>
                            {stakingData.isFull ? 'Pool Full' : (needsApproval ? 'Approve Token' : 'Stake Now')}
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

            {/* Immersive Staking Processing Modal */}
            <StakeProcessingModal
                status={txStatus}
                symbol={symbol || 'TWC'}
                amount={amount}
                error={errorMsg}
                onClose={() => setTxStatus('idle')}
                onDone={() => {
                    setTxStatus('idle');
                    // Navigate to Earn page and switch to Active Positions tab
                    router.replace('/earn?tab=active');
                }}
            />
        </View>
    );
}

/**
 * Immersive Processing Modal for Staking
 */
const StakeProcessingModal = ({
    status,
    symbol,
    amount,
    error,
    onClose,
    onDone
}: {
    status: TransactionStatus;
    symbol: string;
    amount: string;
    error?: string;
    onClose: () => void;
    onDone: () => void;
}) => {
    if (status === 'idle') return null;

    const getStatusText = () => {
        switch (status) {
            case 'approving': return `Approving ${symbol} usage...`;
            case 'staking': return `Initiating stake of ${amount} ${symbol}...`;
            case 'success': return 'Stake successful!';
            case 'error': return 'Transaction Failed';
            default: return 'Processing...';
        }
    };

    const getSubText = () => {
        switch (status) {
            case 'approving': return 'Please confirm the approval in your wallet to proceed.';
            case 'staking': return 'Your transaction is being processed on the blockchain.';
            case 'success': return `Successfully staked ${amount} ${symbol} to the pool.`;
            case 'error': return error || 'Something went wrong during the transaction.';
            default: return '';
        }
    };

    return (
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                {status !== 'success' && status !== 'error' && (
                    <View style={styles.loaderContainer}>
                        <View style={styles.circularWrapper}>
                            <Image
                                source={require('../../../assets/GIF/loader_animation.gif')}
                                style={styles.loaderGif}
                                contentFit="cover"
                            />
                        </View>
                    </View>
                )}

                {status === 'success' && (
                    <View style={styles.successIconContainer}>
                        <AntDesign name="check-circle" size={80} color={colors.primaryCTA} />
                    </View>
                )}

                {status === 'error' && (
                    <View style={styles.successIconContainer}>
                        <AntDesign name="close-circle" size={80} color="#EF4444" />
                    </View>
                )}

                <Text style={styles.statusMainText}>{getStatusText()}</Text>
                <Text style={styles.statusSubText}>{getSubText()}</Text>

                <View style={styles.modalActions}>
                    {status === 'success' && (
                        <TouchableOpacity
                            style={styles.doneButton}
                            activeOpacity={0.8}
                            onPress={onDone}
                        >
                            <Text style={styles.doneButtonText}>Done</Text>
                        </TouchableOpacity>
                    )}

                    {(status === 'error') && (
                        <TouchableOpacity
                            style={[styles.doneButton, { backgroundColor: colors.bgSemi }]}
                            activeOpacity={0.8}
                            onPress={onClose}
                        >
                            <Text style={[styles.doneButtonText, { color: colors.titleText }]}>Close</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
            {BackupRequiredModal}
        </View>
    );
};

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
        backgroundColor: colors.bgSemi,
        borderWidth: 0.5,
        borderColor: '#273024',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 5,
    },
    statsGrid: {
        width: '100%',
    },
    statsRow: {
        flexDirection: 'row',
        width: '100%',
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
    },
    rowValue: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    statLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 10,
        color: colors.mutedText,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    statValue: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.titleText,
    },
    statInfoLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 10,
        color: colors.mutedText,
        marginTop: 2,
    },
    gridDividerV: {
        width: 0.5,
        height: '100%',
        backgroundColor: '#1f261e',
    },
    gridDividerH: {
        height: 0.5,
        width: '100%',
        backgroundColor: '#1f261e',
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
    percentageRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        gap: 12,
        marginBottom: 8,
    },
    percentageButton: {
        flex: 1,
        height: 36,
        backgroundColor: colors.bgSemi,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    percentageText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 13,
        color: colors.mutedText,
    },
    // Modal Styles
    modalOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(5, 10, 5, 0.95)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
    },
    modalContent: {
        width: '85%',
        alignItems: 'center',
        padding: 30,
    },
    loaderContainer: {
        marginBottom: 30,
    },
    circularWrapper: {
        width: 140,
        height: 140,
        borderRadius: 70,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: colors.primaryCTA,
        backgroundColor: colors.bgSemi,
    },
    loaderGif: {
        width: '100%',
        height: '100%',
    },
    successIconContainer: {
        marginBottom: 30,
    },
    statusMainText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 22,
        color: colors.titleText,
        textAlign: 'center',
        marginBottom: 12,
    },
    statusSubText: {
        fontFamily: 'Manrope-Regular',
        fontSize: 14,
        color: colors.mutedText,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 40,
    },
    modalActions: {
        width: '100%',
    },
    doneButton: {
        backgroundColor: colors.primaryCTA,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    doneButtonText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
        color: colors.bg,
    },
});
