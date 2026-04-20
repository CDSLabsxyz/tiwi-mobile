import { colors } from '@/constants/colors';
import { useTranslation } from '@/hooks/useLocalization';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface QuickAction {
    id: string;
    label: string;
    icon: any;
    route: string;
}

/**
 * Quick Actions Section
 * Matches Figma design exactly
 */
export const QuickActionsSection: React.FC = () => {
    const router = useRouter();
    const { t } = useTranslation();

    const localizedActions = [
        { id: 'swap', label: t('nav.swap'), icon: require('../../../assets/home/exchange-01.svg'), route: '/swap' },
        { id: 'stake', label: t('home.stake'), icon: require('../../../assets/home/stake-1.svg'), route: '/earn' },
        // { id: 'pool', label: 'Pool', icon: require('../../../assets/home/coins-02-1.svg'), route: '/pool' },
        { id: 'history', label: 'History', icon: require('../../../assets/home/transaction-history.svg'), route: '/activities' },
        { id: 'settings', label: 'Settings', icon: require('../../../assets/home/settings-03.svg'), route: '/settings' },
        { id: 'more', label: 'More', icon: require('../../../assets/home/dashboard-square-edit.svg'), route: '/more' },
    ];

    return (
        <View style={styles.container}>
            {localizedActions.map((action) => (
                <TouchableOpacity
                    key={action.id}
                    onPress={() => router.push(action.route as any)}
                    style={styles.actionButton}
                    activeOpacity={0.7}
                >
                    <View style={styles.iconWrapper}>
                        <Image
                            source={action.icon}
                            style={styles.icon}
                            contentFit="contain"
                        />
                    </View>
                    <Text style={styles.label}>
                        {action.label}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: "100%",
    },
    actionButton: {
        alignItems: 'center',
        gap: 8,
    },
    iconWrapper: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        backgroundColor: colors.bgCards,
    },
    icon: {
        width: 24,
        height: 24,
    },
    label: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
        textAlign: 'center',
    },
});
