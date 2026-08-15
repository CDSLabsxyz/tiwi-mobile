/**
 * Stake Pool Screen
 * Allows user to stake tokens in flexible or fixed pools
 * Matches Figma nodes: 3279:111935, 3279:112286, 3279:112020, 3279:112146
 */

import { DepositSelectionModal } from '@/components/sections/Earn/DepositSelectionModal';
import { SwapKeyboard } from '@/components/sections/Swap/SwapKeyboard';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { TIWILoader } from '@/components/ui/TIWILoader';
import { colors } from '@/constants/colors';
import { useMarketPrice } from '@/hooks/useMarketPrice';
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
import { isSameTokenAddress } from '@/utils/wallet';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { parseUnits } from 'viem';
import { useAccount } from 'wagmi';

// Icons
const BackIcon = require('../../../assets/swap/arrow-left-02.svg');
const AlertIcon = require('../../../assets/earn/alert-diamond.svg');

// Mock Token Icon
const TWCIcon = require('../../../assets/home/tiwicat.svg');

type StakeType = 'Flexible' | 'Fixed';
type AccountType = 'Account';
type TransactionStatus = 'idle' | 'approving' | 'staking' | 'success' | 'error';

const formatStakeAmount = (value: number): string => {
    if (!Number.isFinite(value) || value <= 0) return '0';
    const abs = Math.abs(value);
    if (abs >= 1000) return formatCompactNumber(value, { decimals: 2 });
    return value.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: abs < 1 ? 6 : 2,
    });
};

const formatStakeInputAmount = (value: number): string => {
    if (!Number.isFinite(value) || value <= 0) return '';
    return value.toLocaleString('en-US', {
        useGrouping: false,
        minimumFractionDigits: 0,
        maximumFractionDigits: 8,
    });
};

