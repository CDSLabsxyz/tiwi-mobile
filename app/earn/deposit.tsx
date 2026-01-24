/**
 * Deposit Selection Screen
 * Matches Figma node: 3279:112146
 */

import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Icons
const BackIcon = require('../../assets/swap/arrow-left-02.svg');
const TWCIcon = require('../../assets/home/tiwicat.svg');
const DepositIcon = require('../../assets/home/navigation-03.svg');
const TransferIcon = require('../../assets/earn/exchange-01.svg');
const ReceiveIcon = require('../../assets/earn/download-04.svg');
const ArrowRightIcon = require('../../assets/earn/arrow-right-02.svg');

export default function DepositScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();

    // Stats (Mock data to match design)
    const stats = {
        tvl: '$1.4M',
        apr: '5.48%',
        totalStaked: '1.1M TWC',
        limits: '0.03-50 TWC',
    };

    const actions = [
        {
            id: 'deposit',
            title: 'Deposit',
            subtitle: 'Deposit crypto from external wallet',
            icon: DepositIcon,
            onPress: () => console.log('Deposit pressed'),
        },
        {
            id: 'transfer',
            title: 'Transfer',
            subtitle: 'Move crypto between accounts',
            icon: TransferIcon,
            onPress: () => console.log('Transfer pressed'),
        },
        {
            id: 'receive',
            title: 'Receive',
            subtitle: 'Move crypto between accounts',
            icon: ReceiveIcon,
            onPress: () => console.log('Receive pressed'),
        },
    ];

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
                        <Text style={styles.tokenTagText}>TWC</Text>
                    </View>
                </View>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
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

                {/* Actions List */}
                <View style={styles.actionsContainer}>
                    {actions.map((action) => (
                        <TouchableOpacity
                            key={action.id}
                            style={styles.actionCard}
                            activeOpacity={0.7}
                            onPress={action.onPress}
                        >
                            <View style={styles.actionLeft}>
                                <View style={styles.iconContainer}>
                                    <Image source={action.icon} style={styles.actionIcon} contentFit="contain" />
                                </View>
                                <View style={styles.textContainer}>
                                    <Text style={styles.actionTitle}>{action.title}</Text>
                                    <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
                                </View>
                            </View>
                            <Image source={ArrowRightIcon} style={styles.arrowIcon} contentFit="contain" />
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>

            {/* Bottom Button */}
            <View style={[styles.bottomBar, { paddingBottom: bottom + 12 }]}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.confirmButton}
                    activeOpacity={0.9}
                >
                    <Text style={styles.confirmButtonText}>Confirm</Text>
                </TouchableOpacity>
            </View>
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
    content: {
        paddingBottom: 100,
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
    actionsContainer: {
        marginTop: 24,
        paddingHorizontal: 20,
        gap: 12,
    },
    actionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.bgSemi,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    actionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        flex: 1,
    },
    iconContainer: {
        width: 53,
        height: 53,
        borderRadius: 26.5,
        backgroundColor: '#1E2818', // Slight tint for icon bg, checking design might be needed
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    actionIcon: {
        width: 24,
        height: 24,
        tintColor: colors.titleText, // Assuming icons need tint, or they are colored SVGs
    },
    textContainer: {
        flex: 1,
        gap: 4,
    },
    actionTitle: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.titleText,
    },
    actionSubtitle: {
        fontFamily: 'Manrope-Regular',
        fontSize: 12,
        color: colors.mutedText,
    },
    arrowIcon: {
        width: 24,
        height: 24,
        tintColor: colors.mutedText,
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
