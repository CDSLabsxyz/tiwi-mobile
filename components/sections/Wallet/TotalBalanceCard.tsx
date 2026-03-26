/**
 * Total Balance Card Component
 * Displays total balance with visibility toggle and portfolio change
 * Converted from Tailwind to StyleSheet
 */

import { colors } from '@/constants/colors';
import AntDesign from '@expo/vector-icons/AntDesign';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { TokenPrice } from '@/components/ui/TokenPrice';
import { usePrice, useTranslation } from '@/hooks/useLocalization';

const ViewIcon = require('../../../assets/wallet/view.svg');

interface TotalBalanceCardProps {
    totalBalance: string;
    portfolioChange: {
        amount: string;
        percent: string;
        period: string;
    };
    isBalanceVisible: boolean;
    onToggleVisibility: () => void;
    onTodayPress?: () => void;
}

/**
 * Total Balance Card - Shows balance, change, and visibility toggle
 */
export const TotalBalanceCard: React.FC<TotalBalanceCardProps> = ({
    totalBalance,
    portfolioChange,
    isBalanceVisible,
    onToggleVisibility,
    onTodayPress,
}) => {
    const { t } = useTranslation();
    const formattedChangeAmount = usePrice(Math.abs(parseFloat(portfolioChange.amount)));

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                {/* Label + View Icon */}
                <View style={styles.labelRow}>
                    <Text style={styles.label}>
                        {t('home.total_balance')}
                    </Text>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={onToggleVisibility}
                        style={styles.viewIcon}
                    >
                        {isBalanceVisible ? <Image
                            source={ViewIcon}
                            style={styles.iconFull}
                            contentFit="contain"
                        /> : <AntDesign name="eye-invisible" size={16} color={colors.bodyText} />}
                    </TouchableOpacity>
                </View>

                {/* Balance Amount */}
                <View style={styles.balanceRow}>
                    {isBalanceVisible ? (
                        <TokenPrice
                            amount={totalBalance}
                            style={styles.balanceText}
                        />
                    ) : (
                        <Text style={styles.balanceText}>****</Text>
                    )}
                </View>

                {/* Portfolio Change */}
                <View style={styles.changeRow}>
                    {isBalanceVisible ? (
                        <>
                            <Text 
                                style={[
                                    styles.changeText,
                                    { color: parseFloat(portfolioChange.amount) < 0 ? '#FB406E' : '#B1F128' }
                                ]}
                            >
                                {parseFloat(portfolioChange.amount) >= 0 ? '+' : '-'}{formattedChangeAmount} ({parseFloat(portfolioChange.percent) >= 0 ? '+' : '-'}{Math.abs(parseFloat(portfolioChange.percent)).toFixed(2)}%)
                            </Text>
                            <TouchableOpacity activeOpacity={0.8} onPress={onTodayPress}>
                                <Text style={styles.periodText}>
                                    {portfolioChange.period}
                                </Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <Text style={styles.changeText}>****</Text>
                    )}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        borderRadius: 16,
        paddingHorizontal: 20,
        paddingVertical: 16,
        overflow: 'hidden',
        backgroundColor: 'transparent', // No background per Figma
    },
    content: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
    },
    label: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.bodyText,
    },
    viewIcon: {
        width: 18,
        height: 18,
    },
    balanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    balanceText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 32,
        color: colors.titleText,
        textAlign: 'center',
    },
    changeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    changeText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        lineHeight: 26,
        color: colors.primaryCTA, // Using primaryCTA for success color
    },
    periodText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        lineHeight: 22,
        color: '#9DA4AE',
        textDecorationLine: 'underline',
    },
    iconFull: {
        width: '100%',
        height: '100%',
    },
});
