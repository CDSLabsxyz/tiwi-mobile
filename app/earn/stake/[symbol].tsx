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
import AntDesign from '@expo/vector-icons/AntDesign';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
    const [accountType, setAccountType] = useState<AccountType>('Account');
    const [isAccountModalVisible, setIsAccountModalVisible] = useState(false);
    const [isDepositModalVisible, setIsDepositModalVisible] = useState(false);

    // Stats
    const stats = {
        tvl: '$1.4M',
        apr: '5.48%',
        totalStaked: '1.1M TWC',
        limits: '0.03-50 TWC',
    };

    const handleConfirm = () => {
        // Handle staking confirmation logic
        console.log('Staking confirmed:', {
            symbol,
            amount,
            stakeType,
            duration: stakeType === 'Fixed' ? selectedDuration : 'Flexible',
        });
        router.back();
    };

    const handleMax = () => {
        setAmount('50'); // Mock max balance
    };

    const handleKeyPress = (value: string) => {
        if (value === '.') {
            if (amount.includes('.')) return;
            setAmount(prev => prev ? prev + '.' : '0.');
            return;
        }
        setAmount(prev => {
            if (prev === '0') return value;
            return prev + value;
        });
    };

    const handleDelete = () => {
        setAmount(prev => prev.slice(0, -1));
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
                    <Image source={TWCIcon} style={styles.tokenIcon} contentFit="cover" />
                    <View style={styles.tokenTag}>
                        <Text style={styles.tokenTagText}>{symbol || 'TWC'}</Text>
                    </View>
                </View>
                <View style={{ width: 24 }} />
            </View>

            <View style={{ flex: 1 }}>
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={{ paddingBottom: 150 }} // Space for button
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
                                <Text style={styles.statLabel}>Total Staked</Text>
                                <Text style={styles.statValue}>{stats.totalStaked}</Text>
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
                            <Text style={[
                                styles.typeCardLabel,
                                stakeType === 'Flexible' ? styles.textActive : styles.textInactive
                            ]}>Flexible</Text>
                            <Text style={[
                                styles.typeCardValue,
                                stakeType === 'Flexible' ? styles.textWhite : styles.textInactive
                            ]}>5.30%</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setStakeType('Fixed')}
                            activeOpacity={0.8}
                            style={[
                                styles.typeCard,
                                stakeType === 'Fixed' && styles.typeCardActive
                            ]}
                        >
                            <Text style={[
                                styles.typeCardLabel,
                                stakeType === 'Fixed' ? styles.textActive : styles.textInactive
                            ]}>Fixed</Text>
                            <Text style={[
                                styles.typeCardValue,
                                stakeType === 'Fixed' ? styles.textWhite : styles.textInactive
                            ]}>5.30%</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Amount Input Display */}
                    <View style={styles.amountSection}>
                        <View style={styles.amountInputContainer}>
                            <Text style={[styles.largeInput, !amount && { color: colors.mutedText }]}>
                                {amount || '0.000'}
                            </Text>
                            <Text style={styles.inputSuffix}>TWC</Text>
                            <TouchableOpacity onPress={handleMax} style={styles.maxButton}>
                                <Text style={styles.maxButtonText}>Max</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.rangeText}>Range: 0.001 BTC - 50 BTC</Text>
                    </View>

                    {/* Est. APR / Tiers */}
                    <View style={styles.infoSection}>
                        <View style={styles.infoHeader}>
                            <Text style={styles.infoTitle}>Est. APR</Text>
                            <View style={styles.liveAprTag}>
                                {/* Icon placeholder */}
                                <Text style={styles.liveAprText}>Live APR</Text>
                            </View>
                        </View>

                        <View style={styles.tierRow}>
                            <Text style={styles.tierLabel}>Tier 1</Text>
                            <Text style={styles.tierCondition}>{'<='} 0.003 TWC</Text>
                            <Text style={styles.tierRate}>5.30%</Text>
                        </View>
                        <View style={styles.tierRow}>
                            <Text style={styles.tierLabel}>Tier 2</Text>
                            <Text style={styles.tierCondition}>Tier 2 {'>'} 0.03 TWC</Text>
                            <Text style={styles.tierRate}>0.30%</Text>
                        </View>
                    </View>

                    {/* Account Selection */}
                    <View style={styles.accountSection}>
                        <TouchableOpacity
                            style={styles.accountSelector}
                            onPress={() => setIsAccountModalVisible(true)}
                        >
                            <Text style={styles.accountSelectorLabel}>Account</Text>
                            <Image source={DropdownIcon} style={styles.dropdownIcon} contentFit="contain" />
                        </TouchableOpacity>

                        <View style={styles.balanceAction}>
                            <Text style={styles.balanceValue}>0.0053 TWC</Text>
                            <TouchableOpacity onPress={() => setIsDepositModalVisible(true)}>
                                <AntDesign name="plus" size={16} color={colors.titleText} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={{ height: 20 }} />

                    {/* Numeric Keypad */}
                    <NumericKeypad onPress={handleKeyPress} onDelete={handleDelete} />

                    <View style={{ height: 100 }} />
                </ScrollView>
            </View>

            {/* Bottom Action Bar */}
            <View style={[styles.bottomBar, { paddingBottom: bottom + 12 }]}>
                <TouchableOpacity
                    onPress={handleConfirm}
                    style={styles.confirmButton}
                    activeOpacity={0.9}
                >
                    <Text style={styles.confirmButtonText}>Stake Now</Text>
                </TouchableOpacity>
            </View>

            {/* Account Selection Modal */}
            <AccountSelectionModal
                visible={isAccountModalVisible}
                onClose={() => setIsAccountModalVisible(false)}
                onSelect={(account) => {
                    console.log('Selected account:', account);
                }}
            />

            {/* Deposit Selection Modal */}
            <DepositSelectionModal
                visible={isDepositModalVisible}
                onClose={() => setIsDepositModalVisible(false)}
                onSelect={(action) => {
                    console.log('Selected action:', action);
                    if (action === 'deposit') {
                        router.push('/earn/deposit');
                    }
                    setIsDepositModalVisible(false);
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
        alignItems: 'center',
        justifyContent: 'center',
    },
    tokenIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    tokenTag: {
        position: 'absolute',
        bottom: -4,
        backgroundColor: colors.bgSemi,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    tokenTagText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 10,
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
        height: 80,
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    typeCardActive: {
        borderColor: colors.primaryCTA,
    },
    typeCardLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
    },
    typeCardValue: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 20,
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
        borderRadius: 100, // Pill shape
        paddingHorizontal: 24,
        height: 72,
    },
    largeInput: {
        flex: 1,
        fontFamily: 'Manrope-Regular',
        fontSize: 32,
        color: colors.titleText,
    },
    inputSuffix: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: colors.mutedText,
        marginRight: 16,
        marginTop: 8,
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
    infoSection: {
        marginTop: 24,
        paddingHorizontal: 20,
        backgroundColor: colors.bgSemi,
        marginHorizontal: 20,
        borderRadius: 16,
        paddingVertical: 16,
    },
    infoHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    infoTitle: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.mutedText,
    },
    liveAprTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    liveAprText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
    },
    tierRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    tierLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.mutedText,
        width: 50,
    },
    tierCondition: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
        flex: 1,
    },
    tierRate: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
        textAlign: 'right',
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
});