const stripTokenSuffix = (value: string, symbol: string): string => (
    value.replace(new RegExp(`\\s+${symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), '').trim()
);

const isZeroLimitLabel = (value?: string | null): boolean => (
    !!value && /^0(?:\.0+)?\s*-\s*0(?:\.0+)?(?:\s+\S+)?$/i.test(value.trim())
);

const parseStakeAmount = (value?: string | number | null): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (!value) return 0;
    const parsed = Number(value.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
};

export default function StakeScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const { symbol } = useLocalSearchParams<{ symbol: string }>();

    // Backup gate - checked at action-time (stake button press), not on page mount.
    const { requireBackup, BackupRequiredModal } = useRequireBackup();
    const [stakeType, setStakeType] = useState<StakeType>('Flexible');
    const [amount, setAmount] = useState('');
    const [selectedDuration, setSelectedDuration] = useState('30 Days');
    const [autoSubscribe, setAutoSubscribe] = useState(true);
    const [isDepositModalVisible, setIsDepositModalVisible] = useState(false);
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    const [selection, setSelection] = useState({ start: 0, end: 0 });
    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => {
        if (isKeyboardVisible) {
            // Delay to allow keyboard-open animation to layout, then scroll
            // so the input/account rows sit just above the keyboard.
            const t = setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 150);
            return () => clearTimeout(t);
        }
    }, [isKeyboardVisible]);

    const { walletGroups = [], activeAddress } = useWalletStore();
    const { data: balanceData } = useWalletBalances();
    const [pool, setPool] = useState<StakingPool | null>(null);
    const { showToast } = useToastStore();
    const [isLoading, setIsLoading] = useState(true);
    const [txStatus, setTxStatus] = useState<TransactionStatus>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    // Route param is a pool DB UUID for new links and a token symbol for old
    // ones - never display it directly. Always render the loaded pool's
    // tokenSymbol, falling back to the param only if it's not a UUID.
    const looksLikeUuid = !!symbol && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(symbol);
    const displaySymbol = pool?.tokenSymbol || (looksLikeUuid ? 'TWC' : symbol) || 'TWC';

    // Get user balance for the active wallet for this specific token.
    // Staking is scoped to the active wallet - no account selector / multi-
    // wallet balance fan-out. Use the resolved token symbol from the loaded
    // pool, since the route param itself is a UUID for new links.
    const selectedWalletToken = React.useMemo(() => {
        if (!balanceData?.tokens || !displaySymbol) return null;
        const poolTokenAddress = pool?.tokenAddress;
        const poolChainId = pool?.chainId;
        return poolTokenAddress && poolChainId
            ? balanceData.tokens.find(t =>
                Number(t.chainId) === Number(poolChainId) &&
                isSameTokenAddress(t.address, poolTokenAddress)
            )
            : balanceData.tokens.find(t => t.symbol.toLowerCase() === displaySymbol.toLowerCase());
    }, [balanceData, displaySymbol, pool?.chainId, pool?.tokenAddress]);
    const userTokenBalance = selectedWalletToken?.balanceFormatted || '0';

    useEffect(() => {
        const loadPool = async () => {
            if (symbol) {
                // The route param is now the pool's DB UUID (so Genesis 1 and
                // Genesis 2 don't collapse onto the same TWC entry). Old deep
                // links that pass a token symbol still work via fallback.
                const foundPool = await stakingService.getPoolByIdOrSymbol(symbol);
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
    // V2 pools are identified by their per-pool contract address; the DB UUID
    // is threaded through as the "poolId" so DB writes (user_stakes) still key
    // off the same pool row. Legacy pools still use the numeric on-chain id.
    const stakingIdentifier = pool?.poolContractAddress ? pool?.id : pool?.poolId;
    const stakingData = useStakingPool(stakingIdentifier, poolDecimals, {
        poolContractAddress: pool?.poolContractAddress,
    });
    const {
        allowance: initialAllowance,
        isLoading: isStakingLoading,
        isTransactionPending,
        approve,
        stake,
        refetch: refetchStaking
    } = stakingData;

    // High-frequency polling for the "Fast-Flow" button.
    // V2 pools: spender is the POOL contract (it calls transferFrom), not the
    // legacy factory. Passing the wrong spender here was the cause of silent
    // "execution reverted: 0x" on deposit - polled allowance reported a stale
    // factory approval, mobile skipped the approve step, and the token's
    // transferFrom reverted because the pool still had zero allowance.
    const stakingSpender = pool?.poolContractAddress || undefined;
    const {
        allowance: polledAllowance,
        startPolling,
        stopPolling
    } = useStakingAllowance(pool?.tokenAddress, stakingSpender);

    // Combine for best UX (initial from wagmi, then polled). Now that the
    // poller reads against the correct spender these two always agree.
    const currentAllowance = polledAllowance > 0n ? polledAllowance : initialAllowance;

    // Prefer the exact wallet row's token price. The TWC market pair is only a
    // fallback for legacy TWC pools; using it for CROSS/other tokens shows a
    // wrong USD value beside an otherwise-correct balance.
    const { data: priceData } = useMarketPrice('TWC-USDT', 56);
    const walletPriceUSD = parseFloat(selectedWalletToken?.priceUSD || '0') || 0;
    const priceUSD = walletPriceUSD || (displaySymbol.toUpperCase() === 'TWC' ? priceData?.priceUSD || 0 : 0);

    // The per-wallet cap is consumed by lifetime *deposits*, not current
    // balance - unstaking never frees headroom. Example: cap 50k, user
    // stakes 30k then unstakes 15k. userStaked=15k, but they've already
    // burned 30k of their 50k allowance, so remaining is 20k (not 35k).
    // `onChainTotalDeposited` sums the user's Deposit events for this pool;
    // we fall back to currentStaked (via max) if the reader hasn't populated
    // yet so we never over-report available headroom.
    const configuredMaxStake = Number(pool?.maxStakeAmount ?? 0);
    const adminMaxStake = Number.isFinite(configuredMaxStake) && configuredMaxStake > 0 ? configuredMaxStake : undefined;
    const userStakedNum = parseFloat(stakingData.userStakedFormatted || '0') || 0;
    const totalDepositedNum = parseFloat((stakingData as any).onChainTotalDepositedFormatted || '0') || 0;
    const consumedLimit = Math.max(userStakedNum, totalDepositedNum);
    const remainingStakeLimit = adminMaxStake !== undefined
        ? Math.max(0, adminMaxStake - consumedLimit)
        : undefined;
    const isAtWalletLimit = remainingStakeLimit !== undefined && remainingStakeLimit <= 0;

    const selectedBalanceNum = parseFloat(userTokenBalance) || 0;
    const maxInputAmount = Math.max(
        0,
        Math.min(
            selectedBalanceNum,
            remainingStakeLimit !== undefined ? remainingStakeLimit : Number.POSITIVE_INFINITY,
        ),
    );
    const balanceUsd = priceUSD > 0 ? selectedBalanceNum * priceUSD : 0;

    const { isConnected: isWagmiConnected } = useAccount();
    const isConnected = !!activeAddress || isWagmiConnected;
    const isStakePageReady = !!pool
        && !isLoading
        && !stakingData.isCoreLoading
        && !!stakingData.stakingToken
        && (!isConnected || !isStakingLoading);

    const needsApproval = React.useMemo(() => {
        if (!isStakePageReady) return false;
        if (!amount || isNaN(parseFloat(amount))) return false;
        try {
            const amountWei = parseUnits(amount, poolDecimals);
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
    }, [amount, currentAllowance, isStakePageReady, poolDecimals, startPolling, stopPolling]);

    const isOutOfRange = React.useMemo(() => {
        if (!amount || !pool) return false;
        const val = parseFloat(amount);
        const min = pool.minStakeAmount || 0;
        const max = remainingStakeLimit !== undefined ? remainingStakeLimit : (pool.maxStakeAmount || Infinity);
        return val < min || val > max || val > selectedBalanceNum;
    }, [amount, pool, remainingStakeLimit, selectedBalanceNum]);

    const limitsValue = React.useMemo(() => {
        const min = Number(pool?.minStakeAmount ?? 0);
        const max = Number(pool?.maxStakeAmount ?? 0);
        if (Number.isFinite(max) && max > 0) {
            return `${formatStakeAmount(Number.isFinite(min) ? min : 0)}-${formatStakeAmount(max)}`;
        }

        const dbLimits = pool?.displayLimits && pool.displayLimits !== 'N/A'
            ? stripTokenSuffix(stripTokenSuffix(pool.displayLimits, displaySymbol), 'TWC')
            : '';
        if (dbLimits && !isZeroLimitLabel(dbLimits)) return dbLimits;

        const hookLimits = stakingData.limitsFormatted && stakingData.limitsFormatted !== 'N/A'
            ? stripTokenSuffix(stripTokenSuffix(stakingData.limitsFormatted, displaySymbol), 'TWC')
            : '';
        if (hookLimits && !isZeroLimitLabel(hookLimits)) {
            return hookLimits;
        }

        return 'No limit';
    }, [pool?.minStakeAmount, pool?.maxStakeAmount, pool?.displayLimits, displaySymbol, stakingData.limitsFormatted]);
    const rangeLabel = limitsValue === 'No limit' ? limitsValue : `${limitsValue} ${displaySymbol}`;

    // Stats based on real pool data
    const stats = {
        tvl: `${stakingData.tvlCompact} / ${stakingData.maxTvlCompact}`,
        apr: stakingData.apr || pool?.displayApy || 'N/A',
        totalStaked: formatStakeAmount(parseStakeAmount((stakingData as any).tvl ?? stakingData.totalStakedFormatted)),
        // Fallback to pool object (database) if on-chain is N/A or empty
        lockPeriod: pool?.minStakingPeriod || 'No Lock',
        limits: limitsValue,
    };

    const handleConfirm = async () => {
        if (!isStakePageReady) {
            showToast('Pool data is still loading. Please wait a moment before approving or staking.', 'error');
            return;
        }

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
        const nextAmount = formatStakeInputAmount(maxInputAmount);
        setAmount(nextAmount);
        setSelection({ start: nextAmount.length, end: nextAmount.length });
    };

    const handleKeyPress = (value: string) => {
        if (value === 'CLEAR') {
            setAmount('');
            setSelection({ start: 0, end: 0 });
            return;
        }
        if (value === 'DELETE') {
            handleDelete();
            return;
        }

        if (value === '.' && amount.includes('.')) return;

        const newAmount =
            amount.slice(0, selection.start) +
            value +
            amount.slice(selection.end);

        setAmount(newAmount);
        const newPos = selection.start + value.length;
        setSelection({ start: newPos, end: newPos });
    };

    const handlePercentage = (percent: number) => {
        const targetAmount = (maxInputAmount * percent) / 100;
        const finalAmountString = formatStakeInputAmount(targetAmount);
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

    const hasValidAmountInput = !!amount && parseFloat(amount) > 0;
    const isActionDisabled = isTransactionPending
        || !hasValidAmountInput
        || !isStakePageReady
        || isOutOfRange
        || stakingData.isFull;
    const actionButtonLabel = !isStakePageReady && hasValidAmountInput
        ? 'Loading Pool'
        : stakingData.isFull
            ? 'Pool Full'
            : needsApproval
                ? 'Approve Token'
                : 'Stake Now';

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
                    <View style={styles.headerTitleColumn}>
                        <Text style={styles.headerSymbol} numberOfLines={1}>
                            {pool?.name || displaySymbol}
                        </Text>
                        {!!pool?.name && (
                            <Text style={styles.headerSubtitle} numberOfLines={1}>
                                {displaySymbol}
                            </Text>
                        )}
                    </View>
                </View>
                <View style={{ width: 24 }} />
            </View>

            <View style={{ flex: 1 }}>
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.scrollView}
                    contentContainerStyle={{ paddingBottom: isKeyboardVisible ? 460 : 40 }}
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
                                        <Text style={styles.statInfoLabel}>{displaySymbol}</Text>
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
                                        <Text style={styles.statInfoLabel}>{displaySymbol}</Text>
                                    </View>
                                    <View style={styles.gridDividerV} />
                                    <View style={styles.statItem}>
                                        <Text style={styles.statLabel}>Limits</Text>
                                        <Text style={styles.statValue}>{stats.limits}</Text>
                                        <Text style={styles.statInfoLabel}>{displaySymbol}</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>


                    {/* Amount Input Display */}
                    <View style={styles.amountSection}>
                        <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={() => setIsKeyboardVisible(true)}
                            style={[
                                styles.amountInputContainer,
                                isOutOfRange && amount.length > 0 && styles.amountInputError
                            ]}
                        >
                            <Text
                                style={[
                                    styles.largeInput,
                                    !amount && { color: colors.mutedText }
                                ]}
                                numberOfLines={1}
                            >
                                {amount || '0.000'}
                            </Text>
                            <TouchableOpacity onPress={handleMax} style={styles.maxButton}>
                                <Text style={styles.maxButtonText}>Max</Text>
                            </TouchableOpacity>
                        </TouchableOpacity>
                        <Text style={[
                            styles.rangeText,
                            isOutOfRange && amount.length > 0 && { color: '#FF4D4D' }
                        ]}>
                            Range: {rangeLabel}
                        </Text>
                    </View>

                    <View style={{ height: 24 }} />

                    {/* Wallet Balance */}
                    <View style={styles.accountSection}>
                        <View style={styles.walletInfo}>
                            <Text style={styles.availableBalanceLabel}>Available Balance</Text>
                            {activeAddress && (
                                <Text style={styles.walletAddressText} numberOfLines={1}>
                                    {`${activeAddress.slice(0, 6)}...${activeAddress.slice(-4)}`}
                                </Text>
                            )}
                        </View>
                        <View style={styles.balanceColumn}>
                            <View style={styles.balanceAction}>
                                <Text style={styles.balanceValue}>{formatCompactNumber(selectedBalanceNum, { decimals: 2 })} {displaySymbol}</Text>
                                <TouchableOpacity onPress={() => setIsDepositModalVisible(true)}>
                                    <AntDesign name="plus" size={16} color={colors.titleText} />
                                </TouchableOpacity>
                            </View>
                            {remainingStakeLimit !== undefined && (
                                <Text style={[styles.remainingLimitText, isAtWalletLimit && styles.remainingLimitTextError]}>
                                    {isAtWalletLimit
                                        ? 'Wallet Limit Reached'
                                        : `Remaining Limit: ${formatCompactNumber(remainingStakeLimit, { decimals: 2 })} ${displaySymbol}`}
                                </Text>
                            )}
                            {balanceUsd > 0 && (
                                <Text style={styles.balanceUsdText}>
                                    ${formatCompactNumber(balanceUsd, { decimals: 2 })}
                                </Text>
                            )}
                        </View>
                    </View>

                    <View style={{ height: 20 }} />

                </ScrollView>

                <SwapKeyboard
                    visible={isKeyboardVisible}
                    onClose={() => setIsKeyboardVisible(false)}
                    onKeyPress={handleKeyPress}
                    onPercentagePress={handlePercentage}
                    onMaxPress={handleMax}
                />
            </View>

            {/* Bottom Action Bar */}
            <View style={[styles.bottomBar, { paddingBottom: bottom + 12 }]}>
                <TouchableOpacity
                    onPress={handleConfirm}
                    disabled={isActionDisabled}
                    style={[
                        styles.confirmButton,
                        isActionDisabled && styles.confirmButtonDisabled
                    ]}
                    activeOpacity={0.9}
                >
                    {isTransactionPending ? (
                        <TIWILoader size={40} />
                    ) : (
                        <Text style={styles.confirmButtonText}>
                            {actionButtonLabel}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>

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
                symbol={displaySymbol}
                amount={amount}
                error={errorMsg}
                onClose={() => setTxStatus('idle')}
                onDone={() => {
                    setTxStatus('idle');
                    // Navigate to Earn page and switch to Active Positions tab
                    router.replace('/earn?tab=active');
                }}
            />

            {BackupRequiredModal}
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
            case 'approving': return 'The approval is being confirmed in your wallet.';
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
        flex: 1,
        minWidth: 0,
        marginHorizontal: 8,
    },
    tokenIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    headerTitleColumn: {
        flexShrink: 1,
        minWidth: 0,
    },
    headerSymbol: {
        fontFamily: 'Manrope-Bold',
        fontSize: 18,
        color: colors.titleText,
    },
    headerSubtitle: {
        fontFamily: 'Manrope-Regular',
        fontSize: 12,
        color: colors.mutedText,
        marginTop: 1,
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
        alignItems: 'flex-start',
        paddingHorizontal: 20,
        marginTop: 24,
        marginBottom: 10,
    },
    walletInfo: {
        gap: 2,
        flexShrink: 1,
    },
    availableBalanceLabel: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.titleText,
    },
    walletAddressText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.mutedText,
    },
    balanceColumn: {
        alignItems: 'flex-end',
        gap: 2,
    },
    remainingLimitText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.primaryCTA,
    },
    remainingLimitTextError: {
        color: '#FF4D4D',
    },
    balanceUsdText: {
        fontFamily: 'Manrope-Regular',
        fontSize: 12,
        color: colors.mutedText,
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
